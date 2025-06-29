import { injectable, inject } from 'inversify';
import { WASocket } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { TYPES } from '@/config/container';
import * as fs from 'fs/promises';
import * as path from 'path';

type WAMessage = any;

@injectable()
export class RestoreCommand implements IInjectableCommand {
  public readonly name = 'restore';
  public readonly description = 'Restaura dados de um backup';
  public readonly usage = '!restore [backup] [--confirm]';
  public readonly aliases = ['restaurar', 'recuperar'];
  public readonly category = 'owner';
  public readonly adminOnly = false;
  public readonly ownerOnly = true;

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {}

  public async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const senderJid = message.key.participant || message.key.remoteJid!;
      
      // Verificar se é o dono
      if (!this.isOwner(senderJid)) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Este comando é exclusivo do dono do bot!'
        });
        return;
      }

      // Verificar se o banco está offline
      if (this.databaseService.isMongoConnected()) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '⚠️ *ATENÇÃO:* MongoDB está conectado!\n\n' +
                'A restauração pode sobrescrever dados ativos.\n' +
                'Recomendamos fazer backup antes de continuar.'
        });
        return;
      }

      // Processar argumentos
      const restoreOptions = this.parseArgs(args);

      if (restoreOptions.list) {
        await this.listBackups(sock, message);
        return;
      }

      if (!restoreOptions.backup) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ *Backup não especificado!*\n\n' +
                '💡 *Exemplos:*\n' +
                '• `!restore` (lista backups)\n' +
                '• `!restore backup_2025-01-28`\n' +
                '• `!restore backup_2025-01-28 --confirm`\n' +
                '• `!restore ultimo` (último backup)'
        });
        return;
      }

      if (!restoreOptions.confirm) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `⚠️ *CONFIRMAÇÃO NECESSÁRIA*\n\n` +
                `Você está prestes a restaurar o backup:\n` +
                `📁 ${restoreOptions.backup}\n\n` +
                `⚠️ *ATENÇÃO:* Esta operação irá:\n` +
                `• Sobrescrever dados atuais\n` +
                `• Restaurar mensagens e configurações\n` +
                `• Pode afetar o funcionamento do bot\n\n` +
                `Para confirmar, use:\n` +
                `\`!restore ${restoreOptions.backup} --confirm\``
        });
        return;
      }

      await sock.sendMessage(message.key.remoteJid!, {
        text: '🔄 Iniciando restauração...'
      });

      // Executar restauração
      const result = await this.restoreBackup(restoreOptions.backup);

      if (result.success) {
        let resultMessage = `✅ *RESTAURAÇÃO CONCLUÍDA!*\n\n` +
          `📁 Backup: ${restoreOptions.backup}\n` +
          `📊 Arquivos restaurados: ${result.restoredFiles}\n` +
          `📈 Tamanho total: ${result.totalSize}MB\n\n`;

        if (result.errors > 0) {
          resultMessage += `⚠️ *AVISOS:*\n` +
            `• ${result.errors} arquivos com erro\n` +
            `• Verifique os logs para detalhes\n\n`;
        }

        resultMessage += `🔄 *PRÓXIMOS PASSOS:*\n` +
          `1. Reinicie o bot para aplicar mudanças\n` +
          `2. Verifique se os dados foram restaurados\n` +
          `3. Teste os comandos principais\n\n` +
          `💡 Use \`!dono status\` para verificar o status`;

        await sock.sendMessage(message.key.remoteJid!, { text: resultMessage });
      } else {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `❌ *ERRO NA RESTAURAÇÃO*\n\n` +
                `📁 Backup: ${restoreOptions.backup}\n` +
                `❌ Erro: ${result.error}\n\n` +
                `💡 Verifique:\n` +
                `• Se o backup existe\n` +
                `• Se há permissões de leitura\n` +
                `• Se o formato está correto`
        });
      }

    } catch (error) {
      console.error('[ERROR] Erro no comando restore:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao restaurar backup. Verifique os logs do servidor.'
      });
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      list: false,
      backup: null,
      confirm: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--list' || arg === 'listar') {
        options.list = true;
      } else if (arg === '--confirm') {
        options.confirm = true;
      } else if (arg === 'ultimo' || arg === 'last') {
        options.backup = 'ultimo';
      } else if (!options.backup) {
        options.backup = arg;
      }
    }

    return options;
  }

  private async listBackups(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      const backups = await this.getAvailableBackups();

      if (backups.length === 0) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Nenhum backup encontrado!\n\n' +
                '💡 Use `!backup` para criar um backup primeiro.'
        });
        return;
      }

      let listText = `📁 *BACKUPS DISPONÍVEIS*\n\n`;

      for (let i = 0; i < backups.length; i++) {
        const backup = backups[i];
        const sizeMB = (backup.size / (1024 * 1024)).toFixed(2);
        const date = new Date(backup.mtime).toLocaleDateString('pt-BR');
        
        listText += `${i + 1}. *${backup.name}*\n`;
        listText += `   📅 ${date}\n`;
        listText += `   📊 ${sizeMB}MB\n`;
        listText += `   📁 ${backup.files} arquivos\n\n`;
      }

      listText += `💡 *Para restaurar:*\n` +
        `• \`!restore ${backups[0].name}\`\n` +
        `• \`!restore ultimo\` (último backup)`;

      await sock.sendMessage(message.key.remoteJid!, { text: listText });

    } catch (error) {
      console.error('Erro ao listar backups:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao listar backups.'
      });
    }
  }

  private async getAvailableBackups(): Promise<any[]> {
    try {
      const backupDirs = await fs.readdir('.');
      const backups = [];

      for (const dir of backupDirs) {
        if (dir.startsWith('backup_') && dir.includes('-')) {
          try {
            const dirPath = path.join('.', dir);
            const stats = await fs.stat(dirPath);
            
            if (stats.isDirectory()) {
              const files = await fs.readdir(dirPath);
              backups.push({
                name: dir,
                size: stats.size,
                mtime: stats.mtime,
                files: files.length
              });
            }
          } catch (error) {
            // Ignorar diretórios com erro
          }
        }
      }

      // Ordenar por data (mais recente primeiro)
      return backups.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    } catch (error) {
      console.error('Erro ao buscar backups:', error);
      return [];
    }
  }

  private async restoreBackup(backupName: string): Promise<any> {
    try {
      let targetBackup = backupName;

      // Se for "ultimo", pegar o backup mais recente
      if (backupName === 'ultimo') {
        const backups = await this.getAvailableBackups();
        if (backups.length === 0) {
          return { success: false, error: 'Nenhum backup encontrado' };
        }
        targetBackup = backups[0].name;
      }

      const backupPath = path.join('.', targetBackup);
      
      // Verificar se o backup existe
      try {
        await fs.access(backupPath);
      } catch {
        return { success: false, error: `Backup ${targetBackup} não encontrado` };
      }

      const backupStats = await fs.stat(backupPath);
      if (!backupStats.isDirectory()) {
        return { success: false, error: `${targetBackup} não é um diretório válido` };
      }

      // Listar arquivos do backup
      const backupFiles = await this.getAllBackupFiles(backupPath);
      
      let restoredFiles = 0;
      let errors = 0;
      let totalSize = 0;

      // Restaurar cada arquivo
      for (const file of backupFiles) {
        try {
          const relativePath = path.relative(backupPath, file);
          const targetPath = path.join('local_history', relativePath);
          
          // Criar diretório de destino se não existir
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          
          // Copiar arquivo
          await fs.copyFile(file, targetPath);
          
          const fileStats = await fs.stat(file);
          totalSize += fileStats.size;
          restoredFiles++;
          
        } catch (error) {
          console.error(`Erro ao restaurar ${file}:`, error);
          errors++;
        }
      }

      return {
        success: true,
        restoredFiles,
        errors,
        totalSize: (totalSize / (1024 * 1024)).toFixed(2)
      };

    } catch (error) {
      console.error('Erro na restauração:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async getAllBackupFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          const subFiles = await this.getAllBackupFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Erro ao ler diretório ${dirPath}:`, error);
    }
    
    return files;
  }

  private isOwner(participant: string): boolean {
    const ownerNumbers = [
      '5521967233931@s.whatsapp.net',
      '5521971200821@s.whatsapp.net'
    ];
    return ownerNumbers.includes(participant);
  }
} 