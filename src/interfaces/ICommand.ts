import { WASocket, proto } from '@whiskeysockets/baileys';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

export interface ICommand {
  name: string;
  aliases?: string[];
  description: string;
  category: 'ai' | 'admin' | 'utils' | 'general' | 'owner' | 'game';
  usage: string;
  cooldown?: number; // Cooldown em segundos
  handle: (context: MessageContext) => Promise<void>;
}

// Interface para comandos injetáveis (classes)
export interface IInjectableCommand extends ICommand {
  // Comandos injetáveis são classes que implementam ICommand
  // e podem receber dependências via construtor
}

// Interface para contexto de comando
export interface ICommandContext {
  sock: WASocket;
  msg: WAMessage;
  args: string[];
  commandName?: string;
}

// NOVO: Interfaces para sistema de hooks
export interface IHook {
  name: string;
  priority: number;
  execute: (...args: any[]) => Promise<void>;
}

export interface IHookManager {
  registerHook(event: string, hook: IHook): void;
  unregisterHook(event: string, hookName: string): void;
  executeHooks(event: string, ...args: any[]): Promise<void>;
  getHooks(event: string): IHook[];
}

// NOVO: Interfaces para sistema de plugins
export interface IPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  dependencies?: string[];
  commands?: string[];
  hooks?: string[];
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}

export interface IPluginManager {
  loadPlugin(pluginPath: string): Promise<IPlugin>;
  unloadPlugin(pluginName: string): Promise<void>;
  getPlugin(pluginName: string): IPlugin | undefined;
  getAllPlugins(): IPlugin[];
  reloadPlugin(pluginName: string): Promise<void>;
}

// NOVO: Interfaces para sistema de alertas
export interface IAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  acknowledged: boolean;
}

export interface IAlertService {
  sendAlert(alert: Omit<IAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void>;
  getAlerts(limit?: number): IAlert[];
  acknowledgeAlert(alertId: string): void;
  clearAlerts(): void;
}

export interface IPerformanceMetrics {
  cpu: number;
  memory: number;
  aiResponseTime: number;
  databaseLatency: number;
  activeConnections: number;
  errorRate: number;
  timestamp: Date;
}

export interface IPerformanceMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
  getMetrics(): IPerformanceMetrics;
  getMetricsHistory(limit?: number): IPerformanceMetrics[];
} 