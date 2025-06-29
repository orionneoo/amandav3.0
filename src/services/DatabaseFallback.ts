// Utilitário para fallback e métricas do MongoDB

export type FallbackOperation = {
  type: string;
  data: any;
  timestamp: number;
};

class DatabaseFallback {
  private static instance: DatabaseFallback;
  private queue: FallbackOperation[] = [];
  private fallbackCount: number = 0;
  private consecutiveFailures: number = 0;
  private lastSuccess: number = Date.now();
  private lastFailure: number = 0;
  private maxQueueSize: number = 1000;

  private constructor() {}

  public static getInstance(): DatabaseFallback {
    if (!DatabaseFallback.instance) {
      DatabaseFallback.instance = new DatabaseFallback();
    }
    return DatabaseFallback.instance;
  }

  public addOperation(type: string, data: any) {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift(); // Remove o mais antigo
    }
    this.queue.push({ type, data, timestamp: Date.now() });
    this.fallbackCount++;
    this.consecutiveFailures++;
    this.lastFailure = Date.now();
  }

  public markSuccess() {
    this.consecutiveFailures = 0;
    this.lastSuccess = Date.now();
  }

  public getMetrics() {
    return {
      fallbackCount: this.fallbackCount,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccess: this.lastSuccess,
      lastFailure: this.lastFailure,
      queueSize: this.queue.length,
    };
  }

  public getQueue() {
    return this.queue;
  }

  public clearQueue() {
    this.queue = [];
  }
}

export default DatabaseFallback.getInstance(); 