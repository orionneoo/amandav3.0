import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const velhaometroCommand: ICommand = {
  name: 'velhaometro',
  description: 'Mede idade mental aleatória.',
  category: 'utils',
  usage: '!velhaometro',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const idade = Math.floor(Math.random() * 71) + 10; // 10 a 80 anos
    const numero = message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid?.split('@')[0];
    const jid = message.key.participant || message.key.remoteJid;
    const frase = `🧓 @${numero} sua idade mental é ${idade} anos hoje. 👵🕰️`;
    await sock.sendMessage(message.key.remoteJid!, { text: frase, mentions: [jid!] });
  },
};

export default velhaometroCommand; 