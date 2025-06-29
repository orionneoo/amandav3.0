import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import Logger from '@/utils/Logger';
import path from 'node:path';
import fs from 'node:fs/promises';
import { MessageContext } from '@/handlers/message.handler';

export class CommandHandler {
  private commands: Map<string, ICommand>;
  private aliases: Map<string, string>;
  private readonly commandsPath: string;

  constructor() {
    this.commands = new Map<string, ICommand>();
    this.aliases = new Map<string, string>();
    this.commandsPath = path.join(__dirname, '..', 'commands');
  }

  public async loadCommands(): Promise<void> {
    Logger.logSystem('Iniciando carregamento de comandos', {
      commandsPath: this.commandsPath
    });

    try {
    const categories = await fs.readdir(this.commandsPath);
    for (const category of categories) {
      const categoryPath = path.join(this.commandsPath, category);
      const isDirectory = (await fs.stat(categoryPath)).isDirectory();

      if (isDirectory) {
          const commandFiles = (await fs.readdir(categoryPath)).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

        for (const file of commandFiles) {
            const commandPath = path.join(categoryPath, file);
            try {
              const commandModule = await import(commandPath);
                const command: ICommand = commandModule.default;

                if (command && command.name && typeof command.handle === 'function') {
                  this.commands.set(command.name, command);

                  if (command.aliases && Array.isArray(command.aliases)) {
                  command.aliases.forEach(alias => this.aliases.set(alias, command.name));
                }
              }
            } catch (error) {
              Logger.logError({
                level: 'error',
                timestamp: new Date().toISOString(),
                errorMessage: `Erro ao carregar comando ${file}`,
                stackTrace: error instanceof Error ? error.stack : String(error),
              });
            }
          }
        }
      }
    } catch (error) {
      Logger.logError({
        level: 'error',
        timestamp: new Date().toISOString(),
        errorMessage: `Erro ao ler diretório de comandos.`,
        stackTrace: error instanceof Error ? error.stack : String(error),
      });
    }

    Logger.logSystem('Carregamento de comandos concluído', {
      totalCommands: this.commands.size,
      totalAliases: this.aliases.size,
    });
  }

  public getCommand(commandName: string): ICommand | undefined {
    const alias = this.aliases.get(commandName);
    return this.commands.get(commandName) || this.commands.get(alias!);
  }

  public getCommands(): Map<string, ICommand> {
    return this.commands;
  }

  public async handle(context: MessageContext): Promise<void> {
    if (!context.command) return;

    const command = this.getCommand(context.command);

    if (command) {
      Logger.logSystem(`Executando comando: ${command.name}`, { user: context.sender, group: context.isGroup ? context.from : 'PV' });
      await command.handle(context);
    } else {
      Logger.warn(`Comando não encontrado: ${context.command}`, { user: context.sender });
    }
  }
} 