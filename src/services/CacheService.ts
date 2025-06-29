// src/services/CacheService.ts

import NodeCache from 'node-cache';
import { IMessage } from '@/database/UserSessionSchema'; // Reutiliza a interface de mensagem
import { injectable } from 'inversify';

@injectable()
export class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 }); // TTL padrão de 1 hora (3600 segundos)
  }

  public getChatHistory(jid: string): IMessage[] | undefined {
    return this.cache.get<IMessage[]>(jid);
  }

  public setChatHistory(jid: string, history: IMessage[]): void {
    this.cache.set(jid, history);
  }

  public updateChatHistory(jid: string, newMessage: IMessage): void {
    let history = this.getChatHistory(jid);
    if (history) {
      history.push(newMessage);
    } else {
      history = [newMessage];
    }
    this.setChatHistory(jid, history);
  }

  public deleteChatHistory(jid: string): void {
    this.cache.del(jid);
  }

  // NOVO: Método para limpar todo o cache
  public async clear(): Promise<void> {
    try {
      this.cache.flushAll();
      console.log('[CacheService] Cache limpo com sucesso');
    } catch (error) {
      console.error('[CacheService] Erro ao limpar cache:', error);
      throw error;
    }
  }

  // NOVO: Método para obter estatísticas do cache
  public getStats(): { keys: number; hits: number; misses: number } {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses
    };
  }

  // NOVO: Método para definir TTL personalizado
  public setWithTTL(key: string, value: any, ttl: number): void {
    this.cache.set(key, value, ttl);
  }
} 