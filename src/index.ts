import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// LOG DE DEBUG DO .env E URI DO MONGO
console.log('[DEBUG] .env carregado. MONGODB_URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:([^:]+)@/, ':*****@') : 'NÃO ENCONTRADA');

import 'reflect-metadata';
// Carrega module-alias primeiro para resolver os aliases
import 'module-alias/register';
// Agora carrega a configuração centralizada
import '@/config/index';
import { Bot } from '@/core/Bot';
import { container } from '@/core/container';
import { TYPES } from '@/config/container';

const bot = container.get<Bot>(TYPES.Bot);

bot.start().catch((error: unknown) => {
  console.error('Erro ao iniciar o bot:', error);
  process.exit(1);
});

// Lidar com o desligamento gracioso
process.on('SIGINT', async () => {
  console.log('Desligando o bot...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Desligando o bot...');
  await bot.stop();
  process.exit(0);
}); 