import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const cornometroCommand: ICommand = {
  name: 'cornometro',
  description: 'Mede nível de corno aleatório.',
  category: 'utils',
  usage: '!cornometro',
  execute: async (sock: WASocket, message: WAMessage) => {
    const pct = Math.floor(Math.random() * 101);
    const numero = message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid?.split('@')[0];
    const jid = message.key.participant || message.key.remoteJid;
    const frase = `🫣 @${numero} ${pct}% corno, aceita que dói menos! 🐮💔`;
    await sock.sendMessage(message.key.remoteJid!, { text: frase, mentions: [jid!] });
  },
};

export default cornometroCommand; 