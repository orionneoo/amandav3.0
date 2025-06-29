import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand, IInjectableCommand } from '@/interfaces/ICommand';
import { IFunctionCall } from '@/interfaces/IFunctionTool';
import { createSafeCommand } from '@/utils/commandWrapper';
import { AmandaErrorMessages } from '@/utils/errorMessages';
import Logger, { ErrorLogData, CommandLogData } from '@/utils/Logger';
import path from 'node:path';
import fs from 'node:fs/promises';
import { injectable, inject } from 'inversify';

type WAMessage = proto.IWebMessageInfo;

// FIX: Interface para erros de comando
interface CommandError {
  commandName: string;
  error: Error;
  timestamp: Date;
  context: {
    groupJid?: string;
    userJid: string;
    args: string[];
  };
}

@injectable()
export class CommandHandler {
  private commands: Map<string, ICommand>;
  private injectableCommands: Map<string, IInjectableCommand>; // NOVO: Comandos injetáveis
  private aliases: Map<string, string>; // Mapeia alias para nome do comando
  private commandsPath: string;
  private errorLog: CommandError[] = []; // FIX: Log de erros para análise

  constructor() {
    this.commands = new Map<string, ICommand>();
    this.injectableCommands = new Map<string, IInjectableCommand>(); // NOVO: Inicializar
    this.aliases = new Map<string, string>();
    this.commandsPath = path.join(__dirname, '..' , 'commands');
  }

  public async loadCommands(): Promise<void> {
    Logger.logSystem('Iniciando carregamento de comandos', {
      commandsPath: this.commandsPath
    });

    // NOVO: Primeiro carregar comandos injetáveis do container
    await this.loadInjectableCommandsFromContainer();

    const categories = await fs.readdir(this.commandsPath);
    let totalCommands = 0;
    let totalInjectableCommands = 0; // NOVO: Contador
    let totalAliases = 0;

    for (const category of categories) {
      const categoryPath = path.join(this.commandsPath, category);
      const isDirectory = (await fs.stat(categoryPath)).isDirectory();

      if (isDirectory) {
        const commandFiles = await fs.readdir(categoryPath);
        for (const file of commandFiles) {
          if (file.endsWith('.ts') || file.endsWith('.js')) {
            const commandPath = path.join(categoryPath, file);
            try {
              // Usar require para carregar o comando
              const commandModule = require(commandPath);
              
              // NOVO: Verificar se é comando injetável (classe) ou normal (objeto)
              if (commandModule.default && typeof commandModule.default === 'function') {
                // É uma classe injetável
                const injectableCommand: IInjectableCommand = commandModule.default;
                if (injectableCommand.name && typeof injectableCommand.execute === 'function') {
                  // Verificar se já não foi carregado do container
                  if (!this.injectableCommands.has(injectableCommand.name)) {
                    this.injectableCommands.set(injectableCommand.name, injectableCommand);
                    totalInjectableCommands++;
                    
                    Logger.logSystem(`Comando injetável carregado do arquivo: ${injectableCommand.name}`, {
                      category,
                      file,
                      type: 'injectable_file'
                    });
                  }
                  
                  // Carregar aliases se existirem
                  if (injectableCommand.aliases && Array.isArray(injectableCommand.aliases)) {
                    for (const alias of injectableCommand.aliases) {
                      this.aliases.set(alias, injectableCommand.name);
                      totalAliases++;
                      
                      Logger.logSystem(`Alias carregado: ${alias}`, {
                        targetCommand: injectableCommand.name,
                        category,
                        type: 'injectable'
                      });
                    }
                  }
                }
              } else {
                // É um comando normal (objeto)
                const command: ICommand = commandModule.default;

                if (command && command.name && typeof command.execute === 'function') {
                  // FIX: Aplicar wrapper de segurança automaticamente
                  const safeCommand = createSafeCommand(command);
                  this.commands.set(command.name, safeCommand);
                  totalCommands++;
                  
                  Logger.logSystem(`Comando carregado: ${command.name}`, {
                    category,
                    file,
                    protected: true,
                    type: 'normal'
                  });
                  
                  // Carregar aliases se existirem
                  if (command.aliases && Array.isArray(command.aliases)) {
                    for (const alias of command.aliases) {
                      this.aliases.set(alias, command.name);
                      totalAliases++;
                      
                      Logger.logSystem(`Alias carregado: ${alias}`, {
                        targetCommand: command.name,
                        category,
                        type: 'normal'
                      });
                    }
                  }
                } else {
                  Logger.warn(`Comando inválido no arquivo`, {
                    file,
                    category,
                    hasName: !!command?.name,
                    hasExecute: typeof command?.execute === 'function'
                  });
                }
              }
            } catch (error) {
              Logger.logError({
                timestamp: new Date().toISOString(),
                level: 'error',
                errorMessage: `Erro ao carregar comando ${file}`,
                stackTrace: error instanceof Error ? error.stack : undefined,
                metadata: {
                  file,
                  category,
                  commandPath
                }
              });
            }
          }
        }
      }
    }

    Logger.logSystem('Carregamento de comandos concluído', {
      totalCommands,
      totalInjectableCommands,
      totalAliases,
      categories: categories.length
    });
  }

  // NOVO: Carregar comandos injetáveis do container
  private async loadInjectableCommandsFromContainer(): Promise<void> {
    try {
      const { container } = await import('@/core/container');
      const { TYPES } = await import('@/config/container');
      
      // Verificar se o container está inicializado
      if (!container) {
        Logger.warn('Container não inicializado, pulando carregamento de comandos injetáveis');
        return;
      }
      
      const injectableCommands = container.getAll<IInjectableCommand>(TYPES.IInjectableCommand);
      
      Logger.logSystem(`Carregando ${injectableCommands.length} comandos injetáveis do container`);
      
      for (const command of injectableCommands) {
        if (command.name && typeof command.execute === 'function') {
          this.injectableCommands.set(command.name, command);
          
          Logger.logSystem(`Comando injetável carregado do container: ${command.name}`, {
            type: 'injectable_container'
          });
          
          // Carregar aliases se existirem
          if (command.aliases && Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
              this.aliases.set(alias, command.name);
              
              Logger.logSystem(`Alias carregado do container: ${alias}`, {
                targetCommand: command.name,
                type: 'injectable_container'
              });
            }
          }
        }
      }
    } catch (error) {
      Logger.warn('Erro ao carregar comandos injetáveis do container', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  // NOVO: Método para executar Function Calls
  public async executeFunctionCall(
    functionCall: IFunctionCall, 
    sock: WASocket, 
    message: WAMessage, 
    senderInfo: any
  ): Promise<void> {
    const startTime = Date.now();
    const { name, args } = functionCall;
    
    try {
      Logger.logSystem('Executando Function Call', {
        functionName: name,
        args,
        userId: senderInfo.jid
      });

      // Buscar comando injetável correspondente
      const command = this.injectableCommands.get(name);
      if (!command) {
        Logger.warn('Function Call não encontrado', {
          functionName: name,
          availableCommands: Array.from(this.injectableCommands.keys())
        });
        
        await sock.sendMessage(message.key.remoteJid!, {
          text: `❌ Opa, não consegui encontrar a função "${name}". Tente usar um comando direto como !${name}. Se não souber como usar, chama o meu criador: +55 21 6723-3931 - ele vai te ajudar! 💪`
        });
        return;
      }

      // Converter argumentos da função para formato de comando
      const commandArgs = this.mapFunctionArgsToCommandArgs(args, name);
      
      // Executar o comando
      await command.execute(sock, message, commandArgs);
      
      Logger.logSystem('Function Call executado com sucesso', {
        functionName: name,
        executionTime: Date.now() - startTime
      });

    } catch (error) {
      Logger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        errorMessage: `Erro ao executar Function Call ${name}`,
        stackTrace: error instanceof Error ? error.stack : undefined,
        metadata: {
          functionName: name,
          args,
          executionTime: Date.now() - startTime
        }
      });

      await sock.sendMessage(message.key.remoteJid!, {
        text: `❌ Ops! Deu ruim na hora de executar "${name}". Tente usar o comando direto !${name}. Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧`
      });
    }
  }

  // NOVO: Mapeia argumentos da função para formato de comando
  private mapFunctionArgsToCommandArgs(args: Record<string, any>, functionName: string): string[] {
    const commandArgs: string[] = [];

    switch (functionName) {
      case 'banir':
        if (args.userJid) {
          // Extrair número do JID para mencionar
          const number = args.userJid.split('@')[0];
          commandArgs.push(`@${number}`);
        }
        if (args.motivo) {
          commandArgs.push(args.motivo);
        }
        break;

      case 'personalidade':
        if (args.personalidade) {
          commandArgs.push(args.personalidade);
        }
        break;

      case 'fofoca':
      case 'intriga':
        if (args.tema) {
          commandArgs.push(args.tema);
        }
        break;

      case 'menage':
      case 'par':
      case 'casal':
        if (args.quantidade) {
          commandArgs.push(args.quantidade.toString());
        }
        break;

      default:
        // Para comandos genéricos, adiciona todos os argumentos
        Object.values(args).forEach(value => {
          if (value !== undefined && value !== null) {
            commandArgs.push(String(value));
          }
        });
    }

    return commandArgs;
  }

  // NOVO: Retorna todos os comandos injetáveis
  public getInjectableCommands(): IInjectableCommand[] {
    return Array.from(this.injectableCommands.values());
  }

  // FIX: Método melhorado com tratamento de erro robusto
  public async executeCommand(commandName: string, sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const startTime = Date.now();
    const groupJid = message.key.remoteJid;
    const userJid = message.key.participant || message.key.remoteJid!;
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Verificar se é um alias primeiro
      const actualCommandName = this.aliases.get(commandName) || commandName;
      
      // NOVO: Verificar se o comando está desativado no grupo (com timeout reduzido e fallback)
      if (groupJid && groupJid.endsWith('@g.us')) {
        try {
          const { Group } = await import('@/database/models/GroupSchema');
          
          // Timeout reduzido para 3 segundos
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database timeout')), 3000);
          });
          
          const groupPromise = Group.findOne({ groupJid }).exec();
          const group = await Promise.race([groupPromise, timeoutPromise]) as any;
          
          const disabledCommands = group?.settings?.disabledCommands || [];
          
          if (disabledCommands.includes(actualCommandName)) {
            await sock.sendMessage(message.key.remoteJid!, { 
              text: `❌ O comando \`!${actualCommandName}\` está desativado neste grupo.\n\n💡 Use \`!comandos listar\` para ver quais comandos estão ativos.` 
            });
            return;
          }
        } catch (dbError) {
          // Erro no banco não deve impedir execução do comando - apenas log
          Logger.warn(`Erro ao verificar comandos desativados`, {
            command: actualCommandName,
            groupJid,
            error: dbError instanceof Error ? dbError.message : String(dbError),
            isTimeout: dbError instanceof Error && dbError.message.includes('timeout')
          });
          // Continua a execução mesmo com erro de banco
        }
      }
      
      // NOVO: Buscar primeiro nos comandos injetáveis, depois nos normais
      let command = this.injectableCommands.get(actualCommandName);
      if (!command) {
        command = this.commands.get(actualCommandName);
      }

      if (!command) {
        // FIX: Comando não encontrado - mensagem personalizada da Amanda
        const availableCommands = [
          ...Array.from(this.injectableCommands.keys()),
          ...Array.from(this.commands.keys())
        ];
        const suggestions = AmandaErrorMessages.generateCommandSuggestions(commandName, availableCommands);
        const errorMessage = AmandaErrorMessages.getCommandNotFoundMessage(commandName, suggestions);
        
        Logger.logCommand({
          timestamp: new Date().toISOString(),
          level: 'warn',
          command: commandName,
          userId: userJid,
          groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
          success: false,
          executionTime: Date.now() - startTime,
          metadata: {
            sessionId,
            args,
            phase: 'command_not_found',
            suggestions,
            availableCommands: availableCommands.length
          }
        });

        await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
        return;
      }

      // FIX: Log estruturado de execução
      Logger.logCommand({
        timestamp: new Date().toISOString(),
        level: 'info',
        command: actualCommandName,
        userId: userJid,
        groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
        success: true,
        executionTime: 0,
        metadata: {
          sessionId,
          args,
          phase: 'start',
          isAlias: commandName !== actualCommandName,
          originalCommand: commandName,
          isInjectable: this.injectableCommands.has(actualCommandName)
        }
      });

      // NOVO: Registrar uso do comando por grupo (com timeout reduzido e fallback silencioso)
      if (groupJid && groupJid.endsWith('@g.us')) {
        // Executar em background sem bloquear o comando
        setImmediate(async () => {
          try {
            const { CommandUsage } = await import('@/database/models/CommandUsageSchema');
            
            // Timeout reduzido para 2 segundos
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Database timeout')), 2000);
            });
            
            const updatePromise = CommandUsage.findOneAndUpdate(
              { groupJid, command: actualCommandName },
              { $inc: { count: 1 } },
              { upsert: true }
            ).exec();
            
            await Promise.race([updatePromise, timeoutPromise]);
          } catch (dbError) {
            // Erro silencioso - não afeta a execução do comando
            Logger.warn(`Erro ao registrar uso do comando no banco (silencioso)`, {
              command: actualCommandName,
              groupJid,
              error: dbError instanceof Error ? dbError.message : String(dbError),
              isTimeout: dbError instanceof Error && dbError.message.includes('timeout')
            });
          }
        });
      }

      // FIX: Execução do comando com timeout (agora o wrapper já protege)
      await command.execute(sock, message, args);
      
      // FIX: Log estruturado de sucesso
      const executionTime = Date.now() - startTime;
      Logger.logCommand({
        timestamp: new Date().toISOString(),
        level: 'info',
        command: actualCommandName,
        userId: userJid,
        groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
        success: true,
        executionTime,
        metadata: {
          sessionId,
          args,
          phase: 'success',
          isAlias: commandName !== actualCommandName,
          originalCommand: commandName,
          isInjectable: this.injectableCommands.has(actualCommandName)
        }
      });

    } catch (error) {
      // FIX: Tratamento de erro robusto
      const executionTime = Date.now() - startTime;
      const errorData: CommandError = {
        commandName,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
        context: {
          groupJid: groupJid?.endsWith('@g.us') ? groupJid : undefined,
          userJid,
          args
        }
      };

      this.errorLog.push(errorData);
      if (this.errorLog.length > 100) {
        this.errorLog = this.errorLog.slice(-100); // Manter apenas os últimos 100 erros
      }

      Logger.logCommand({
        timestamp: new Date().toISOString(),
        level: 'error',
        command: commandName,
        userId: userJid,
        groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
        success: false,
        executionTime,
        metadata: {
          sessionId,
          args,
          phase: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
          stackTrace: error instanceof Error ? error.stack : undefined
        }
      });

      // FIX: Mensagem de erro personalizada da Amanda
      const errorMessage = AmandaErrorMessages.getCommandErrorMessage(commandName, error);
      await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
    }
  }

  // FIX: Método para sugerir comandos similares (agora usando o sistema da Amanda)
  private getCommandSuggestions(input: string): string[] {
    const availableCommands = Array.from(this.commands.keys());
    return AmandaErrorMessages.generateCommandSuggestions(input, availableCommands);
  }

  public getCommand(name: string): ICommand | undefined {
    const actualCommandName = this.aliases.get(name) || name;
    return this.commands.get(actualCommandName);
  }

  public getAllCommands(): Map<string, ICommand> {
    return this.commands;
  }

  public getAliases(): Map<string, string> {
    return this.aliases;
  }

  // FIX: Método para obter estatísticas de erros
  public getErrorStats(): { totalErrors: number; recentErrors: CommandError[] } {
    return {
      totalErrors: this.errorLog.length,
      recentErrors: this.errorLog.slice(-10) // Últimos 10 erros
    };
  }
} 