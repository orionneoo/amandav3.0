import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const coinflipCommand: ICommand = {
  name: 'coinflip',
  description: 'Cara ou coroa aleatório.',
  category: 'utils',
  usage: '!coinflip',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const result = Math.random() < 0.5 ? '🪙 Deu *cara*!' : '🪙 Deu *coroa*!';
    await sock.sendMessage(message.key.remoteJid!, { text: result });
  },
};

export default coinflipCommand; 