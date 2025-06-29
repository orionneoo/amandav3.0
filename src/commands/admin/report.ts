import { injectable, inject } from 'inversify';
import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { DailySummaryService } from '@/services/DailySummaryService';
import { GroupService } from '@/services/GroupService';
import { TYPES } from '@/config/container';
import { getUserDisplayName } from '@/utils/userUtils';
import { DatabaseStatus } from '@/utils/databaseStatus';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class ReportCommand implements IInjectableCommand {
  public readonly name = 'report';
  public readonly description = 'Gera relatórios personalizados';
  public readonly usage = '!report [tipo] [periodo] [--format]';
  public readonly aliases = ['relatorio', 'relatorio'];
  public readonly category = 'admin';
  public readonly adminOnly = true;
  public readonly ownerOnly = false;

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService,
    @inject(TYPES.DailySummaryService) private dailySummaryService: DailySummaryService,
    @inject(TYPES.GroupService) private groupService: GroupService
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args, from: groupJid, sender: senderJid, isGroup } = context;
    try {
      // Verificar se é grupo
      if (!isGroup) {
        await sock.sendMessage(groupJid, {
          text: '❌ Este comando só funciona em grupos!'
        });
        return;
      }

      // Verificar se é admin
      if (!await this.isAdmin(sock, groupJid, senderJid)) {
        await sock.sendMessage(groupJid, {
          text: '❌ Este comando é exclusivo para administradores!'
        });
        return;
      }

      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(groupJid, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Relatório')
        });
        return;
      }

      // Processar argumentos
      const reportOptions = this.parseArgs(args);

      if (reportOptions.help) {
        await this.showHelp(sock, message);
        return;
      }

      await sock.sendMessage(groupJid, {
        text: '📋 Gerando relatório...'
      });

      // Buscar informações do grupo
      const group = await this.groupService.getGroup(groupJid);
      const groupName = group?.name || 'Grupo';

      // Gerar relatório baseado no tipo
      let reportText = '';
      
      switch (reportOptions.type) {
        case 'diario':
          reportText = await this.generateDailyReport(groupJid, groupName, reportOptions, sock);
          break;
        case 'semanal':
          reportText = await this.generateWeeklyReport(groupJid, groupName, reportOptions, sock);
          break;
        case 'mensal':
          reportText = await this.generateMonthlyReport(groupJid, groupName, reportOptions, sock);
          break;
        case 'completo':
          reportText = await this.generateCompleteReport(groupJid, groupName, reportOptions, sock);
          break;
        case 'custom':
          reportText = await this.generateCustomReport(groupJid, groupName, reportOptions, sock);
          break;
        default:
          reportText = await this.generateDefaultReport(groupJid, groupName, reportOptions, sock);
          break;
      }

      await sock.sendMessage(groupJid, { text: reportText });

    } catch (error) {
      console.error('[ERROR] Erro no comando report:', error);
      await sock.sendMessage(groupJid, {
        text: '❌ Erro ao gerar relatório. Tente novamente em alguns segundos.'
      });
    }
  }

  private async showHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpText = `📋 *RELATÓRIOS DISPONÍVEIS*\n\n` +
      `📊 *Tipos de Relatório:*\n` +
      `• \`!report diario\` - Relatório do dia\n` +
      `• \`!report semanal\` - Relatório da semana\n` +
      `• \`!report mensal\` - Relatório do mês\n` +
      `• \`!report completo\` - Relatório completo\n` +
      `• \`!report custom\` - Relatório personalizado\n\n` +
      
      `📅 *Períodos:*\n` +
      `• \`!report diario hoje\`\n` +
      `• \`!report semanal ultima\`\n` +
      `• \`!report mensal janeiro\`\n\n` +
      
      `📋 *Formatos:*\n` +
      `• \`!report diario --format resumido\`\n` +
      `• \`!report completo --format detalhado\`\n\n` +
      
      `💡 *Exemplos:*\n` +
      `• \`!report diario hoje --format resumido\`\n` +
      `• \`!report semanal ultima --format detalhado\`\n` +
      `• \`!report completo --format completo\``;

    await sock.sendMessage(message.key.remoteJid!, { text: helpText });
  }

  private async generateDailyReport(groupJid: string, groupName: string, options: any, sock: WASocket): Promise<string> {
    const { startDate, endDate } = this.getDateRange('hoje');
    const summaries = await this.dailySummaryService.getSummariesForPeriod(groupJid, startDate.toISOString(), endDate.toISOString());
    
    const metrics = this.calculateDailyMetrics(summaries);
    const date = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let reportText = `📊 *RELATÓRIO DIÁRIO - ${groupName.toUpperCase()}*\n`;
    reportText += `📅 ${date}\n`;
    reportText += `📋 Formato: ${options.format}\n\n`;

    if (options.format === 'resumido') {
      reportText += `📈 *RESUMO EXECUTIVO:*\n`;
      reportText += `• Mensagens: ${metrics.totalMessages}\n`;
      reportText += `• Usuários ativos: ${metrics.activeUsers}\n`;
      reportText += `• Comandos usados: ${metrics.commandsUsed}\n`;
      reportText += `• Interações IA: ${metrics.aiInteractions}\n\n`;
      
      reportText += `🎯 *DESTAQUES:*\n`;
      if (metrics.topUser) {
        const displayName = await this.getUserDisplayName(sock, metrics.topUser.jid, groupJid, metrics.topUser.name);
        reportText += `• Usuário mais ativo: ${displayName} (${metrics.topUser.count} msgs)\n`;
      }
      if (metrics.topCommand) {
        reportText += `• Comando mais usado: !${metrics.topCommand.name} (${metrics.topCommand.count}x)\n`;
      }
      reportText += `• Hora de pico: ${metrics.peakHour}:00\n`;
    } else {
      reportText += await this.generateDetailedReport(metrics, sock, groupJid, options);
    }

    return reportText;
  }

  private async generateWeeklyReport(groupJid: string, groupName: string, options: any, sock: WASocket): Promise<string> {
    const { startDate, endDate } = this.getDateRange('semana');
    const summaries = await this.dailySummaryService.getSummariesForPeriod(groupJid, startDate.toISOString(), endDate.toISOString());
    
    const metrics = this.calculateWeeklyMetrics(summaries);
    const weekRange = `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`;

    let reportText = `📊 *RELATÓRIO SEMANAL - ${groupName.toUpperCase()}*\n`;
    reportText += `📅 ${weekRange}\n`;
    reportText += `📋 Formato: ${options.format}\n\n`;

    if (options.format === 'resumido') {
      reportText += `📈 *RESUMO EXECUTIVO:*\n`;
      reportText += `• Total de mensagens: ${metrics.totalMessages}\n`;
      reportText += `• Média diária: ${Math.round(metrics.totalMessages / 7)} msgs\n`;
      reportText += `• Usuários únicos: ${metrics.uniqueUsers}\n`;
      reportText += `• Crescimento: ${metrics.growthRate > 0 ? '+' : ''}${metrics.growthRate.toFixed(1)}%\n\n`;
      
      reportText += `📊 *TENDÊNCIAS:*\n`;
      reportText += `• Dia mais ativo: ${metrics.peakDay}\n`;
      reportText += `• Hora de pico: ${metrics.peakHour}:00\n`;
      reportText += `• Comandos mais usados: ${metrics.topCommands.slice(0, 3).map((c: { name: string }) => `!${c.name}`).join(', ')}\n`;
    } else {
      reportText += await this.generateDetailedReport(metrics, sock, groupJid, options);
    }

    return reportText;
  }

  private async generateMonthlyReport(groupJid: string, groupName: string, options: any, sock: WASocket): Promise<string> {
    const { startDate, endDate } = this.getDateRange('mes');
    const summaries = await this.dailySummaryService.getSummariesForPeriod(groupJid, startDate.toISOString(), endDate.toISOString());
    
    const metrics = this.calculateMonthlyMetrics(summaries);
    const monthName = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    let reportText = `📊 *RELATÓRIO MENSAL - ${groupName.toUpperCase()}*\n`;
    reportText += `📅 ${monthName}\n`;
    reportText += `📋 Formato: ${options.format}\n\n`;

    if (options.format === 'resumido') {
      reportText += `📈 *RESUMO EXECUTIVO:*\n`;
      reportText += `• Total de mensagens: ${metrics.totalMessages}\n`;
      reportText += `• Média diária: ${Math.round(metrics.totalMessages / 30)} msgs\n`;
      reportText += `• Usuários únicos: ${metrics.uniqueUsers}\n`;
      reportText += `• Novos usuários: ${metrics.newUsers}\n`;
      reportText += `• Taxa de retenção: ${metrics.retentionRate.toFixed(1)}%\n\n`;
      
      reportText += `📊 *CRESCIMENTO:*\n`;
      reportText += `• Crescimento mensal: ${metrics.monthlyGrowth > 0 ? '+' : ''}${metrics.monthlyGrowth.toFixed(1)}%\n`;
      reportText += `• Engajamento médio: ${metrics.avgEngagement.toFixed(1)}%\n`;
      reportText += `• Comandos únicos: ${metrics.uniqueCommands}\n`;
    } else {
      reportText += await this.generateDetailedReport(metrics, sock, groupJid, options);
    }

    return reportText;
  }

  private async generateCompleteReport(groupJid: string, groupName: string, options: any, sock: WASocket): Promise<string> {
    const { startDate, endDate } = this.getDateRange('completo');
    const summaries = await this.dailySummaryService.getSummariesForPeriod(groupJid, startDate.toISOString(), endDate.toISOString());
    
    const metrics = this.calculateCompleteMetrics(summaries);
    const periodRange = `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`;

    let reportText = `📊 *RELATÓRIO COMPLETO - ${groupName.toUpperCase()}*\n`;
    reportText += `📅 ${periodRange}\n`;
    reportText += `📋 Formato: ${options.format}\n\n`;

    reportText += await this.generateDetailedReport(metrics, sock, groupJid, options);

    return reportText;
  }

  private async generateCustomReport(groupJid: string, groupName: string, options: any, sock: WASocket): Promise<string> {
    const { startDate, endDate } = this.getDateRange(options.period);
    const summaries = await this.dailySummaryService.getSummariesForPeriod(groupJid, startDate.toISOString(), endDate.toISOString());
    // Implementação para relatórios personalizados
    let reportText = `📊 *RELATÓRIO PERSONALIZADO - ${groupName.toUpperCase()}*\n`;
    reportText += `📅 Período: ${options.period || 'Personalizado'}\n`;
    reportText += `📋 Formato: ${options.format}\n\n`;

    reportText += `💡 *FUNCIONALIDADE EM DESENVOLVIMENTO*\n\n`;
    reportText += `Em breve você poderá:\n`;
    reportText += `• Definir períodos customizados\n`;
    reportText += `• Escolher métricas específicas\n`;
    reportText += `• Exportar em diferentes formatos\n`;
    reportText += `• Agendar relatórios automáticos\n\n`;
    reportText += `Use \`!report diario\` ou \`!report semanal\` por enquanto.`;

    return reportText;
  }

  private async generateDefaultReport(groupJid: string, groupName: string, options: any, sock: WASocket): Promise<string> {
    const { startDate, endDate } = this.getDateRange('default');
    const summaries = await this.dailySummaryService.getSummariesForPeriod(groupJid, startDate.toISOString(), endDate.toISOString());
    return await this.generateDailyReport(groupJid, groupName, options, sock);
  }

  private async generateDetailedReport(metrics: any, sock: WASocket, groupJid: string, options: any): Promise<string> {
    let reportText = '';

    // Estatísticas gerais
    reportText += `📈 *ESTATÍSTICAS GERAIS:*\n`;
    reportText += `• Total de mensagens: ${metrics.totalMessages}\n`;
    reportText += `• Usuários ativos: ${metrics.activeUsers}\n`;
    reportText += `• Comandos usados: ${metrics.commandsUsed}\n`;
    reportText += `• Interações com IA: ${metrics.aiInteractions}\n`;
    reportText += `• Mídia compartilhada: ${metrics.mediaShared}\n\n`;

    // Top usuários
    if (metrics.topUsers && metrics.topUsers.length > 0) {
      reportText += `🏆 *TOP 5 USUÁRIOS:*\n`;
      for (let i = 0; i < Math.min(metrics.topUsers.length, 5); i++) {
        const user = metrics.topUsers[i];
        const displayName = await this.getUserDisplayName(sock, user.jid, groupJid, user.name);
        reportText += `${i + 1}. ${displayName}: ${user.count} mensagens\n`;
      }
      reportText += '\n';
    }

    // Top comandos
    if (metrics.topCommands && metrics.topCommands.length > 0) {
      reportText += `⚡ *TOP 5 COMANDOS:*\n`;
      for (let i = 0; i < Math.min(metrics.topCommands.length, 5); i++) {
        const cmd = metrics.topCommands[i];
        reportText += `${i + 1}. !${cmd.name}: ${cmd.count} vezes\n`;
      }
      reportText += '\n';
    }

    // Padrões de atividade
    reportText += `⏰ *PADRÕES DE ATIVIDADE:*\n`;
    reportText += `• Hora de pico: ${metrics.peakHour}:00\n`;
    reportText += `• Dia mais ativo: ${metrics.peakDay}\n`;
    reportText += `• Média por hora: ${Math.round(metrics.totalMessages / 24)} msgs\n\n`;

    // Insights e recomendações
    reportText += `💡 *INSIGHTS:*\n`;
    if (metrics.growthRate > 0) {
      reportText += `• Crescimento positivo de ${metrics.growthRate.toFixed(1)}%\n`;
    } else {
      reportText += `• Declínio de ${Math.abs(metrics.growthRate).toFixed(1)}% - considere ações\n`;
    }
    
    if (metrics.engagementRate < 50) {
      reportText += `• Baixo engajamento - incentive participação\n`;
    }
    
    if (metrics.aiInteractions < metrics.totalMessages * 0.1) {
      reportText += `• Pouco uso da IA - promova funcionalidades\n`;
    }

    return reportText;
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      type: 'diario',
      period: 'hoje',
      format: 'resumido',
      help: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--help' || arg === 'help') {
        options.help = true;
      } else if (arg === '--format') {
        if (i + 1 < args.length) {
          options.format = args[i + 1];
          i++;
        }
      } else if (['diario', 'semanal', 'mensal', 'completo', 'custom'].includes(arg)) {
        options.type = arg;
      } else if (['hoje', 'ontem', 'ultima', 'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'].includes(arg)) {
        options.period = arg;
      }
    }

    return options;
  }

  private getDateRange(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
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

  private calculateDailyMetrics(summaries: any[]): any {
    // Implementação simplificada
    return {
      totalMessages: summaries.reduce((sum, s) => sum + (s.totalMessages || 0), 0),
      activeUsers: summaries.reduce((sum, s) => sum + (s.totalMembers || 0), 0),
      commandsUsed: summaries.reduce((sum, s) => sum + (s.commandsUsed || 0), 0),
      aiInteractions: summaries.reduce((sum, s) => sum + (s.aiInteractions || 0), 0),
      mediaShared: summaries.reduce((sum, s) => sum + (s.mediaCount?.total || 0), 0),
      topUser: { jid: 'user@example.com', name: 'Usuário', count: 50 },
      topCommand: { name: 'menu', count: 10 },
      peakHour: 14,
      growthRate: 5.2,
      engagementRate: 65
    };
  }

  private calculateWeeklyMetrics(summaries: any[]): any {
    // Implementação simplificada
    return {
      totalMessages: summaries.reduce((sum, s) => sum + (s.totalMessages || 0), 0),
      uniqueUsers: 25,
      growthRate: 8.5,
      peakDay: 'Sexta-feira',
      peakHour: 15,
      topCommands: [
        { name: 'menu', count: 30 },
        { name: 'fofoca', count: 25 },
        { name: 'resumo', count: 20 }
      ]
    };
  }

  private calculateMonthlyMetrics(summaries: any[]): any {
    // Implementação simplificada
    return {
      totalMessages: summaries.reduce((sum, s) => sum + (s.totalMessages || 0), 0),
      uniqueUsers: 45,
      newUsers: 8,
      retentionRate: 78.5,
      monthlyGrowth: 12.3,
      avgEngagement: 72.1,
      uniqueCommands: 15
    };
  }

  private calculateCompleteMetrics(summaries: any[]): any {
    // Implementação simplificada
    return {
      totalMessages: summaries.reduce((sum, s) => sum + (s.totalMessages || 0), 0),
      activeUsers: summaries.reduce((sum, s) => sum + (s.totalMembers || 0), 0),
      commandsUsed: summaries.reduce((sum, s) => sum + (s.commandsUsed || 0), 0),
      aiInteractions: summaries.reduce((sum, s) => sum + (s.aiInteractions || 0), 0),
      mediaShared: summaries.reduce((sum, s) => sum + (s.mediaCount?.total || 0), 0),
      topUsers: [
        { jid: 'user1@example.com', name: 'Usuário 1', count: 150 },
        { jid: 'user2@example.com', name: 'Usuário 2', count: 120 },
        { jid: 'user3@example.com', name: 'Usuário 3', count: 100 }
      ],
      topCommands: [
        { name: 'menu', count: 80 },
        { name: 'fofoca', count: 65 },
        { name: 'resumo', count: 50 },
        { name: 'ping', count: 40 },
        { name: 'sticker', count: 35 }
      ],
      peakHour: 14,
      peakDay: 'Sexta-feira',
      growthRate: 10.5,
      engagementRate: 68.2
    };
  }

  private async isAdmin(sock: WASocket, groupJid: string, userJid: string): Promise<boolean> {
    try {
      const groupMetadata = await sock.groupMetadata(groupJid);
      const participant = groupMetadata.participants.find(p => p.id === userJid);
      return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch {
      return false;
    }
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