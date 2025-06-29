import { injectable, inject } from 'inversify';
import { WASocket } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { TYPES } from '@/config/container';
import { getUserDisplayName } from '@/utils/userUtils';
import { DatabaseStatus } from '@/utils/databaseStatus';

type WAMessage = any;

@injectable()
export class SearchCommand implements IInjectableCommand {
  public readonly name = 'search';
  public readonly description = 'Busca avançada de mensagens no grupo';
  public readonly usage = '!search "termo" [opções]';
  public readonly aliases = ['buscar', 'procurar', 'find'];
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
                '• `!search "palavra"`\n' +
                '• `!search "frase completa"`\n' +
                '• `!search "termo" @usuario`\n' +
                '• `!search "texto" --limit 10`\n' +
                '• `!search "mídia" --type media`'
        });
        return;
      }

      // Processar argumentos
      const searchOptions = this.parseSearchArgs(args);
      
      if (!searchOptions.term) {
        await sock.sendMessage(groupJid, {
          text: '❌ Termo de busca inválido! Use aspas para frases.\n\nExemplo: `!search "palavra"`'
        });
        return;
      }

      await sock.sendMessage(groupJid, {
        text: '🔍 Buscando mensagens...'
      });

      // Buscar mensagens
      const messages = await this.searchMessages(groupJid, searchOptions);

      if (messages.length === 0) {
        await sock.sendMessage(groupJid, {
          text: `❌ Nenhuma mensagem encontrada para "${searchOptions.term}"`
        });
        return;
      }

      // Formatar resultados
      const searchText = await this.formatSearchResults(messages, searchOptions, sock);

      await sock.sendMessage(groupJid, { text: searchText });

    } catch (error) {
      console.error('[ERROR] Erro no comando search:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao buscar mensagens. Tente novamente em alguns segundos.'
      });
    }
  }

  private parseSearchArgs(args: string[]): any {
    const options: any = {
      term: '',
      user: null,
      limit: 10,
      type: 'all',
      date: null
    };

    let currentArg = 0;

    // Processar argumentos
    while (currentArg < args.length) {
      const arg = args[currentArg];

      if (arg.startsWith('--')) {
        // Opção com valor
        switch (arg) {
          case '--limit':
            if (currentArg + 1 < args.length) {
              options.limit = parseInt(args[currentArg + 1]) || 10;
              currentArg += 2;
            } else {
              currentArg++;
            }
            break;
          case '--type':
            if (currentArg + 1 < args.length) {
              options.type = args[currentArg + 1];
              currentArg += 2;
            } else {
              currentArg++;
            }
            break;
          case '--date':
            if (currentArg + 1 < args.length) {
              options.date = args[currentArg + 1];
              currentArg += 2;
            } else {
              currentArg++;
            }
            break;
          default:
            currentArg++;
        }
      } else if (arg.startsWith('@')) {
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

  private async searchMessages(groupJid: string, options: any): Promise<any[]> {
    try {
      // Buscar mensagens dos últimos 30 dias por padrão
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Se especificou data, ajustar período
      if (options.date) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
          const targetDate = new Date(options.date);
          startDate.setTime(targetDate.getTime());
          endDate.setTime(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        }
      }

      // Buscar mensagens do período
      const messages = await this.databaseService.getMessagesOfDay(groupJid, startDate.toISOString());

      // Filtrar por termo de busca
      let filteredMessages = messages.filter(msg => {
        if (!msg.text) return false;
        
        const text = msg.text.toLowerCase();
        const term = options.term.toLowerCase();
        
        return text.includes(term);
      });

      // Filtrar por usuário se especificado
      if (options.user) {
        const userJid = options.user.includes('@') ? options.user : `${options.user}@s.whatsapp.net`;
        filteredMessages = filteredMessages.filter(msg => msg.from === userJid);
      }

      // Filtrar por tipo se especificado
      if (options.type !== 'all') {
        switch (options.type) {
          case 'media':
            filteredMessages = filteredMessages.filter(msg => 
              msg.type !== 'textMessage' && msg.type !== 'extendedTextMessage'
            );
            break;
          case 'text':
            filteredMessages = filteredMessages.filter(msg => 
              msg.type === 'textMessage' || msg.type === 'extendedTextMessage'
            );
            break;
          case 'commands':
            filteredMessages = filteredMessages.filter(msg => msg.commandUsed);
            break;
        }
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

  private async formatSearchResults(
    messages: any[], 
    options: any, 
    sock: WASocket
  ): Promise<string> {
    let searchText = `🔍 *RESULTADOS DA BUSCA*\n\n`;
    searchText += `📝 Termo: "${options.term}"\n`;
    searchText += `📊 Encontrados: ${messages.length} resultados\n`;
    
    if (options.user) {
      searchText += `👤 Usuário: @${options.user}\n`;
    }
    
    if (options.type !== 'all') {
      searchText += `📋 Tipo: ${options.type}\n`;
    }
    
    searchText += '\n';

    // Agrupar por usuário
    const userMessages = new Map<string, any[]>();
    for (const msg of messages) {
      if (!userMessages.has(msg.from)) {
        userMessages.set(msg.from, []);
      }
      userMessages.get(msg.from)!.push(msg);
    }

    // Mostrar resultados por usuário
    for (const [userJid, userMsgs] of userMessages) {
      const displayName = await this.getUserDisplayName(sock, userJid, messages[0].jid, userJid.split('@')[0]);
      
      searchText += `👤 *${displayName}* (${userMsgs.length} msgs):\n`;
      
      // Mostrar mensagens do usuário
      for (const msg of userMsgs) {
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
        if (messageText.length > 80) {
          messageText = messageText.substring(0, 80) + '...';
        }
        
        searchText += `  ${time}: ${messageText}\n`;
      }
      
      searchText += '\n';
    }

    // Estatísticas
    const textMessages = messages.filter(msg => 
      msg.type === 'textMessage' || msg.type === 'extendedTextMessage'
    ).length;
    const mediaMessages = messages.length - textMessages;
    const commands = messages.filter(msg => msg.commandUsed).length;

    searchText += `📈 *ESTATÍSTICAS:*\n`;
    searchText += `💬 Texto: ${textMessages}\n`;
    searchText += `📱 Mídia: ${mediaMessages}\n`;
    searchText += `⚡ Comandos: ${commands}\n\n`;

    searchText += `💡 *Dicas:*\n`;
    searchText += `• Use aspas para frases exatas: "frase completa"\n`;
    searchText += `• Adicione @usuario para filtrar por usuário\n`;
    searchText += `• Use --limit 20 para mais resultados\n`;
    searchText += `• Use --type media para apenas mídia`;

    return searchText;
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