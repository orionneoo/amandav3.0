import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { OwnerService } from '@/services/OwnerService';
import { GroupActivity } from '@/database/models/GroupActivitySchema';
import { TYPES } from '@/config/container';
import { DatabaseService } from '@/services/DatabaseService';
import { DatabaseStatus } from '@/utils/databaseStatus';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class UsuariosCommand implements IInjectableCommand {
  public name = 'usuarios';
  public description = 'Gerencia usuários do bot';
  public category = 'admin' as const;
  public usage = '!usuarios [comando] [opções]';
  public aliases = ['users', 'membros'];

  private readonly OWNER_NUMBER = '5521967233931';

  constructor(
    @inject(TYPES.OwnerService) private ownerService: OwnerService
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args } = context;
    const userJid = message.key.participant || message.key.remoteJid!;
    const isPrivate = !message.key.remoteJid!.endsWith('@g.us');
    
    // Verificar se é o dono
    const userNumber = userJid.split('@')[0];
    if (userNumber !== this.OWNER_NUMBER) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '🚫 *Acesso Negado*\n\nEste comando é exclusivo do dono do bot!'
      });
      return;
    }

    // Verificar se é conversa privada
    if (!isPrivate) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '🔒 *Comando Privado*\n\nEste comando só pode ser usado em conversa privada com o bot!'
      });
      return;
    }

    // Verificar autenticação
    const isAuthenticated = await this.ownerService.isAuthenticated(userJid);
    if (!isAuthenticated) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '🔐 *Autenticação Necessária*\n\nUse `!dono senha [senha]` para se autenticar primeiro.'
      });
      return;
    }

    const command = args[0]?.toLowerCase();

    switch (command) {
      case 'listar':
        await this.listUsers(sock, message, args.slice(1));
        break;
      case 'buscar':
        await this.searchUser(sock, message, args.slice(1));
        break;
      case 'banir':
        await this.banUser(sock, message, args.slice(1));
        break;
      case 'desbanir':
        await this.unbanUser(sock, message, args.slice(1));
        break;
      case 'estatisticas':
        await this.userStats(sock, message, args.slice(1));
        break;
      case 'ajuda':
      case 'help':
        await this.showHelp(sock, message);
        break;
      default:
        await this.showHelp(sock, message);
        break;
    }
  }

  private async listUsers(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Lista de Usuários')
        });
        return;
      }

      const limit = parseInt(args[0]) || 20;
      
      // NOVO: Implementar busca real de usuários
      let users: any[] = [];
      try {
        const { UserSession } = await import('@/database/UserSessionSchema');
        users = await UserSession.find({})
          .sort({ lastInteraction: -1 })
          .limit(limit)
          .lean();
      } catch (error) {
        // Fallback: buscar baseado em atividades recentes
        const { GroupActivity } = await import('@/database/models/GroupActivitySchema');
        const recentUsers = await GroupActivity.aggregate([
          { $match: { timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
          { $group: { _id: '$userJid', lastActivity: { $max: '$timestamp' } } },
          { $sort: { lastActivity: -1 } },
          { $limit: limit }
        ]);
        
        users = recentUsers.map(user => ({
          jid: user._id,
          lastInteraction: user.lastActivity
        }));
      }

      let messageText = `👥 *LISTA DE USUÁRIOS* (${users.length})\n\n`;
      
      if (users.length === 0) {
        messageText += 'Nenhum usuário encontrado.';
      } else {
        users.forEach((user, index) => {
          const number = user.jid?.split('@')[0] || 'N/A';
          const lastSeen = user.lastInteraction ? 
            new Date(user.lastInteraction).toLocaleDateString('pt-BR') : 'N/A';
          
          messageText += `${index + 1}. ${number}\n`;
          messageText += `   📅 Última atividade: ${lastSeen}\n\n`;
        });
      }

      await sock.sendMessage(message.key.remoteJid!, { text: messageText });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao listar usuários. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async searchUser(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    if (args.length === 0) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Número Obrigatório*\n\nUse: `!usuarios buscar [numero]`'
      });
      return;
    }

    try {
      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Busca de Usuário')
        });
        return;
      }

      const searchNumber = args[0].replace(/\D/g, '');
      
      // NOVO: Implementar busca real de usuário
      let user: any = null;
      try {
        const { UserSession } = await import('@/database/UserSessionSchema');
        user = await UserSession.findOne({ jid: new RegExp(searchNumber) }).lean();
      } catch (error) {
        // Fallback: buscar em atividades
        const { GroupActivity } = await import('@/database/models/GroupActivitySchema');
        const activities = await GroupActivity.find({ 
          userJid: new RegExp(searchNumber) 
        }).sort({ timestamp: -1 }).limit(10).lean();
        
        if (activities.length > 0) {
          user = {
            jid: activities[0].userJid,
            lastInteraction: activities[0].timestamp,
            activities: activities.length
          };
        }
      }

      if (!user) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `❌ *Usuário não encontrado*\n\nNenhum usuário encontrado com o número ${searchNumber}`
        });
        return;
      }

      // Verificar se está banido
      const { Blacklist } = await import('@/database/models/BlacklistSchema');
      const banInfo = await Blacklist.findOne({ 
        userJid: user.jid,
        active: true
      }).lean();

      let userInfo = `👤 *INFORMAÇÕES DO USUÁRIO*\n\n`;
      userInfo += `📱 *Número:* ${user.jid?.split('@')[0] || searchNumber}\n`;
      userInfo += `📅 *Última atividade:* ${user.lastInteraction ? 
        new Date(user.lastInteraction).toLocaleString('pt-BR') : 'N/A'}\n`;
      
      if (user.activities) {
        userInfo += `📊 *Atividades recentes:* ${user.activities}\n`;
      }

      if (banInfo) {
        userInfo += `\n🚫 *STATUS:* BANIDO\n`;
        userInfo += `📝 *Motivo:* ${banInfo.reason}\n`;
        userInfo += `📅 *Banido em:* ${new Date(banInfo.bannedAt).toLocaleDateString('pt-BR')}\n`;
      } else {
        userInfo += `\n✅ *STATUS:* Ativo`;
      }

      await sock.sendMessage(message.key.remoteJid!, { text: userInfo });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao buscar usuário. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async banUser(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    if (args.length === 0) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Número Obrigatório*\n\nUse: `!usuarios banir [numero] [motivo]`'
      });
      return;
    }

    try {
      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Banir Usuário')
        });
        return;
      }

      const number = args[0].replace(/\D/g, '');
      const motivo = args.slice(1).join(' ') || 'Banido pelo dono';
      
      // NOVO: Implementar sistema de ban real
      const { Blacklist } = await import('@/database/models/BlacklistSchema');
      
      // Verificar se já está banido
      const existingBan = await Blacklist.findOne({ 
        number: number,
        active: true 
      });
      
      if (existingBan) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `⚠️ *Usuário Já Banido*\n\nO número ${number} já está na blacklist.\nMotivo: ${existingBan.reason}`
        });
        return;
      }
      
      // Adicionar à blacklist
      const newBan = new Blacklist({
        number: number,
        userJid: `${number}@s.whatsapp.net`,
        reason: motivo,
        bannedBy: this.OWNER_NUMBER + '@s.whatsapp.net'
      });
      await newBan.save();

      await sock.sendMessage(message.key.remoteJid!, {
        text: `✅ *Usuário Banido*\n\nO número ${number} foi adicionado à blacklist.`
      });
      
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao banir usuário. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async unbanUser(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    if (args.length === 0) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Número Obrigatório*\n\nUse: `!usuarios desbanir [numero]`'
      });
      return;
    }

    try {
      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Desbanir Usuário')
        });
        return;
      }

      const number = args[0].replace(/\D/g, '');
      
      // NOVO: Implementar sistema de desbanir real
      const { Blacklist } = await import('@/database/models/BlacklistSchema');
      
      // Verificar se está banido
      const banInfo = await Blacklist.findOne({ 
        number: number,
        active: true 
      });

      if (!banInfo) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `✅ *Usuário Não Banido*\n\nO número ${number} não está na blacklist.`
        });
        return;
      }

      // Desativar ban
      banInfo.active = false;
      await banInfo.save();

      await sock.sendMessage(message.key.remoteJid!, {
        text: `✅ *Usuário Desbanido*\n\nO número ${number} foi removido da blacklist.`
      });
      
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao desbanir usuário. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async userStats(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Estatísticas de Usuários')
        });
        return;
      }

      // NOVO: Implementar estatísticas reais
      let totalUsers = 0;
      let activeLast7Days = 0;
      let bannedUsers = 0;
      let topGroups: any[] = [];
      
      try {
        const { UserSession } = await import('@/database/UserSessionSchema');
        const { Blacklist } = await import('@/database/models/BlacklistSchema');
        const { GroupActivity } = await import('@/database/models/GroupActivitySchema');
        
        totalUsers = await UserSession.countDocuments();
        
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        activeLast7Days = await UserSession.countDocuments({ 
          lastInteraction: { $gte: sevenDaysAgo } 
        });
        
        bannedUsers = await Blacklist.countDocuments({ active: true });
        
        topGroups = await GroupActivity.aggregate([
          { $group: { _id: '$groupJid', messages: { $sum: 1 } } },
          { $sort: { messages: -1 } },
          { $limit: 3 }
        ]);
        
      } catch (error) {
        // Fallback se schemas não existirem
      }

      let statsText = `📊 *ESTATÍSTICAS DE USUÁRIOS*\n\n`;
      statsText += `👥 Total de usuários: ${totalUsers}\n`;
      statsText += `✅ Ativos (7 dias): ${activeLast7Days}\n`;
      statsText += `🚫 Banidos: ${bannedUsers}\n\n`;
      
      statsText += `🏆 *TOP 3 GRUPOS MAIS ATIVOS:*\n`;
      if (topGroups.length > 0) {
        for (let i = 0; i < topGroups.length; i++) {
          const group = topGroups[i];
          const groupName = await this.getGroupName(group._id);
          statsText += `${i + 1}. ${groupName} (${group.messages} msgs)\n`;
        }
      } else {
        statsText += 'Nenhum grupo ativo encontrado.';
      }

      await sock.sendMessage(message.key.remoteJid!, { text: statsText });
      
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao gerar estatísticas de usuários. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async showHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpText = `👥 *COMANDO DE USUÁRIOS*\n\n` +
                    `*Uso:* \`!usuarios [comando]\`\n\n` +
                    `*Comandos disponíveis:*\n` +
                    `📋 \`listar [limite]\` - Lista usuários (padrão: 20)\n` +
                    `🔍 \`buscar [numero]\` - Busca um usuário\n` +
                    `🚫 \`banir [numero] [motivo]\` - Bane um usuário\n` +
                    `✅ \`desbanir [numero]\` - Desbane um usuário\n` +
                    `📊 \`estatisticas\` - Mostra estatísticas\n` +
                    `❓ \`ajuda\` - Mostra esta mensagem\n\n` +
                    `*Exemplos:*\n` +
                    `• \`!usuarios listar 50\`\n` +
                    `• \`!usuarios buscar 5521... \`\n` +
                    `• \`!usuarios banir 5521... spammer\``;

    await sock.sendMessage(message.key.remoteJid!, { text: helpText });
  }

  private async getGroupName(groupJid: string): Promise<string> {
    try {
      const { Group } = await import('@/database/models/GroupSchema');
      const group = await Group.findOne({ groupJid }).lean();
      return group?.name || groupJid;
    } catch (error) {
      return groupJid;
    }
  }

  private getDateRange(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case 'hoje':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'mes':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'ano':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default: // Padrão para semana
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
    }
    return { startDate, endDate };
  }
}

export default UsuariosCommand; 