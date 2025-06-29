import NodeCache from 'node-cache';
import Logger from '@/utils/Logger';

export class CacheManager {
  private static instance: CacheManager;
  private cache: NodeCache;

  private constructor() {
    // Configuração do cache com TTL padrão de 10 minutos e checagem a cada 2 minutos
    this.cache = new NodeCache({ 
      stdTTL: 600, // 10 minutos em segundos
      checkperiod: 120, // Checa expiração a cada 2 minutos
      useClones: false, // Melhor performance
      deleteOnExpire: true // Remove automaticamente itens expirados
    });

    // Log de eventos do cache
    this.cache.on('expired', (key, value) => {
      Logger.debug(`Cache expirado: ${key}`, { 
        type: 'cache_expired',
        key,
        valueType: typeof value
      });
    });

    this.cache.on('flush', () => {
      Logger.info('Cache limpo completamente', { type: 'cache_flush' });
    });

    Logger.logSystem('CacheManager inicializado', {
      defaultTTL: '10 minutos',
      checkPeriod: '2 minutos'
    });
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Obtém um valor do cache
   */
  public get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    
    if (value !== undefined) {
      Logger.debug(`Cache hit: ${key}`, { 
        type: 'cache_hit',
        key 
      });
    } else {
      Logger.debug(`Cache miss: ${key}`, { 
        type: 'cache_miss',
        key 
      });
    }
    
    return value;
  }

  /**
   * Define um valor no cache com TTL padrão
   */
  public set<T>(key: string, value: T): boolean {
    const result = this.cache.set(key, value);
    
    Logger.debug(`Cache set: ${key}`, { 
      type: 'cache_set',
      key,
      valueType: typeof value
    });
    
    return result;
  }

  /**
   * Define um valor no cache com TTL customizado
   */
  public setWithTTL<T>(key: string, value: T, ttlSeconds: number): boolean {
    const result = this.cache.set(key, value, ttlSeconds);
    
    Logger.debug(`Cache set with TTL: ${key}`, { 
      type: 'cache_set_ttl',
      key,
      valueType: typeof value,
      ttlSeconds
    });
    
    return result;
  }

  /**
   * Remove um item do cache
   */
  public delete(key: string): number {
    const result = this.cache.del(key);
    
    if (result > 0) {
      Logger.debug(`Cache delete: ${key}`, { 
        type: 'cache_delete',
        key 
      });
    }
    
    return result;
  }

  /**
   * Verifica se uma chave existe no cache
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Obtém estatísticas do cache
   */
  public getStats(): {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) * 100
    };
  }

  /**
   * Limpa todo o cache
   */
  public flush(): void {
    this.cache.flushAll();
    Logger.info('Cache limpo manualmente', { type: 'cache_manual_flush' });
  }

  /**
   * Obtém todas as chaves do cache
   */
  public getKeys(): string[] {
    return this.cache.keys();
  }

  /**
   * Obtém múltiplos valores de uma vez
   */
  public getMultiple<T>(keys: string[]): { [key: string]: T | undefined } {
    return this.cache.mget<T>(keys);
  }

  /**
   * Define múltiplos valores de uma vez
   */
  public setMultiple<T>(keyValuePairs: { [key: string]: T }): boolean {
    const items = Object.entries(keyValuePairs).map(([key, value]) => ({ key, val: value }));
    return this.cache.mset(items);
  }
}

// Exporta uma instância singleton
export default CacheManager.getInstance(); 