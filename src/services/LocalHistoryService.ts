import fs from 'fs/promises';
import path from 'path';
import { injectable } from 'inversify';
import { IMessage } from '@/database/models/MessageSchema';
import { IDailySummary } from '@/database/models/DailySummarySchema';
import Logger from '@/utils/Logger';

@injectable()
export class LocalHistoryService {
  private readonly baseDir = 'local_history';
  private logger: typeof Logger;

  constructor() {
    this.logger = Logger;
  }

  /**
   * Salva uma mensagem no arquivo JSON local
   */
  public async saveMessage(message: IMessage): Promise<void> {
    try {
      const date = new Date(message.timestamp * 1000).toISOString().split('T')[0];
      const groupId = message.jid;
      const filePath = this.getFilePath(date, groupId);
      
      // Garante que o diretório existe
      await this.ensureDirectoryExists(path.dirname(filePath));
      
      // Lê o arquivo existente ou cria um novo
      let data = await this.readLocalFile(filePath);
      
      // Adiciona a mensagem
      if (!data.messages) {
        data.messages = [];
      }
      data.messages.push({
        id: message._id,
        from: message.from,
        timestamp: message.timestamp,
        text: message.text,
        type: message.type,
        commandUsed: message.commandUsed,
        personality: message.personality
      });
      
      // Atualiza estatísticas
      data.stats = this.updateStats(data.stats, message);
      
      // Salva o arquivo
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      this.logger.debug(`Mensagem salva localmente: ${filePath}`);
    } catch (error) {
      this.logger.error('Erro ao salvar mensagem localmente', { error, messageId: message._id });
    }
  }

  /**
   * Salva um resumo diário no arquivo JSON local
   */
  public async saveDailySummary(summary: IDailySummary): Promise<void> {
    try {
      const filePath = this.getFilePath(summary.date, summary.groupJid);
      
      // Garante que o diretório existe
      await this.ensureDirectoryExists(path.dirname(filePath));
      
      // Lê o arquivo existente ou cria um novo
      let data = await this.readLocalFile(filePath);
      
      // Atualiza o resumo
      data.dailySummary = {
        groupJid: summary.groupJid,
        date: summary.date,
        personality: summary.personality,
        totalMessages: summary.totalMessages,
        totalMembers: summary.totalMembers,
        totalAdmins: summary.totalAdmins,
        topUsers: summary.topUsers,
        topCommands: summary.topCommands,
        popularPhrases: summary.popularPhrases,
        aiInteractions: summary.aiInteractions,
        mediaCount: summary.mediaCount,
        peakActivityHour: summary.peakActivityHour
      };
      
      // Salva o arquivo
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      this.logger.debug(`Resumo diário salvo localmente: ${filePath}`);
    } catch (error) {
      this.logger.error('Erro ao salvar resumo diário localmente', { error, groupJid: summary.groupJid });
    }
  }

  /**
   * Busca mensagens de um grupo em uma data específica
   */
  public async getMessagesOfDay(date: string, groupId: string): Promise<IMessage[]> {
    try {
      const filePath = this.getFilePath(date, groupId);
      const data = await this.readLocalFile(filePath);
      return data.messages || [];
    } catch (error) {
      this.logger.error('Erro ao buscar mensagens locais', { error, date, groupId });
      return [];
    }
  }

  /**
   * Busca resumo diário de um grupo
   */
  public async getDailySummary(date: string, groupId: string): Promise<IDailySummary | null> {
    try {
      const filePath = this.getFilePath(date, groupId);
      const data = await this.readLocalFile(filePath);
      return data.dailySummary || null;
    } catch (error) {
      this.logger.error('Erro ao buscar resumo diário local', { error, date, groupId });
      return null;
    }
  }

  /**
   * Sincroniza arquivos locais com o MongoDB
   */
  public async syncWithMongoDB(): Promise<{ synced: number; errors: number }> {
    try {
      const files = await this.getAllLocalFiles();
      let synced = 0;
      let errors = 0;

      for (const file of files) {
        try {
          const data = await this.readLocalFile(file);
          
          // Aqui você pode implementar a lógica para sincronizar com MongoDB
          // Por exemplo, chamar métodos do DatabaseService
          
          // Após sincronizar com sucesso, pode deletar o arquivo local
          // await fs.unlink(file);
          
          synced++;
        } catch (error) {
          this.logger.error('Erro ao sincronizar arquivo', { error, file });
          errors++;
        }
      }

      return { synced, errors };
    } catch (error) {
      this.logger.error('Erro ao sincronizar arquivos locais', { error });
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Lista todos os arquivos locais para backup
   */
  public async getAllLocalFiles(): Promise<string[]> {
    try {
      const files: string[] = [];
      await this.scanDirectory(this.baseDir, files);
      return files;
    } catch (error) {
      this.logger.error('Erro ao listar arquivos locais', { error });
      return [];
    }
  }

  /**
   * Cria backup de todos os arquivos locais
   */
  public async createBackup(): Promise<string> {
    try {
      const backupDir = `backup_${new Date().toISOString().split('T')[0]}`;
      const files = await this.getAllLocalFiles();
      
      for (const file of files) {
        const relativePath = path.relative(this.baseDir, file);
        const backupPath = path.join(backupDir, relativePath);
        
        await this.ensureDirectoryExists(path.dirname(backupPath));
        await fs.copyFile(file, backupPath);
      }
      
      this.logger.info(`Backup criado: ${backupDir}`);
      return backupDir;
    } catch (error) {
      this.logger.error('Erro ao criar backup', { error });
      throw error;
    }
  }

  // Métodos privados auxiliares

  private getFilePath(date: string, groupId: string): string {
    return path.join(this.baseDir, date, `${groupId}.json`);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async readLocalFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        groupId: path.basename(filePath, '.json'),
        date: path.basename(path.dirname(filePath)),
        messages: [],
        stats: {
          totalMessages: 0,
          topUsers: [],
          topCommands: []
        }
      };
    }
  }

  private updateStats(stats: any, message: IMessage): any {
    if (!stats) {
      stats = {
        totalMessages: 0,
        topUsers: [],
        topCommands: []
      };
    }

    stats.totalMessages++;

    // Atualiza usuários mais ativos
    const userIndex = stats.topUsers.findIndex((u: any) => u.jid === message.from);
    if (userIndex >= 0) {
      stats.topUsers[userIndex].messageCount++;
    } else {
      stats.topUsers.push({
        jid: message.from,
        name: message.from.split('@')[0],
        messageCount: 1
      });
    }

    // Atualiza comandos mais usados
    if (message.commandUsed) {
      const commandIndex = stats.topCommands.findIndex((c: any) => c.name === message.commandUsed!.name);
      if (commandIndex >= 0) {
        stats.topCommands[commandIndex].count++;
      } else {
        stats.topCommands.push({
          name: message.commandUsed.name,
          count: 1
        });
      }
    }

    // Ordena por quantidade
    stats.topUsers.sort((a: any, b: any) => b.messageCount - a.messageCount);
    stats.topCommands.sort((a: any, b: any) => b.count - a.count);

    // Mantém apenas top 10
    stats.topUsers = stats.topUsers.slice(0, 10);
    stats.topCommands = stats.topCommands.slice(0, 10);

    return stats;
  }

  private async scanDirectory(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Diretório não existe, ignora
    }
  }
} 