import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { Blacklist } from '@/database/models/BlacklistSchema';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

const banirCommand: ICommand = {
  name: 'banir',
  description: 'Remove um usuário do grupo (admin apenas) e adiciona à blacklist.',
  category: 'admin',
  usage: '!banir @user',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message, from: groupJid, sender: userJid, isGroup } = context;
    if (!isGroup) {
      await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
      return;
    }
    if (!await canUseCommand(sock, groupJid, userJid, 'admin')) {
      await sock.sendMessage(groupJid, { text: 'Apenas admins podem usar este comando.' });
      return;
    }
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentioned || mentioned.length === 0) {
      await sock.sendMessage(groupJid, { text: 'Marque o usuário que deseja banir.' });
      return;
    }
    // Buscar nome e número do usuário mencionado
    const groupMetadata = await sock.groupMetadata(groupJid);
    for (const banJid of mentioned) {
      const participant = groupMetadata.participants.find(p => p.id === banJid);
      const number = banJid.split('@')[0];
      const name = participant?.name || participant?.id || number;
      await Blacklist.create({
        groupJid,
        userJid: banJid,
        number,
        name,
        bannedAt: new Date(),
        bannedBy: userJid,
      });
    }
    await sock.groupParticipantsUpdate(groupJid, mentioned, 'remove');
    await sock.sendMessage(groupJid, { text: 'Usuário(s) banido(s) e adicionado(s) à blacklist.' });
  },
};

export default banirCommand; 