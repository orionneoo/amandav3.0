import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const parCommand: ICommand = {
  name: 'par',
  description: 'Marca 2 pessoas aleatórias do grupo para formar um par.',
  category: 'utils',
  usage: '!par',
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
    if (participantes.length < 2) {
      await sock.sendMessage(groupJid, { text: 'Pouca gente no grupo pra formar um par!' });
      return;
    }
    // Sorteia 1
    const sorteado = participantes.sort(() => 0.5 - Math.random())[0];
    const frase = `💘 O seu par perfeito é: @${sorteado.split('@')[0]} 😍`;
    await sock.sendMessage(groupJid, { text: frase, mentions: [sorteado] });
  },
};

export default parCommand; 