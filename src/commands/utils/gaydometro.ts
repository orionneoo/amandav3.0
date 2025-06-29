import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const gaydometroCommand: ICommand = {
  name: 'gaydometro',
  description: 'Mede quanto por cento gay você é (aleatório).',
  category: 'utils',
  usage: '!gaydometro',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const pct = Math.floor(Math.random() * 101);
    const numero = message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid?.split('@')[0];
    const jid = message.key.participant || message.key.remoteJid;
    const frase = `🌈 @${numero} você é ${pct}% gay hoje! 🏳️‍🌈`;
    await sock.sendMessage(message.key.remoteJid!, { text: frase, mentions: [jid!] });
  },
};

export default gaydometroCommand; 