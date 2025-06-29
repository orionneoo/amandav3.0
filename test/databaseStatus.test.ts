import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DatabaseStatus from '../src/utils/databaseStatus';
import DatabaseFallback from '../src/services/DatabaseFallback';

// Mock do DatabaseFallback
jest.mock('../src/services/DatabaseFallback', () => ({
  getMetrics: jest.fn(() => ({
    consecutiveFailures: 0,
    lastSuccess: Date.now(),
    lastFailure: 0,
    fallbackCount: 0,
    queueSize: 0
  })),
  markSuccess: jest.fn(),
  addOperation: jest.fn()
}));

const POSSIBLE_MESSAGES = [
  "😅 Calma aí que tô calculando tudo e depois tu pede de novo!",
  "🤔 Deixa eu pensar... parece que tô com preguiça de acessar o banco agora!",
  "😴 O banco tá dormindo, acorda ele depois e tenta de novo!",
  "🤷‍♀️ Tô com dificuldade pra acessar os dados agora, tenta mais tarde!",
  "😅 Opa, deu uma bugada aqui! Tenta de novo em alguns minutos!",
  "🤔 Hmm, parece que tô offline do banco. Tenta mais tarde que eu resolvo!",
  "😴 O banco tá offline, mas eu tô aqui! Tenta de novo depois!",
  "🤷‍♀️ Não consegui acessar os dados agora, mas tenta de novo que eu resolvo!"
];

describe('DatabaseStatus', () => {
  let databaseStatus: any;

  beforeEach(() => {
    databaseStatus = DatabaseStatus;
  });

  describe('singleton instance', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseStatus;
      const instance2 = DatabaseStatus;
      expect(instance1).toBe(instance2);
    });
  });

  describe('isDatabaseOffline', () => {
    it('should return false when consecutive failures are below threshold', () => {
      const mockMetrics = {
        consecutiveFailures: 3,
        lastSuccess: Date.now(),
        lastFailure: 0,
        fallbackCount: 0,
        queueSize: 0
      };
      
      (DatabaseFallback.getMetrics as jest.Mock).mockReturnValue(mockMetrics);
      
      expect(databaseStatus.isDatabaseOffline()).toBe(false);
    });

    it('should return true when consecutive failures reach threshold', () => {
      const mockMetrics = {
        consecutiveFailures: 5,
        lastSuccess: Date.now(),
        lastFailure: 0,
        fallbackCount: 0,
        queueSize: 0
      };
      
      (DatabaseFallback.getMetrics as jest.Mock).mockReturnValue(mockMetrics);
      
      expect(databaseStatus.isDatabaseOffline()).toBe(true);
    });
  });

  describe('getOfflineMessage', () => {
    it('should return a message with command name when provided', () => {
      const message = databaseStatus.getOfflineMessage('Teste');
      expect(message).toContain('❌ *Teste*');
      // Deve conter uma das mensagens possíveis
      expect(POSSIBLE_MESSAGES.some(m => message.includes(m))).toBe(true);
    });

    it('should return a message without command name when not provided', () => {
      const message = databaseStatus.getOfflineMessage();
      expect(message).not.toContain('❌ *');
      expect(POSSIBLE_MESSAGES.some(m => message.includes(m))).toBe(true);
    });

    it('should include contact information', () => {
      const message = databaseStatus.getOfflineMessage('Teste');
      expect(message).toContain('+55 21 6723-3931');
    });
  });

  describe('markSuccess and markFailure', () => {
    it('should call DatabaseFallback methods when marking success', () => {
      const mockMarkSuccess = jest.fn();
      (DatabaseFallback.markSuccess as jest.Mock) = mockMarkSuccess;
      
      databaseStatus.markSuccess();
      
      expect(mockMarkSuccess).toHaveBeenCalled();
    });

    it('should call DatabaseFallback methods when marking failure', () => {
      const mockAddOperation = jest.fn();
      (DatabaseFallback.addOperation as jest.Mock) = mockAddOperation;
      
      databaseStatus.markFailure();
      
      expect(mockAddOperation).toHaveBeenCalledWith('failure', { timestamp: expect.any(Number) });
    });
  });

  describe('getDatabaseStatus', () => {
    it('should return correct status information', () => {
      const mockMetrics = {
        consecutiveFailures: 2,
        lastSuccess: Date.now(),
        lastFailure: Date.now() - 1000,
        fallbackCount: 5,
        queueSize: 3
      };
      
      (DatabaseFallback.getMetrics as jest.Mock).mockReturnValue(mockMetrics);
      
      const status = databaseStatus.getDatabaseStatus();
      
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('consecutiveFailures');
      expect(status).toHaveProperty('lastSuccess');
      expect(status).toHaveProperty('lastFailure');
      expect(status.consecutiveFailures).toBe(2);
    });
  });
}); 