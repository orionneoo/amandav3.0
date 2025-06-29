import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { GroupActivity } from '@/database/models/GroupActivitySchema';

type WAMessage = proto.IWebMessageInfo;

const topativosCommand: ICommand = {
  name: 'topativos',
  description: 'Mostra os membros mais ativos do grupo nos últimos X dias (padrão 7, máximo 30).',
  category: 'admin',
  usage: '!topativos [dias]',
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
    // Buscar atividades de mensagem no período
    const atividades = await GroupActivity.find({
      groupJid,
      type: 'message',
      timestamp: { $gte: since }
    });
    // Contar mensagens por usuário
    const contagem: Record<string, number> = {};
    for (const atv of atividades) {
      contagem[atv.userJid] = (contagem[atv.userJid] || 0) + 1;
    }
    // Ordenar do mais ativo pro menos
    const ranking = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (ranking.length === 0) {
      await sock.sendMessage(groupJid, { text: `Ninguém mandou mensagem nos últimos ${dias} dias.` });
      return;
    }
    // Montar mensagem
    let msg = `🏆 *Top ativos do grupo nos últimos ${dias} dias:*
`;
    ranking.forEach(([jid, count], i) => {
      const numero = jid.split('@')[0];
      msg += `${i + 1}. @${numero} — ${count} mensagens
`;
    });
    const mentions = ranking.map(([jid]) => jid);
    await sock.sendMessage(groupJid, { text: msg, mentions });
  },
};

export default topativosCommand; 