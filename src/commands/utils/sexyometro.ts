import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { getUserDisplayName } from '@/utils/userUtils';
import { MessageContext } from '@/handlers/message.handler';

const sexyometroCommand: ICommand = {
  name: 'sexyometro',
  description: 'Mede nível de sexy aleatório.',
  category: 'utils',
  usage: '!sexyometro',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const pct = Math.floor(Math.random() * 101);
    const jid = message.key.participant || message.key.remoteJid!;
    const groupJid = message.key.remoteJid!;
    
    const displayName = await getUserDisplayName(sock, jid, groupJid, message.pushName);
    const frase = `😏 @${displayName} seu nível de sexy hoje é ${pct}%! 🔥`;
    await sock.sendMessage(message.key.remoteJid!, { text: frase, mentions: [jid] });
  },
};

export default sexyometroCommand; 