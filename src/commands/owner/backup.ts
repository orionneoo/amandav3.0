import { injectable, inject } from 'inversify';
import { WASocket } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { TYPES } from '@/config/container';
import { MessageContext } from '@/handlers/message.handler';

@injectable()
export class BackupCommand implements IInjectableCommand {
  public readonly name = 'backup';
  public readonly description = 'Cria backup dos dados locais';
  public readonly usage = '!backup';
  public readonly aliases = ['backup', 'dados'];
  public readonly category = 'owner';
  public readonly adminOnly = false;
  public readonly ownerOnly = true;

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    try {
      const senderJid = message.key.participant || message.key.remoteJid!;
      
      // Verificar se é o dono
      if (!this.isOwner(senderJid)) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Este comando é exclusivo do dono do bot!'
        });
        return;
      }

      await sock.sendMessage(message.key.remoteJid!, {
        text: '📦 Criando backup dos dados locais...'
      });

      // Criar backup
      const backupDir = await this.databaseService.createBackup();
      
      // Verificar status do MongoDB
      const mongoStatus = this.databaseService.isMongoConnected() ? '✅ Conectado' : '❌ Desconectado';
      
      // Sincronizar dados locais com MongoDB se possível
      let syncResult = { synced: 0, errors: 0 };
      if (this.databaseService.isMongoConnected()) {
        syncResult = await this.databaseService.syncLocalData();
      }

      let resultMessage = `📦 *BACKUP CRIADO COM SUCESSO!*\n\n` +
        `📁 Diretório: ${backupDir}\n` +
        `🗄️ MongoDB: ${mongoStatus}\n\n`;

      if (this.databaseService.isMongoConnected()) {
        resultMessage += `🔄 *SINCRONIZAÇÃO:*\n` +
          `✅ Sincronizados: ${syncResult.synced} arquivos\n` +
          `❌ Erros: ${syncResult.errors} arquivos\n\n`;
      }

      resultMessage += `💡 *INSTRUÇÕES:*\n` +
        `1. Acesse o servidor onde o bot está rodando\n` +
        `2. Navegue até o diretório: ${backupDir}\n` +
        `3. Faça download dos arquivos .json\n` +
        `4. Mantenha em local seguro como backup\n\n` +
        `🔒 Os dados contêm informações sensíveis dos grupos!`;

      await sock.sendMessage(message.key.remoteJid!, { text: resultMessage });

    } catch (error) {
      console.error('[ERROR] Erro no comando backup:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao criar backup. Verifique os logs do servidor.'
      });
    }
  }

  private isOwner(participant: string): boolean {
    const ownerNumbers = [
      '5521967233931@s.whatsapp.net',
      '5521971200821@s.whatsapp.net'
    ];
    return ownerNumbers.includes(participant);
  }
} 