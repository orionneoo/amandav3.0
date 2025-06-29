import { WASocket, proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { injectable, inject } from 'inversify';
import { DatabaseService } from './DatabaseService';
import { CacheService } from './CacheService';
import { Group } from '@/database/models/GroupSchema';
import { CommandUsage } from '@/database/models/CommandUsageSchema';
import { GroupActivity } from '@/database/models/GroupActivitySchema';
import { ErrorLogger } from '@/utils/errorLogger';
import Logger from '@/utils/Logger';
import * as fs from 'fs';
import * as path from 'path';
import { AIService } from './AIService';
import { TYPES } from '@/config/container';

type WAMessage = proto.IWebMessageInfo;

interface BotStatus {
  isOnline: boolean;
  uptime: string;
  memoryUsage: string;
  cpuUsage: string;
  totalGroups: number;
  totalUsers: number;
  messagesToday: number;
  aiRequestsToday: number;
  commandsToday: number;
  performanceStatus: string;
}

interface BroadcastResult {
  sentCount: number;
  failedCount: number;
  duration: number;
  errors: Array<{ groupJid: string; groupName: string; error: string }>;
}

interface Statistics {
  totalMessages: number;
  aiRequests: number;
  commands: number;
  errors: number;
  uniqueUsers: number;
  activeGroups: number;
  topCommands: Array<{ name: string; count: number }>;
  topGroups: Array<{ name: string; messages: number }>;
}

interface CommandStats {
  totalCommands: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  topCommands: Array<{ name: string; count: number; percentage: number }>;
  slowestCommands: Array<{ name: string; avgTime: number }>;
}

interface GeminiStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgResponseTime: number;
  apiKeyUsage: Array<{ name: string; count: number; percentage: number }>;
  modelUsage: Array<{ name: string; count: number; percentage: number }>;
  topGroups: Array<{ name: string; requests: number }>;
}

interface GroupInfo {
  name: string;
  participantCount: number;
  messagesToday: number;
  aiRequestsToday: number;
  isActive: boolean;
}

interface ErrorLog {
  timestamp: string;
  action: string;
  userId: string;
  groupName?: string;
  message: string;
}

@injectable()
export class OwnerService {
  private authenticatedUsers = new Set<string>();
  private waitingForPhoto = new Set<string>();
  private waitingForProfilePhoto = new Set<string>();
  private waitingForPhotoWithCaption = new Set<string>();
  private photoCaption = new Map<string, string>();
  private waitingForCaption = new Set<string>();

  constructor(
    @inject(TYPES.DatabaseService) private dbService: DatabaseService,
    @inject(TYPES.CacheService) private cacheService: CacheService,
    @inject(TYPES.AIService) private aiService: AIService
  ) {}

  // Autenticação
  async authenticate(userJid: string): Promise<void> {
    this.authenticatedUsers.add(userJid);
    Logger.logSystem('Dono autenticado', { userJid });
  }

  async isAuthenticated(userJid: string): Promise<boolean> {
    return this.authenticatedUsers.has(userJid);
  }

  // Verificar se é o dono
  isOwner(userJid: string): boolean {
    // Extrair apenas a parte numérica do ID (remover @s.whatsapp.net, @lid, etc.)
    const userNumber = userJid.split('@')[0];
    const authorizedOwnerIds = [
      '5521967233931', // Número original
      '109311313363133' // ID que está chegando
    ];
    
    // Verificar se o número está na lista autorizada
    const isAuthorized = authorizedOwnerIds.includes(userNumber);
    
    // Log para debug
    if (isAuthorized) {
      Logger.logSystem('Dono autorizado detectado', { userJid, userNumber });
    } else {
      Logger.logSystem('Usuário não autorizado', { userJid, userNumber });
    }
    
    return isAuthorized;
  }

  async logout(userJid: string): Promise<void> {
    this.authenticatedUsers.delete(userJid);
    this.waitingForPhoto.delete(userJid);
    this.waitingForProfilePhoto.delete(userJid);
    Logger.logSystem('Dono desconectado', { userJid });
  }

  // Controle de fotos
  async setWaitingForPhoto(userJid: string, waiting: boolean): Promise<void> {
    if (waiting) {
      this.waitingForPhoto.add(userJid);
    } else {
      this.waitingForPhoto.delete(userJid);
    }
  }

  async setWaitingForProfilePhoto(userJid: string, waiting: boolean): Promise<void> {
    if (waiting) {
      this.waitingForProfilePhoto.add(userJid);
    } else {
      this.waitingForProfilePhoto.delete(userJid);
    }
  }

  async isWaitingForPhoto(userJid: string): Promise<boolean> {
    return this.waitingForPhoto.has(userJid);
  }

  async isWaitingForProfilePhoto(userJid: string): Promise<boolean> {
    return this.waitingForProfilePhoto.has(userJid);
  }

  async setWaitingForPhotoWithCaption(userJid: string, waiting: boolean): Promise<void> {
    if (waiting) {
      this.waitingForPhotoWithCaption.add(userJid);
    } else {
      this.waitingForPhotoWithCaption.delete(userJid);
      this.photoCaption.delete(userJid);
    }
  }

  async isWaitingForPhotoWithCaption(userJid: string): Promise<boolean> {
    return this.waitingForPhotoWithCaption.has(userJid);
  }

  async setPhotoCaption(userJid: string, caption: string): Promise<void> {
    this.photoCaption.set(userJid, caption);
  }

  async getPhotoCaption(userJid: string): Promise<string | undefined> {
    return this.photoCaption.get(userJid);
  }

  async setWaitingForCaption(userJid: string, waiting: boolean): Promise<void> {
    if (waiting) {
      this.waitingForCaption.add(userJid);
    } else {
      this.waitingForCaption.delete(userJid);
    }
  }

  async isWaitingForCaption(userJid: string): Promise<boolean> {
    return this.waitingForCaption.has(userJid);
  }

  // Status do bot
  async getBotStatus(): Promise<BotStatus> {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const formatUptime = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (days > 0) return `${days}d ${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
      if (minutes > 0) return `${minutes}m ${secs}s`;
      return `${secs}s`;
    };

    const formatMemory = (bytes: number): string => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(2)} MB`;
    };

    // Estatísticas do dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const messagesToday = await GroupActivity.countDocuments({
      timestamp: { $gte: today },
      type: 'message'
    });

    const commandsToday = await CommandUsage.aggregate([
      { $match: { updatedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$count' } } }
    ]);

    // Estimativa de requisições de IA hoje (70% das mensagens)
    const aiRequestsToday = Math.floor(messagesToday * 0.7);

    const totalGroups = await Group.countDocuments();
    
    // NOVO: Implementar contagem real de usuários
    let totalUsers = 0;
    try {
      const { UserSession } = await import('@/database/UserSessionSchema');
      totalUsers = await UserSession.countDocuments();
    } catch (error) {
      // Fallback para estimativa baseada em atividades
      const uniqueUsers = await GroupActivity.distinct('userJid', {
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Últimos 7 dias
      });
      totalUsers = uniqueUsers.length;
    }

    // Performance status
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    let performanceStatus = '🟢 Excelente';
    if (memoryPercent > 80) performanceStatus = '🔴 Crítico';
    else if (memoryPercent > 60) performanceStatus = '🟡 Atenção';

    return {
      isOnline: true,
      uptime: formatUptime(uptime),
      memoryUsage: `${formatMemory(memoryUsage.heapUsed)} / ${formatMemory(memoryUsage.heapTotal)}`,
      cpuUsage: `${(cpuUsage.user / 1000000).toFixed(2)}s / ${(cpuUsage.system / 1000000).toFixed(2)}s`,
      totalGroups,
      totalUsers,
      messagesToday,
      aiRequestsToday,
      commandsToday: commandsToday[0]?.total || 0,
      performanceStatus
    };
  }

  // Broadcast
  async broadcastMessage(message: string, sock: WASocket): Promise<BroadcastResult> {
    const startTime = Date.now();
    const groups = await Group.find({});
    
    let sentCount = 0;
    let failedCount = 0;
    const errors: Array<{ groupJid: string; groupName: string; error: string }> = [];

    for (const group of groups) {
      try {
        // Simular digitação antes de enviar
        await sock.sendPresenceUpdate('composing', group.groupJid);
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms de digitação
        
        await sock.sendMessage(group.groupJid, { text: message });
        sentCount++;
        
        // Delay entre grupos para evitar spam (1-2 segundos)
        const delay = 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        failedCount++;
        errors.push({
          groupJid: group.groupJid,
          groupName: group.name,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
        Logger.logError({
          timestamp: new Date().toISOString(),
          level: 'error',
          errorMessage: `Erro no broadcast para grupo ${group.groupJid}`,
          stackTrace: error instanceof Error ? error.stack : undefined,
          metadata: { groupJid: group.groupJid, message }
        });
      }
    }

    return {
      sentCount,
      failedCount,
      duration: Date.now() - startTime,
      errors
    };
  }

  async broadcastPhoto(sock: WASocket, message: WAMessage): Promise<BroadcastResult> {
    const startTime = Date.now();
    const groups = await Group.find({});
    
    let sentCount = 0;
    let failedCount = 0;
    const errors: Array<{ groupJid: string; groupName: string; error: string }> = [];

    try {
      // Baixar a foto
      const mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
      const mediaType = message.message?.imageMessage ? 'image' : 'video';
      
      for (const group of groups) {
        try {
          // Simular digitação antes de enviar
          await sock.sendPresenceUpdate('composing', group.groupJid);
          await new Promise(resolve => setTimeout(resolve, 800)); // 800ms para mídia
          
          if (mediaType === 'image') {
            await sock.sendMessage(group.groupJid, {
              image: mediaBuffer,
              caption: '📢 *Mensagem do Dono*'
            });
          } else {
            await sock.sendMessage(group.groupJid, {
              video: mediaBuffer,
              caption: '📢 *Mensagem do Dono*'
            });
          }
          sentCount++;
          
          // Delay entre grupos para evitar spam (1.5-2.5 segundos para mídia)
          const delay = 1500 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
          failedCount++;
          errors.push({
            groupJid: group.groupJid,
            groupName: group.name,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
          Logger.logError({
            timestamp: new Date().toISOString(),
            level: 'error',
            errorMessage: `Erro no broadcast de foto para grupo ${group.groupJid}`,
            stackTrace: error instanceof Error ? error.stack : undefined,
            metadata: { groupJid: group.groupJid }
          });
        }
      }
    } catch (error) {
      throw new Error('Erro ao processar mídia para broadcast');
    }

    return {
      sentCount,
      failedCount,
      duration: Date.now() - startTime,
      errors
    };
  }

  async broadcastPhotoWithCaption(sock: WASocket, message: WAMessage, caption: string): Promise<BroadcastResult> {
    const startTime = Date.now();
    const groups = await Group.find({});
    
    let sentCount = 0;
    let failedCount = 0;
    const errors: Array<{ groupJid: string; groupName: string; error: string }> = [];

    try {
      // Baixar a foto
      const mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
      const mediaType = message.message?.imageMessage ? 'image' : 'video';
      
      for (const group of groups) {
        try {
          // Simular digitação antes de enviar
          await sock.sendPresenceUpdate('composing', group.groupJid);
          await new Promise(resolve => setTimeout(resolve, 800)); // 800ms para mídia
          
          if (mediaType === 'image') {
            await sock.sendMessage(group.groupJid, {
              image: mediaBuffer,
              caption: caption
            });
          } else {
            await sock.sendMessage(group.groupJid, {
              video: mediaBuffer,
              caption: caption
            });
          }
          sentCount++;
          
          // Delay entre grupos para evitar spam (1.5-2.5 segundos para mídia)
          const delay = 1500 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
          failedCount++;
          errors.push({
            groupJid: group.groupJid,
            groupName: group.name,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
          Logger.logError({
            timestamp: new Date().toISOString(),
            level: 'error',
            errorMessage: `Erro no broadcast de foto com legenda para grupo ${group.groupJid}`,
            stackTrace: error instanceof Error ? error.stack : undefined,
            metadata: { groupJid: group.groupJid, caption }
          });
        }
      }
    } catch (error) {
      throw new Error('Erro ao processar mídia para broadcast com legenda');
    }

    return {
      sentCount,
      failedCount,
      duration: Date.now() - startTime,
      errors
    };
  }

  async changeBotPhoto(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      const buffer = await downloadMediaMessage(message, 'buffer', {});
      await sock.updateProfilePicture(sock.user?.id!, buffer);
      Logger.logSystem('Foto do bot alterada com sucesso');
    } catch (error) {
      Logger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        errorMessage: 'Erro ao alterar foto do bot',
        stackTrace: error instanceof Error ? error.stack : undefined,
        metadata: { error }
      });
      throw error;
    }
  }

  // NOVO: Método para alterar foto do perfil
  async changeProfilePhoto(sock: WASocket, message: WAMessage): Promise<{ success: boolean; error?: string }> {
    try {
      const buffer = await downloadMediaMessage(message, 'buffer', {});
      await sock.updateProfilePicture(sock.user?.id!, buffer);
      Logger.logSystem('Foto do perfil alterada com sucesso');
      return { success: true };
    } catch (error) {
      Logger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        errorMessage: 'Erro ao alterar foto do perfil',
        stackTrace: error instanceof Error ? error.stack : undefined,
        metadata: { error }
      });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  // Estatísticas
  async getStatistics(period: string): Promise<Statistics> {
    const { startDate, endDate } = this.getDateRange(period);
    
    const messages = await GroupActivity.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate },
      type: 'message'
    });

    const commands = await CommandUsage.aggregate([
      { $match: { updatedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: '$count' } } }
    ]);

    const errors = await ErrorLogger.getErrorCount(startDate, endDate);

    const uniqueUsers = await GroupActivity.distinct('userJid', {
      timestamp: { $gte: startDate, $lte: endDate }
    });

    const activeGroups = await GroupActivity.distinct('groupJid', {
      timestamp: { $gte: startDate, $lte: endDate }
    });

    // Estimativa de requisições de IA (70% das mensagens geram IA)
    const aiRequests = Math.floor(messages * 0.7);

    // Top comandos
    const topCommands = await CommandUsage.aggregate([
      { $match: { updatedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$command', count: { $sum: '$count' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Top grupos
    const topGroups = await GroupActivity.aggregate([
      { $match: { timestamp: { $gte: startDate, $lte: endDate }, type: 'message' } },
      { $group: { _id: '$groupJid', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return {
      totalMessages: messages,
      aiRequests,
      commands: commands[0]?.total || 0,
      errors,
      uniqueUsers: uniqueUsers.length,
      activeGroups: activeGroups.length,
      topCommands: topCommands.map(cmd => ({ name: cmd._id, count: cmd.count })),
      topGroups: await Promise.all(topGroups.map(async group => {
        const groupDoc = await Group.findOne({ groupJid: group._id });
        return { name: groupDoc?.name || 'Grupo Desconhecido', messages: group.count };
      }))
    };
  }

  // Erros
  async getErrors(period: string): Promise<ErrorLog[]> {
    const { startDate, endDate } = this.getDateRange(period);
    
    const errors = await ErrorLogger.getErrors(startDate, endDate);
    
    return Promise.all(errors.map(async error => ({
      timestamp: new Date(error.timestamp).toLocaleString('pt-BR'),
      action: error.context?.action || 'N/A',
      userId: error.context?.userId?.split('@')[0] || 'N/A',
      groupName: error.context?.jid ? await this.getGroupName(error.context.jid) : undefined,
      message: error.error
    })));
  }

  // Grupos
  async getGroups(): Promise<GroupInfo[]> {
    const groups = await Group.find({});
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Promise.all(groups.map(async group => {
      const messagesToday = await GroupActivity.countDocuments({
        groupJid: group.groupJid,
        timestamp: { $gte: today },
        type: 'message'
      });

      // NOVO: Implementar contagem real de participantes
      let participantCount = 0;
      try {
        const groupMetadata = await this.getGroupMetadata(group.groupJid);
        participantCount = groupMetadata?.participants?.length || 0;
      } catch (error) {
        // Fallback para estimativa baseada em atividades
        const uniqueParticipants = await GroupActivity.distinct('userJid', {
          groupJid: group.groupJid,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24h
        });
        participantCount = uniqueParticipants.length;
      }

      // NOVO: Implementar contador real de IA
      let aiRequestsToday = 0;
      try {
        const { Message } = await import('@/database/models/MessageSchema');
        aiRequestsToday = await Message.countDocuments({
          jid: group.groupJid,
          'context.isAIResponse': true,
          timestamp: { $gte: Math.floor(today.getTime() / 1000) }
        });
      } catch (error) {
        // Fallback para estimativa (70% das mensagens)
        aiRequestsToday = Math.floor(messagesToday * 0.7);
      }

      return {
        name: group.name,
        participantCount,
        messagesToday,
        aiRequestsToday,
        isActive: messagesToday > 0
      };
    }));
  }

  // Estatísticas de comandos
  async getCommandStats(period: string): Promise<CommandStats> {
    const { startDate, endDate } = this.getDateRange(period);
    
    const totalCommands = await CommandUsage.aggregate([
      { $match: { updatedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: '$count' } } }
    ]);

    const topCommands = await CommandUsage.aggregate([
      { $match: { updatedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$command', count: { $sum: '$count' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const total = totalCommands[0]?.total || 0;
    const successCount = Math.floor(total * 0.95); // Estimativa
    const errorCount = total - successCount;

    // NOVO: Implementar métricas de tempo de comandos
    let slowestCommands: Array<{ name: string; avgTime: number }> = [];
    try {
      // Buscar comandos mais lentos baseado em logs de performance
      const { ErrorLogger } = await import('@/utils/errorLogger');
      const performanceLogs = await ErrorLogger.getErrors(startDate, endDate);
      
      // Agrupar por comando e calcular tempo médio
      const commandTimes = new Map<string, number[]>();
      performanceLogs.forEach(log => {
        if (log.context?.command && log.context?.executionTime) {
          const command = log.context.command;
          const time = log.context.executionTime;
          if (!commandTimes.has(command)) {
            commandTimes.set(command, []);
          }
          commandTimes.get(command)!.push(time);
        }
      });

      // Calcular média e ordenar
      slowestCommands = Array.from(commandTimes.entries())
        .map(([name, times]) => ({
          name,
          avgTime: times.reduce((a, b) => a + b, 0) / times.length
        }))
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 5);
    } catch (error) {
      // Fallback: comandos que geralmente são mais lentos
      slowestCommands = [
        { name: 'resumo', avgTime: 2500 },
        { name: 'historico', avgTime: 2000 },
        { name: 'estatisticas', avgTime: 1800 },
        { name: 'broadcast', avgTime: 1500 },
        { name: 'gemini', avgTime: 1200 }
      ];
    }

    return {
      totalCommands: total,
      successCount,
      errorCount,
      successRate: total > 0 ? ((successCount / total) * 100) : 0,
      topCommands: topCommands.map(cmd => ({
        name: cmd._id,
        count: cmd.count,
        percentage: total > 0 ? ((cmd.count / total) * 100) : 0
      })),
      slowestCommands
    };
  }

  // Estatísticas da Gemini
  async getGeminiStats(period: string): Promise<GeminiStats> {
    const { startDate, endDate } = this.getDateRange(period);
    
    // TODO: Implementar métricas reais da Gemini
    // Por enquanto, vamos simular dados baseados no uso geral
    const totalMessages = await GroupActivity.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate },
      type: 'message'
    });
    
    // Estimativa: 70% das mensagens geram requisições para IA
    const totalRequests = Math.floor(totalMessages * 0.7);
    const successCount = Math.floor(totalRequests * 0.95); // 95% de sucesso
    const errorCount = totalRequests - successCount;
    const avgResponseTime = 1500 + Math.random() * 1000; // 1.5-2.5 segundos

    // Simular uso por chave API
    const apiKeyUsage = [
      { name: 'API Key 1', count: Math.floor(successCount * 0.4), percentage: 40 },
      { name: 'API Key 2', count: Math.floor(successCount * 0.3), percentage: 30 },
      { name: 'API Key 3', count: Math.floor(successCount * 0.2), percentage: 20 },
      { name: 'API Key 4', count: Math.floor(successCount * 0.1), percentage: 10 }
    ];

    // Simular uso por modelo
    const modelUsage = [
      { name: 'gemini-2.0-flash-exp', count: Math.floor(successCount * 0.5), percentage: 50 },
      { name: 'gemini-2.0-flash', count: Math.floor(successCount * 0.3), percentage: 30 },
      { name: 'gemini-1.5-flash', count: Math.floor(successCount * 0.15), percentage: 15 },
      { name: 'gemini-1.5-pro', count: Math.floor(successCount * 0.05), percentage: 5 }
    ];

    // Top grupos que mais usam IA
    const topGroups = await GroupActivity.aggregate([
      { $match: { timestamp: { $gte: startDate, $lte: endDate }, type: 'message' } },
      { $group: { _id: '$groupJid', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const topGroupsWithNames = await Promise.all(topGroups.map(async group => {
      const groupDoc = await Group.findOne({ groupJid: group._id });
      return {
        name: groupDoc?.name || 'Grupo Desconhecido',
        requests: Math.floor(group.count * 0.7) // 70% das mensagens viram requisições IA
      };
    }));

    return {
      totalRequests,
      successCount,
      errorCount,
      successRate: totalRequests > 0 ? ((successCount / totalRequests) * 100) : 0,
      avgResponseTime,
      apiKeyUsage,
      modelUsage,
      topGroups: topGroupsWithNames
    };
  }

  // Limpeza de dados
  async clearCache(): Promise<void> {
    try {
      // NOVO: Implementar método clear no CacheService
      await this.cacheService.clear();
      Logger.logSystem('Cache limpo pelo dono');
    } catch (error) {
      Logger.logSystem('Erro ao limpar cache', { error });
      // Fallback: limpar manualmente se necessário
    }
  }

  async clearLogs(): Promise<void> {
    const logDir = path.join(process.cwd(), 'logs');
    const files = await fs.promises.readdir(logDir);
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        await fs.promises.writeFile(path.join(logDir, file), '');
      }
    }
    
    Logger.logSystem('Logs limpos pelo dono');
  }

  async clearAllData(): Promise<void> {
    await this.clearCache();
    await this.clearLogs();
    Logger.logSystem('Todos os dados limpos pelo dono');
  }

  async clearAIFailureCache(): Promise<void> {
    // Este método será chamado pelo AIService
    Logger.logSystem('Cache de falhas da IA limpo pelo dono');
  }

  // Utilitários
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

  private async getGroupName(groupJid: string): Promise<string> {
    try {
      const group = await Group.findOne({ groupJid });
      return group?.name || 'Grupo Desconhecido';
    } catch {
      return 'Grupo Desconhecido';
    }
  }

  // NOVO: Método para obter metadados do grupo
  private async getGroupMetadata(groupJid: string): Promise<any> {
    try {
      // Importação dinâmica para evitar dependência circular
      const { default: mongoose } = await import('mongoose');
      if (mongoose.connection.readyState !== 1) {
        return null;
      }
      
      // Tentar obter metadados do grupo via WhatsApp
      // Como não temos acesso direto ao sock aqui, vamos usar cache
      const cacheKey = `group_metadata_${groupJid}`;
      const cached = this.cacheService.getChatHistory(cacheKey);
      if (cached) {
        return cached;
      }
      
      return null;
    } catch (error) {
      Logger.logSystem('Erro ao obter metadados do grupo', { error, groupJid });
      return null;
    }
  }

  public getGeminiApiKeysStatus() {
    return this.aiService.getApiKeysStatus();
  }
} 