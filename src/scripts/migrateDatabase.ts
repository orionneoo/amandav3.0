// Carregar variáveis de ambiente ANTES de qualquer importação que use process.env
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { config } from '../config';
import { Message } from '../database/models/MessageSchema';
import { Group } from '../database/models/GroupSchema';
import { CommandUsage } from '../database/models/CommandUsageSchema';
import { ErrorLogs } from '../database/models/ErrorLogsSchema';
import { Game } from '../database/models/GameSchema';
import Logger from '../utils/Logger';

/**
 * Script de migração para atualizar dados existentes com novos campos
 * Executar: npm run migrate
 */
export async function migrateDatabase(): Promise<void> {
  const logger = Logger;
  
  try {
    console.log('🚀 Iniciando migração do banco de dados...');
    
    // Debug: verificar se as variáveis estão carregadas
    console.log('🔍 Verificando variáveis de ambiente:');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Configurada' : '❌ Não configurada');
    console.log('MONGODB_DATABASE:', process.env.MONGODB_DATABASE ? '✅ Configurada' : '❌ Não configurada');
    
    // NOVO: Usar a estrutura correta da configuração
    const mongodbUri = config.database?.mongodbUri;
    if (!mongodbUri) throw new Error('MONGODB_URI não está configurada!');
    const databaseName = config.database?.mongodbName || 'amandanova';
    
    await mongoose.connect(mongodbUri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true,
      readPreference: 'primaryPreferred' as const,
    });

    console.log('✅ Conectado ao MongoDB Atlas');
    console.log(`Banco de dados: ${databaseName}`);
    
    // 1. Migrar mensagens
    await migrateMessages();
    
    // 2. Migrar grupos
    await migrateGroups();
    
    // 3. Migrar uso de comandos
    await migrateCommandUsage();
    
    // 4. Migrar logs de erro
    await migrateErrorLogs();
    
    // 5. Migrar jogos
    await migrateGames();
    
    console.log('✅ Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    logger.error('Erro na migração do banco', { error });
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }
}

async function migrateMessages(): Promise<void> {
  console.log('📝 Migrando mensagens...');
  
  const batchSize = 1000;
  let processed = 0;
  let updated = 0;
  
  // Buscar mensagens sem schemaVersion ou com versão antiga
  const query = {
    $or: [
      { schemaVersion: { $exists: false } },
      { schemaVersion: { $lt: 2 } }
    ]
  };
  
  const totalMessages = await Message.countDocuments(query);
  console.log(`📊 Total de mensagens para migrar: ${totalMessages}`);
  
  if (totalMessages === 0) {
    console.log('✅ Nenhuma mensagem precisa ser migrada');
    return;
  }
  
  const cursor = Message.find(query).cursor();
  
  for (let message = await cursor.next(); message != null; message = await cursor.next()) {
    try {
      const updates: any = {
        schemaVersion: 2,
        updatedAt: new Date()
      };
      
      // Adicionar campos que podem estar faltando
      if (!message.botVersion) {
        updates.botVersion = '2.0.0';
      }
      
      if (!message.messageId) {
        updates.messageId = message._id;
      }
      
      if (!message.mediaType && message.media?.type) {
        updates.mediaType = message.media.type;
      }
      
      // Detectar se é resposta de IA baseado na personalidade
      if (message.personality && !message.context?.isAIResponse) {
        updates.context = {
          isAIResponse: true,
          aiModel: 'gemini-2.0-flash'
        };
      }
      
      await Message.updateOne({ _id: message._id }, { $set: updates });
      updated++;
      
    } catch (error) {
      console.error(`❌ Erro ao migrar mensagem ${message._id}:`, error);
    }
    
    processed++;
    if (processed % batchSize === 0) {
      console.log(`📊 Progresso: ${processed}/${totalMessages} mensagens processadas`);
    }
  }
  
  console.log(`✅ Mensagens migradas: ${updated}/${processed}`);
}

async function migrateGroups(): Promise<void> {
  console.log('👥 Migrando grupos...');
  
  const query = {
    $or: [
      { schemaVersion: { $exists: false } },
      { schemaVersion: { $lt: 2 } }
    ]
  };
  
  const totalGroups = await Group.countDocuments(query);
  console.log(`📊 Total de grupos para migrar: ${totalGroups}`);
  
  if (totalGroups === 0) {
    console.log('✅ Nenhum grupo precisa ser migrado');
    return;
  }
  
  const result = await Group.updateMany(query, {
    $set: {
      schemaVersion: 2,
      lastActivity: new Date(),
      messageCount: 0,
      isActive: true,
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Grupos migrados: ${result.modifiedCount}/${totalGroups}`);
}

async function migrateCommandUsage(): Promise<void> {
  console.log('⚡ Migrando uso de comandos...');
  
  const query = {
    $or: [
      { schemaVersion: { $exists: false } },
      { schemaVersion: { $lt: 2 } }
    ]
  };
  
  const totalCommands = await CommandUsage.countDocuments(query);
  console.log(`📊 Total de comandos para migrar: ${totalCommands}`);
  
  if (totalCommands === 0) {
    console.log('✅ Nenhum comando precisa ser migrado');
    return;
  }
  
  const result = await CommandUsage.updateMany(query, {
    $set: {
      schemaVersion: 2,
      success: true,
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Comandos migrados: ${result.modifiedCount}/${totalCommands}`);
}

async function migrateErrorLogs(): Promise<void> {
  console.log('🚨 Migrando logs de erro...');
  
  const query = {
    $or: [
      { schemaVersion: { $exists: false } },
      { schemaVersion: { $lt: 2 } }
    ]
  };
  
  const totalErrors = await ErrorLogs.countDocuments(query);
  console.log(`📊 Total de erros para migrar: ${totalErrors}`);
  
  if (totalErrors === 0) {
    console.log('✅ Nenhum erro precisa ser migrado');
    return;
  }
  
  const result = await ErrorLogs.updateMany(query, {
    $set: {
      schemaVersion: 2,
      botVersion: '2.0.0',
      environment: 'production',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Erros migrados: ${result.modifiedCount}/${totalErrors}`);
}

async function migrateGames(): Promise<void> {
  console.log('🎮 Migrando jogos...');
  
  const query = {
    $or: [
      { schemaVersion: { $exists: false } },
      { schemaVersion: { $lt: 2 } }
    ]
  };
  
  const totalGames = await Game.countDocuments(query);
  console.log(`📊 Total de jogos para migrar: ${totalGames}`);
  
  if (totalGames === 0) {
    console.log('✅ Nenhum jogo precisa ser migrado');
    return;
  }

  const cursor = Game.find(query).cursor();
  let processed = 0;
  let updated = 0;

  for (let game = await cursor.next(); game != null; game = await cursor.next()) {
    try {
      const updates: any = {
        schemaVersion: 2,
        totalSubmissions: Array.isArray(game.submissions) ? game.submissions.length : 0,
        totalReactions: Array.isArray(game.reactions) ? game.reactions.length : 0,
        settings: {
          maxSubmissions: 50,
          timeLimit: 60,
          allowMultipleSubmissions: false
        },
        updatedAt: new Date()
      };
      await Game.updateOne({ _id: game._id }, { $set: updates });
      updated++;
    } catch (error) {
      console.error(`❌ Erro ao migrar jogo ${game._id}:`, error);
    }
    processed++;
    if (processed % 100 === 0) {
      console.log(`📊 Progresso: ${processed}/${totalGames} jogos processados`);
    }
  }
  console.log(`✅ Jogos migrados: ${updated}/${processed}`);
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateDatabase()
    .then(() => {
      console.log('🎉 Migração finalizada com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro na migração:', error);
      process.exit(1);
    });
}