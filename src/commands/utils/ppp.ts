import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { sortearMembros } from '@/utils/sorteioUtils';

const pppCommand: ICommand = {
  name: 'ppp',
  description: 'Sorteia 3 pessoas do grupo para o clássico pega, pensa e passa.',
  category: 'utils',
  usage: '!ppp',
  execute: async (sock: WASocket, message: proto.IWebMessageInfo) => {
    const groupJid = message.key.remoteJid!;
    if (!groupJid.endsWith('@g.us')) {
      await sock.sendMessage(groupJid, { text: 'Esse comando só funciona em grupos!' });
      return;
    }
    const metadata = await sock.groupMetadata(groupJid);
    const botJid = (await sock.user?.id) || '';
    const authorJid = message.key.participant || message.key.remoteJid;
    if (!authorJid) {
      await sock.sendMessage(groupJid, { text: 'Não foi possível identificar o autor da mensagem.' });
      return;
    }
    const participantes = metadata.participants.map(p => p.id);
    const sorteados = sortearMembros(participantes, { excluir: [authorJid, botJid], quantidade: 3 });
    if (sorteados.length < 3) {
      await sock.sendMessage(groupJid, { text: 'Pouca gente no grupo pra brincar de PPP!' });
      return;
    }
    const numeroAutor = authorJid.split('@')[0];
    const frase = `E aí, @${numeroAutor}, desses três aqui, quem você Pega (beija), quem você Pensa (casa) e quem você Passa (mata)?\n\n${sorteados.map(jid => '@' + jid.split('@')[0]).join(', ')}`;
    await sock.sendMessage(groupJid, { text: frase, mentions: [authorJid, ...sorteados] });
  },
};

export default pppCommand; 