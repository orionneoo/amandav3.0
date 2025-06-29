import { WASocket } from '@whiskeysockets/baileys';
import { DatabaseStatus } from './databaseStatus';
import { ICommandContext } from '@/interfaces/ICommand';
import { ErrorLogger } from './errorLogger';

type WAMessage = any;

export interface CommandWithDatabaseCheck {
  name: string;
  requiresDatabase: boolean;
}

/**
 * Middleware para verificar se o banco está offline antes de executar comandos
 */
export async function checkDatabaseStatus(
  sock: WASocket, 
  message: WAMessage, 
  commandName: string,
  requiresDatabase: boolean = true
): Promise<boolean> {
  if (!requiresDatabase) {
    return true; // Comando não depende do banco
  }

  if (DatabaseStatus.getInstance().isDatabaseOffline()) {
    await sock.sendMessage(message.key.remoteJid!, {
      text: DatabaseStatus.getInstance().getOfflineMessage(commandName)
    });
    return false; // Banco offline, não executar comando
  }

  return true; // Banco online, pode executar comando
}

/**
 * Decorator para aplicar verificação de banco automaticamente
 */
export function withDatabaseCheck(commandName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ICommandContext) {
      const { sock, msg, commandName } = context;

      try {
        // Verificar se o banco de dados está offline
        if (DatabaseStatus.getInstance().isDatabaseOffline()) {
          await sock.sendMessage(msg.key.remoteJid!, {
            text: DatabaseStatus.getInstance().getOfflineMessage(commandName)
          });
          return;
        }

        // Executar o comando original
        const result = await originalMethod.call(this, context);
        return result;

      } catch (error) {
        console.error(`[ERROR] Erro no comando ${commandName}:`, error);
        
        // Enviar mensagem de erro para o usuário
        try {
          const cmdName = commandName || 'Comando';
          await sock.sendMessage(msg.key.remoteJid!, {
            text: `❌ *${cmdName}*\n\n😅 Deu uma bugada aqui! Tenta de novo ou chama o meu criador: +55 21 6723-3931 🔧`
          });
        } catch (sendError) {
          console.error('[ERROR] Erro ao enviar mensagem de erro:', sendError);
        }

        // Log do erro
        await ErrorLogger.logError(error as Error, {
          action: `command_${commandName}`,
          messageId: msg.key.id || undefined,
          jid: msg.key.remoteJid || undefined,
          userId: msg.key.participant || undefined
        });
      }
    };

    return descriptor;
  };
}

/**
 * Lista de comandos que dependem do banco de dados
 */
export const DATABASE_DEPENDENT_COMMANDS = [
  'resumo',
  'historico', 
  'estatisticas',
  'logs',
  'usuarios',
  'banir',
  'desbanir',
  'search',
  'find',
  'stats',
  'analytics',
  'report',
  'backup',
  'restore',
  'sync',
  'export',
  'import'
];

/**
 * Verifica se um comando depende do banco de dados
 */
export function isDatabaseDependent(commandName: string): boolean {
  return DATABASE_DEPENDENT_COMMANDS.some(cmd => 
    commandName.toLowerCase().includes(cmd.toLowerCase())
  );
}

export function commandMiddleware(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (sock: WASocket, message: WAMessage, args: string[]) {
    const cmdName = propertyKey || 'Comando';
    
    try {
      // Verificar se o banco de dados está offline
      if (DatabaseStatus.getInstance().isDatabaseOffline()) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: DatabaseStatus.getInstance().getOfflineMessage(cmdName)
        });
        return;
      }

      // Executar o comando original
      const result = await originalMethod.call(this, sock, message, args);
      return result;

    } catch (error) {
      console.error(`[ERROR] Erro no comando ${cmdName}:`, error);
      
      // Enviar mensagem de erro para o usuário
      try {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `❌ *${cmdName}*\n\n😅 Deu uma bugada aqui! Tenta de novo ou chama o meu criador: +55 21 6723-3931 🔧`
        });
      } catch (sendError) {
        console.error('[ERROR] Erro ao enviar mensagem de erro:', sendError);
      }

      // Log do erro
      await ErrorLogger.logError(error as Error, {
        action: `command_${cmdName}`,
        messageId: message.key.id || undefined,
        jid: message.key.remoteJid || undefined,
        userId: message.key.participant || undefined
      });
    }
  };

  return descriptor;
} 