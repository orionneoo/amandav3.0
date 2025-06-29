// Setup para testes
import 'reflect-metadata';

// Mock do module-alias
jest.mock('module-alias', () => ({
  register: jest.fn()
}));

// Mock do mongoose
jest.mock('mongoose', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  connection: {
    readyState: 1
  }
}));

// Mock do winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock do node-cache
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushAll: jest.fn(),
    keys: jest.fn(() => []),
    hasKey: jest.fn(() => false)
  }));
});

// Configurar variáveis de ambiente para teste
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://test:27017/test';
process.env.GEMINI_API_KEY = 'test-key';
process.env.BOT_OWNER = '5521967233931'; 