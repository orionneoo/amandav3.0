import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { AlertService } from '@/services/AlertService';
import { WASocket } from '@whiskeysockets/baileys';
import Logger from '@/utils/Logger';
import { MessageContext } from '@/handlers/message.handler';

@injectable()
export class AlertasCommand implements IInjectableCommand {
  public readonly name = 'alertas';
  public readonly description = 'Gerenciar alertas do sistema';
  public readonly usage = '!dono alertas [listar|limpar|reconhecer <id>]';
  public readonly aliases = ['alerts'];
  public readonly category = 'owner';
  public readonly adminOnly = false;
  public readonly ownerOnly = true;

  constructor(
    @inject(TYPES.AlertService) private alertService: AlertService
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args } = context;
    try {
      const action = args[0]?.toLowerCase() || 'listar';

      switch (action) {
        case 'listar':
        case 'list':
          await this.listAlerts(context);
          break;
        
        case 'limpar':
        case 'clear':
          await this.clearAlerts(context);
          break;
        
        case 'reconhecer':
        case 'ack':
          await this.acknowledgeAlert(context);
          break;
        
        case 'estatisticas':
        case 'stats':
          await this.showAlertStats(context);
          break;
        
        default:
          await this.showHelp(context);
          break;
      }

    } catch (error) {
      Logger.error('Erro no comando alertas', { error, args });
      if (message.key.remoteJid) {
        await sock.sendMessage(message.key.remoteJid, {
          text: '❌ Erro ao processar comando de alertas'
        });
      }
    }
  }

  private async listAlerts(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;
    
    const limit = parseInt(args[1]) || 10;
    const alerts = this.alertService.getAlerts(limit);

    if (alerts.length === 0) {
      await sock.sendMessage(remoteJid, {
        text: '📢 *ALERTAS DO SISTEMA*\n\nNenhum alerta encontrado.'
      });
      return;
    }

    let alertText = `📢 *ALERTAS DO SISTEMA* (${alerts.length})\n\n`;
    
    for (const alert of alerts) {
      const status = alert.acknowledged ? '✅' : '🔴';
      const time = alert.timestamp.toLocaleString('pt-BR');
      const emoji = this.getAlertEmoji(alert.type);
      
      alertText += `${status} ${emoji} *${alert.title}*\n`;
      alertText += `📝 ${alert.message}\n`;
      alertText += `⏰ ${time}\n`;
      alertText += `🆔 \`${alert.id}\`\n\n`;
    }

    alertText += '💡 Use `!dono alertas reconhecer <id>` para marcar como lido';

    await sock.sendMessage(remoteJid, { text: alertText });
  }

  private async clearAlerts(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    this.alertService.clearAlerts();
    
    await sock.sendMessage(remoteJid, {
      text: '🗑️ *ALERTAS LIMPOS*\n\nTodos os alertas foram removidos com sucesso.'
    });
  }

  private async acknowledgeAlert(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    const alertId = args[1];
    
    if (!alertId) {
      await sock.sendMessage(remoteJid, {
        text: '❌ *ERRO*\n\nUso: `!dono alertas reconhecer <id>`'
      });
      return;
    }

    this.alertService.acknowledgeAlert(alertId);
    
    await sock.sendMessage(remoteJid, {
      text: `✅ *ALERTA RECONHECIDO*\n\nAlerta \`${alertId}\` foi marcado como lido.`
    });
  }

  private async showAlertStats(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    const alerts = this.alertService.getAlerts();
    
    const stats = {
      total: alerts.length,
      acknowledged: alerts.filter(a => a.acknowledged).length,
      unacknowledged: alerts.filter(a => !a.acknowledged).length,
      byType: {} as Record<string, number>
    };

    // Contar por tipo
    for (const alert of alerts) {
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    }

    let statsText = '📊 *ESTATÍSTICAS DE ALERTAS*\n\n';
    statsText += `📈 Total: ${stats.total}\n`;
    statsText += `✅ Reconhecidos: ${stats.acknowledged}\n`;
    statsText += `🔴 Pendentes: ${stats.unacknowledged}\n\n`;
    
    statsText += '📋 *Por Tipo:*\n';
    for (const [type, count] of Object.entries(stats.byType)) {
      const emoji = this.getAlertEmoji(type);
      statsText += `${emoji} ${type}: ${count}\n`;
    }

    await sock.sendMessage(remoteJid, { text: statsText });
  }

  private async showHelp(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    const helpText = `📢 *COMANDO DE ALERTAS*\n\n` +
                    `*Uso:* \`!dono alertas [ação]\`\n\n` +
                    `*Ações disponíveis:*\n` +
                    `📋 \`listar [limite]\` - Listar alertas (padrão: 10)\n` +
                    `🗑️ \`limpar\` - Remover todos os alertas\n` +
                    `✅ \`reconhecer <id>\` - Marcar alerta como lido\n` +
                    `📊 \`estatisticas\` - Ver estatísticas\n\n` +
                    `*Exemplos:*\n` +
                    `• \`!dono alertas\` - Listar 10 alertas\n` +
                    `• \`!dono alertas listar 20\` - Listar 20 alertas\n` +
                    `• \`!dono alertas reconhecer alert_123\` - Reconhecer alerta`;

    await sock.sendMessage(remoteJid, { text: helpText });
  }

  private getAlertEmoji(type: string): string {
    switch (type) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '📢';
    }
  }
} 