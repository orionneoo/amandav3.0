import { injectable } from 'inversify';
import { IHookManager, IHook } from '@/interfaces/ICommand';
import Logger from '@/utils/Logger';

@injectable()
export class HookManager implements IHookManager {
  private hooks: Map<string, IHook[]> = new Map();

  // NOVO: Eventos disponíveis para hooks
  private readonly availableEvents = [
    // Eventos de mensagem
    'beforeMessage',
    'afterMessage',
    'onCommand',
    'onAIResponse',
    'onError',
    
    // Eventos de grupo
    'onUserJoin',
    'onUserLeave',
    'onUserBan',
    'onUserUnban',
    'onUserPromote',
    'onUserDemote',
    'onGroupCreate',
    'onGroupDelete',
    
    // Eventos de sistema
    'onStartup',
    'onShutdown',
    'onDatabaseConnect',
    'onDatabaseDisconnect',
    'onPerformanceAlert',
    
    // Eventos de plugin
    'onPluginLoad',
    'onPluginUnload',
    'onPluginError'
  ];

  constructor() {
    Logger.info('HookManager inicializado', { availableEvents: this.availableEvents.length });
  }

  public registerHook(event: string, hook: IHook): void {
    try {
      // Validar se o evento é suportado
      if (!this.availableEvents.includes(event)) {
        Logger.warn(`Tentativa de registrar hook para evento não suportado: ${event}`);
        return;
      }

      // Validar hook
      if (!hook.name || typeof hook.execute !== 'function') {
        Logger.error('Hook inválido', { hook });
        return;
      }

      // Obter hooks existentes para o evento
      const eventHooks = this.hooks.get(event) || [];
      
      // Verificar se já existe um hook com o mesmo nome
      const existingHookIndex = eventHooks.findIndex(h => h.name === hook.name);
      if (existingHookIndex !== -1) {
        // Substituir hook existente
        eventHooks[existingHookIndex] = hook;
        Logger.info(`Hook ${hook.name} substituído para evento ${event}`);
      } else {
        // Adicionar novo hook
        eventHooks.push(hook);
        Logger.info(`Hook ${hook.name} registrado para evento ${event}`);
      }

      // Ordenar hooks por prioridade (maior prioridade primeiro)
      eventHooks.sort((a, b) => b.priority - a.priority);
      
      // Salvar hooks ordenados
      this.hooks.set(event, eventHooks);

    } catch (error) {
      Logger.error('Erro ao registrar hook', { error, event, hook });
    }
  }

  public unregisterHook(event: string, hookName: string): void {
    try {
      const eventHooks = this.hooks.get(event);
      if (!eventHooks) {
        Logger.warn(`Nenhum hook encontrado para evento: ${event}`);
        return;
      }

      const initialLength = eventHooks.length;
      const filteredHooks = eventHooks.filter(hook => hook.name !== hookName);
      
      if (filteredHooks.length < initialLength) {
        this.hooks.set(event, filteredHooks);
        Logger.info(`Hook ${hookName} removido do evento ${event}`);
      } else {
        Logger.warn(`Hook ${hookName} não encontrado no evento ${event}`);
      }

    } catch (error) {
      Logger.error('Erro ao remover hook', { error, event, hookName });
    }
  }

  public async executeHooks(event: string, ...args: any[]): Promise<void> {
    try {
      const eventHooks = this.hooks.get(event);
      if (!eventHooks || eventHooks.length === 0) {
        return; // Nenhum hook registrado para este evento
      }

      Logger.debug(`Executando ${eventHooks.length} hooks para evento: ${event}`);

      // Executar hooks em paralelo para melhor performance
      const hookPromises = eventHooks.map(async (hook) => {
        try {
          const startTime = Date.now();
          await hook.execute(...args);
          const executionTime = Date.now() - startTime;
          
          Logger.debug(`Hook ${hook.name} executado em ${executionTime}ms`);
        } catch (error) {
          Logger.error(`Erro ao executar hook ${hook.name}`, { 
            error, 
            event, 
            hookName: hook.name 
          });
          
          // Não interromper outros hooks por causa de um erro
        }
      });

      await Promise.all(hookPromises);

    } catch (error) {
      Logger.error('Erro ao executar hooks', { error, event });
    }
  }

  public getHooks(event: string): IHook[] {
    return this.hooks.get(event) || [];
  }

  // NOVO: Obter todos os eventos com hooks registrados
  public getEventsWithHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  // NOVO: Obter estatísticas dos hooks
  public getHookStats(): { totalHooks: number; eventsWithHooks: number; eventBreakdown: Record<string, number> } {
    const eventBreakdown: Record<string, number> = {};
    let totalHooks = 0;

    for (const [event, hooks] of this.hooks.entries()) {
      eventBreakdown[event] = hooks.length;
      totalHooks += hooks.length;
    }

    return {
      totalHooks,
      eventsWithHooks: this.hooks.size,
      eventBreakdown
    };
  }

  // NOVO: Verificar se um evento tem hooks registrados
  public hasHooks(event: string): boolean {
    const hooks = this.hooks.get(event);
    return hooks !== undefined && hooks.length > 0;
  }

  // NOVO: Limpar todos os hooks de um evento
  public clearEventHooks(event: string): void {
    const hooks = this.hooks.get(event);
    if (hooks && hooks.length > 0) {
      this.hooks.delete(event);
      Logger.info(`Todos os hooks do evento ${event} foram removidos (${hooks.length} hooks)`);
    }
  }

  // NOVO: Limpar todos os hooks
  public clearAllHooks(): void {
    const totalHooks = Array.from(this.hooks.values()).reduce((sum, hooks) => sum + hooks.length, 0);
    this.hooks.clear();
    Logger.info(`Todos os hooks foram removidos (${totalHooks} hooks)`);
  }

  // NOVO: Obter lista de eventos disponíveis
  public getAvailableEvents(): string[] {
    return [...this.availableEvents];
  }

  // NOVO: Registrar hook com validação adicional
  public registerHookWithValidation(event: string, hook: IHook, validateFunction?: (args: any[]) => boolean): void {
    const originalExecute = hook.execute;
    
    // Criar hook com validação
    const validatedHook: IHook = {
      ...hook,
      execute: async (...args: any[]) => {
        try {
          // Executar validação se fornecida
          if (validateFunction && !validateFunction(args)) {
            Logger.warn(`Hook ${hook.name} falhou na validação para evento ${event}`);
            return;
          }

          await originalExecute(...args);
        } catch (error) {
          Logger.error(`Erro no hook ${hook.name}`, { error, event });
        }
      }
    };

    this.registerHook(event, validatedHook);
  }

  // NOVO: Criar hook de exemplo para logging
  public createLoggingHook(event: string, hookName: string): IHook {
    return {
      name: hookName,
      priority: 1, // Baixa prioridade para logging
      execute: async (...args: any[]) => {
        Logger.info(`[HOOK] Evento ${event} executado`, {
          event,
          hookName,
          argsCount: args.length,
          timestamp: new Date().toISOString()
        });
      }
    };
  }
} 