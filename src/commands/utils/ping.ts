import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const pingCommand: ICommand = {
  name: 'ping',
  aliases: ['pong', 'latencia'],
  description: 'Responde com Pong! (versão divertida)',
  category: 'utils',
  usage: '!ping',
  execute: async (sock: WASocket, message: WAMessage) => {
    const pongArt = '🏓\n';
    await sock.sendMessage(message.key.remoteJid!, { text: pongArt + '\nPong!' });
  },
};

export default pingCommand; 