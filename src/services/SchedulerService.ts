import { injectable, inject } from 'inversify';
import { DailySummaryService } from './DailySummaryService';
import { DatabaseService } from './DatabaseService';
import Logger from '@/utils/Logger';
import { TYPES } from '@/config/container';

@injectable()
export class SchedulerService {
  private logger: typeof Logger;
  private dailySummaryInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.DailySummaryService) private dailySummaryService: DailySummaryService,
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {
    this.logger = Logger;
  }

  /**
   * Inicia todos os agendadores
   */
  public start(): void {
    this.logger.info('Iniciando agendadores...');
    
    // Gerar resumos diários às 00:00
    this.startDailySummaryScheduler();
    
    // Sincronizar dados locais a cada 6 horas
    this.startSyncScheduler();
    
    this.logger.info('Agendadores iniciados com sucesso');
  }

  /**
   * Para todos os agendadores
   */
  public stop(): void {
    this.logger.info('Parando agendadores...');
    
    if (this.dailySummaryInterval) {
      clearInterval(this.dailySummaryInterval);
      this.dailySummaryInterval = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.logger.info('Agendadores parados');
  }

  /**
   * Agendador para resumos diários
   */
  private startDailySummaryScheduler(): void {
    // Calcular tempo até próxima meia-noite
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    // Agendar primeira execução
    setTimeout(() => {
      this.generateDailySummaries();
      
      // Agendar execuções diárias
      this.dailySummaryInterval = setInterval(() => {
        this.generateDailySummaries();
      }, 24 * 60 * 60 * 1000); // 24 horas
    }, timeUntilMidnight);
    
    this.logger.info(`Resumos diários agendados para ${tomorrow.toISOString()}`);
  }

  /**
   * Agendador para sincronização de dados
   */
  private startSyncScheduler(): void {
    // Sincronizar a cada 6 horas
    this.syncInterval = setInterval(() => {
      this.syncLocalData();
    }, 6 * 60 * 60 * 1000); // 6 horas
    
    this.logger.info('Sincronização de dados agendada para cada 6 horas');
  }

  /**
   * Gera resumos diários para todos os grupos
   */
  private async generateDailySummaries(): Promise<void> {
    try {
      this.logger.info('Executando geração automática de resumos diários...');
      await this.dailySummaryService.generateDailySummaries();
      this.logger.info('Resumos diários gerados com sucesso');
    } catch (error) {
      this.logger.error('Erro ao gerar resumos diários', { error });
    }
  }

  /**
   * Sincroniza dados locais com MongoDB
   */
  private async syncLocalData(): Promise<void> {
    try {
      this.logger.info('Executando sincronização automática de dados...');
      const result = await this.databaseService.syncLocalData();
      this.logger.info('Sincronização concluída', { 
        synced: result.synced, 
        errors: result.errors 
      });
    } catch (error) {
      this.logger.error('Erro ao sincronizar dados', { error });
    }
  }

  /**
   * Executa tarefa manualmente (para testes)
   */
  public async runDailySummaryNow(): Promise<void> {
    this.logger.info('Executando resumo diário manualmente...');
    await this.generateDailySummaries();
  }

  /**
   * Executa sincronização manualmente (para testes)
   */
  public async runSyncNow(): Promise<void> {
    this.logger.info('Executando sincronização manualmente...');
    await this.syncLocalData();
  }
} 