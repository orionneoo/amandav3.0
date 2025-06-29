import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import cache from '@/core/CacheManager';

type WAMessage = proto.IWebMessageInfo;

const command: ICommand = {
  name: 'tempo',
  description: '🌤️ Mostra o clima de uma cidade (cache de 5 min)',
  aliases: ['clima', 'weather', 'tempo'],
  category: 'utils',
  usage: '!tempo [cidade]',
  cooldown: 10, // 10 segundos de cooldown
  async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const userJid = message.key.participant || message.key.remoteJid!;
    const groupJid = message.key.remoteJid;
    
    // Verificar se foi fornecida uma cidade
    if (args.length === 0) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Cidade não informada!*\n\nUse: `!tempo [cidade]`\n\nExemplo: `!tempo Rio de Janeiro`'
      });
      return;
    }
    
    const cidade = args.join(' ').toLowerCase();
    const cacheKey = `weather:${cidade}`;
    
    // Tentar obter do cache primeiro
    const cachedWeather = cache.get<string>(cacheKey);
    
    if (cachedWeather) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: `${cachedWeather}\n\n💡 *Dados do cache (5 min)*`
      });
      return;
    }
    
    // Simular chamada para API de clima (operação cara)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Gerar dados simulados do clima
    const temperaturas = [18, 22, 25, 28, 30, 32, 35];
    const condicoes = ['☀️ Ensolarado', '⛅ Parcialmente nublado', '☁️ Nublado', '🌧️ Chuvoso', '🌩️ Tempestade'];
    const umidades = [45, 55, 65, 75, 85];
    
    const temperatura = temperaturas[Math.floor(Math.random() * temperaturas.length)];
    const condicao = condicoes[Math.floor(Math.random() * condicoes.length)];
    const umidade = umidades[Math.floor(Math.random() * umidades.length)];
    
    const weatherData = `🌤️ *Clima em ${args.join(' ')}*\n\n` +
      `🌡️ *Temperatura:* ${temperatura}°C\n` +
      `🌦️ *Condição:* ${condicao}\n` +
      `💧 *Umidade:* ${umidade}%\n` +
      `🌬️ *Vento:* ${Math.floor(Math.random() * 20) + 5} km/h\n\n` +
      `📅 *Atualizado:* ${new Date().toLocaleString('pt-BR')}`;
    
    // Armazenar no cache por 5 minutos (300 segundos)
    cache.setWithTTL(cacheKey, weatherData, 300);
    
    await sock.sendMessage(message.key.remoteJid!, {
      text: `${weatherData}\n\n💡 *Dados frescos da API*`
    });
  }
};

export default command; 