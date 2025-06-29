import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { PluginManager } from '@/services/PluginManager';
import { WASocket } from '@whiskeysockets/baileys';
import Logger from '@/utils/Logger';

type WAMessage = any;

@injectable()
export class PluginsCommand implements IInjectableCommand {
  public readonly name = 'plugins';
  public readonly description = 'Gerenciar plugins do sistema';
  public readonly usage = '!dono plugins [listar|carregar|descarregar|recarregar|estatisticas]';
  public readonly aliases = ['plugin'];
  public readonly category = 'owner';
  public readonly adminOnly = false;
  public readonly ownerOnly = true;

  constructor(
    @inject(TYPES.PluginManager) private pluginManager: PluginManager
  ) {}

  public async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const action = args[0]?.toLowerCase() || 'listar';

      switch (action) {
        case 'listar':
        case 'list':
          await this.listPlugins(sock, message, args);
          break;
        
        case 'carregar':
        case 'load':
          await this.loadPlugin(sock, message, args);
          break;
        
        case 'descarregar':
        case 'unload':
          await this.unloadPlugin(sock, message, args);
          break;
        
        case 'recarregar':
        case 'reload':
          await this.reloadPlugin(sock, message, args);
          break;
        
        case 'estatisticas':
        case 'stats':
          await this.showStats(sock, message, args);
          break;
        
        case 'exemplo':
        case 'example':
          await this.createExample(sock, message, args);
          break;
        
        default:
          await this.showHelp(sock, message);
          break;
      }

    } catch (error) {
      Logger.error('Erro no comando plugins', { error, args });
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ Erro ao processar comando de plugins'
      });
    }
  }

  private async listPlugins(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const plugins = this.pluginManager.getAllPlugins();
    
    if (plugins.length === 0) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '🔌 *PLUGINS DO SISTEMA*\n\nNenhum plugin carregado.\n\n💡 Use `!dono plugins exemplo` para criar um plugin de exemplo.'
      });
      return;
    }

    let pluginsText = `🔌 *PLUGINS CARREGADOS* (${plugins.length})\n\n`;
    
    for (const plugin of plugins) {
      const status = '🟢'; // Plugin carregado
      pluginsText += `${status} *${plugin.name}* v${plugin.version}\n`;
      pluginsText += `   📝 ${plugin.description}\n`;
      pluginsText += `   👤 ${plugin.author}\n`;
      pluginsText += `   🎯 Comandos: ${plugin.commands?.length || 0}\n`;
      pluginsText += `   🔗 Hooks: ${plugin.hooks?.length || 0}\n`;
      
      if (plugin.dependencies && plugin.dependencies.length > 0) {
        pluginsText += `   📦 Dependências: ${plugin.dependencies.join(', ')}\n`;
      }
      
      pluginsText += '\n';
    }

    pluginsText += '💡 Use `!dono plugins recarregar <nome>` para recarregar um plugin';

    await sock.sendMessage(message.key.remoteJid, { text: pluginsText });
  }

  private async loadPlugin(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const pluginPath = args[1];
    
    if (!pluginPath) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ *ERRO*\n\nUso: `!dono plugins carregar <caminho>`\n\nExemplo: `!dono plugins carregar ./plugins/exemplo.js`'
      });
      return;
    }

    try {
      const plugin = await this.pluginManager.loadPlugin(pluginPath);
      
      await sock.sendMessage(message.key.remoteJid, {
        text: `✅ *PLUGIN CARREGADO*\n\n*${plugin.name}* v${plugin.version}\n📝 ${plugin.description}\n👤 ${plugin.author}`
      });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ *ERRO AO CARREGAR PLUGIN*\n\n${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async unloadPlugin(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const pluginName = args[1];
    
    if (!pluginName) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ *ERRO*\n\nUso: `!dono plugins descarregar <nome>`'
      });
      return;
    }

    try {
      await this.pluginManager.unloadPlugin(pluginName);
      
      await sock.sendMessage(message.key.remoteJid, {
        text: `✅ *PLUGIN DESCARREGADO*\n\nPlugin *${pluginName}* foi descarregado com sucesso.`
      });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ *ERRO AO DESCARREGAR PLUGIN*\n\n${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async reloadPlugin(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const pluginName = args[1];
    
    if (!pluginName) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ *ERRO*\n\nUso: `!dono plugins recarregar <nome>`'
      });
      return;
    }

    try {
      await this.pluginManager.reloadPlugin(pluginName);
      
      await sock.sendMessage(message.key.remoteJid, {
        text: `✅ *PLUGIN RECARREGADO*\n\nPlugin *${pluginName}* foi recarregado com sucesso.`
      });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ *ERRO AO RECARREGAR PLUGIN*\n\n${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async showStats(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const stats = this.pluginManager.getPluginStats();
    
    let statsText = '📊 *ESTATÍSTICAS DE PLUGINS*\n\n';
    statsText += `🔌 Total de plugins: ${stats.totalPlugins}\n`;
    statsText += `📦 Plugins carregados: ${stats.loadedPlugins}\n\n`;
    
    if (stats.pluginNames.length > 0) {
      statsText += '📋 *Plugins ativos:*\n';
      for (const name of stats.pluginNames) {
        statsText += `   • ${name}\n`;
      }
    }

    await sock.sendMessage(message.key.remoteJid, { text: statsText });
  }

  private async createExample(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const examplePath = this.pluginManager.createExamplePlugin();
      
      await sock.sendMessage(message.key.remoteJid, {
        text: `✅ *PLUGIN DE EXEMPLO CRIADO*\n\nPlugin de exemplo foi criado em:\n\`${examplePath}\`\n\n💡 Edite o arquivo e use \`!dono plugins carregar ${examplePath}\` para testá-lo.`
      });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ *ERRO AO CRIAR EXEMPLO*\n\n${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async showHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpText = `🔌 *COMANDO DE PLUGINS*\n\n` +
                    `*Uso:* \`!dono plugins [ação]\`\n\n` +
                    `*Ações disponíveis:*\n` +
                    `📋 \`listar\` - Listar plugins carregados\n` +
                    `📦 \`carregar <caminho>\` - Carregar plugin\n` +
                    `🗑️ \`descarregar <nome>\` - Descarregar plugin\n` +
                    `🔄 \`recarregar <nome>\` - Recarregar plugin\n` +
                    `📊 \`estatisticas\` - Ver estatísticas\n` +
                    `💡 \`exemplo\` - Criar plugin de exemplo\n\n` +
                    `*Exemplos:*\n` +
                    `• \`!dono plugins\` - Listar plugins\n` +
                    `• \`!dono plugins carregar ./plugins/exemplo.js\`\n` +
                    `• \`!dono plugins recarregar exemplo\`\n` +
                    `• \`!dono plugins exemplo\` - Criar exemplo`;

    await sock.sendMessage(message.key.remoteJid, { text: helpText });
  }
} 