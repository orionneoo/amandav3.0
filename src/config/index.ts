// Remover carregamento duplicado do dotenv - já carregado no src/index.ts
// import * as dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

/**
 * Coleta todas as chaves GEMINI_API_KEY_ do ambiente e as retorna em um array.
 * @returns {string[]} Um array de chaves de API do Gemini.
 */
const getGeminiApiKeys = (): string[] => {
  const keys: string[] = [];
  let i = 1;
  while (process.env[`GEMINI_API_KEY_${i}`]) {
    keys.push(process.env[`GEMINI_API_KEY_${i}`] as string);
    i++;
  }
  // Fallback para a chave única, caso o formato antigo ainda seja usado
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  return keys;
};

/**
 * Coleta todos os modelos Gemini do ambiente.
 * @returns {string[]} Um array de modelos Gemini.
 */
const getGeminiModels = (): string[] => {
    const modelsEnv = process.env.GEMINI_MODELS || 'gemini-1.5-pro-latest,gemini-pro';
    return modelsEnv.split(',').map(m => m.trim());
}

/**
 * Objeto de configuração principal, extraído das variáveis de ambiente.
 */
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  
  bot: {
    name: process.env.BOT_NAME || 'Amanda',
    prefix: process.env.BOT_PREFIX || '!',
    owners: (process.env.BOT_OWNERS || '').split(',').map(owner => owner.trim()),
    language: process.env.DEFAULT_LANGUAGE || 'pt-BR',
  },

  database: {
    mongodbUri: process.env.MONGODB_URI,
    mongodbName: process.env.MONGODB_DATABASE || 'amandanova',
  },
  
  gemini: {
    apiKeys: getGeminiApiKeys(),
    models: getGeminiModels(),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.9'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.GEMINI_RETRY_DELAY || '1000', 10),
    timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000', 10),
  },

  commands: {
    daysLimitInactive: parseInt(process.env.DAYS_LIMIT_INACTIVE_COMMAND || '30', 10),
  },

  // Adicione outras seções de configuração conforme necessário
  // Ex: cache, moderation, media, logs, etc.
};

// Validação crítica: Trava a inicialização se configurações essenciais não estiverem presentes.
if (!config.database.mongodbUri) {
  throw new Error('A variável de ambiente MONGODB_URI não foi definida. O bot não pode iniciar sem o banco de dados.');
}

if (config.gemini.apiKeys.length === 0) {
  throw new Error('Nenhuma chave de API do Gemini (GEMINI_API_KEY ou GEMINI_API_KEY_1, etc.) foi encontrada no arquivo .env. O bot não pode iniciar.');
}

console.log('[Config] Configurações carregadas com sucesso.');
console.log(`[Config] Modo: ${config.nodeEnv}`);
console.log(`[Config] Chaves Gemini encontradas: ${config.gemini.apiKeys.length}`);
console.log(`[Config] Modelos Gemini: ${config.gemini.models.join(', ')}`); 