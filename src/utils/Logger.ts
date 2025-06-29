import winston from 'winston';
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// NOVO: Configuração de níveis de debug
const DEBUG_LEVELS: Record<string, number> = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  VERBOSE: 5
};

// NOVO: Configuração de debug por módulo
const DEBUG_CONFIG = {
  // Configuração global de debug
  global: process.env.DEBUG_LEVEL || 'INFO',
  
  // Configuração específica por módulo
  modules: {
    'MessageManager': process.env.DEBUG_MESSAGE_MANAGER || 'ERROR',
    'AIService': process.env.DEBUG_AI_SERVICE || 'ERROR',
    'Bot': process.env.DEBUG_BOT || 'ERROR',
    'Commands': process.env.DEBUG_COMMANDS || 'ERROR',
    'Database': process.env.DEBUG_DATABASE || 'ERROR',
    'Onboarding': process.env.DEBUG_ONBOARDING || 'INFO'
  } as Record<string, string>
};

// NOVO: Função para verificar se debug está ativo para um módulo
function isDebugEnabled(module: string, level: string = 'DEBUG'): boolean {
  const moduleConfig = DEBUG_CONFIG.modules[module] || DEBUG_CONFIG.global;
  const requestedLevel = DEBUG_LEVELS[level] || DEBUG_LEVELS.DEBUG;
  const configuredLevel = DEBUG_LEVELS[moduleConfig] || DEBUG_LEVELS.ERROR;
  
  return requestedLevel <= configuredLevel;
}

// NOVO: Função para debug condicional
function conditionalDebug(module: string, level: string, message: string, ...args: any[]): void {
  if (isDebugEnabled(module, level)) {
    console.log(`[${module}] ${message}`, ...args);
  }
}

// NOVO: Função para debug de mensagens (mais restritiva)
function messageDebug(message: string, ...args: any[]): void {
  if (isDebugEnabled('MessageManager', 'DEBUG')) {
    console.log(`[MessageManager] ${message}`, ...args);
  }
}

// NOVO: Função para debug de IA (mais restritiva)
function aiDebug(message: string, ...args: any[]): void {
  if (isDebugEnabled('AIService', 'DEBUG')) {
    console.log(`[AIService] ${message}`, ...args);
  }
}

// NOVO: Função para debug de comandos (mais restritiva)
function commandDebug(message: string, ...args: any[]): void {
  if (isDebugEnabled('Commands', 'DEBUG')) {
    console.log(`[Commands] ${message}`, ...args);
  }
}

// NOVO: Função para debug de onboarding (mais permissiva)
function onboardingDebug(message: string, ...args: any[]): void {
  if (isDebugEnabled('Onboarding', 'INFO')) {
    console.log(`[Onboarding] ${message}`, ...args);
  }
}

// NOVO: Função para debug de bot (mais restritiva)
function botDebug(message: string, ...args: any[]): void {
  if (isDebugEnabled('Bot', 'ERROR')) {
    console.log(`[Bot] ${message}`, ...args);
  }
}

// NOVO: Função para debug de banco de dados (mais restritiva)
function databaseDebug(message: string, ...args: any[]): void {
  if (isDebugEnabled('Database', 'ERROR')) {
    console.log(`[Database] ${message}`, ...args);
  }
}

// NOVO: Função para configurar debug dinamicamente
function setDebugLevel(module: string, level: string): void {
  if (DEBUG_LEVELS[level] !== undefined) {
    DEBUG_CONFIG.modules[module] = level;
    console.log(`[Logger] Debug level for ${module} set to ${level}`);
  } else {
    console.warn(`[Logger] Invalid debug level: ${level}`);
  }
}

// NOVO: Função para listar configuração de debug
function getDebugConfig(): any {
  return {
    global: DEBUG_CONFIG.global,
    modules: { ...DEBUG_CONFIG.modules }
  };
}

// NOVO: Função para limpar logs antigos
function cleanupOldLogs(): void {
  // Implementar limpeza de logs antigos se necessário
  console.log('[Logger] Log cleanup not implemented yet');
}

// Interface para dados estruturados de erro
export interface ErrorLogData {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  command?: string;
  userId?: string;
  groupId?: string;
  errorMessage: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
  sessionId?: string;
  executionTime?: number;
}

// Interface para logs de comando
export interface CommandLogData {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  command: string;
  userId: string;
  groupId?: string;
  success: boolean;
  executionTime: number;
  metadata?: Record<string, any>;
}

class Logger {
  private logger: winston.Logger;
  private static instance: Logger;

  private constructor() {
    // Configurar diretório de logs
    const logDir = path.join(process.cwd(), 'logs');
    
    // Formato personalizado para logs estruturados
    const structuredFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // Formato para console (mais legível)
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          log += ` | ${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
      })
    );

    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: structuredFormat,
      defaultMeta: { service: 'amanda-bot' },
      transports: [
        // NOVO: Arquivo de log para erros
        new transports.File({ 
          filename: path.join(logDir, 'error.log'), 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        
        // NOVO: Arquivo de log para todas as mensagens
        new transports.File({ 
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        
        // NOVO: Console apenas para produção (sem debug)
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple(),
            format.printf(({ timestamp, level, message, service, ...meta }) => {
              // NOVO: Filtrar logs de debug no console em produção
              if (process.env.NODE_ENV === 'production' && level === 'debug') {
                return ''; // Retornar string vazia em vez de null
              }
              
              let logMessage = `${timestamp} [${service}] ${level}: ${message}`;
              
              // Adicionar metadados se existirem
              if (Object.keys(meta).length > 0) {
                logMessage += ` ${JSON.stringify(meta)}`;
              }
              
              return logMessage;
            })
          )
        }),

        // Arquivo de logs gerais (rotação diária)
        new DailyRotateFile({
          filename: path.join(logDir, 'amanda-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: structuredFormat
        }),

        // Arquivo específico para erros (rotação diária)
        new DailyRotateFile({
          filename: path.join(logDir, 'errors-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
          format: structuredFormat
        }),

        // Arquivo para comandos (rotação diária)
        new DailyRotateFile({
          filename: path.join(logDir, 'commands-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '7d',
          format: structuredFormat
        })
      ]
    });

    // Log inicial do sistema
    this.info('Sistema de logging inicializado', {
      environment: process.env.NODE_ENV || 'development',
      logLevel: this.logger.level,
      logDirectory: logDir
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Método para log de erro estruturado
  public logError(data: ErrorLogData): void {
    const logData = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
      type: 'error',
      source: 'command_execution'
    };

    this.logger.error(data.errorMessage, logData);
  }

  // Método para log de comando
  public logCommand(data: CommandLogData): void {
    const logData = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
      type: 'command_execution',
      source: 'amanda_bot'
    };

    this.logger.info(`Comando executado: ${data.command}`, logData);
  }

  // Método para log de performance
  public logPerformance(operation: string, executionTime: number, metadata?: Record<string, any>): void {
    const level = executionTime > 5000 ? 'warn' : 'info';
    
    this.logger.log(level, `Performance: ${operation}`, {
      timestamp: new Date().toISOString(),
      operation,
      executionTime,
      level: executionTime > 5000 ? 'slow' : 'normal',
      metadata
    });
  }

  // Método para log de sistema
  public logSystem(message: string, metadata?: Record<string, any>): void {
    this.logger.info(message, {
      timestamp: new Date().toISOString(),
      type: 'system',
      source: 'amanda_bot',
      ...metadata
    });
  }

  // Métodos de conveniência
  public error(message: string, metadata?: Record<string, any>): void {
    this.logger.error(message, metadata);
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    this.logger.warn(message, metadata);
  }

  public info(message: string, metadata?: Record<string, any>): void {
    this.logger.info(message, metadata);
  }

  public debug(message: string, metadata?: Record<string, any>): void {
    this.logger.debug(message, metadata);
  }

  // Método para gerar relatório de erros
  public generateErrorReport(startDate: Date, endDate: Date): Promise<any> {
    // Implementação futura para análise de logs
    return Promise.resolve({
      period: { startDate, endDate },
      totalErrors: 0,
      errorTypes: {},
      mostAffectedCommands: []
    });
  }

  // Método para limpar logs antigos
  public async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    // Implementação futura para limpeza automática
    this.info(`Limpeza de logs configurada para manter ${daysToKeep} dias`);
  }
}

export default Logger.getInstance();

// NOVO: Exportar funções de debug
export {
  conditionalDebug,
  messageDebug,
  aiDebug,
  commandDebug,
  onboardingDebug,
  botDebug,
  databaseDebug,
  setDebugLevel,
  getDebugConfig,
  cleanupOldLogs,
  isDebugEnabled
}; 