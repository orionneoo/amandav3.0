import { default as mongoose } from 'mongoose';
import DatabaseFallback from '@/services/DatabaseFallback';

export class DatabaseStatus {
  private static instance: DatabaseStatus;
  private consecutiveFailuresThreshold = 5; // Após 5 falhas consecutivas, considera offline
  private consecutiveFailures = 0;
  private lastSuccess = Date.now();
  private lastFailure = 0;

  private constructor() {}

  public static getInstance(): DatabaseStatus {
    if (!DatabaseStatus.instance) {
      DatabaseStatus.instance = new DatabaseStatus();
    }
    return DatabaseStatus.instance;
  }

  public isDatabaseOffline(): boolean {
    const metrics = DatabaseFallback.getMetrics();
    return metrics.consecutiveFailures >= this.consecutiveFailuresThreshold;
  }

  public markSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastSuccess = Date.now();
    DatabaseFallback.markSuccess();
  }

  public markFailure(): void {
    this.consecutiveFailures++;
    this.lastFailure = Date.now();
    DatabaseFallback.addOperation('failure', { timestamp: Date.now() });
  }

  public getOfflineMessage(commandName?: string): string {
    const messages = [
      "😅 Calma aí que tô calculando tudo e depois tu pede de novo!",
      "🤔 Deixa eu pensar... parece que tô com preguiça de acessar o banco agora!",
      "😴 O banco tá dormindo, acorda ele depois e tenta de novo!",
      "🤷‍♀️ Tô com dificuldade pra acessar os dados agora, tenta mais tarde!",
      "😅 Opa, deu uma bugada aqui! Tenta de novo em alguns minutos!",
      "🤔 Hmm, parece que tô offline do banco. Tenta mais tarde que eu resolvo!",
      "😴 O banco tá offline, mas eu tô aqui! Tenta de novo depois!",
      "🤷‍♀️ Não consegui acessar os dados agora, mas tenta de novo que eu resolvo!"
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    if (commandName) {
      return `❌ *${commandName}*\n\n${randomMessage}\n\n💡 Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧`;
    }
    
    return `${randomMessage}\n\n💡 Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧`;
  }

  public getDatabaseStatus(): {
    isOnline: boolean;
    consecutiveFailures: number;
    lastSuccess: string;
    lastFailure: string;
  } {
    const metrics = DatabaseFallback.getMetrics();
    const isOnline = mongoose.connection.readyState === 1 && !this.isDatabaseOffline();
    
    return {
      isOnline,
      consecutiveFailures: metrics.consecutiveFailures,
      lastSuccess: metrics.lastSuccess ? new Date(metrics.lastSuccess).toLocaleString() : 'Nunca',
      lastFailure: metrics.lastFailure ? new Date(metrics.lastFailure).toLocaleString() : 'Nunca'
    };
  }
}

export default DatabaseStatus.getInstance(); 