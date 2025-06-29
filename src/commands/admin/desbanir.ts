import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { Blacklist } from '@/database/models/BlacklistSchema';

type WAMessage = proto.IWebMessageInfo;

const desbanirCommand: ICommand = {
  name: 'desbanir',
  description: 'Remove alguém da blacklist do grupo.',
  category: 'admin',
  usage: '!desbanir @user',
  execute: async (sock: WASocket, message: WAMessage, args: string[]) => {
    const groupJid = message.key.remoteJid!;
    if (!groupJid.endsWith('@g.us')) {
      await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
      return;
    }
    const userJid = message.key.participant || '';
    if (!await canUseCommand(sock, groupJid, userJid, 'admin')) {
      await sock.sendMessage(groupJid, { text: 'Apenas admins podem usar este comando.' });
      return;
    }
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentioned || mentioned.length === 0) {
      await sock.sendMessage(groupJid, { text: 'Marque o usuário que deseja desbanir.' });
      return;
    }
    let count = 0;
    for (const jid of mentioned) {
      const res = await Blacklist.deleteOne({ groupJid, userJid: jid });
      if (res.deletedCount) count++;
    }
    if (count > 0) {
      await sock.sendMessage(groupJid, { text: `Usuário(s) desbanido(s) com sucesso!` });
    } else {
      await sock.sendMessage(groupJid, { text: `Nenhum usuário estava na blacklist.` });
    }
  },
};

export default desbanirCommand; 