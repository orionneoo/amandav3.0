import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';
import { IAlertService, IAlert } from '@/interfaces/ICommand';
import { DatabaseService } from './DatabaseService';
import { WASocket } from '@whiskeysockets/baileys';
import Logger from '@/utils/Logger';

@injectable()
export class AlertService implements IAlertService {
  private alerts: IAlert[] = [];
  private maxAlerts = 100; // Limite de alertas em memória
  private ownerNumbers = [
    '5521967233931@s.whatsapp.net',
    '5521971200821@s.whatsapp.net'
  ];

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {}

  public async sendAlert(alertData: Omit<IAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    try {
      const alert: IAlert = {
        ...alertData,
        id: this.generateAlertId(),
        timestamp: new Date(),
        acknowledged: false
      };

      // Adicionar à lista de alertas
      this.alerts.unshift(alert);
      
      // Manter apenas os últimos maxAlerts
      if (this.alerts.length > this.maxAlerts) {
        this.alerts = this.alerts.slice(0, this.maxAlerts);
      }

      // Log do alerta
      Logger.warn(`ALERTA: ${alert.title}`, {
        type: alert.type,
        message: alert.message,
        metadata: alert.metadata
      });

      // Salvar no banco de dados
      await this.saveAlertToDatabase(alert);

      // Enviar notificação para o dono (se sock estiver disponível)
      await this.notifyOwner(alert);

    } catch (error) {
      Logger.error('Erro ao enviar alerta', { error, alertData });
    }
  }

  public getAlerts(limit: number = 50): IAlert[] {
    return this.alerts.slice(0, limit);
  }

  public acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      Logger.info(`Alerta ${alertId} marcado como reconhecido`);
    }
  }

  public clearAlerts(): void {
    this.alerts = [];
    Logger.info('Todos os alertas foram limpos');
  }

  // NOVO: Método para enviar notificação via WhatsApp
  private async notifyOwner(alert: IAlert): Promise<void> {
    try {
      // Buscar sock do container (se disponível)
      const { container } = await import('@/core/container');
      const bot = container.get(TYPES.Bot);
      
      if (bot && (bot as any).sock) {
        const sock = (bot as any).sock as WASocket;
        
        const alertEmoji = this.getAlertEmoji(alert.type);
        const message = `${alertEmoji} *ALERTA DO SISTEMA*\n\n` +
                       `📋 *${alert.title}*\n` +
                       `📝 ${alert.message}\n` +
                       `⏰ ${alert.timestamp.toLocaleString('pt-BR')}\n\n` +
                       `🔧 Use \`!dono alertas\` para ver todos os alertas`;

        // Enviar para todos os números do dono
        for (const ownerNumber of this.ownerNumbers) {
          try {
            await sock.sendMessage(ownerNumber, { text: message });
            Logger.info(`Alerta enviado para ${ownerNumber}`);
          } catch (error) {
            Logger.error(`Erro ao enviar alerta para ${ownerNumber}`, { error });
          }
        }
      }
    } catch (error) {
      Logger.error('Erro ao notificar dono', { error });
    }
  }

  // NOVO: Salvar alerta no banco de dados
  private async saveAlertToDatabase(alert: IAlert): Promise<void> {
    try {
      // Implementar salvamento no MongoDB quando necessário
      // Por enquanto, apenas log
      Logger.info('Alerta salvo no banco de dados', { alertId: alert.id });
    } catch (error) {
      Logger.error('Erro ao salvar alerta no banco', { error });
    }
  }

  // NOVO: Gerar ID único para alerta
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // NOVO: Obter emoji baseado no tipo de alerta
  private getAlertEmoji(type: string): string {
    switch (type) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '📢';
    }
  }

  // NOVO: Método para criar alertas de performance
  public async createPerformanceAlert(metric: string, value: number, threshold: number): Promise<void> {
    const alertType = value > threshold ? 'warning' : 'info';
    const title = `Problema de Performance: ${metric}`;
    const message = `${metric} está em ${value} (limite: ${threshold})`;

    await this.sendAlert({
      type: alertType,
      title,
      message,
      metadata: { metric, value, threshold }
    });
  }

  // NOVO: Método para criar alertas de sistema
  public async createSystemAlert(type: 'error' | 'warning' | 'info' | 'success', title: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      type,
      title,
      message,
      metadata
    });
  }
} 