import fs from 'fs/promises';
import path from 'path';

interface ErrorLog {
  timestamp: string;
  error: string;
  stack?: string;
  context?: {
    messageId?: string;
    jid?: string;
    userId?: string;
    action?: string;
    [key: string]: any; // Permite propriedades adicionais
  };
}

export class ErrorLogger {
  private static readonly LOG_FILE = 'error_log.json';
  private static readonly MAX_LOG_SIZE = 1000; // Máximo de 1000 erros no arquivo

  public static async logError(error: Error | string, context?: ErrorLog['context']): Promise<void> {
    try {
      const errorLog: ErrorLog = {
        timestamp: new Date().toISOString(),
        error: typeof error === 'string' ? error : error.message,
        stack: error instanceof Error ? error.stack : undefined,
        context
      };

      // Ler logs existentes
      let logs: ErrorLog[] = [];
      try {
        const logPath = path.join(process.cwd(), this.LOG_FILE);
        const existingData = await fs.readFile(logPath, 'utf-8');
        logs = JSON.parse(existingData);
      } catch (readError) {
        // Arquivo não existe ou está vazio, começar com array vazio
        logs = [];
      }

      // Adicionar novo erro
      logs.push(errorLog);

      // Manter apenas os últimos MAX_LOG_SIZE erros
      if (logs.length > this.MAX_LOG_SIZE) {
        logs = logs.slice(-this.MAX_LOG_SIZE);
      }

      // Salvar no arquivo
      const logPath = path.join(process.cwd(), this.LOG_FILE);
      await fs.writeFile(logPath, JSON.stringify(logs, null, 2));

      // Log no console também
      console.error(`[ERROR LOGGED] ${errorLog.timestamp}: ${errorLog.error}`);
      if (context) {
        console.error(`[CONTEXT]`, context);
      }
    } catch (logError) {
      // Se falhar ao salvar o erro, pelo menos logar no console
      console.error('[ERROR LOGGER FAILED]', logError);
      console.error('[ORIGINAL ERROR]', error);
    }
  }

  public static async getRecentErrors(limit: number = 10): Promise<ErrorLog[]> {
    try {
      const logPath = path.join(process.cwd(), this.LOG_FILE);
      const data = await fs.readFile(logPath, 'utf-8');
      const logs: ErrorLog[] = JSON.parse(data);
      return logs.slice(-limit);
    } catch (error) {
      return [];
    }
  }

  public static async clearLogs(): Promise<void> {
    try {
      const logPath = path.join(process.cwd(), this.LOG_FILE);
      await fs.writeFile(logPath, '[]');
      console.log('[ERROR LOGGER] Logs limpos com sucesso');
    } catch (error) {
      console.error('[ERROR LOGGER] Falha ao limpar logs:', error);
    }
  }

  // NOVO: Obter contagem de erros por período
  static async getErrorCount(startDate: Date, endDate: Date): Promise<number> {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      const files = await fs.readdir(logDir);
      
      let totalErrors = 0;
      
      for (const file of files) {
        if (file.includes('errors-') && file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const logEntry = JSON.parse(line);
                const logDate = new Date(logEntry.timestamp);
                
                if (logDate >= startDate && logDate <= endDate) {
                  totalErrors++;
                }
              } catch (e) {
                // Ignorar linhas inválidas
              }
            }
          }
        }
      }
      
      return totalErrors;
    } catch (error) {
      console.error('Erro ao contar erros:', error);
      return 0;
    }
  }

  // NOVO: Obter erros por período
  static async getErrors(startDate: Date, endDate: Date): Promise<Array<{
    timestamp: string;
    error: string;
    context?: any;
  }>> {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      const files = await fs.readdir(logDir);
      
      const errors: Array<{
        timestamp: string;
        error: string;
        context?: any;
      }> = [];
      
      for (const file of files) {
        if (file.includes('errors-') && file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const logEntry = JSON.parse(line);
                const logDate = new Date(logEntry.timestamp);
                
                if (logDate >= startDate && logDate <= endDate) {
                  errors.push({
                    timestamp: logEntry.timestamp,
                    error: logEntry.errorMessage || logEntry.error || 'Erro desconhecido',
                    context: logEntry.context
                  });
                }
              } catch (e) {
                // Ignorar linhas inválidas
              }
            }
          }
        }
      }
      
      // Ordenar por timestamp (mais recentes primeiro)
      return errors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Erro ao obter erros:', error);
      return [];
    }
  }
} 