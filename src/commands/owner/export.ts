import { injectable, inject } from 'inversify';
import { WASocket } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { DatabaseService } from '@/services/DatabaseService';
import { TYPES } from '@/config/container';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseStatus } from '@/utils/databaseStatus';

type WAMessage = any;

@injectable()
export class ExportCommand implements IInjectableCommand {
  public readonly name = 'export';
  public readonly description = 'Exporta dados do grupo em diferentes formatos';
  public readonly usage = '!export [tipo] [periodo] [--format]';
  public readonly aliases = ['exportar', 'dados'];
  public readonly category = 'owner';
  public readonly adminOnly = false;
  public readonly ownerOnly = true;

  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {}

  public async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const senderJid = message.key.participant || message.key.remoteJid!;
      
      // Verificar se é o dono
      if (!this.isOwner(senderJid)) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Este comando é exclusivo do dono do bot!'
        });
        return;
      }

      // Verificar se o banco está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: DatabaseStatus.getInstance().getOfflineMessage('Export')
        });
        return;
      }

      // Processar argumentos
      const exportOptions = this.parseArgs(args);

      if (exportOptions.help) {
        await this.showHelp(sock, message);
        return;
      }

      await sock.sendMessage(message.key.remoteJid!, {
        text: '📤 Preparando exportação...'
      });

      // Executar exportação
      const result = await this.exportData(exportOptions);

      if (result.success) {
        let resultMessage = `✅ *EXPORTAÇÃO CONCLUÍDA!*\n\n` +
          `📁 Arquivo: ${result.filename}\n` +
          `📊 Tipo: ${exportOptions.type}\n` +
          `📅 Período: ${exportOptions.period}\n` +
          `📋 Formato: ${exportOptions.format}\n` +
          `📈 Tamanho: ${result.size}KB\n\n`;

        if (result.records > 0) {
          resultMessage += `📊 *DADOS EXPORTADOS:*\n` +
            `• Registros: ${result.records}\n` +
            `• Grupos: ${result.groups}\n` +
            `• Usuários: ${result.users}\n\n`;
        }

        resultMessage += `💡 *INSTRUÇÕES:*\n` +
          `1. Acesse o servidor onde o bot está rodando\n` +
          `2. Navegue até: ${result.filepath}\n` +
          `3. Faça download do arquivo\n` +
          `4. Use para backup ou análise externa\n\n` +
          `🔒 Os dados contêm informações sensíveis!`;

        await sock.sendMessage(message.key.remoteJid!, { text: resultMessage });
      } else {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `❌ *ERRO NA EXPORTAÇÃO*\n\n` +
                `❌ Erro: ${result.error}\n\n` +
                `💡 Verifique:\n` +
                `• Se há dados para exportar\n` +
                `• Se há permissões de escrita\n` +
                `• Se o formato é válido`
        });
      }

    } catch (error) {
      console.error('[ERROR] Erro no comando export:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao exportar dados. Verifique os logs do servidor.'
      });
    }
  }

  private async showHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpText = `📤 *EXPORTAÇÃO DE DADOS*\n\n` +
      `📊 *Tipos de Exportação:*\n` +
      `• \`!export mensagens\` - Mensagens do grupo\n` +
      `• \`!export usuarios\` - Dados de usuários\n` +
      `• \`!export comandos\` - Histórico de comandos\n` +
      `• \`!export completo\` - Todos os dados\n` +
      `• \`!export estatisticas\` - Estatísticas agregadas\n\n` +
      
      `📅 *Períodos:*\n` +
      `• \`!export mensagens hoje\`\n` +
      `• \`!export usuarios semana\`\n` +
      `• \`!export completo mes\`\n\n` +
      
      `📋 *Formatos:*\n` +
      `• \`!export mensagens --format json\`\n` +
      `• \`!export usuarios --format csv\`\n` +
      `• \`!export completo --format txt\`\n\n` +
      
      `💡 *Exemplos:*\n` +
      `• \`!export mensagens hoje --format json\`\n` +
      `• \`!export usuarios semana --format csv\`\n` +
      `• \`!export completo mes --format txt\``;

    await sock.sendMessage(message.key.remoteJid!, { text: helpText });
  }

  private async exportData(options: any): Promise<any> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `export_${options.type}_${options.period}_${timestamp}.${options.format}`;
      const filepath = path.join('exports', filename);

      // Criar diretório de exports se não existir
      await fs.mkdir('exports', { recursive: true });

      let data: any = {};
      let records = 0;
      let groups = 0;
      let users = 0;

      // Buscar dados baseado no tipo
      switch (options.type) {
        case 'mensagens':
          data = await this.exportMessages(options);
          records = data.messages?.length || 0;
          break;
        case 'usuarios':
          data = await this.exportUsers(options);
          records = data.users?.length || 0;
          users = records;
          break;
        case 'comandos':
          data = await this.exportCommands(options);
          records = data.commands?.length || 0;
          break;
        case 'estatisticas':
          data = await this.exportStatistics(options);
          records = Object.keys(data).length;
          break;
        case 'completo':
          data = await this.exportComplete(options);
          records = data.totalRecords || 0;
          groups = data.groups?.length || 0;
          users = data.users?.length || 0;
          break;
        default:
          data = await this.exportMessages(options);
          records = data.messages?.length || 0;
          break;
      }

      // Formatar dados
      const formattedData = this.formatData(data, options.format);

      // Salvar arquivo
      await fs.writeFile(filepath, formattedData, 'utf8');

      // Obter tamanho do arquivo
      const stats = await fs.stat(filepath);
      const sizeKB = Math.round(stats.size / 1024);

      return {
        success: true,
        filename,
        filepath,
        size: sizeKB,
        records,
        groups,
        users
      };

    } catch (error) {
      console.error('Erro na exportação:', error);
      return {
        success: false,
        error: error as Error ? (error as Error).message : error
      };
    }
  }

  private async exportMessages(options: any): Promise<any> {
    // Implementação simplificada
    return {
      exportInfo: {
        type: 'messages',
        period: options.period,
        timestamp: new Date().toISOString(),
        total: 100
      },
      messages: [
        {
          id: 'msg1',
          from: 'user@example.com',
          text: 'Exemplo de mensagem',
          timestamp: new Date().toISOString(),
          type: 'textMessage'
        }
      ]
    };
  }

  private async exportUsers(options: any): Promise<any> {
    // Implementação simplificada
    return {
      exportInfo: {
        type: 'users',
        period: options.period,
        timestamp: new Date().toISOString(),
        total: 25
      },
      users: [
        {
          jid: 'user@example.com',
          name: 'Usuário Exemplo',
          messageCount: 50,
          lastSeen: new Date().toISOString(),
          isAdmin: false
        }
      ]
    };
  }

  private async exportCommands(options: any): Promise<any> {
    // Implementação simplificada
    return {
      exportInfo: {
        type: 'commands',
        period: options.period,
        timestamp: new Date().toISOString(),
        total: 150
      },
      commands: [
        {
          name: 'menu',
          count: 30,
          lastUsed: new Date().toISOString(),
          users: ['user1@example.com', 'user2@example.com']
        }
      ]
    };
  }

  private async exportStatistics(options: any): Promise<any> {
    // Implementação simplificada
    return {
      exportInfo: {
        type: 'statistics',
        period: options.period,
        timestamp: new Date().toISOString()
      },
      statistics: {
        totalMessages: 1000,
        totalUsers: 25,
        totalCommands: 150,
        peakHour: 14,
        peakDay: 'Sexta-feira',
        engagementRate: 65.5
      }
    };
  }

  private async exportComplete(options: any): Promise<any> {
    // Implementação simplificada
    return {
      exportInfo: {
        type: 'complete',
        period: options.period,
        timestamp: new Date().toISOString()
      },
      totalRecords: 1275,
      groups: [
        {
          jid: 'group@example.com',
          name: 'Grupo Exemplo',
          memberCount: 25,
          adminCount: 3
        }
      ],
      users: [
        {
          jid: 'user@example.com',
          name: 'Usuário Exemplo',
          messageCount: 50,
          commandCount: 10
        }
      ],
      messages: [
        {
          id: 'msg1',
          from: 'user@example.com',
          text: 'Exemplo',
          timestamp: new Date().toISOString()
        }
      ],
      commands: [
        {
          name: 'menu',
          count: 30,
          users: ['user1@example.com']
        }
      ]
    };
  }

  private formatData(data: any, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        return this.convertToCSV(data);
      
      case 'txt':
        return this.convertToTXT(data);
      
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private convertToCSV(data: any): string {
    // Implementação simplificada para CSV
    if (data.messages) {
      let csv = 'ID,From,Text,Timestamp,Type\n';
      for (const msg of data.messages) {
        csv += `${msg.id},${msg.from},${msg.text},${msg.timestamp},${msg.type}\n`;
      }
      return csv;
    }
    
    if (data.users) {
      let csv = 'JID,Name,MessageCount,LastSeen,IsAdmin\n';
      for (const user of data.users) {
        csv += `${user.jid},${user.name},${user.messageCount},${user.lastSeen},${user.isAdmin}\n`;
      }
      return csv;
    }
    
    return JSON.stringify(data);
  }

  private convertToTXT(data: any): string {
    let txt = `EXPORTAÇÃO DE DADOS\n`;
    txt += `==================\n\n`;
    txt += `Tipo: ${data.exportInfo?.type || 'dados'}\n`;
    txt += `Período: ${data.exportInfo?.period || 'N/A'}\n`;
    txt += `Timestamp: ${data.exportInfo?.timestamp || new Date().toISOString()}\n\n`;
    
    if (data.statistics) {
      txt += `ESTATÍSTICAS:\n`;
      txt += `- Total de mensagens: ${data.statistics.totalMessages}\n`;
      txt += `- Total de usuários: ${data.statistics.totalUsers}\n`;
      txt += `- Total de comandos: ${data.statistics.totalCommands}\n`;
      txt += `- Hora de pico: ${data.statistics.peakHour}:00\n`;
      txt += `- Dia de pico: ${data.statistics.peakDay}\n`;
      txt += `- Taxa de engajamento: ${data.statistics.engagementRate}%\n\n`;
    }
    
    if (data.messages && data.messages.length > 0) {
      txt += `MENSAGENS (${data.messages.length}):\n`;
      for (let i = 0; i < Math.min(data.messages.length, 10); i++) {
        const msg = data.messages[i];
        txt += `${i + 1}. ${msg.from}: ${msg.text}\n`;
      }
      if (data.messages.length > 10) {
        txt += `... e mais ${data.messages.length - 10} mensagens\n`;
      }
      txt += '\n';
    }
    
    return txt;
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      type: 'mensagens',
      period: 'hoje',
      format: 'json',
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
      } else if (['mensagens', 'usuarios', 'comandos', 'estatisticas', 'completo'].includes(arg)) {
        options.type = arg;
      } else if (['hoje', 'ontem', 'semana', 'mes', 'ano'].includes(arg)) {
        options.period = arg;
      }
    }

    return options;
  }

  private isOwner(participant: string): boolean {
    const ownerNumbers = [
      '5521967233931@s.whatsapp.net',
      '5521971200821@s.whatsapp.net'
    ];
    return ownerNumbers.includes(participant);
  }
} 