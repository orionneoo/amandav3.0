import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const casalCommand: ICommand = {
  name: 'casal',
  description: 'Marca 2 pessoas aleatórias do grupo para formar um casal.',
  category: 'utils',
  usage: '!casal',
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
    const participantes = metadata.participants
      .map(p => p.id)
      .filter(jid => jid !== botJid && jid !== authorJid);
    if (participantes.length < 2) {
      await sock.sendMessage(groupJid, { text: 'Pouca gente no grupo pra formar um casal!' });
      return;
    }
    // Sorteia 2
    const sorteados = participantes.sort(() => 0.5 - Math.random()).slice(0, 2);
    const frase = `💘 O par perfeito do grupo é: @${sorteados[0].split('@')[0]} + @${sorteados[1].split('@')[0]} 😍`;
    await sock.sendMessage(groupJid, { text: frase, mentions: sorteados });
  },
};

export default casalCommand; 