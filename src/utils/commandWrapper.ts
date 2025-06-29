import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { AmandaErrorMessages, ErrorContext, ErrorType } from '@/utils/errorMessages';
import Logger, { ErrorLogData, CommandLogData } from '@/utils/Logger';

type WAMessage = proto.IWebMessageInfo;

// FIX: Interface para métricas de comando
interface CommandMetrics {
  executionCount: number;
  totalExecutionTime: number;
  errorCount: number;
  lastExecuted: Date | null;
}

// FIX: Sistema de cooldown por usuário e comando
const commandCooldowns = new Map<string, Map<string, number>>(); // userId -> (commandName -> lastUsed)

// FIX: Wrapper para comandos com tratamento automático de erro
export function createSafeCommand(command: ICommand): ICommand {
  const metrics: CommandMetrics = {
    executionCount: 0,
    totalExecutionTime: 0,
    errorCount: 0,
    lastExecuted: null
  };

  return {
    ...command,
    execute: async (sock: WASocket, message: WAMessage, args: string[]): Promise<void> => {
      const startTime = Date.now();
      const groupJid = message.key.remoteJid;
      const userJid = message.key.participant || message.key.remoteJid!;
      const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // FIX: Verificar cooldown do comando
      if (command.cooldown) {
        const now = Date.now();
        const userCooldowns = commandCooldowns.get(userJid) || new Map<string, number>();
        const lastUsed = userCooldowns.get(command.name) || 0;
        const cooldownMs = command.cooldown * 1000;

        if (now - lastUsed < cooldownMs) {
          const timeLeft = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
          
          // FIX: Log de cooldown
          Logger.logCommand({
            timestamp: new Date().toISOString(),
            level: 'warn',
            command: command.name,
            userId: userJid,
            groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
            success: false,
            executionTime: 0,
            metadata: {
              sessionId,
              args,
              phase: 'cooldown',
              timeLeft,
              cooldown: command.cooldown
            }
          });

          // FIX: Mensagem personalizada da Amanda para cooldown
          const cooldownMessages = [
            `Calma aí, fofinho(a)! 🔥 Espera mais ${timeLeft}s pra usar o !${command.name} de novo.`,
            `Eita, baby! ⏰ Tá com pressa? Aguarda ${timeLeft} segundos antes de usar o !${command.name} novamente.`,
            `Ops, gracinha! 🕐 O !${command.name} tá de cooldown. Volta em ${timeLeft}s, tá?`,
            `Hmm, amor! ⏱️ Deixa o !${command.name} descansar um pouco. Tenta de novo em ${timeLeft} segundos.`
          ];
          
          const cooldownMessage = cooldownMessages[Math.floor(Math.random() * cooldownMessages.length)];
          
          await sock.sendMessage(message.key.remoteJid!, { 
            text: cooldownMessage
          });
          return;
        }

        // FIX: Atualizar timestamp do último uso
        userCooldowns.set(command.name, now);
        commandCooldowns.set(userJid, userCooldowns);
      }
      
      try {
        // FIX: Log estruturado de início da execução
        Logger.logCommand({
          timestamp: new Date().toISOString(),
          level: 'info',
          command: command.name,
          userId: userJid,
          groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
          success: true,
          executionTime: 0,
          metadata: {
            sessionId,
            args,
            phase: 'start'
          }
        });
        
        // Executar o comando original
        await command.execute(sock, message, args);
        
        // FIX: Atualizar métricas de sucesso
        const executionTime = Date.now() - startTime;
        metrics.executionCount++;
        metrics.totalExecutionTime += executionTime;
        metrics.lastExecuted = new Date();
        
        // FIX: Log estruturado de sucesso
        Logger.logCommand({
          timestamp: new Date().toISOString(),
          level: 'info',
          command: command.name,
          userId: userJid,
          groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
          success: true,
          executionTime,
          metadata: {
            sessionId,
            args,
            phase: 'success',
            metrics: {
              totalExecutions: metrics.executionCount,
              totalErrors: metrics.errorCount,
              successRate: metrics.executionCount > 0 ? 
                ((metrics.executionCount - metrics.errorCount) / metrics.executionCount * 100).toFixed(2) + '%' : '0%'
            }
          }
        });

        // FIX: Log de performance se execução for lenta
        if (executionTime > 5000) {
          Logger.logPerformance(`Comando ${command.name}`, executionTime, {
            sessionId,
            userId: userJid,
            groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined
          });
        }
        
      } catch (error) {
        // FIX: Tratamento robusto de erro com logging estruturado
        const executionTime = Date.now() - startTime;
        metrics.errorCount++;
        metrics.lastExecuted = new Date();
        
        // FIX: Criar contexto de erro para análise
        const errorContext: ErrorContext = {
          commandName: command.name,
          error: error instanceof Error ? error : new Error(String(error)),
          args,
          userJid,
          groupJid: groupJid?.endsWith('@g.us') ? groupJid : undefined,
          command
        };
        
        // FIX: Detectar tipo de erro
        const errorType = AmandaErrorMessages.detectErrorType(errorContext.error, errorContext);
        
        // FIX: Log estruturado detalhado do erro
        const errorLogData: ErrorLogData = {
          timestamp: new Date().toISOString(),
          level: 'error',
          command: command.name,
          userId: userJid,
          groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
          errorMessage: errorContext.error.message,
          stackTrace: errorContext.error.stack,
          sessionId,
          executionTime,
          metadata: {
            errorType,
            args,
            metrics: {
              totalExecutions: metrics.executionCount,
              totalErrors: metrics.errorCount,
              successRate: metrics.executionCount > 0 ? 
                ((metrics.executionCount - metrics.errorCount) / metrics.executionCount * 100).toFixed(2) + '%' : '0%'
            }
          }
        };

        Logger.logError(errorLogData);

        // FIX: Log de comando com falha
        Logger.logCommand({
          timestamp: new Date().toISOString(),
          level: 'error',
          command: command.name,
          userId: userJid,
          groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
          success: false,
          executionTime,
          metadata: {
            sessionId,
            args,
            phase: 'error',
            errorType,
            errorMessage: errorContext.error.message
          }
        });

        // FIX: Gerar mensagem de erro personalizada da Amanda
        const userErrorMessage = AmandaErrorMessages.generateErrorMessage(errorType, errorContext);

        // FIX: Tentar enviar mensagem de erro personalizada para o usuário
        try {
          await sock.sendMessage(message.key.remoteJid!, { 
            text: userErrorMessage
          });
        } catch (sendError) {
          // FIX: Log estruturado se nem a mensagem de erro conseguir enviar
          Logger.logError({
            timestamp: new Date().toISOString(),
            level: 'error',
            command: command.name,
            userId: userJid,
            groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
            errorMessage: `Falha ao enviar mensagem de erro: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
            stackTrace: sendError instanceof Error ? sendError.stack : undefined,
            sessionId,
            executionTime,
            metadata: {
              originalError: errorContext.error.message,
              errorType,
              phase: 'error_message_send_failed'
            }
          });
        }
      }
    }
  };
}

// FIX: Decorator para adicionar validação de argumentos
export function validateArgs(validationRules: {
  minArgs?: number;
  maxArgs?: number;
  requiredArgs?: string[];
  optionalArgs?: string[];
}) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(sock: WASocket, message: WAMessage, args: string[]) {
      const { minArgs = 0, maxArgs = Infinity, requiredArgs = [], optionalArgs = [] } = validationRules;
      
      // FIX: Validação de número de argumentos com mensagens personalizadas
      if (args.length < minArgs) {
        const errorContext: ErrorContext = {
          commandName: target.name || 'comando',
          error: new Error(`Missing arguments: expected ${minArgs}, got ${args.length}`),
          args,
          userJid: message.key.participant || message.key.remoteJid!,
          groupJid: message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : undefined,
          command: target
        };
        
        const errorMessage = AmandaErrorMessages.generateErrorMessage(ErrorType.MISSING_ARGS, errorContext);
        await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
        return;
      }
      
      if (args.length > maxArgs) {
        const errorContext: ErrorContext = {
          commandName: target.name || 'comando',
          error: new Error(`Too many arguments: expected ${maxArgs}, got ${args.length}`),
          args,
          userJid: message.key.participant || message.key.remoteJid!,
          groupJid: message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : undefined,
          command: target
        };
        
        const errorMessage = AmandaErrorMessages.generateErrorMessage(ErrorType.INVALID_ARGS, errorContext);
        await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
        return;
      }
      
      // FIX: Validação de argumentos obrigatórios
      for (let i = 0; i < requiredArgs.length; i++) {
        if (!args[i]) {
          const errorContext: ErrorContext = {
            commandName: target.name || 'comando',
            error: new Error(`Missing required argument: ${requiredArgs[i]}`),
            args,
            userJid: message.key.participant || message.key.remoteJid!,
            groupJid: message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : undefined,
            command: target
          };
          
          const errorMessage = AmandaErrorMessages.generateErrorMessage(ErrorType.MISSING_ARGS, errorContext);
          await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
          return;
        }
      }
      
      // FIX: Executar método original se validação passar
      return originalMethod.call(this, sock, message, args);
    };
    
    return descriptor;
  };
}

// FIX: Decorator para adicionar rate limiting
export function rateLimit(maxExecutions: number, timeWindowMs: number = 60000) {
  const executionCounts = new Map<string, { count: number; resetTime: number }>();
  
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(sock: WASocket, message: WAMessage, args: string[]) {
      const userJid = message.key.participant || message.key.remoteJid!;
      const now = Date.now();
      
      // FIX: Verificar rate limit
      const userLimit = executionCounts.get(userJid);
      if (userLimit && now < userLimit.resetTime) {
        if (userLimit.count >= maxExecutions) {
          const remainingTime = Math.ceil((userLimit.resetTime - now) / 1000);
          
          // FIX: Usar mensagem personalizada da Amanda para rate limit
          const errorContext: ErrorContext = {
            commandName: target.name || 'comando',
            error: new Error(`Rate limit exceeded: ${maxExecutions} executions in ${timeWindowMs}ms`),
            args,
            userJid,
            groupJid: message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : undefined,
            command: target
          };
          
          const errorMessage = AmandaErrorMessages.generateErrorMessage(ErrorType.RATE_LIMIT, errorContext);
          await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
          return;
        }
        userLimit.count++;
      } else {
        executionCounts.set(userJid, { count: 1, resetTime: now + timeWindowMs });
      }
      
      // FIX: Limpar entradas antigas periodicamente
      if (executionCounts.size > 1000) {
        for (const [key, value] of executionCounts.entries()) {
          if (now > value.resetTime) {
            executionCounts.delete(key);
          }
        }
      }
      
      return originalMethod.call(this, sock, message, args);
    };
    
    return descriptor;
  };
}

// FIX: Função utilitária para criar comandos seguros com validação
export function createValidatedCommand(
  command: ICommand, 
  validationRules?: {
    minArgs?: number;
    maxArgs?: number;
    requiredArgs?: string[];
    optionalArgs?: string[];
  },
  rateLimitConfig?: {
    maxExecutions: number;
    timeWindowMs?: number;
  }
): ICommand {
  let safeCommand = createSafeCommand(command);
  
  // FIX: Aplicar validação se fornecida
  if (validationRules) {
    const originalExecute = safeCommand.execute;
    safeCommand.execute = async (sock: WASocket, message: WAMessage, args: string[]) => {
      const { minArgs = 0, maxArgs = Infinity, requiredArgs = [], optionalArgs = [] } = validationRules;
      
      if (args.length < minArgs) {
        const errorContext: ErrorContext = {
          commandName: command.name,
          error: new Error(`Missing arguments: expected ${minArgs}, got ${args.length}`),
          args,
          userJid: message.key.participant || message.key.remoteJid!,
          groupJid: message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : undefined,
          command
        };
        
        const errorMessage = AmandaErrorMessages.generateErrorMessage(ErrorType.MISSING_ARGS, errorContext);
        await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
        return;
      }
      
      if (args.length > maxArgs) {
        const errorContext: ErrorContext = {
          commandName: command.name,
          error: new Error(`Too many arguments: expected ${maxArgs}, got ${args.length}`),
          args,
          userJid: message.key.participant || message.key.remoteJid!,
          groupJid: message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : undefined,
          command
        };
        
        const errorMessage = AmandaErrorMessages.generateErrorMessage(ErrorType.INVALID_ARGS, errorContext);
        await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
        return;
      }
      
      for (let i = 0; i < requiredArgs.length; i++) {
        if (!args[i]) {
          const errorContext: ErrorContext = {
            commandName: command.name,
            error: new Error(`Missing required argument: ${requiredArgs[i]}`),
            args,
            userJid: message.key.participant || message.key.remoteJid!,
            groupJid: message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : undefined,
            command
          };
          
          const errorMessage = AmandaErrorMessages.generateErrorMessage(ErrorType.MISSING_ARGS, errorContext);
          await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
          return;
        }
      }
      
      return originalExecute(sock, message, args);
    };
  }
  
  return safeCommand;
} 