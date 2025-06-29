import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { getUserDisplayName } from '@/utils/userUtils';

type WAMessage = proto.IWebMessageInfo;

const nojoometroCommand: ICommand = {
  name: 'nojoometro',
  description: 'Mede nível de nojo aleatório.',
  category: 'utils',
  usage: '!nojoometro',
  execute: async (sock: WASocket, message: WAMessage) => {
    const pct = Math.floor(Math.random() * 101);
    const jid = message.key.participant || message.key.remoteJid!;
    const groupJid = message.key.remoteJid!;
    
    const displayName = await getUserDisplayName(sock, jid, groupJid, message.pushName);
    const frase = `🤢 @${displayName} seu nível de nojo hoje é ${pct}%! 🤮`;
    await sock.sendMessage(message.key.remoteJid!, { text: frase, mentions: [jid] });
  },
};

export default nojoometroCommand; 