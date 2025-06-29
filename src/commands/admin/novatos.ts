import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { GroupActivity } from '@/database/models/GroupActivitySchema';

// Utilitário para pegar todos os membros do grupo
async function getGroupMembers(sock: WASocket, groupJid: string): Promise<string[]> {
  const meta = await sock.groupMetadata(groupJid);
  return meta.participants.map(p => p.id);
}

type WAMessage = proto.IWebMessageInfo;

const novatosCommand: ICommand = {
  name: 'novatos',
  description: 'Mostra membros que entraram no grupo nos últimos X dias (padrão 7, máximo 30).',
  category: 'admin',
  usage: '!novatos [dias]',
  execute: async (sock: WASocket, message: WAMessage, args: string[]) => {
    const groupJid = message.key.remoteJid!;
    if (!groupJid.endsWith('@g.us')) {
      await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
      return;
    }
    let dias = 7;
    if (args[0]) {
      const n = parseInt(args[0]);
      if (!isNaN(n) && n > 0 && n <= 30) dias = n;
    }
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    // Buscar atividades de entrada no período
    const atividades = await GroupActivity.find({
      groupJid,
      type: 'join',
      timestamp: { $gte: since }
    });
    const novatos = atividades.map(a => a.userJid);
    // Filtrar só quem ainda está no grupo
    const membros = await getGroupMembers(sock, groupJid);
    const novatosAtuais = novatos.filter(jid => membros.includes(jid));
    if (novatosAtuais.length === 0) {
      await sock.sendMessage(groupJid, { text: `Ninguém entrou no grupo nos últimos ${dias} dias.` });
      return;
    }
    let msg = `👋 *Novatos dos últimos ${dias} dias:*
`;
    novatosAtuais.forEach((jid, i) => {
      const numero = jid.split('@')[0];
      msg += `• @${numero}
`;
    });
    await sock.sendMessage(groupJid, { text: msg, mentions: novatosAtuais });
  },
};

export default novatosCommand; 