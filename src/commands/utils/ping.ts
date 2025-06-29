import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const pingCommand: ICommand = {
  name: 'ping',
  aliases: ['pong', 'latencia'],
  description: 'Responde com Pong! (versão divertida)',
  category: 'utils',
  usage: '!ping',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const pongArt = '🏓\n';
    await sock.sendMessage(message.key.remoteJid!, { text: pongArt + '\nPong!' });
  },
};

export default pingCommand; 