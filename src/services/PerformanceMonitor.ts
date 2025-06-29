import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';
import { IPerformanceMonitor, IPerformanceMetrics } from '@/interfaces/ICommand';
import { AlertService } from './AlertService';
import { AIService } from './AIService';
import { DatabaseService } from './DatabaseService';
import Logger from '@/utils/Logger';

@injectable()
export class PerformanceMonitor implements IPerformanceMonitor {
  private metricsHistory: IPerformanceMetrics[] = [];
  private maxHistorySize = 1000; // Manter histórico das últimas 1000 medições
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  // Thresholds para alertas
  private readonly thresholds = {
    cpu: 80, // 80% de CPU
    memory: 99, // 99% de memória (alterado de 60% para 99%)
    aiResponseTime: 10000, // 10 segundos
    databaseLatency: 5000, // 5 segundos
    errorRate: 10 // 10% de erro
  };

  // Contadores para cálculo de métricas
  private aiResponseTimes: number[] = [];
  private databaseLatencies: number[] = [];
  private errorCount = 0;
  private totalRequests = 0;

  constructor(
    @inject(TYPES.AlertService) private alertService: AlertService,
    @inject(TYPES.AIService) private aiService: AIService,
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {}

  public startMonitoring(): void {
    if (this.isMonitoring) {
      Logger.warn('PerformanceMonitor já está rodando');
      return;
    }

    this.isMonitoring = true;
    const interval = parseInt(process.env.PERFORMANCE_CHECK_INTERVAL || '30000', 10); // 30 segundos

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        Logger.error('Erro ao coletar métricas de performance', { error });
      }
    }, interval);

    Logger.info('PerformanceMonitor iniciado', { interval });
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    Logger.info('PerformanceMonitor parado');
  }

  public getMetrics(): IPerformanceMetrics {
    return this.metricsHistory[0] || this.createEmptyMetrics();
  }

  public getMetricsHistory(limit: number = 100): IPerformanceMetrics[] {
    return this.metricsHistory.slice(0, limit);
  }

  // NOVO: Coletar métricas do sistema
  private async collectMetrics(): Promise<void> {
    try {
      const startTime = Date.now();

      // Coletar métricas básicas do sistema
      const cpu = await this.getCPUUsage();
      const memory = await this.getMemoryUsage();
      const aiResponseTime = this.getAverageAIResponseTime();
      const databaseLatency = await this.getDatabaseLatency();
      const activeConnections = this.getActiveConnections();
      const errorRate = this.getErrorRate();

      const metrics: IPerformanceMetrics = {
        cpu,
        memory,
        aiResponseTime,
        databaseLatency,
        activeConnections,
        errorRate,
        timestamp: new Date()
      };

      // Adicionar ao histórico
      this.metricsHistory.unshift(metrics);
      
      // Manter apenas os últimos maxHistorySize
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(0, this.maxHistorySize);
      }

      // Verificar thresholds e enviar alertas
      await this.checkThresholds(metrics);

      Logger.debug('Métricas coletadas', {
        cpu: `${cpu}%`,
        memory: `${memory}%`,
        aiResponseTime: `${aiResponseTime}ms`,
        databaseLatency: `${databaseLatency}ms`,
        errorRate: `${errorRate}%`
      });

    } catch (error) {
      Logger.error('Erro ao coletar métricas', { error });
    }
  }

  // NOVO: Verificar thresholds e enviar alertas
  private async checkThresholds(metrics: IPerformanceMetrics): Promise<void> {
    const checks = [
      { metric: 'CPU', value: metrics.cpu, threshold: this.thresholds.cpu },
      { metric: 'Memória', value: metrics.memory, threshold: this.thresholds.memory },
      { metric: 'Tempo de Resposta da IA', value: metrics.aiResponseTime, threshold: this.thresholds.aiResponseTime },
      { metric: 'Latência do Banco', value: metrics.databaseLatency, threshold: this.thresholds.databaseLatency },
      { metric: 'Taxa de Erro', value: metrics.errorRate, threshold: this.thresholds.errorRate }
    ];

    for (const check of checks) {
      if (check.value > check.threshold) {
        await this.alertService.createPerformanceAlert(
          check.metric,
          check.value,
          check.threshold
        );
      }
    }
  }

  // NOVO: Obter uso de CPU
  private async getCPUUsage(): Promise<number> {
    try {
      const startUsage = process.cpuUsage();
      await new Promise(resolve => setTimeout(resolve, 100)); // Aguardar 100ms
      const endUsage = process.cpuUsage(startUsage);
      
      const totalCPU = endUsage.user + endUsage.system;
      const cpuPercent = (totalCPU / 100000) * 100; // Converter para porcentagem
      
      return Math.min(cpuPercent, 100);
    } catch (error) {
      Logger.error('Erro ao obter uso de CPU', { error });
      return 0;
    }
  }

  // NOVO: Obter uso de memória
  private async getMemoryUsage(): Promise<number> {
    try {
      const memUsage = process.memoryUsage();
      const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      return Math.min(memoryPercent, 100);
    } catch (error) {
      Logger.error('Erro ao obter uso de memória', { error });
      return 0;
    }
  }

  // NOVO: Obter tempo médio de resposta da IA
  private getAverageAIResponseTime(): number {
    if (this.aiResponseTimes.length === 0) return 0;
    
    const sum = this.aiResponseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.aiResponseTimes.length);
  }

  // NOVO: Obter latência do banco de dados
  private async getDatabaseLatency(): Promise<number> {
    try {
      const startTime = Date.now();
      
      // Teste simples de conexão
      const isConnected = this.databaseService.isMongoConnected();
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Adicionar à lista de latências
      this.databaseLatencies.push(latency);
      
      // Manter apenas as últimas 100 medições
      if (this.databaseLatencies.length > 100) {
        this.databaseLatencies = this.databaseLatencies.slice(-100);
      }
      
      return latency;
    } catch (error) {
      Logger.error('Erro ao medir latência do banco', { error });
      return 0;
    }
  }

  // NOVO: Obter conexões ativas
  private getActiveConnections(): number {
    // Implementação simplificada - pode ser expandida
    return 1; // Sempre pelo menos 1 conexão (WhatsApp)
  }

  // NOVO: Obter taxa de erro
  private getErrorRate(): number {
    if (this.totalRequests === 0) return 0;
    return (this.errorCount / this.totalRequests) * 100;
  }

  // NOVO: Registrar tempo de resposta da IA
  public recordAIResponseTime(responseTime: number): void {
    this.aiResponseTimes.push(responseTime);
    
    // Manter apenas as últimas 100 medições
    if (this.aiResponseTimes.length > 100) {
      this.aiResponseTimes = this.aiResponseTimes.slice(-100);
    }
  }

  // NOVO: Registrar erro
  public recordError(): void {
    this.errorCount++;
    this.totalRequests++;
  }

  // NOVO: Registrar requisição bem-sucedida
  public recordSuccess(): void {
    this.totalRequests++;
  }

  // NOVO: Criar métricas vazias
  private createEmptyMetrics(): IPerformanceMetrics {
    return {
      cpu: 0,
      memory: 0,
      aiResponseTime: 0,
      databaseLatency: 0,
      activeConnections: 0,
      errorRate: 0,
      timestamp: new Date()
    };
  }

  // NOVO: Obter status do monitoramento
  public getStatus(): { isMonitoring: boolean; metricsCount: number; lastCheck?: Date } {
    return {
      isMonitoring: this.isMonitoring,
      metricsCount: this.metricsHistory.length,
      lastCheck: this.metricsHistory[0]?.timestamp
    };
  }
} 