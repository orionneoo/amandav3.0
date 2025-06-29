import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const coinflipCommand: ICommand = {
  name: 'coinflip',
  description: 'Cara ou coroa aleatório.',
  category: 'utils',
  usage: '!coinflip',
  execute: async (sock: WASocket, message: WAMessage) => {
    const result = Math.random() < 0.5 ? '🪙 Deu *cara*!' : '🪙 Deu *coroa*!';
    await sock.sendMessage(message.key.remoteJid!, { text: result });
  },
};

export default coinflipCommand; 