import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const surubaCommand: ICommand = {
  name: 'suruba',
  description: 'Marca 5 pessoas aleatórias do grupo para transar com você.',
  category: 'utils',
  usage: '!suruba',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const groupJid = message.key.remoteJid!;
    if (!groupJid.endsWith('@g.us')) {
      await sock.sendMessage(groupJid, { text: 'Esse comando só funciona em grupos!' });
      return;
    }
    const metadata = await sock.groupMetadata(groupJid);
    const botJid = (await sock.user?.id) || '';
    const authorJid = message.key.participant || message.key.remoteJid;
    // Garante que authorJid não é null ou undefined
    if (!authorJid) {
      await sock.sendMessage(groupJid, { text: 'Não foi possível identificar o autor da mensagem.' });
      return;
    }
    const participantes = metadata.participants
      .map(p => p.id)
      .filter(jid => jid !== botJid && jid !== authorJid);
    if (participantes.length < 5) {
      await sock.sendMessage(groupJid, { text: 'Pouca gente no grupo pra fazer uma suruba!' });
      return;
    }
    // Sorteia 5
    const sorteados = participantes.sort(() => 0.5 - Math.random()).slice(0, 5);
    const numeroAutor = authorJid.split('@')[0];
    const frase = `🔥 @${numeroAutor} vai fazer uma suruba com: ${sorteados.map(jid => '@' + jid.split('@')[0]).join(', ')} 😈🍑`;
    await sock.sendMessage(groupJid, { text: frase, mentions: [authorJid, ...sorteados] });
  },
};

export default surubaCommand; 