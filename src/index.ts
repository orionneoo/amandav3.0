import 'reflect-metadata';
require('dotenv').config();
require('module-alias/register');
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