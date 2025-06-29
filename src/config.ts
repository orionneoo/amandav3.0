export const config = {
  bot: {
    name: process.env.BOT_NAME || 'Amanda',
    prefix: process.env.BOT_PREFIX || '!',
    owners: process.env.BOT_OWNERS ? process.env.BOT_OWNERS.split(',') : [],
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'pt-BR',
  },
  whatsapp: {
    sessionName: process.env.WHATSAPP_SESSION_NAME || 'bot-session',
  },
  gemini: {
    // Múltiplas chaves da API para redundância
    apiKeys: [
      process.env.GEMINI_API_KEY_1 || 'AIzaSyCo-bgivCMVXrlY0iLiKzwvif5jObFPU3o',
      process.env.GEMINI_API_KEY_2 || 'AIzaSyCfpveWKF_sDIqlkOZBot9Kc1uQQEMVpTM',
      process.env.GEMINI_API_KEY_3 || 'AIzaSyBTMAzPkibhWPFoZinsAORWQpiAWcb_I3o',
      process.env.GEMINI_API_KEY_4 || 'AIzaSyCHU1Y0iHt5Ttnnww4Psdc38xmtnWiTTmo',
      process.env.GEMINI_API_KEY_5 || 'AIzaSyCo-bgivCMVXrlY0iLiKzwvif5jObFPU3o',
    ].filter(key => key && key.trim() !== ''),
    
    // Modelos em ordem de prioridade (fallback)
    models: [
      'gemini-2.0-flash-exp', // Gemini 2.5 Pro (experimental)
      'gemini-2.0-flash',     // Gemini 2.0 Flash
      'gemini-1.5-flash',     // Gemini 1.5 Flash
      'gemini-1.5-pro',       // Gemini 1.5 Pro (fallback final)
    ],
    
    // Configurações padrão
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.9'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
    contextWindow: parseInt(process.env.AI_CONTEXT_WINDOW || '50', 10),
    rateLimit: parseInt(process.env.AI_RATE_LIMIT || '60', 10),
    maxConcurrent: parseInt(process.env.AI_MAX_CONCURRENT || '5', 10),
    
    // Configurações de retry
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.GEMINI_RETRY_DELAY || '1000', 10),
    timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000', 10),
  },
  mongodb: {
    uri: process.env.MONGODB_URI || '',
    database: process.env.MONGODB_DATABASE || '',
    // Configurações de conexão para reduzir timeouts
    options: {
      serverSelectionTimeoutMS: 5000, // 5 segundos para seleção de servidor
      socketTimeoutMS: 10000, // 10 segundos para operações de socket
      connectTimeoutMS: 10000, // 10 segundos para conexão
      maxPoolSize: 10, // Máximo de conexões no pool
      minPoolSize: 1, // Mínimo de conexões no pool
      maxIdleTimeMS: 30000, // 30 segundos de idle
      retryWrites: true,
      retryReads: true,
      // w: 'majority', // Removido para evitar erro de tipo
      readPreference: 'primaryPreferred' as any, // Forçar tipo compatível
    },
    // Configurações de fallback
    fallbackEnabled: process.env.MONGODB_FALLBACK_ENABLED === 'true' || true,
    fallbackTimeout: parseInt(process.env.MONGODB_FALLBACK_TIMEOUT || '3000', 10), // 3 segundos
  },
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  },
  moderation: {
    enabled: process.env.MODERATION_ENABLED === 'true',
    maxWarnings: parseInt(process.env.MAX_WARNINGS || '3', 10),
    banDuration: parseInt(process.env.BAN_DURATION || '86400', 10),
    restrictedWords: process.env.RESTRICTED_WORDS ? process.env.RESTRICTED_WORDS.split(',') : [],
    spamThreshold: parseInt(process.env.SPAM_THRESHOLD || '5', 10),
  },
  media: {
    maxSize: parseInt(process.env.MAX_MEDIA_SIZE || '16777216', 10),
    allowedTypes: process.env.ALLOWED_MEDIA_TYPES ? process.env.ALLOWED_MEDIA_TYPES.split(',') : [],
    compressionEnabled: process.env.MEDIA_COMPRESSION_ENABLED === 'true',
    compressionQuality: parseInt(process.env.MEDIA_COMPRESSION_QUALITY || '80', 10),
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'bot.log',
    maxSize: parseInt(process.env.LOG_MAX_SIZE || '5242880', 10),
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
  },
  ownerNumber: process.env.OWNER_NUMBER || '',
}; 