import { injectable, inject } from 'inversify';
import Logger from '@/utils/Logger';
import { Message } from '@/database/models/MessageSchema';
import { DailySummary } from '@/database/models/DailySummarySchema';
import { Group } from '@/database/models/GroupSchema';
import { LocalHistoryService } from './LocalHistoryService';
import { TYPES } from '@/config/container';

@injectable()
export class DailySummaryService {
  private logger: typeof Logger;

  constructor(
    @inject(TYPES.LocalHistoryService) private localHistoryService: LocalHistoryService
  ) {
    this.logger = Logger;
  }

  /**
   * Gera resumo diário para todos os grupos ativos
   */
  public async generateDailySummaries(): Promise<void> {
    try {
      this.logger.info('Iniciando geração de resumos diários...');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar todos os grupos ativos
      const groups = await Group.find({ isActive: true });
      
      for (const group of groups) {
        try {
          await this.generateSummaryForGroup(group.groupJid, today);
        } catch (error) {
          this.logger.error(`Erro ao gerar resumo para grupo ${group.groupJid}`, { error });
        }
      }
      
      this.logger.info(`Resumos diários gerados para ${groups.length} grupos`);
    } catch (error) {
      this.logger.error('Erro ao gerar resumos diários', { error });
      throw error;
    }
  }

  /**
   * Gera resumo diário para um grupo específico
   */
  public async generateSummaryForGroup(groupJid: string, date: string): Promise<any | null> {
    try {
      this.logger.info(`Gerando resumo para grupo ${groupJid} em ${date}`);
      
      // Buscar mensagens do dia
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const messages = await Message.find({
        jid: groupJid,
        timestamp: {
          $gte: Math.floor(startOfDay.getTime() / 1000),
          $lte: Math.floor(endOfDay.getTime() / 1000)
        }
      }).sort({ timestamp: 1 });

      if (messages.length === 0) {
        this.logger.info(`Nenhuma mensagem encontrada para ${groupJid} em ${date}`);
        return null;
      }

      // Buscar informações do grupo
      const group = await Group.findOne({ groupJid });
      if (!group) {
        this.logger.warn(`Grupo ${groupJid} não encontrado no banco`);
        return null;
      }

      // Calcular estatísticas
      const stats = this.calculateMessageStats(messages);
      const topUsers = this.getTopUsers(messages);
      const topCommands = this.getTopCommands(messages);
      const popularPhrases = this.getPopularPhrases(messages);
      const mediaCount = this.getMediaCount(messages);
      const peakActivityHour = this.getPeakActivityHour(messages);
      const aiInteractions = this.getAIInteractions(messages);

      // Criar resumo
      const summary = {
        groupJid,
        date,
        personality: group.activePersonality || 'padrao',
        totalMessages: messages.length,
        totalMembers: group.members?.length || 0,
        totalAdmins: group.admins?.length || 0,
        topUsers,
        topCommands,
        popularPhrases,
        aiInteractions,
        mediaCount,
        peakActivityHour,
        createdAt: new Date()
      };

      // Salvar no MongoDB
      try {
        await DailySummary.findOneAndUpdate(
          { groupJid, date },
          summary,
          { upsert: true, new: true }
        );
        this.logger.info(`Resumo salvo no MongoDB para ${groupJid}`);
      } catch (error) {
        this.logger.error(`Erro ao salvar resumo no MongoDB para ${groupJid}`, { error });
        
        // Fallback: salvar localmente
        await this.localHistoryService.saveDailySummary(summary as any);
        this.logger.info(`Resumo salvo localmente para ${groupJid}`);
      }

      return summary;
    } catch (error) {
      this.logger.error(`Erro ao gerar resumo para ${groupJid}`, { error });
      throw error;
    }
  }

  /**
   * Busca resumo diário (MongoDB ou local)
   */
  public async getDailySummary(groupJid: string, date: string): Promise<any | null> {
    try {
      // Tentar buscar no MongoDB primeiro
      let summary = await DailySummary.findOne({ groupJid, date });
      
      if (!summary) {
        // Fallback: buscar localmente
        summary = await this.localHistoryService.getDailySummary(date, groupJid) as any;
      }
      
      return summary;
    } catch (error) {
      this.logger.error(`Erro ao buscar resumo para ${groupJid}`, { error });
      return null;
    }
  }

  /**
   * Busca resumos de um período
   */
  public async getSummariesForPeriod(groupJid: string, startDate: string, endDate: string): Promise<any[]> {
    try {
      const summaries = await DailySummary.find({
        groupJid,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });
      
      return summaries;
    } catch (error) {
      this.logger.error(`Erro ao buscar resumos para período`, { error, groupJid, startDate, endDate });
      return [];
    }
  }

  /**
   * Calcula estatísticas das mensagens
   */
  private calculateMessageStats(messages: any[]): any {
    const userCount = new Set(messages.map(m => m.from)).size;
    const commandCount = messages.filter(m => m.commandUsed).length;
    const mediaCount = messages.filter(m => m.type !== 'textMessage').length;
    
    return {
      userCount,
      commandCount,
      mediaCount,
      textCount: messages.length - mediaCount
    };
  }

  /**
   * Obtém top 5 usuários mais ativos
   */
  private getTopUsers(messages: any[]): Array<{ jid: string; name: string; messageCount: number }> {
    const userCounts = new Map<string, number>();
    
    for (const message of messages) {
      const count = userCounts.get(message.from) || 0;
      userCounts.set(message.from, count + 1);
    }
    
    return Array.from(userCounts.entries())
      .map(([jid, count]) => ({
        jid,
        name: jid.split('@')[0],
        messageCount: count
      }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 5);
  }

  /**
   * Obtém top 5 comandos mais usados
   */
  private getTopCommands(messages: any[]): Array<{ name: string; count: number }> {
    const commandCounts = new Map<string, number>();
    
    for (const message of messages) {
      if (message.commandUsed) {
        const count = commandCounts.get(message.commandUsed.name) || 0;
        commandCounts.set(message.commandUsed.name, count + 1);
      }
    }
    
    return Array.from(commandCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Obtém frases populares
   */
  private getPopularPhrases(messages: any[]): Array<{ text: string; count: number; engagement: number }> {
    const phraseCounts = new Map<string, number>();
    
    for (const message of messages) {
      if (message.text && message.text.length > 10) {
        const count = phraseCounts.get(message.text) || 0;
        phraseCounts.set(message.text, count + 1);
      }
    }
    
    return Array.from(phraseCounts.entries())
      .map(([text, count]) => ({
        text,
        count,
        engagement: count * (text.length / 100) // Engajamento baseado no tamanho
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);
  }

  /**
   * Conta tipos de mídia
   */
  private getMediaCount(messages: any[]): {
    images: number;
    videos: number;
    audios: number;
    documents: number;
    stickers: number;
  } {
    const counts = {
      images: 0,
      videos: 0,
      audios: 0,
      documents: 0,
      stickers: 0
    };
    
    for (const message of messages) {
      switch (message.type) {
        case 'imageMessage':
          counts.images++;
          break;
        case 'videoMessage':
          counts.videos++;
          break;
        case 'audioMessage':
          counts.audios++;
          break;
        case 'documentMessage':
          counts.documents++;
          break;
        case 'stickerMessage':
          counts.stickers++;
          break;
      }
    }
    
    return counts;
  }

  /**
   * Calcula hora de pico de atividade
   */
  private getPeakActivityHour(messages: any[]): number {
    const hourCounts = new Array(24).fill(0);
    
    for (const message of messages) {
      const date = new Date(message.timestamp * 1000);
      const hour = date.getHours();
      hourCounts[hour]++;
    }
    
    return hourCounts.indexOf(Math.max(...hourCounts));
  }

  /**
   * Conta interações com IA
   */
  private getAIInteractions(messages: any[]): number {
    return messages.filter(m => m.personality).length;
  }
} 