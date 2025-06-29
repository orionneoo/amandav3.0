import { getGroupMembers } from '@/utils/groupUtils';
import { ICommand } from '@/interfaces/ICommand';
import { GroupActivity } from '@/database/models/GroupActivitySchema';
import { MessageContext } from '@/handlers/message.handler';

const novatosCommand: ICommand = {
  name: 'novatos',
  description: 'Mostra membros que entraram no grupo nos últimos X dias (padrão 7, máximo 30).',
  category: 'admin',
  usage: '!novatos [dias]',
  handle: async (context: MessageContext) => {
    const { sock, from: groupJid, args } = context;

    if (!context.isGroup) {
      await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
      return;
    }
    let dias = 7;
    if (args[0]) {
      const n = parseInt(args[0]);
      if (!isNaN(n) && n > 0 && n <= 30) {
        dias = n;
      } else {
        await sock.sendMessage(groupJid, { text: `Uso incorreto. Exemplo: !novatos 7` });
        return;
      }
    }
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const atividades = await GroupActivity.find({
      groupJid,
      type: 'join',
      timestamp: { $gte: since }
    });
    const novatos = atividades.map(a => a.userJid);
    
    const membros = await getGroupMembers(sock, groupJid);
    const novatosAtuais = novatos.filter(jid => membros.includes(jid));
    
    if (novatosAtuais.length === 0) {
      await sock.sendMessage(groupJid, { text: `Ninguém entrou no grupo nos últimos ${dias} dias.` });
      return;
    }
    let msg = `👋 *Novatos dos últimos ${dias} dias:*
`;
    novatosAtuais.forEach((jid) => {
      const numero = jid.split('@')[0];
      msg += `• @${numero}
`;
    });
    await sock.sendMessage(groupJid, { text: msg, mentions: novatosAtuais });
  },
};

export default novatosCommand; 