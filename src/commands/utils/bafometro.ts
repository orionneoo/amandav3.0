import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const bafometroCommand: ICommand = {
  name: 'bafometro',
  description: 'Mede seu nível de álcool aleatório.',
  category: 'utils',
  usage: '!bafometro',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const nivel = (Math.random() * 12.5).toFixed(1);
    const numero = message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid?.split('@')[0];
    const jid = message.key.participant || message.key.remoteJid;
    let frase = `🍻 @${numero} nível de álcool: ${nivel}%`;
    if (parseFloat(nivel) > 6) frase += '\n🚨 Dirija não hein!';
    else frase += ' 😎';
    await sock.sendMessage(message.key.remoteJid!, { text: frase, mentions: [jid!] });
  },
};

export default bafometroCommand; 