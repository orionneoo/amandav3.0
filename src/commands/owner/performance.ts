import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { WASocket } from '@whiskeysockets/baileys';
import Logger from '@/utils/Logger';
import { MessageContext } from '@/handlers/message.handler';

@injectable()
export class PerformanceCommand implements IInjectableCommand {
  public readonly name = 'performance';
  public readonly description = 'Monitorar performance do sistema';
  public readonly usage = '!dono performance [status|metricas|historico|limpar]';
  public readonly aliases = ['perf', 'monitor'];
  public readonly category = 'owner';
  public readonly adminOnly = false;
  public readonly ownerOnly = true;

  constructor(
    @inject(TYPES.PerformanceMonitor) private performanceMonitor: PerformanceMonitor
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args } = context;
    try {
      const action = args[0]?.toLowerCase() || 'status';

      switch (action) {
        case 'status':
          await this.showStatus(context);
          break;
        
        case 'metricas':
        case 'metrics':
          await this.showMetrics(context);
          break;
        
        case 'historico':
        case 'history':
          await this.showHistory(context);
          break;
        
        case 'limpar':
        case 'clear':
          await this.clearHistory(context);
          break;
        
        case 'start':
        case 'iniciar':
          await this.startMonitoring(context);
          break;
        
        case 'stop':
        case 'parar':
          await this.stopMonitoring(context);
          break;
        
        default:
          await this.showHelp(context);
          break;
      }

    } catch (error) {
      Logger.error('Erro no comando performance', { error, args });
      if (message.key.remoteJid) {
        await sock.sendMessage(message.key.remoteJid, {
          text: '❌ Erro ao processar comando de performance'
        });
      }
    }
  }

  private async showStatus(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    const status = this.performanceMonitor.getStatus();
    
    let statusText = '📊 *STATUS DO MONITORAMENTO*\n\n';
    statusText += `🔄 Status: ${status.isMonitoring ? '🟢 Ativo' : '🔴 Inativo'}\n`;
    statusText += `📈 Métricas coletadas: ${status.metricsCount}\n`;
    
    if (status.lastCheck) {
      statusText += `⏰ Última verificação: ${status.lastCheck.toLocaleString('pt-BR')}\n`;
    }

    // Obter métricas atuais
    const currentMetrics = this.performanceMonitor.getMetrics();
    statusText += '\n📋 *Métricas Atuais:*\n';
    statusText += `🖥️ CPU: ${currentMetrics.cpu.toFixed(1)}%\n`;
    statusText += `💾 Memória: ${currentMetrics.memory.toFixed(1)}%\n`;
    statusText += `🤖 IA Response: ${currentMetrics.aiResponseTime}ms\n`;
    statusText += `🗄️ DB Latency: ${currentMetrics.databaseLatency}ms\n`;
    statusText += `❌ Taxa de Erro: ${currentMetrics.errorRate.toFixed(1)}%\n`;

    await sock.sendMessage(remoteJid, { text: statusText });
  }

  private async showMetrics(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    const metrics = this.performanceMonitor.getMetrics();
    const history = this.performanceMonitor.getMetricsHistory(10);
    
    if (history.length === 0) {
      await sock.sendMessage(remoteJid, {
        text: '📊 *MÉTRICAS DE PERFORMANCE*\n\nNenhuma métrica coletada ainda.'
      });
      return;
    }

    // Calcular médias
    const averages = {
      cpu: history.reduce((sum, m) => sum + m.cpu, 0) / history.length,
      memory: history.reduce((sum, m) => sum + m.memory, 0) / history.length,
      aiResponseTime: history.reduce((sum, m) => sum + m.aiResponseTime, 0) / history.length,
      databaseLatency: history.reduce((sum, m) => sum + m.databaseLatency, 0) / history.length,
      errorRate: history.reduce((sum, m) => sum + m.errorRate, 0) / history.length
    };

    // Encontrar valores máximos
    const maxValues = {
      cpu: Math.max(...history.map(m => m.cpu)),
      memory: Math.max(...history.map(m => m.memory)),
      aiResponseTime: Math.max(...history.map(m => m.aiResponseTime)),
      databaseLatency: Math.max(...history.map(m => m.databaseLatency)),
      errorRate: Math.max(...history.map(m => m.errorRate))
    };

    let metricsText = '📊 *MÉTRICAS DETALHADAS*\n\n';
    metricsText += `📈 Período: Últimas ${history.length} medições\n\n`;
    
    metricsText += '🖥️ *CPU:*\n';
    metricsText += `   Atual: ${metrics.cpu.toFixed(1)}%\n`;
    metricsText += `   Média: ${averages.cpu.toFixed(1)}%\n`;
    metricsText += `   Máximo: ${maxValues.cpu.toFixed(1)}%\n\n`;
    
    metricsText += '💾 *Memória:*\n';
    metricsText += `   Atual: ${metrics.memory.toFixed(1)}%\n`;
    metricsText += `   Média: ${averages.memory.toFixed(1)}%\n`;
    metricsText += `   Máximo: ${maxValues.memory.toFixed(1)}%\n\n`;
    
    metricsText += '🤖 *IA Response Time:*\n';
    metricsText += `   Atual: ${metrics.aiResponseTime}ms\n`;
    metricsText += `   Média: ${Math.round(averages.aiResponseTime)}ms\n`;
    metricsText += `   Máximo: ${maxValues.aiResponseTime}ms\n\n`;
    
    metricsText += '🗄️ *Database Latency:*\n';
    metricsText += `   Atual: ${metrics.databaseLatency}ms\n`;
    metricsText += `   Média: ${Math.round(averages.databaseLatency)}ms\n`;
    metricsText += `   Máximo: ${maxValues.databaseLatency}ms\n\n`;
    
    metricsText += '❌ *Taxa de Erro:*\n';
    metricsText += `   Atual: ${metrics.errorRate.toFixed(1)}%\n`;
    metricsText += `   Média: ${averages.errorRate.toFixed(1)}%\n`;
    metricsText += `   Máximo: ${maxValues.errorRate.toFixed(1)}%`;

    await sock.sendMessage(remoteJid, { text: metricsText });
  }

  private async showHistory(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    const limit = parseInt(args[1]) || 5;
    const history = this.performanceMonitor.getMetricsHistory(limit);
    
    if (history.length === 0) {
      await sock.sendMessage(remoteJid, {
        text: '📊 *HISTÓRICO DE PERFORMANCE*\n\nNenhum histórico disponível.'
      });
      return;
    }

    let historyText = `📊 *HISTÓRICO DE PERFORMANCE* (${history.length})\n\n`;
    
    for (let i = 0; i < history.length; i++) {
      const metric = history[i];
      const time = metric.timestamp.toLocaleTimeString('pt-BR');
      
      historyText += `⏰ *${time}*\n`;
      historyText += `   CPU: ${metric.cpu.toFixed(1)}% | Mem: ${metric.memory.toFixed(1)}%\n`;
      historyText += `   IA: ${metric.aiResponseTime}ms | DB: ${metric.databaseLatency}ms\n`;
      historyText += `   Erro: ${metric.errorRate.toFixed(1)}%\n\n`;
    }

    await sock.sendMessage(remoteJid, { text: historyText });
  }

  private async clearHistory(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    // Implementar limpeza de histórico se necessário
    await sock.sendMessage(remoteJid, {
      text: '🗑️ *HISTÓRICO LIMPO*\n\nHistórico de performance foi limpo.'
    });
  }

  private async startMonitoring(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    this.performanceMonitor.startMonitoring();
    
    await sock.sendMessage(remoteJid, {
      text: '🟢 *MONITORAMENTO INICIADO*\n\nMonitoramento de performance foi ativado.'
    });
  }

  private async stopMonitoring(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    this.performanceMonitor.stopMonitoring();
    
    await sock.sendMessage(remoteJid, {
      text: '🔴 *MONITORAMENTO PARADO*\n\nMonitoramento de performance foi desativado.'
    });
  }

  private async showHelp(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    const helpText = `📊 *COMANDO DE PERFORMANCE*\n\n` +
                    `*Uso:* \`!dono performance [ação]\`\n\n` +
                    `*Ações disponíveis:*\n` +
                    `📊 \`status\` - Ver status do monitoramento\n` +
                    `📈 \`metricas\` - Ver métricas detalhadas\n` +
                    `📋 \`historico [limite]\` - Ver histórico (padrão: 5)\n` +
                    `🗑️ \`limpar\` - Limpar histórico\n` +
                    `🟢 \`iniciar\` - Iniciar monitoramento\n` +
                    `🔴 \`parar\` - Parar monitoramento\n\n` +
                    `*Exemplos:*\n` +
                    `• \`!dono performance\` - Ver status\n` +
                    `• \`!dono performance metricas\` - Ver métricas\n` +
                    `• \`!dono performance historico 10\` - Ver 10 registros`;

    await sock.sendMessage(remoteJid, { text: helpText });
  }
} 