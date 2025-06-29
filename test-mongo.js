require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔍 Testando conexão com MongoDB Atlas...');
console.log('URI configurada:', process.env.MONGODB_URI ? '✅ Sim' : '❌ Não');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI não encontrada no .env');
  process.exit(1);
}

const connectionOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  retryWrites: true,
  retryReads: true,
  readPreference: 'primaryPreferred'
};

mongoose.connect(process.env.MONGODB_URI, connectionOptions)
  .then(() => {
    console.log('✅ Conectado ao MongoDB Atlas com sucesso!');
    console.log('📊 Status da conexão:', mongoose.connection.readyState);
    console.log('🗄️  Banco de dados:', mongoose.connection.db.databaseName);
  })
  .catch((error) => {
    console.error('❌ Erro ao conectar:', error.message);
    console.error('🔍 Detalhes:', error);
  })
  .finally(() => {
    mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }); 