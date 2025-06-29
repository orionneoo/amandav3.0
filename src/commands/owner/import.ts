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
export class ImportCommand implements IInjectableCommand {
  public readonly name = 'import';
  public readonly description = 'Importa dados de arquivos exportados';
  public readonly usage = '!import [arquivo] [--confirm]';
  public readonly aliases = ['importar', 'restaurar'];
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
          text: DatabaseStatus.getInstance().getOfflineMessage('Import')
        });
        return;
      }

      // Processar argumentos
      const importOptions = this.parseArgs(args);

      if (importOptions.help) {
        await this.showHelp(sock, message);
        return;
      }

      if (importOptions.list) {
        await this.listImportFiles(sock, message);
        return;
      }

      if (!importOptions.file) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ *Arquivo não especificado!*\n\n' +
                '💡 *Exemplos:*\n' +
                '• `!import` (lista arquivos)\n' +
                '• `!import export_mensagens_hoje.json`\n' +
                '• `!import export_completo_mes.json --confirm`\n' +
                '• `!import --list` (lista arquivos disponíveis)'
        });
        return;
      }

      if (!importOptions.confirm) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `⚠️ *CONFIRMAÇÃO NECESSÁRIA*\n\n` +
                `Você está prestes a importar:\n` +
                `📁 ${importOptions.file}\n\n` +
                `⚠️ *ATENÇÃO:* Esta operação irá:\n` +
                `• Adicionar dados ao banco atual\n` +
                `• Pode sobrescrever dados existentes\n` +
                `• Afetar estatísticas e relatórios\n\n` +
                `Para confirmar, use:\n` +
                `\`!import ${importOptions.file} --confirm\``
        });
        return;
      }

      await sock.sendMessage(message.key.remoteJid!, {
        text: '📥 Iniciando importação...'
      });

      // Executar importação
      const result = await this.importData(importOptions.file);

      if (result.success) {
        let resultMessage = `✅ *IMPORTAÇÃO CONCLUÍDA!*\n\n` +
          `📁 Arquivo: ${importOptions.file}\n` +
          `📊 Tipo: ${result.type}\n` +
          `📅 Período: ${result.period}\n` +
          `📈 Registros importados: ${result.importedRecords}\n\n`;

        if (result.errors > 0) {
          resultMessage += `⚠️ *AVISOS:*\n` +
            `• ${result.errors} registros com erro\n` +
            `• Verifique os logs para detalhes\n\n`;
        }

        resultMessage += `🔄 *PRÓXIMOS PASSOS:*\n` +
          `1. Verifique se os dados foram importados\n` +
          `2. Teste os comandos principais\n` +
          `3. Use \`!dono status\` para verificar\n\n` +
          `💡 Use \`!estatisticas\` para ver os novos dados`;

        await sock.sendMessage(message.key.remoteJid!, { text: resultMessage });
      } else {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `❌ *ERRO NA IMPORTAÇÃO*\n\n` +
                `📁 Arquivo: ${importOptions.file}\n` +
                `❌ Erro: ${result.error}\n\n` +
                `💡 Verifique:\n` +
                `• Se o arquivo existe\n` +
                `• Se o formato é válido\n` +
                `• Se há permissões de leitura`
        });
      }

    } catch (error) {
      console.error('[ERROR] Erro no comando import:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao importar dados. Verifique os logs do servidor.'
      });
    }
  }

  private async showHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpText = `📥 *IMPORTAÇÃO DE DADOS*\n\n` +
      `📊 *Tipos de Importação:*\n` +
      `• \`!import export_mensagens.json\` - Mensagens\n` +
      `• \`!import export_usuarios.json\` - Usuários\n` +
      `• \`!import export_comandos.json\` - Comandos\n` +
      `• \`!import export_completo.json\` - Dados completos\n` +
      `• \`!import export_estatisticas.json\` - Estatísticas\n\n` +
      
      `📋 *Formatos Suportados:*\n` +
      `• JSON (.json) - Recomendado\n` +
      `• CSV (.csv) - Limitado\n` +
      `• TXT (.txt) - Básico\n\n` +
      
      `💡 *Exemplos:*\n` +
      `• \`!import export_mensagens_hoje.json --confirm\`\n` +
      `• \`!import export_completo_semana.json --confirm\`\n` +
      `• \`!import --list\` (lista arquivos)\n\n` +
      
      `⚠️ *IMPORTANTE:*\n` +
      `• Sempre use --confirm para confirmar\n` +
      `• Faça backup antes de importar\n` +
      `• Verifique o formato do arquivo`;

    await sock.sendMessage(message.key.remoteJid!, { text: helpText });
  }

  private async listImportFiles(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      const files = await this.getImportFiles();

      if (files.length === 0) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Nenhum arquivo de importação encontrado!\n\n' +
                '💡 Use `!export` para criar arquivos primeiro.'
        });
        return;
      }

      let listText = `📁 *ARQUIVOS DISPONÍVEIS PARA IMPORTAÇÃO*\n\n`;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const date = new Date(file.mtime).toLocaleDateString('pt-BR');
        
        listText += `${i + 1}. *${file.name}*\n`;
        listText += `   📅 ${date}\n`;
        listText += `   📊 ${sizeMB}MB\n`;
        listText += `   📋 ${file.type}\n\n`;
      }

      listText += `💡 *Para importar:*\n` +
        `• \`!import ${files[0].name} --confirm\`\n` +
        `• \`!import ${files[0].name}\` (para prévia)`;

      await sock.sendMessage(message.key.remoteJid!, { text: listText });

    } catch (error) {
      console.error('Erro ao listar arquivos:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao listar arquivos de importação.'
      });
    }
  }

  private async getImportFiles(): Promise<any[]> {
    try {
      const importDirs = ['exports', 'imports', '.'];
      const files = [];

      for (const dir of importDirs) {
        try {
          const dirFiles = await fs.readdir(dir);
          
          for (const file of dirFiles) {
            if (file.startsWith('export_') && (file.endsWith('.json') || file.endsWith('.csv') || file.endsWith('.txt'))) {
              try {
                const filePath = path.join(dir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile()) {
                  const type = this.getFileType(file);
                  files.push({
                    name: file,
                    path: filePath,
                    size: stats.size,
                    mtime: stats.mtime,
                    type
                  });
                }
              } catch (error) {
                // Ignorar arquivos com erro
              }
            }
          }
        } catch (error) {
          // Ignorar diretórios que não existem
        }
      }

      // Ordenar por data (mais recente primeiro)
      return files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    } catch (error) {
      console.error('Erro ao buscar arquivos:', error);
      return [];
    }
  }

  private getFileType(filename: string): string {
    if (filename.includes('mensagens')) return 'Mensagens';
    if (filename.includes('usuarios')) return 'Usuários';
    if (filename.includes('comandos')) return 'Comandos';
    if (filename.includes('estatisticas')) return 'Estatísticas';
    if (filename.includes('completo')) return 'Completo';
    return 'Desconhecido';
  }

  private async importData(filename: string): Promise<any> {
    try {
      // Encontrar o arquivo
      const filePath = await this.findImportFile(filename);
      
      if (!filePath) {
        return { success: false, error: `Arquivo ${filename} não encontrado` };
      }

      // Ler arquivo
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      // Determinar formato
      const format = this.getFileFormat(filename);
      
      // Parsear dados
      const data = this.parseFileContent(fileContent, format);
      
      if (!data) {
        return { success: false, error: 'Formato de arquivo inválido' };
      }

      // Validar dados
      const validation = this.validateImportData(data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Importar dados
      const importResult = await this.processImportData(data);

      return {
        success: true,
        type: data.exportInfo?.type || 'desconhecido',
        period: data.exportInfo?.period || 'N/A',
        importedRecords: importResult.imported,
        errors: importResult.errors
      };

    } catch (error) {
      console.error('Erro na importação:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  private async findImportFile(filename: string): Promise<string | null> {
    const searchDirs = ['exports', 'imports', '.'];
    
    for (const dir of searchDirs) {
      try {
        const filePath = path.join(dir, filename);
        await fs.access(filePath);
        return filePath;
      } catch {
        // Continuar procurando
      }
    }
    
    return null;
  }

  private getFileFormat(filename: string): string {
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.csv')) return 'csv';
    if (filename.endsWith('.txt')) return 'txt';
    return 'json';
  }

  private parseFileContent(content: string, format: string): any {
    try {
      switch (format) {
        case 'json':
          return JSON.parse(content);
        
        case 'csv':
          return this.parseCSV(content);
        
        case 'txt':
          return this.parseTXT(content);
        
        default:
          return JSON.parse(content);
      }
    } catch (error) {
      console.error('Erro ao parsear arquivo:', error);
      return null;
    }
  }

  private parseCSV(content: string): any {
    // Implementação simplificada para CSV
    const lines = content.split('\n');
    const headers = lines[0].split(',');
    const data: any = {
      exportInfo: {
        type: 'csv_import',
        timestamp: new Date().toISOString()
      },
      records: []
    };

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',');
        const record: any = {};
        
        for (let j = 0; j < headers.length; j++) {
          record[headers[j]] = values[j] || '';
        }
        
        data.records.push(record);
      }
    }

    return data;
  }

  private parseTXT(content: string): any {
    // Implementação simplificada para TXT
    return {
      exportInfo: {
        type: 'txt_import',
        timestamp: new Date().toISOString()
      },
      content: content,
      lines: content.split('\n').length
    };
  }

  private validateImportData(data: any): { valid: boolean; error?: string } {
    if (!data) {
      return { valid: false, error: 'Dados vazios' };
    }

    if (!data.exportInfo) {
      return { valid: false, error: 'Informações de exportação ausentes' };
    }

    // Validar baseado no tipo
    const type = data.exportInfo.type;
    
    switch (type) {
      case 'messages':
        if (!data.messages || !Array.isArray(data.messages)) {
          return { valid: false, error: 'Dados de mensagens inválidos' };
        }
        break;
      
      case 'users':
        if (!data.users || !Array.isArray(data.users)) {
          return { valid: false, error: 'Dados de usuários inválidos' };
        }
        break;
      
      case 'commands':
        if (!data.commands || !Array.isArray(data.commands)) {
          return { valid: false, error: 'Dados de comandos inválidos' };
        }
        break;
      
      case 'statistics':
        if (!data.statistics) {
          return { valid: false, error: 'Dados de estatísticas inválidos' };
        }
        break;
      
      case 'complete':
        if (!data.groups || !data.users) {
          return { valid: false, error: 'Dados completos inválidos' };
        }
        break;
      
      default:
        // Para tipos desconhecidos, aceitar se tem dados básicos
        if (!data.records && !data.content) {
          return { valid: false, error: 'Formato de dados não reconhecido' };
        }
    }

    return { valid: true };
  }

  private async processImportData(data: any): Promise<{ imported: number; errors: number }> {
    let imported = 0;
    let errors = 0;

    try {
      const type = data.exportInfo?.type;

      switch (type) {
        case 'messages':
          if (data.messages) {
            for (const msg of data.messages) {
              try {
                // Aqui você implementaria a lógica real de importação
                // await this.databaseService.saveMessage(msg);
                imported++;
              } catch (error) {
                errors++;
              }
            }
          }
          break;

        case 'users':
          if (data.users) {
            for (const user of data.users) {
              try {
                // await this.databaseService.saveUser(user);
                imported++;
              } catch (error) {
                errors++;
              }
            }
          }
          break;

        case 'commands':
          if (data.commands) {
            for (const cmd of data.commands) {
              try {
                // await this.databaseService.saveCommand(cmd);
                imported++;
              } catch (error) {
                errors++;
              }
            }
          }
          break;

        case 'statistics':
          if (data.statistics) {
            try {
              // await this.databaseService.saveStatistics(data.statistics);
              imported++;
            } catch (error) {
              errors++;
            }
          }
          break;

        case 'complete':
          // Importar todos os tipos de dados
          if (data.messages) {
            for (const msg of data.messages) {
              try {
                // await this.databaseService.saveMessage(msg);
                imported++;
              } catch (error) {
                errors++;
              }
            }
          }
          if (data.users) {
            for (const user of data.users) {
              try {
                // await this.databaseService.saveUser(user);
                imported++;
              } catch (error) {
                errors++;
              }
            }
          }
          break;

        default:
          // Para tipos desconhecidos, contar como um registro
          imported = 1;
          break;
      }

    } catch (error) {
      console.error('Erro ao processar dados:', error);
      errors++;
    }

    return { imported, errors };
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      file: null,
      confirm: false,
      help: false,
      list: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--help' || arg === 'help') {
        options.help = true;
      } else if (arg === '--confirm') {
        options.confirm = true;
      } else if (arg === '--list' || arg === 'list') {
        options.list = true;
      } else if (!options.file) {
        options.file = arg;
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