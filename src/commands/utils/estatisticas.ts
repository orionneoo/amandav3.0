import { injectable, inject } from 'inversify';
import { WASocket } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { DailySummaryService } from '@/services/DailySummaryService';
import { GroupService } from '@/services/GroupService';
import { TYPES } from '@/config/container';
import { getUserDisplayName } from '@/utils/userUtils';
import { DatabaseStatus } from '@/utils/databaseStatus';

type WAMessage = any;

@injectable()
export class EstatisticasCommand implements IInjectableCommand {
  public readonly name = 'estatisticas';
  public readonly description = 'Mostra estatísticas detalhadas do grupo';
  public readonly usage = '!estatisticas [periodo]';
  public readonly aliases = ['stats', 'analytics', 'metricas'];
  public readonly category = 'utils';
  public readonly adminOnly = false;
  public readonly ownerOnly = false;

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService,
    @inject(TYPES.DailySummaryService) private dailySummaryService: DailySummaryService,
    @inject(TYPES.GroupService) private groupService: GroupService
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
          text: DatabaseStatus.getInstance().getOfflineMessage('Estatísticas')
        });
        return;
      }

      // Determinar o período
      const period = args[0]?.toLowerCase() || 'hoje';
      const { startDate, endDate } = this.getDateRange(period);

      await sock.sendMessage(groupJid, {
        text: '📊 Calculando estatísticas...'
      });

      // Buscar informações do grupo
      const group = await this.groupService.getGroup(groupJid);
      const groupName = group?.name || 'Grupo';

      // Buscar estatísticas do período
      const stats = await this.getGroupStats(groupJid, startDate.toISOString(), endDate.toISOString());

      // Formatar estatísticas
      const statsText = await this.formatStats(stats, groupName, period, sock);

      await sock.sendMessage(groupJid, { text: statsText });

    } catch (error) {
      console.error('[ERROR] Erro no comando estatisticas:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao calcular estatísticas. Tente novamente em alguns segundos.'
      });
    }
  }

  private async getGroupStats(groupJid: string, startDate: string, endDate: string): Promise<any> {
    try {
      // Buscar resumos do período
      const summaries = await this.dailySummaryService.getSummariesForPeriod(groupJid, startDate, endDate);
      
      // Calcular estatísticas agregadas
      const stats = {
        totalMessages: 0,
        totalMembers: 0,
        totalAdmins: 0,
        totalAIInteractions: 0,
        topUsers: new Map<string, number>(),
        topCommands: new Map<string, number>(),
        mediaCount: {
          images: 0,
          videos: 0,
          audios: 0,
          documents: 0,
          stickers: 0
        },
        activityHours: new Map<number, number>(),
        popularPhrases: new Map<string, number>()
      };

      // Agregar dados dos resumos
      for (const summary of summaries) {
        stats.totalMessages += summary.totalMessages || 0;
        stats.totalMembers = Math.max(stats.totalMembers, summary.totalMembers || 0);
        stats.totalAdmins = Math.max(stats.totalAdmins, summary.totalAdmins || 0);
        stats.totalAIInteractions += summary.aiInteractions || 0;

        // Agregar usuários
        if (summary.topUsers) {
          for (const user of summary.topUsers) {
            const current = stats.topUsers.get(user.jid) || 0;
            stats.topUsers.set(user.jid, current + user.messageCount);
          }
        }

        // Agregar comandos
        if (summary.topCommands) {
          for (const cmd of summary.topCommands) {
            const current = stats.topCommands.get(cmd.name) || 0;
            stats.topCommands.set(cmd.name, current + cmd.count);
          }
        }

        // Agregar mídia
        if (summary.mediaCount) {
          stats.mediaCount.images += summary.mediaCount.images || 0;
          stats.mediaCount.videos += summary.mediaCount.videos || 0;
          stats.mediaCount.audios += summary.mediaCount.audios || 0;
          stats.mediaCount.documents += summary.mediaCount.documents || 0;
          stats.mediaCount.stickers += summary.mediaCount.stickers || 0;
        }

        // Agregar hora de pico
        if (summary.peakActivityHour !== undefined) {
          const current = stats.activityHours.get(summary.peakActivityHour) || 0;
          stats.activityHours.set(summary.peakActivityHour, current + 1);
        }

        // Agregar frases populares
        if (summary.popularPhrases) {
          for (const phrase of summary.popularPhrases) {
            const current = stats.popularPhrases.get(phrase.text) || 0;
            stats.popularPhrases.set(phrase.text, current + phrase.count);
          }
        }
      }

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return {
        totalMessages: 0,
        totalMembers: 0,
        totalAdmins: 0,
        totalAIInteractions: 0,
        topUsers: new Map(),
        topCommands: new Map(),
        mediaCount: { images: 0, videos: 0, audios: 0, documents: 0, stickers: 0 },
        activityHours: new Map(),
        popularPhrases: new Map()
      };
    }
  }

  private async formatStats(
    stats: any, 
    groupName: string, 
    period: string, 
    sock: WASocket
  ): Promise<string> {
    const periodText = this.getPeriodText(period);
    const groupJid = ''; // Placeholder - será passado como parâmetro se necessário
    
    let statsText = `📊 *ESTATÍSTICAS - ${groupName.toUpperCase()}*\n`;
    statsText += `📅 Período: ${periodText}\n\n`;

    // Estatísticas gerais
    statsText += `📈 *ESTATÍSTICAS GERAIS*\n`;
    statsText += `💬 Total de mensagens: ${stats.totalMessages}\n`;
    statsText += `👥 Membros: ${stats.totalMembers}\n`;
    statsText += `👑 Admins: ${stats.totalAdmins}\n`;
    statsText += `🤖 Interações com IA: ${stats.totalAIInteractions}\n`;
    statsText += `📱 Média por dia: ${Math.round(stats.totalMessages / Math.max(1, this.getDaysInPeriod(period)))} msgs\n\n`;

    // Top usuários
    if (stats.topUsers.size > 0) {
      statsText += `🏆 *TOP 5 MAIS ATIVOS*\n`;
      const sortedUsers = Array.from(stats.topUsers.entries() as Iterable<[string, number]>)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      for (let i = 0; i < sortedUsers.length; i++) {
        const [userJid, messageCount] = sortedUsers[i];
        const displayName = await this.getUserDisplayName(sock, userJid, groupJid, userJid.split('@')[0]);
        statsText += `${i + 1}. ${displayName} - ${messageCount} mensagens\n`;
      }
      statsText += '\n';
    }

    // Top comandos
    if (stats.topCommands.size > 0) {
      statsText += `⚡ *COMANDOS MAIS USADOS*\n`;
      const sortedCommands = Array.from(stats.topCommands.entries() as Iterable<[string, number]>)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      for (let i = 0; i < sortedCommands.length; i++) {
        const [command, count] = sortedCommands[i];
        statsText += `${i + 1}. !${command} - ${count} vezes\n`;
      }
      statsText += '\n';
    }

    // Mídia
    const totalMedia = stats.mediaCount.images + stats.mediaCount.videos + 
                      stats.mediaCount.audios + stats.mediaCount.documents + 
                      stats.mediaCount.stickers;
    
    if (totalMedia > 0) {
      statsText += `📱 *MÍDIA ENVIADA*\n`;
      statsText += `🖼️ Imagens: ${stats.mediaCount.images}\n`;
      statsText += `🎥 Vídeos: ${stats.mediaCount.videos}\n`;
      statsText += `🎵 Áudios: ${stats.mediaCount.audios}\n`;
      statsText += `📄 Documentos: ${stats.mediaCount.documents}\n`;
      statsText += `😀 Stickers: ${stats.mediaCount.stickers}\n`;
      statsText += `📊 Total: ${totalMedia} arquivos\n\n`;
    }

    // Hora de pico
    if (stats.activityHours.size > 0) {
      const peakHour = (Array.from(stats.activityHours.entries() as Iterable<[number, number]>)
        .sort((a, b) => b[1] - a[1])[0][0]);
      const peakHourStr = peakHour.toString().padStart(2, '0');
      statsText += `⏰ *HORA DE PICO:* ${peakHourStr}:00\n\n`;
    }

    // Frases populares
    if (stats.popularPhrases.size > 0) {
      statsText += `💬 *FRASES POPULARES*\n`;
      const sortedPhrases = Array.from(stats.popularPhrases.entries() as Iterable<[string, number]>)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      for (let i = 0; i < sortedPhrases.length; i++) {
        const [phrase, count] = sortedPhrases[i];
        const shortText = phrase.length > 40 ? phrase.substring(0, 40) + '...' : phrase;
        statsText += `${i + 1}. "${shortText}" (${count}x)\n`;
      }
    }

    return statsText;
  }

  private getDateRange(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
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
      case 'ano':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }

  private getPeriodText(period: string): string {
    switch (period) {
      case 'hoje': return 'Hoje';
      case 'ontem': return 'Ontem';
      case 'semana': return 'Última semana';
      case 'mes': return 'Último mês';
      case 'ano': return 'Último ano';
      default: return 'Hoje';
    }
  }

  private getDaysInPeriod(period: string): number {
    switch (period) {
      case 'hoje': return 1;
      case 'ontem': return 1;
      case 'semana': return 7;
      case 'mes': return 30;
      case 'ano': return 365;
      default: return 1;
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