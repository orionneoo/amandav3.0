import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';
import { IPluginManager, IPlugin } from '@/interfaces/ICommand';
import { HookManager } from './HookManager';
import { CommandHandler } from '@/core/CommandHandler';
import Logger from '@/utils/Logger';
import * as fs from 'fs/promises';
import * as path from 'path';

@injectable()
export class PluginManager implements IPluginManager {
  private plugins: Map<string, IPlugin> = new Map();
  private pluginsPath: string;
  private loadedPlugins: Set<string> = new Set();

  constructor(
    @inject(TYPES.HookManager) private hookManager: HookManager,
    @inject(TYPES.CommandHandler) private commandHandler: CommandHandler
  ) {
    this.pluginsPath = path.join(process.cwd(), 'plugins');
    this.ensurePluginsDirectory();
  }

  public async loadPlugin(pluginPath: string): Promise<IPlugin> {
    try {
      Logger.info(`Carregando plugin: ${pluginPath}`);

      // Verificar se o plugin já está carregado
      if (this.loadedPlugins.has(pluginPath)) {
        Logger.warn(`Plugin ${pluginPath} já está carregado`);
        const existingPlugin = this.plugins.get(pluginPath);
        if (existingPlugin) return existingPlugin;
      }

      // Verificar se o arquivo existe
      const fullPath = path.resolve(pluginPath);
      const stats = await fs.stat(fullPath);
      
      if (!stats.isFile()) {
        throw new Error(`Plugin path não é um arquivo: ${pluginPath}`);
      }

      // Carregar módulo do plugin
      const pluginModule = await this.loadPluginModule(fullPath);
      
      // Validar plugin
      this.validatePlugin(pluginModule);

      // Criar instância do plugin
      const plugin: IPlugin = {
        name: pluginModule.name,
        version: pluginModule.version,
        description: pluginModule.description,
        author: pluginModule.author,
        dependencies: pluginModule.dependencies || [],
        commands: pluginModule.commands || [],
        hooks: pluginModule.hooks || [],
        initialize: pluginModule.initialize || (async () => {}),
        destroy: pluginModule.destroy || (async () => {})
      };

      // Verificar dependências
      await this.checkDependencies(plugin);

      // Inicializar plugin
      await plugin.initialize();

      // Registrar plugin
      this.plugins.set(pluginPath, plugin);
      this.loadedPlugins.add(pluginPath);

      // Executar hooks de plugin carregado
      await this.hookManager.executeHooks('onPluginLoad', plugin);

      Logger.info(`Plugin ${plugin.name} carregado com sucesso`, {
        version: plugin.version,
        author: plugin.author,
        commands: plugin.commands?.length ?? 0,
        hooks: plugin.hooks?.length ?? 0
      });

      return plugin;

    } catch (error) {
      Logger.error(`Erro ao carregar plugin ${pluginPath}`, { error });
      throw error;
    }
  }

  public async unloadPlugin(pluginName: string): Promise<void> {
    try {
      const plugin = this.getPlugin(pluginName);
      if (!plugin) {
        Logger.warn(`Plugin ${pluginName} não encontrado`);
        return;
      }

      Logger.info(`Descarregando plugin: ${pluginName}`);

      // Executar hooks de plugin sendo descarregado
      await this.hookManager.executeHooks('onPluginUnload', plugin);

      // Destruir plugin
      await plugin.destroy();

      // Remover plugin dos registros
      for (const [path, p] of this.plugins.entries()) {
        if (p.name === pluginName) {
          this.plugins.delete(path);
          this.loadedPlugins.delete(path);
          break;
        }
      }

      Logger.info(`Plugin ${pluginName} descarregado com sucesso`);

    } catch (error) {
      Logger.error(`Erro ao descarregar plugin ${pluginName}`, { error });
      throw error;
    }
  }

  public getPlugin(pluginName: string): IPlugin | undefined {
    for (const plugin of this.plugins.values()) {
      if (plugin.name === pluginName) {
        return plugin;
      }
    }
    return undefined;
  }

  public getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  public async reloadPlugin(pluginName: string): Promise<void> {
    try {
      Logger.info(`Recarregando plugin: ${pluginName}`);

      // Descarregar plugin
      await this.unloadPlugin(pluginName);

      // Encontrar caminho do plugin
      const pluginPath = this.findPluginPath(pluginName);
      if (!pluginPath) {
        throw new Error(`Caminho do plugin ${pluginName} não encontrado`);
      }

      // Recarregar plugin
      await this.loadPlugin(pluginPath);

      Logger.info(`Plugin ${pluginName} recarregado com sucesso`);

    } catch (error) {
      Logger.error(`Erro ao recarregar plugin ${pluginName}`, { error });
      throw error;
    }
  }

  // NOVO: Carregar todos os plugins de um diretório
  public async loadAllPlugins(): Promise<IPlugin[]> {
    try {
      Logger.info('Carregando todos os plugins...');

      const plugins: IPlugin[] = [];
      const files = await fs.readdir(this.pluginsPath);

      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          const pluginPath = path.join(this.pluginsPath, file);
          try {
            const plugin = await this.loadPlugin(pluginPath);
            plugins.push(plugin);
          } catch (error) {
            Logger.error(`Erro ao carregar plugin ${file}`, { error });
          }
        }
      }

      Logger.info(`${plugins.length} plugins carregados com sucesso`);
      return plugins;

    } catch (error) {
      Logger.error('Erro ao carregar plugins', { error });
      return [];
    }
  }

  // NOVO: Obter estatísticas dos plugins
  public getPluginStats(): { totalPlugins: number; loadedPlugins: number; pluginNames: string[] } {
    const pluginNames = Array.from(this.plugins.values()).map(p => p.name);
    
    return {
      totalPlugins: this.plugins.size,
      loadedPlugins: this.loadedPlugins.size,
      pluginNames
    };
  }

  // NOVO: Verificar se um plugin está carregado
  public isPluginLoaded(pluginName: string): boolean {
    return this.getPlugin(pluginName) !== undefined;
  }

  // NOVO: Obter plugins por categoria
  public getPluginsByCategory(category: string): IPlugin[] {
    // Implementação básica - pode ser expandida com metadados de categoria
    return this.getAllPlugins().filter(plugin => 
      plugin.description.toLowerCase().includes(category.toLowerCase())
    );
  }

  // NOVO: Carregar módulo do plugin
  private async loadPluginModule(pluginPath: string): Promise<any> {
    try {
      // Remover cache do módulo se existir
      delete require.cache[require.resolve(pluginPath)];
      
      // Carregar módulo
      const pluginModule = require(pluginPath);
      
      // Verificar se é um módulo ES6 ou CommonJS
      return pluginModule.default || pluginModule;
      
    } catch (error) {
      Logger.error(`Erro ao carregar módulo do plugin: ${pluginPath}`, { error });
      throw error;
    }
  }

  // NOVO: Validar plugin
  private validatePlugin(pluginModule: any): void {
    const requiredFields = ['name', 'version', 'description', 'author'];
    
    for (const field of requiredFields) {
      if (!pluginModule[field]) {
        throw new Error(`Plugin inválido: campo obrigatório '${field}' não encontrado`);
      }
    }

    // Validar nome do plugin
    if (typeof pluginModule.name !== 'string' || pluginModule.name.trim() === '') {
      throw new Error('Nome do plugin deve ser uma string não vazia');
    }

    // Validar versão
    if (typeof pluginModule.version !== 'string' || !/^\d+\.\d+\.\d+/.test(pluginModule.version)) {
      throw new Error('Versão do plugin deve estar no formato semântico (ex: 1.0.0)');
    }
  }

  // NOVO: Verificar dependências
  private async checkDependencies(plugin: IPlugin): Promise<void> {
    if (!plugin.dependencies || plugin.dependencies.length === 0) {
      return;
    }

    const missingDependencies: string[] = [];

    for (const dependency of plugin.dependencies) {
      if (!this.isPluginLoaded(dependency)) {
        missingDependencies.push(dependency);
      }
    }

    if (missingDependencies.length > 0) {
      throw new Error(`Dependências não encontradas: ${missingDependencies.join(', ')}`);
    }
  }

  // NOVO: Encontrar caminho do plugin
  private findPluginPath(pluginName: string): string | null {
    for (const [path, plugin] of this.plugins.entries()) {
      if (plugin.name === pluginName) {
        return path;
      }
    }
    return null;
  }

  // NOVO: Garantir que o diretório de plugins existe
  private async ensurePluginsDirectory(): Promise<void> {
    try {
      await fs.access(this.pluginsPath);
    } catch {
      try {
        await fs.mkdir(this.pluginsPath, { recursive: true });
        Logger.info(`Diretório de plugins criado: ${this.pluginsPath}`);
      } catch (error) {
        Logger.error('Erro ao criar diretório de plugins', { error });
      }
    }
  }

  // NOVO: Criar plugin de exemplo
  public createExamplePlugin(): string {
    const examplePlugin = `
// Exemplo de plugin para Amanda Bot
module.exports = {
  name: 'exemplo',
  version: '1.0.0',
  description: 'Plugin de exemplo para demonstração',
  author: 'Desenvolvedor',
  dependencies: [],
  commands: ['exemplo'],
  hooks: ['onMessage'],

  async initialize() {
    console.log('Plugin de exemplo inicializado!');
  },

  async destroy() {
    console.log('Plugin de exemplo destruído!');
  },

  // Comandos do plugin
  commands: {
    exemplo: {
      name: 'exemplo',
      description: 'Comando de exemplo',
      execute: async (sock, message, args) => {
        await sock.sendMessage(message.key.remoteJid, {
          text: 'Este é um comando de exemplo do plugin!'
        });
      }
    }
  },

  // Hooks do plugin
  hooks: {
    onMessage: {
      name: 'exemplo_message_hook',
      priority: 1,
      execute: async (message) => {
        console.log('Mensagem processada pelo plugin de exemplo:', message.text);
      }
    }
  }
};
`;

    const examplePath = path.join(this.pluginsPath, 'exemplo.js');
    fs.writeFile(examplePath, examplePlugin).catch(error => {
      Logger.error('Erro ao criar plugin de exemplo', { error });
    });

    return examplePath;
  }
} 