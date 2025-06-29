import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import cache from '@/core/CacheManager';

type WAMessage = proto.IWebMessageInfo;

const command: ICommand = {
  name: 'cache',
  description: '📊 Mostra estatísticas do cache do sistema',
  aliases: ['cachestats', 'cacheinfo'],
  category: 'admin',
  usage: '!cache [opção]',
  async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const userJid = message.key.participant || message.key.remoteJid!;
    const groupJid = message.key.remoteJid;
    
    // Verificar se é admin (implementar verificação de admin)
    const isAdmin = true; // TODO: Implementar verificação real
    
    if (!isAdmin) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Acesso Negado*\n\nVocê não tem permissão para usar este comando, meu bem! 😅'
      });
      return;
    }

    const option = args[0]?.toLowerCase();
    
    try {
      switch (option) {
        case 'clear':
        case 'flush':
          cache.flush();
          await sock.sendMessage(message.key.remoteJid!, {
            text: '🗑️ *Cache Limpo*\n\nTodo o cache foi limpo com sucesso! ✨'
          });
          break;
          
        case 'keys':
          const keys = cache.getKeys();
          const keysMessage = keys.length > 0 
            ? `📋 *Chaves no Cache (${keys.length}):*\n\n${keys.slice(0, 10).map(k => `• \`${k}\``).join('\n')}${keys.length > 10 ? `\n\n... e mais ${keys.length - 10} chaves` : ''}`
            : '📋 *Cache Vazio*\n\nNenhuma chave encontrada no cache.';
          
          await sock.sendMessage(message.key.remoteJid!, { text: keysMessage });
          break;
          
        default:
          const stats = cache.getStats();
          const statsMessage = `📊 *Estatísticas do Cache*\n\n` +
            `🔑 *Chaves ativas:* ${stats.keys}\n` +
            `✅ *Hits:* ${stats.hits}\n` +
            `❌ *Misses:* ${stats.misses}\n` +
            `📈 *Taxa de acerto:* ${stats.hitRate.toFixed(1)}%\n\n` +
            `*Opções disponíveis:*\n` +
            `• \`!cache\` - Estatísticas gerais\n` +
            `• \`!cache keys\` - Listar chaves\n` +
            `• \`!cache clear\` - Limpar cache`;
          
          await sock.sendMessage(message.key.remoteJid!, { text: statsMessage });
          break;
      }
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Erro ao acessar cache*\n\nOpa, deu ruim na hora de verificar o cache! 😅\n\nSe não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }
};

export default command; 