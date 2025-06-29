import { injectable, inject } from 'inversify';
import { WASocket } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { TYPES } from '@/config/container';
import { getUserDisplayName } from '@/utils/userUtils';
import { DatabaseStatus } from '@/utils/databaseStatus';

type WAMessage = any;

@injectable()
export class FindCommand implements IInjectableCommand {
  public readonly name = 'find';
  public readonly description = 'Busca simples e rápida de mensagens';
  public readonly usage = '!find termo [@usuario]';
  public readonly aliases = ['encontrar', 'procurar', 'buscar'];
  public readonly category = 'utils';
  public readonly adminOnly = false;
  public readonly ownerOnly = false;

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {}

  public async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const groupJid = message.key.remoteJid!;
      const senderJid = message.key.participant!;

      // Verificar se é grupo
      if (!groupJid.endsWith('@g.us')) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Este comando só funciona em grupos!'
        });
        return;
      }

      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(groupJid, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Busca')
        });
        return;
      }

      // Verificar argumentos
      if (args.length === 0) {
        await sock.sendMessage(groupJid, {
          text: '❌ *Termo de busca obrigatório!*\n\n' +
                '💡 *Exemplos:*\n' +
                '• `!find palavra`\n' +
                '• `!find "frase completa"`\n' +
                '• `!find termo @usuario`\n' +
                '• `!find @usuario` (busca mensagens do usuário)'
        });
        return;
      }

      // Processar argumentos
      const searchOptions = this.parseArgs(args);

      await sock.sendMessage(groupJid, {
        text: '🔍 Buscando...'
      });

      // Buscar mensagens
      const messages = await this.findMessages(groupJid, searchOptions);

      if (messages.length === 0) {
        await sock.sendMessage(groupJid, {
          text: `❌ Nenhuma mensagem encontrada para "${searchOptions.term || searchOptions.user}"`
        });
        return;
      }

      // Formatar resultados
      const findText = await this.formatFindResults(messages, searchOptions, sock);

      await sock.sendMessage(groupJid, { text: findText });

    } catch (error) {
      console.error('[ERROR] Erro no comando find:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao buscar mensagens. Tente novamente em alguns segundos.'
      });
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      term: '',
      user: null,
      limit: 5
    };

    let currentArg = 0;

    // Processar argumentos
    while (currentArg < args.length) {
      const arg = args[currentArg];

      if (arg.startsWith('@')) {
        // Usuário mencionado
        options.user = arg.substring(1);
        currentArg++;
      } else if (arg.startsWith('"') && arg.endsWith('"')) {
        // Termo entre aspas
        options.term = arg.substring(1, arg.length - 1);
        currentArg++;
      } else if (options.term === '') {
        // Primeiro termo sem aspas
        options.term = arg;
        currentArg++;
      } else {
        // Termo adicional
        options.term += ' ' + arg;
        currentArg++;
      }
    }

    return options;
  }

  private async findMessages(groupJid: string, options: any): Promise<any[]> {
    try {
      // Buscar mensagens dos últimos 7 dias por padrão
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Buscar mensagens do período
      const messages = await this.databaseService.getMessagesOfDay(groupJid, startDate.toISOString());

      let filteredMessages = messages;

      // Filtrar por termo se especificado
      if (options.term) {
        filteredMessages = filteredMessages.filter((msg: any) => {
          if (!msg.text) return false;
          
          const text = msg.text.toLowerCase();
          const term = options.term.toLowerCase();
          
          return text.includes(term);
        });
      }

      // Filtrar por usuário se especificado
      if (options.user) {
        const userJid = options.user.includes('@') ? options.user : `${options.user}@s.whatsapp.net`;
        filteredMessages = filteredMessages.filter((msg: any) => msg.from === userJid);
      }

      // Ordenar por data (mais recentes primeiro) e limitar
      return filteredMessages
        .sort((a: any, b: any) => b.timestamp - a.timestamp)
        .slice(0, options.limit);

    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      return [];
    }
  }

  private async formatFindResults(
    messages: any[], 
    options: any, 
    sock: WASocket
  ): Promise<string> {
    let findText = `🔎 *BUSCA RÁPIDA*\n\n`;
    
    if (options.term) {
      findText += `📝 Termo: "${options.term}"\n`;
    }
    
    if (options.user) {
      findText += `👤 Usuário: @${options.user}\n`;
    }
    
    findText += `📊 Encontrados: ${messages.length} resultados\n\n`;

    // Mostrar resultados
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const displayName = await this.getUserDisplayName(sock, msg.from, msg.jid, msg.from.split('@')[0]);
      
      const time = new Date(msg.timestamp * 1000).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      let messageText = msg.text || '[mídia]';
      
      // Destacar o termo encontrado
      if (msg.text && options.term) {
        const regex = new RegExp(`(${options.term})`, 'gi');
        messageText = msg.text.replace(regex, '*$1*');
      }
      
      // Limitar tamanho da mensagem
      if (messageText.length > 60) {
        messageText = messageText.substring(0, 60) + '...';
      }
      
      findText += `${i + 1}. *${displayName}* (${time})\n`;
      findText += `   ${messageText}\n\n`;
    }

    // Informações adicionais
    const lastMessage = messages[0];
    if (lastMessage) {
      const lastTime = new Date(lastMessage.timestamp * 1000);
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - lastTime.getTime()) / (1000 * 60 * 60));
      
      findText += `⏰ Última menção: há ${diffHours} hora${diffHours !== 1 ? 's' : ''}\n`;
    }

    findText += `💡 Use \`!search\` para busca avançada`;

    return findText;
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