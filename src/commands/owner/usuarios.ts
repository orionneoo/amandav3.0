import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { OwnerService } from '@/services/OwnerService';
import { GroupActivity } from '@/database/models/GroupActivitySchema';
import { TYPES } from '@/config/container';
import { DatabaseService } from '@/services/DatabaseService';
import { DatabaseStatus } from '@/utils/databaseStatus';

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

  public async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
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
          text: `❌ *Usuário já banido*\n\n📱 Número: ${number}\n📝 Motivo: ${existingBan.reason}\n📅 Banido em: ${new Date(existingBan.bannedAt).toLocaleDateString('pt-BR')}`
        });
        return;
      }

      // Criar novo ban
      await Blacklist.create({
        userJid: `${number}@s.whatsapp.net`,
        number: number,
        name: `Usuário ${number}`,
        bannedAt: new Date(),
        bannedBy: message.key.participant || message.key.remoteJid!,
        reason: motivo,
        active: true
      });

      await sock.sendMessage(message.key.remoteJid!, {
        text: `✅ *Usuário Banido com Sucesso*\n\n📱 Número: ${number}\n📝 Motivo: ${motivo}\n📅 Data: ${new Date().toLocaleDateString('pt-BR')}\n\n⚠️ O usuário será removido automaticamente de todos os grupos onde o bot estiver presente.`
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
      
      // NOVO: Implementar sistema de unban real
      const { Blacklist } = await import('@/database/models/BlacklistSchema');
      
      // Buscar ban ativo
      const ban = await Blacklist.findOne({ 
        number: number,
        active: true 
      });

      if (!ban) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `❌ *Usuário não está banido*\n\n📱 Número: ${number}\n\n💡 Este usuário não está na lista de banidos.`
        });
        return;
      }

      // Desativar o ban
      await Blacklist.updateOne(
        { _id: ban._id },
        { active: false }
      );

      await sock.sendMessage(message.key.remoteJid!, {
        text: `✅ *Usuário Desbanido com Sucesso*\n\n📱 Número: ${number}\n📝 Motivo anterior: ${ban.reason}\n📅 Banido em: ${new Date(ban.bannedAt).toLocaleDateString('pt-BR')}\n📅 Desbanido em: ${new Date().toLocaleDateString('pt-BR')}\n\n🔄 O usuário agora pode entrar nos grupos novamente.`
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

      const period = args[0] || 'hoje';
      const { startDate, endDate } = this.getDateRange(period);

      // NOVO: Implementar contagem real de usuários
      let totalUsers = 0;
      let newUsers = 0;
      
      try {
        const { UserSession } = await import('@/database/UserSessionSchema');
        totalUsers = await UserSession.countDocuments();
        
        // Usuários criados no período
        newUsers = await UserSession.countDocuments({
          lastInteraction: { $gte: startDate, $lte: endDate }
        });
      } catch (error) {
        // Fallback: estimativa baseada em atividades
        const uniqueUsers = await GroupActivity.distinct('userJid', {
          timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
        });
        totalUsers = uniqueUsers.length;
        
        const newUsersInPeriod = await GroupActivity.distinct('userJid', {
          timestamp: { $gte: startDate, $lte: endDate }
        });
        newUsers = newUsersInPeriod.length;
      }

      const activeUsers = await GroupActivity.distinct('userJid', {
        timestamp: { $gte: startDate, $lte: endDate }
      });

      const topUsers = await GroupActivity.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate }, type: 'message' } },
        { $group: { _id: '$userJid', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // NOVO: Estatísticas de ban
      const { Blacklist } = await import('@/database/models/BlacklistSchema');
      const bannedUsers = await Blacklist.countDocuments({ active: true });

      let statsMessage = `📊 *ESTATÍSTICAS DE USUÁRIOS - ${period.toUpperCase()}*\n\n`;
      statsMessage += `👥 *Total de usuários:* ${totalUsers}\n`;
      statsMessage += `🟢 *Usuários ativos:* ${activeUsers.length}\n`;
      statsMessage += `🆕 *Novos usuários:* ${newUsers}\n`;
      statsMessage += `🚫 *Usuários banidos:* ${bannedUsers}\n\n`;

      if (topUsers.length > 0) {
        statsMessage += `🏆 *Usuários mais ativos:*\n`;
        for (let i = 0; i < Math.min(topUsers.length, 5); i++) {
          const user = topUsers[i];
          const number = user._id.split('@')[0];
          statsMessage += `${i + 1}. ${number}: ${user.count} msgs\n`;
        }
      }

      await sock.sendMessage(message.key.remoteJid!, { text: statsMessage });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter estatísticas. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async showHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpMessage = `👥 *COMANDOS DE USUÁRIOS*\n\n` +
      `📋 *Comandos disponíveis:*\n` +
      `• \`!usuarios listar [quantidade]\` - Lista usuários\n` +
      `• \`!usuarios buscar [numero]\` - Busca usuário específico\n` +
      `• \`!usuarios banir [numero] [motivo]\` - Bane usuário\n` +
      `• \`!usuarios desbanir [numero]\` - Desbane usuário\n` +
      `• \`!usuarios estatisticas [periodo]\` - Estatísticas\n\n` +
      `📅 *Períodos:* hoje, ontem, semana, mes\n\n` +
      `💡 *Exemplos:*\n` +
      `• \`!usuarios listar 50\`\n` +
      `• \`!usuarios buscar 21999999999\`\n` +
      `• \`!usuarios estatisticas semana\``;

    await sock.sendMessage(message.key.remoteJid!, { text: helpMessage });
  }

  private async getGroupName(groupJid: string): Promise<string> {
    try {
      const { Group } = await import('@/database/models/GroupSchema');
      const group = await Group.findOne({ groupJid });
      return group?.name || 'Grupo Desconhecido';
    } catch {
      return 'Grupo Desconhecido';
    }
  }

  private getDateRange(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate = new Date();

    switch (period.toLowerCase()) {
      case 'hoje':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'ontem':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'semana':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'mes':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }
}

export default UsuariosCommand; 