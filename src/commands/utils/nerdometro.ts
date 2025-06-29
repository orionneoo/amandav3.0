import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const nerdometroCommand: ICommand = {
  name: 'nerdometro',
  description: 'Mede nível de nerd aleatório.',
  category: 'utils',
  usage: '!nerdometro',
  execute: async (sock: WASocket, message: WAMessage) => {
    const pct = Math.floor(Math.random() * 101);
    const numero = message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid?.split('@')[0];
    const jid = message.key.participant || message.key.remoteJid;
    const frase = `🤓 @${numero} seu nível de nerd hoje é ${pct}%! 👾`;
    await sock.sendMessage(message.key.remoteJid!, { text: frase, mentions: [jid!] });
  },
};

export default nerdometroCommand; 