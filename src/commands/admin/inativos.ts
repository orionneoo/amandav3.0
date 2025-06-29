import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { GroupActivity } from '@/database/models/GroupActivitySchema';
import { getGroupMembers } from '@/utils/groupUtils';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

const inativosCommand: ICommand = {
  name: 'inativos',
  description: 'Mostra membros que não enviaram mensagem nos últimos X dias (padrão 7, máximo 30).',
  category: 'admin',
  usage: '!inativos [dias]',
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
        await sock.sendMessage(groupJid, { text: `Uso incorreto. Exemplo: !inativos 7` });
        return;
      }
    }
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    
    const atividades = await GroupActivity.find({
      groupJid,
      type: 'message',
      timestamp: { $gte: since }
    });
    const ativos = new Set(atividades.map(a => a.userJid));

    const membros = await getGroupMembers(sock, groupJid);
    const inativos = membros.filter(jid => !ativos.has(jid));
    
    if (inativos.length === 0) {
      await sock.sendMessage(groupJid, { text: `Todos os membros enviaram mensagem nos últimos ${dias} dias!` });
      return;
    }
    let msg = `😴 *Inativos há ${dias} dias:*
`;
    inativos.forEach((jid) => {
      const numero = jid.split('@')[0];
      msg += `• @${numero}
`;
    });
    await sock.sendMessage(groupJid, { text: msg, mentions: inativos });
  },
};

export default inativosCommand; 