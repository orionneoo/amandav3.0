import mongoose from 'mongoose';
import { config } from '@/config';
import { injectable, inject } from 'inversify';
import Logger from '@/utils/Logger';
import { Message, IMessage } from '@/database/models/MessageSchema';
import { DailySummary, IDailySummary } from '@/database/models/DailySummarySchema';
import { CommandUsage, ICommandUsage } from '@/database/models/CommandUsageSchema';
import { ErrorLogs, IErrorLog } from '@/database/models/ErrorLogsSchema';
import { QuotedMessage, IQuotedMessage } from '@/database/models/QuotedMessageSchema';
import { MessageReaction, IMessageReaction } from '@/database/models/MessageReactionSchema';
import { LocalHistoryService } from './LocalHistoryService';
import { TYPES } from '@/config/container';
import DatabaseFallback from './DatabaseFallback';
import { DatabaseStatus } from '@/utils/databaseStatus';

@injectable()
export class DatabaseService {
  private logger: typeof Logger;
  private isConnected: boolean = false;
  private botVersion: string = '2.0.0'; // Versão atual do bot

  constructor(
    @inject(TYPES.LocalHistoryService) private localHistoryService: LocalHistoryService
  ) {
    this.logger = Logger;
  }

  public async connect(): Promise<void> {
    if (mongoose.connection.readyState === 0) { // 0 = disconnected
      console.log('Conectando ao MongoDB Atlas...');
      try {
        if (!config.mongodb.uri) {
          throw new Error('MONGODB_URI não está configurada no ambiente.');
        }
        
        // Usar configurações de timeout e conexão
        const connectionOptions = {
          dbName: config.mongodb.database,
          ...config.mongodb.options
        };
        
        await mongoose.connect(config.mongodb.uri, connectionOptions);
        this.isConnected = true;
        DatabaseFallback.markSuccess();
        DatabaseStatus.getInstance().markSuccess();
        console.log('Conexão com MongoDB Atlas estabelecida!');
      } catch (error) {
        this.isConnected = false;
        DatabaseFallback.addOperation('connect', { error });
        DatabaseStatus.getInstance().markFailure();
        console.error('Erro ao conectar ao MongoDB Atlas:', error);
        this.logger.error('Falha na conexão com MongoDB, usando fallback local', { error });
        // Não encerra o processo, usa fallback local
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (mongoose.connection.readyState === 1) { // 1 = connected
      console.log('Desconectando do MongoDB Atlas...');
      try {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('Desconexão do MongoDB Atlas realizada!');
      } catch (error) {
        console.error('Erro ao desconectar do MongoDB Atlas:', error);
      }
    }
  }

  /**
   * Salva uma mensagem no banco de dados com novos campos de contexto
   */
  public async saveMessage(messageData: Partial<IMessage>): Promise<IMessage | null> {
    try {
      if (this.isConnected) {
        // Adicionar campos de contexto e versão
        const enhancedMessageData = {
          ...messageData,
          botVersion: this.botVersion,
          schemaVersion: 2,
          updatedAt: new Date()
        };

        const message = new Message(enhancedMessageData);
        const savedMessage = await message.save();
        DatabaseFallback.markSuccess();
        DatabaseStatus.getInstance().markSuccess();

        // Se há mensagem citada, salvar na coleção separada
        if (messageData.quotedMessage?.id) {
          await this.saveQuotedMessage(messageData._id!, messageData.quotedMessage);
        }

        return savedMessage;
      } else {
        // Fallback para local
        DatabaseFallback.addOperation('saveMessage', messageData);
        DatabaseStatus.getInstance().markFailure();
        await this.localHistoryService.saveMessage(messageData as IMessage);
        return messageData as IMessage;
      }
    } catch (error: any) {
      // NOVO: Tratamento específico para erro de chave duplicada
      if (error.code === 11000) {
        this.logger.warn('Mensagem duplicada detectada', { 
          messageId: messageData._id, 
          error: error.message 
        });
        // Não é um erro crítico, apenas log de aviso
        return null;
      }

      this.logger.error('Erro ao salvar mensagem', { 
        error: error.message, 
        messageId: messageData._id,
        stack: error.stack 
      });
      DatabaseFallback.addOperation('saveMessage', messageData);
      DatabaseStatus.getInstance().markFailure();
      
      // Fallback para local em caso de erro
      try {
        await this.localHistoryService.saveMessage(messageData as IMessage);
      } catch (fallbackError) {
        this.logger.error('Erro também no fallback local', { fallbackError });
      }
      
      return null;
    }
  }

  /**
   * Salva uma mensagem citada na coleção separada
   */
  public async saveQuotedMessage(originalMessageId: string, quotedMessageData: any): Promise<IQuotedMessage | null> {
    try {
      if (this.isConnected) {
        // Extrair o JID da mensagem citada
        const quotedJid = quotedMessageData.from || quotedMessageData.quotedJid || '';
        
        // Se não temos um JID válido, não salvar a mensagem citada
        if (!quotedJid || quotedJid.trim() === '') {
          this.logger.warn('Tentativa de salvar mensagem citada sem JID válido', { 
            originalMessageId, 
            quotedMessageData 
          });
          return null;
        }

        const quotedMessage = new QuotedMessage({
          _id: `${originalMessageId}_quoted`,
          originalMessageId,
          quotedMessageId: quotedMessageData.id,
          quotedText: quotedMessageData.text,
          quotedFrom: quotedMessageData.from,
          quotedTimestamp: Date.now(), // Será atualizado com timestamp real
          quotedJid: quotedJid, // JID extraído da mensagem citada
          quotedType: 'textMessage',
          schemaVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        return await quotedMessage.save();
      }
      return null;
    } catch (error) {
      this.logger.error('Erro ao salvar mensagem citada', { error, originalMessageId });
      return null;
    }
  }

  /**
   * Salva uma reação à mensagem
   */
  public async saveMessageReaction(reactionData: Partial<IMessageReaction>): Promise<IMessageReaction | null> {
    try {
      if (this.isConnected) {
        const enhancedReactionData = {
          ...reactionData,
          _id: `${reactionData.messageId}_${reactionData.user}_${Date.now()}`,
          schemaVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const reaction = new MessageReaction(enhancedReactionData);
        return await reaction.save();
      }
      return null;
    } catch (error) {
      this.logger.error('Erro ao salvar reação', { error, messageId: reactionData.messageId });
      return null;
    }
  }

  /**
   * Busca mensagens de um grupo em um período específico
   */
  public async getMessagesOfDay(groupJid: string, date: string): Promise<IMessage[]> {
    try {
      if (this.isConnected) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return await Message.find({
          jid: groupJid,
          timestamp: {
            $gte: Math.floor(startOfDay.getTime() / 1000),
            $lte: Math.floor(endOfDay.getTime() / 1000)
          }
        }).sort({ timestamp: 1 });
      } else {
        // Fallback para local
        return await this.localHistoryService.getMessagesOfDay(date, groupJid);
      }
    } catch (error) {
      this.logger.error('Erro ao buscar mensagens do dia', { error, groupJid, date });
      
      // Fallback para local
      try {
        return await this.localHistoryService.getMessagesOfDay(date, groupJid);
      } catch (fallbackError) {
        this.logger.error('Erro também no fallback local', { fallbackError });
        return [];
      }
    }
  }

  /**
   * Gera resumo diário para um grupo
   */
  public async generateSummary(groupJid: string, date: string): Promise<IDailySummary | null> {
    try {
      if (this.isConnected) {
        // Busca mensagens do dia
        const messages = await this.getMessagesOfDay(groupJid, date);
        
        if (messages.length === 0) {
          return null;
        }

        // Calcula estatísticas
        const stats = this.calculateMessageStats(messages);
        const topUsers = this.getTopUsers(messages);
        const topCommands = this.getTopCommands(messages);
        const popularPhrases = this.getPopularPhrases(messages);
        const mediaCount = this.getMediaCount(messages);
        const peakActivityHour = this.getPeakActivityHour(messages);
        const aiInteractions = this.getAIInteractions(messages);

        // Cria o resumo
        const summary = new DailySummary({
          groupJid,
          date,
          personality: 'padrao', // Será atualizado pelo GroupService
          totalMessages: messages.length,
          totalMembers: 0, // Será atualizado pelo GroupService
          totalAdmins: 0, // Será atualizado pelo GroupService
          topUsers: topUsers.slice(0, 5),
          topCommands: topCommands.slice(0, 5),
          popularPhrases: popularPhrases.slice(0, 5),
          aiInteractions,
          mediaCount,
          peakActivityHour
        });

        return await summary.save();
      } else {
        // Fallback para local
        return await this.localHistoryService.getDailySummary(date, groupJid);
      }
    } catch (error) {
      this.logger.error('Erro ao gerar resumo', { error, groupJid, date });
      return null;
    }
  }

  /**
   * Salva estatística de uso de comando com novos campos
   */
  public async saveCommandUsage(
    groupJid: string, 
    command: string, 
    user: string, 
    options?: {
      success?: boolean;
      error?: string;
      executionTime?: number;
      args?: string[];
      isAIResponse?: boolean;
    }
  ): Promise<void> {
    try {
      if (this.isConnected) {
        const updateData: any = {
          $inc: { count: 1, totalUsage: 1 },
          $set: { 
            lastUsed: new Date(),
            updatedAt: new Date()
          }
        };

        // Adicionar novos campos se fornecidos
        if (options) {
          if (options.success !== undefined) updateData.$set.success = options.success;
          if (options.error) updateData.$set.error = options.error;
          if (options.executionTime) updateData.$set.executionTime = options.executionTime;
          if (options.args) updateData.$set.args = options.args;
          if (options.isAIResponse !== undefined) {
            updateData.$set['context.isAIResponse'] = options.isAIResponse;
          }
        }

        await CommandUsage.findOneAndUpdate(
          { groupJid, command, user },
          updateData,
          { upsert: true }
        );
      }
      // Não salva localmente pois não é crítico
    } catch (error) {
      this.logger.error('Erro ao salvar uso de comando', { error, groupJid, command, user });
    }
  }

  /**
   * Salva log de erro com novos campos
   */
  public async saveErrorLog(errorData: Partial<IErrorLog>): Promise<void> {
    try {
      if (this.isConnected) {
        const enhancedErrorData = {
          ...errorData,
          botVersion: this.botVersion,
          environment: process.env.NODE_ENV || 'production',
          schemaVersion: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const errorLog = new ErrorLogs(enhancedErrorData);
        await errorLog.save();
      }
      // Sempre loga localmente também
      this.logger.error('Erro registrado', errorData);
    } catch (error) {
      this.logger.error('Erro ao salvar log de erro', { error, originalError: errorData });
    }
  }

  /**
   * Sincroniza dados locais com MongoDB
   */
  public async syncLocalData(): Promise<{ synced: number; errors: number }> {
    try {
      if (!this.isConnected) {
        this.logger.warn('MongoDB não está conectado, não é possível sincronizar');
        return { synced: 0, errors: 1 };
      }

      return await this.localHistoryService.syncWithMongoDB();
    } catch (error) {
      this.logger.error('Erro ao sincronizar dados locais', { error });
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Cria backup dos dados locais
   */
  public async createBackup(): Promise<string> {
    try {
      return await this.localHistoryService.createBackup();
    } catch (error) {
      this.logger.error('Erro ao criar backup', { error });
      throw error;
    }
  }

  /**
   * Verifica se o MongoDB está conectado
   */
  public isMongoConnected(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Atualiza a versão do bot
   */
  public setBotVersion(version: string): void {
    this.botVersion = version;
  }

  // Métodos privados auxiliares (reutilizados do DailySummaryService)

  private calculateMessageStats(messages: IMessage[]): any {
    const stats = {
      totalMessages: messages.length,
      textMessages: 0,
      mediaMessages: 0,
      commandMessages: 0,
      aiInteractions: 0
    };

    for (const message of messages) {
      if (message.type === 'textMessage') {
        stats.textMessages++;
      } else {
        stats.mediaMessages++;
      }

      if (message.commandUsed) {
        stats.commandMessages++;
      }

      if (message.personality || message.context?.isAIResponse) {
        stats.aiInteractions++;
      }
    }

    return stats;
  }

  private getTopUsers(messages: IMessage[]): Array<{ jid: string; name: string; messageCount: number }> {
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
      .sort((a, b) => b.messageCount - a.messageCount);
  }

  private getTopCommands(messages: IMessage[]): Array<{ name: string; count: number }> {
    const commandCounts = new Map<string, number>();

    for (const message of messages) {
      if (message.commandUsed) {
        const count = commandCounts.get(message.commandUsed.name) || 0;
        commandCounts.set(message.commandUsed.name, count + 1);
      }
    }

    return Array.from(commandCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private getPopularPhrases(messages: IMessage[]): Array<{ text: string; count: number; engagement: number }> {
    const phraseCounts = new Map<string, number>();

    for (const message of messages) {
      if (message.text && message.text.length > 10) {
        const normalizedText = message.text.toLowerCase().trim();
        const count = phraseCounts.get(normalizedText) || 0;
        phraseCounts.set(normalizedText, count + 1);
      }
    }

    return Array.from(phraseCounts.entries())
      .map(([text, count]) => ({
        text,
        count,
        engagement: count * 1.5
      }))
      .sort((a, b) => b.engagement - a.engagement);
  }

  private getMediaCount(messages: IMessage[]): {
    images: number;
    videos: number;
    audios: number;
    documents: number;
    stickers: number;
  } {
    const mediaCount = {
      images: 0,
      videos: 0,
      audios: 0,
      documents: 0,
      stickers: 0
    };

    for (const message of messages) {
      switch (message.type) {
        case 'imageMessage':
          mediaCount.images++;
          break;
        case 'videoMessage':
          mediaCount.videos++;
          break;
        case 'audioMessage':
          mediaCount.audios++;
          break;
        case 'documentMessage':
          mediaCount.documents++;
          break;
        case 'stickerMessage':
          mediaCount.stickers++;
          break;
      }
    }

    return mediaCount;
  }

  private getPeakActivityHour(messages: IMessage[]): number {
    const hourCounts = new Array(24).fill(0);

    for (const message of messages) {
      const date = new Date(message.timestamp * 1000);
      const hour = date.getHours();
      hourCounts[hour]++;
    }

    return hourCounts.indexOf(Math.max(...hourCounts));
  }

  private getAIInteractions(messages: IMessage[]): number {
    return messages.filter(message => 
      message.personality || message.context?.isAIResponse
    ).length;
  }
} 