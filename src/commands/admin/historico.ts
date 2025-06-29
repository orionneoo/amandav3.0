import { injectable, inject } from 'inversify';
import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { TYPES } from '@/config/container';
import { getUserDisplayName } from '@/utils/userUtils';
import { DatabaseStatus } from '@/utils/databaseStatus';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class HistoricoCommand implements IInjectableCommand {
  public readonly name = 'historico';
  public readonly description = 'Busca histórico de mensagens de dias anteriores';
  public readonly usage = '!historico [data] [usuario]';
  public readonly aliases = ['historico', 'history', 'mensagens'];
  public readonly category = 'admin';
  public readonly adminOnly = true;
  public readonly ownerOnly = false;

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args, from: groupJid, sender: senderJid, isGroup } = context;
    try {
      // Verificar se é grupo
      if (!isGroup) {
        await sock.sendMessage(groupJid, {
          text: '❌ Este comando só funciona em grupos!'
        });
        return;
      }

      // Verificar se é admin
      if (!await this.isAdmin(sock, groupJid, senderJid)) {
        await sock.sendMessage(groupJid, {
          text: '❌ Este comando é exclusivo para administradores!'
        });
        return;
      }

      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(groupJid, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Histórico')
        });
        return;
      }

      // Processar argumentos
      let targetDate: string;
      let targetUser: string | null = null;

      if (args.length === 0) {
        // Sem argumentos: histórico de hoje
        targetDate = new Date().toISOString().split('T')[0];
      } else if (args.length === 1) {
        // Um argumento: pode ser data ou usuário
        const arg = args[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
          // É uma data
          targetDate = arg;
        } else {
          // É um usuário (hoje)
          targetDate = new Date().toISOString().split('T')[0];
          targetUser = arg;
        }
      } else {
        // Dois argumentos: data e usuário
        const [dateArg, userArg] = args;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
          await sock.sendMessage(groupJid, {
            text: '❌ Formato de data inválido! Use: YYYY-MM-DD\n\nExemplos:\n!historico 2025-06-22\n!historico 2025-06-22 @usuario'
          });
          return;
        }
        targetDate = dateArg;
        targetUser = userArg;
      }

      await sock.sendMessage(groupJid, {
        text: '🔍 Buscando histórico de mensagens...'
      });

      // Buscar mensagens
      const messages = await this.databaseService.getMessagesOfDay(groupJid, targetDate);

      if (messages.length === 0) {
        await sock.sendMessage(groupJid, {
          text: `❌ Nenhuma mensagem encontrada para ${targetDate}`
        });
        return;
      }

      // Filtrar por usuário se especificado
      let filteredMessages = messages;
      if (targetUser) {
        const userJid = targetUser.includes('@') ? targetUser : `${targetUser}@s.whatsapp.net`;
        filteredMessages = messages.filter(msg => msg.from === userJid);
        
        if (filteredMessages.length === 0) {
          await sock.sendMessage(groupJid, {
            text: `❌ Nenhuma mensagem encontrada para ${targetUser} em ${targetDate}`
          });
          return;
        }
      }

      // Formatar histórico
      const historicoText = await this.formatHistorico(filteredMessages, targetDate, targetUser, sock);

      await sock.sendMessage(groupJid, { text: historicoText });

    } catch (error) {
      console.error('[ERROR] Erro no comando historico:', error);
      await sock.sendMessage(groupJid, {
        text: '❌ Erro ao buscar histórico. Tente novamente em alguns segundos.'
      });
    }
  }

  private async formatHistorico(
    messages: any[], 
    date: string, 
    targetUser: string | null, 
    sock: WASocket
  ): Promise<string> {
    const formattedDate = new Date(date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let historicoText = `📜 *HISTÓRICO DE MENSAGENS*\n`;
    historicoText += `📅 ${formattedDate}\n`;
    
    if (targetUser) {
      historicoText += `👤 Usuário: ${targetUser}\n`;
    }
    
    historicoText += `📊 Total: ${messages.length} mensagens\n\n`;

    // Agrupar mensagens por usuário
    const userMessages = new Map<string, any[]>();
    for (const msg of messages) {
      if (!userMessages.has(msg.from)) {
        userMessages.set(msg.from, []);
      }
      userMessages.get(msg.from)!.push(msg);
    }

    // Mostrar mensagens por usuário
    for (const [userJid, userMsgs] of userMessages) {
      const displayName = await this.getUserDisplayName(sock, userJid, messages[0].jid, userJid.split('@')[0]);
      
      historicoText += `👤 *${displayName}* (${userMsgs.length} msgs):\n`;
      
      // Mostrar até 5 mensagens por usuário
      const recentMessages = userMsgs
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
      
      for (const msg of recentMessages) {
        const time = new Date(msg.timestamp * 1000).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const shortText = msg.text && msg.text.length > 50 
          ? msg.text.substring(0, 50) + '...' 
          : msg.text || '[mídia]';
        
        historicoText += `  ${time}: ${shortText}\n`;
      }
      
      historicoText += '\n';
    }

    // Estatísticas
    const textMessages = messages.filter(msg => msg.type === 'textMessage').length;
    const mediaMessages = messages.length - textMessages;
    const commands = messages.filter(msg => msg.commandUsed).length;

    historicoText += `📈 *ESTATÍSTICAS:*\n`;
    historicoText += `💬 Texto: ${textMessages}\n`;
    historicoText += `📱 Mídia: ${mediaMessages}\n`;
    historicoText += `⚡ Comandos: ${commands}\n`;

    return historicoText;
  }

  private async isAdmin(sock: WASocket, groupJid: string, userJid: string): Promise<boolean> {
    try {
      const groupMetadata = await sock.groupMetadata(groupJid);
      const participant = groupMetadata.participants.find(p => p.id === userJid);
      return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
      return false;
    }
  }

  private async getUserDisplayName(
    sock: WASocket, 
    userJid: string, 
    groupJid: string, 
    fallbackName: string
  ): Promise<string> {
    try {
      return await getUserDisplayName(sock, userJid, groupJid, fallbackName);
    } catch (error) {
      return fallbackName;
    }
  }
} 
