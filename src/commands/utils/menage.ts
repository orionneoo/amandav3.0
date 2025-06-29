import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const menageCommand: ICommand = {
  name: 'menage',
  description: 'Marca 3 pessoas aleatórias do grupo para um ménage.',
  category: 'utils',
  usage: '!menage',
  execute: async (sock: WASocket, message: WAMessage) => {
    const groupJid = message.key.remoteJid!;
    if (!groupJid.endsWith('@g.us')) {
      await sock.sendMessage(groupJid, { text: 'Esse comando só funciona em grupos!' });
      return;
    }
    const metadata = await sock.groupMetadata(groupJid);
    const botJid = (await sock.user?.id) || '';
    const authorJid = message.key.participant || message.key.remoteJid;
    const participantes = metadata.participants
      .map(p => p.id)
      .filter(jid => jid !== botJid && jid !== authorJid);
    if (participantes.length < 3) {
      await sock.sendMessage(groupJid, { text: 'Pouca gente no grupo pra fazer um ménage!' });
      return;
    }
    // Sorteia 3
    const sorteados = participantes.sort(() => 0.5 - Math.random()).slice(0, 3);
    const frase = `🔥 Hoje é dia de ménage: @${sorteados[0].split('@')[0]} + @${sorteados[1].split('@')[0]} + @${sorteados[2].split('@')[0]} 😏💦`;
    await sock.sendMessage(groupJid, { text: frase, mentions: sorteados });
  },
};

export default menageCommand; 