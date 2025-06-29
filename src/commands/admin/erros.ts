import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { ErrorLogger } from '@/utils/errorLogger';
import { injectable } from 'inversify';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class ErrosCommand implements IInjectableCommand {
  public name = 'erros';
  public description = 'Mostra os últimos erros registrados pelo bot';
  public category = 'admin' as const;
  public usage = '!erros [limpar]';
  public aliases = ['errors', 'logs'];

  public async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const groupJid = message.key.remoteJid!;
    const userJid = message.key.participant || '';
    
    if (!groupJid.endsWith('@g.us')) {
      await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
      return;
    }

    if (!await canUseCommand(sock, groupJid, userJid, 'admin')) {
      await sock.sendMessage(groupJid, { text: 'Apenas admins podem usar este comando.' });
      return;
    }

    try {
      if (args.length > 0 && args[0].toLowerCase() === 'limpar') {
        await ErrorLogger.clearLogs();
        await sock.sendMessage(groupJid, { 
          text: '✅ *Logs de erro limpos com sucesso!*\n\n🗑️ Todos os erros foram removidos do arquivo de log.' 
        });
        return;
      }

      const errors = await ErrorLogger.getRecentErrors(10);
      
      if (errors.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: '✅ *Nenhum erro registrado!*\n\n🎉 O bot está funcionando perfeitamente sem erros.' 
        });
        return;
      }

      let message = `📋 *Últimos ${errors.length} Erros Registrados:*\n\n`;
      
      errors.forEach((error, index) => {
        const timestamp = new Date(error.timestamp).toLocaleString('pt-BR');
        const action = error.context?.action || 'N/A';
        const jid = error.context?.jid ? error.context.jid.split('@')[0] : 'N/A';
        const userId = error.context?.userId ? error.context.userId.split('@')[0] : 'N/A';
        
        message += `*${index + 1}. ${timestamp}*\n`;
        message += `🔧 Ação: ${action}\n`;
        message += `👤 Usuário: ${userId}\n`;
        message += `📱 JID: ${jid}\n`;
        message += `❌ Erro: ${error.error.substring(0, 100)}${error.error.length > 100 ? '...' : ''}\n\n`;
      });

      message += `💡 *Comandos:*\n`;
      message += `• \`!erros\` - Mostra os últimos 10 erros\n`;
      message += `• \`!erros limpar\` - Limpa todos os logs de erro`;

      await sock.sendMessage(groupJid, { text: message });
    } catch (error) {
      console.error('Erro ao mostrar logs:', error);
      await sock.sendMessage(groupJid, { 
        text: '❌ Erro ao acessar os logs. Tente novamente mais tarde. Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧' 
      });
    }
  }
}

export default ErrosCommand; 