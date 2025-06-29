import { injectable, inject } from 'inversify';
import { WASocket } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { DailySummaryService } from '@/services/DailySummaryService';
import { GroupService } from '@/services/GroupService';
import { PersonalityService } from '@/services/PersonalityService';
import { TYPES } from '@/config/container';
import { getUserDisplayName } from '@/utils/userUtils';
import { DatabaseStatus } from '@/utils/databaseStatus';
import { commandMiddleware } from '@/utils/commandMiddleware';

type WAMessage = any;

@injectable()
export class ResumoCommand implements IInjectableCommand {
  public readonly name = 'resumo';
  public readonly description = 'Mostra resumo detalhado do grupo';
  public readonly usage = '!resumo [data]';
  public readonly aliases = ['resumo', 'summary', 'estatisticas'];
  public readonly category = 'utils';
  public readonly adminOnly = false;
  public readonly ownerOnly = false;

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService,
    @inject(TYPES.DailySummaryService) private dailySummaryService: DailySummaryService,
    @inject(TYPES.GroupService) private groupService: GroupService,
    @inject(TYPES.PersonalityService) private personalityService: PersonalityService
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
          text: DatabaseStatus.getInstance().getOfflineMessage('Resumo')
        });
        return;
      }

      // Determinar a data (hoje por padrão, ou data especificada)
      let targetDate: string;
      if (args.length > 0) {
        const dateArg = args[0];
        // Validar formato da data (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
          await sock.sendMessage(groupJid, {
            text: '❌ Formato de data inválido! Use: YYYY-MM-DD\n\nExemplo: !resumo 2025-06-22'
          });
          return;
        }
        targetDate = dateArg;
      } else {
        targetDate = new Date().toISOString().split('T')[0];
      }

      // Buscar resumo do dia
      let summary = await this.dailySummaryService.getDailySummary(groupJid, targetDate);

      // Se não existir resumo, gerar um
      if (!summary) {
        await sock.sendMessage(groupJid, {
          text: '📊 Gerando resumo do dia...'
        });

        summary = await this.dailySummaryService.generateSummaryForGroup(groupJid, targetDate);
        
        if (!summary) {
          await sock.sendMessage(groupJid, {
            text: `❌ Nenhuma atividade encontrada para ${targetDate}`
          });
          return;
        }
      }

      // Buscar informações do grupo
      const group = await this.groupService.getGroup(groupJid);
      const groupName = group?.name || 'Grupo';

      // Formatar resumo
      const resumoText = await this.formatSummary(summary, groupName, targetDate, sock);

      await sock.sendMessage(groupJid, { text: resumoText });

    } catch (error) {
      console.error('[ERROR] Erro no comando resumo:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao gerar resumo. Tente novamente em alguns segundos.'
      });
    }
  }

  private async formatSummary(
    summary: any, 
    groupName: string, 
    date: string, 
    sock: WASocket
  ): Promise<string> {
    const formattedDate = new Date(date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let resumoText = `📊 *RESUMO DO DIA - ${groupName.toUpperCase()}*\n`;
    resumoText += `📅 ${formattedDate}\n`;
    resumoText += `🎭 Personalidade: ${summary.personality}\n\n`;

    // Estatísticas gerais
    resumoText += `📈 *ESTATÍSTICAS GERAIS*\n`;
    resumoText += `💬 Total de mensagens: ${summary.totalMessages}\n`;
    resumoText += `👥 Membros: ${summary.totalMembers}\n`;
    resumoText += `👑 Admins: ${summary.totalAdmins}\n`;
    resumoText += `🤖 Interações com IA: ${summary.aiInteractions}\n\n`;

    // Top usuários
    if (summary.topUsers && summary.topUsers.length > 0) {
      resumoText += `🏆 *TOP 5 MAIS ATIVOS*\n`;
      for (let i = 0; i < Math.min(summary.topUsers.length, 5); i++) {
        const user = summary.topUsers[i];
        const displayName = await this.getUserDisplayName(sock, user.jid, summary.groupJid, user.name);
        resumoText += `${i + 1}. ${displayName} - ${user.messageCount} mensagens\n`;
      }
      resumoText += '\n';
    }

    // Top comandos
    if (summary.topCommands && summary.topCommands.length > 0) {
      resumoText += `⚡ *COMANDOS MAIS USADOS*\n`;
      for (let i = 0; i < Math.min(summary.topCommands.length, 5); i++) {
        const cmd = summary.topCommands[i];
        resumoText += `${i + 1}. !${cmd.name} - ${cmd.count} vezes\n`;
      }
      resumoText += '\n';
    }

    // Mídia
    if (summary.mediaCount) {
      resumoText += `📱 *MÍDIA ENVIADA*\n`;
      resumoText += `🖼️ Imagens: ${summary.mediaCount.images}\n`;
      resumoText += `🎥 Vídeos: ${summary.mediaCount.videos}\n`;
      resumoText += `🎵 Áudios: ${summary.mediaCount.audios}\n`;
      resumoText += `📄 Documentos: ${summary.mediaCount.documents}\n`;
      resumoText += `😀 Stickers: ${summary.mediaCount.stickers}\n\n`;
    }

    // Hora de pico
    if (summary.peakActivityHour !== undefined) {
      const peakHour = summary.peakActivityHour.toString().padStart(2, '0');
      resumoText += `⏰ *HORA DE PICO:* ${peakHour}:00\n\n`;
    }

    // Frases populares
    if (summary.popularPhrases && summary.popularPhrases.length > 0) {
      resumoText += `💬 *FRASES POPULARES*\n`;
      for (let i = 0; i < Math.min(summary.popularPhrases.length, 3); i++) {
        const phrase = summary.popularPhrases[i];
        const shortText = phrase.text.length > 50 ? phrase.text.substring(0, 50) + '...' : phrase.text;
        resumoText += `${i + 1}. "${shortText}" (${phrase.count}x)\n`;
      }
    }

    return resumoText;
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