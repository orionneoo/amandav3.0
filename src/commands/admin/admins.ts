import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const adminsCommand: ICommand = {
  name: 'admins',
  description: 'Lista todos os admins do grupo.',
  category: 'admin',
  usage: '!admins',
  execute: async (sock: WASocket, message: WAMessage) => {
    const groupJid = message.key.remoteJid!;
    if (!groupJid.endsWith('@g.us')) {
      await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
      return;
    }
    const meta = await sock.groupMetadata(groupJid);
    const admins = meta.participants.filter(p => p.admin).map(p => p.id);
    if (admins.length === 0) {
      await sock.sendMessage(groupJid, { text: 'Nenhum admin encontrado no grupo.' });
      return;
    }
    let msg = `👑 *Admins do grupo:*
`;
    admins.forEach((jid, i) => {
      const numero = jid.split('@')[0];
      msg += `• @${numero}
`;
    });
    await sock.sendMessage(groupJid, { text: msg, mentions: admins });
  },
};

export default adminsCommand; 