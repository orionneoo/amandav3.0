import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { perguntasHardcore } from '@/utils/perguntasHardcore';
import { sortearMembros } from '@/utils/sorteioUtils';
import { getUserDisplayName } from '@/utils/userUtils';

const fodeousomeCommand: ICommand = {
  name: 'fodeousome',
  description: 'Modo hardcore: faz uma pergunta quente para um alvo aleatório ou marcado.',
  category: 'utils',
  usage: '!fodeousome [@alvo]',
  execute: async (sock: WASocket, message: proto.IWebMessageInfo, args: string[]) => {
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
    let alvoJid = '';
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length) {
      alvoJid = mentioned[0];
    } else {
      const participantes = metadata.participants.map(p => p.id);
      const sorteados = sortearMembros(participantes, { excluir: [authorJid, botJid], quantidade: 1 });
      alvoJid = sorteados[0];
    }
    if (!alvoJid) {
      await sock.sendMessage(groupJid, { text: 'Não foi possível encontrar um alvo para a pergunta.' });
      return;
    }
    const pergunta = perguntasHardcore[Math.floor(Math.random() * perguntasHardcore.length)];
    
    const authorDisplayName = await getUserDisplayName(sock, authorJid, groupJid, message.pushName);
    const alvoDisplayName = await getUserDisplayName(sock, alvoJid, groupJid);
    
    const frase = `Ok, @${authorDisplayName}, hora da verdade. Olhando aqui pro @${alvoDisplayName}, você...\n${pergunta}`;
    await sock.sendMessage(groupJid, { text: frase, mentions: [authorJid, alvoJid] });
  },
};

export default fodeousomeCommand; 