import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

const rebaixarCommand: ICommand = {
  name: 'rebaixar',
  description: 'Remove admin de um usuário (admin apenas).',
  category: 'admin',
  usage: '!rebaixar @user',
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
      await sock.sendMessage(groupJid, { text: 'Marque o usuário que deseja rebaixar.' });
      return;
    }
    await sock.groupParticipantsUpdate(groupJid, mentioned, 'demote');
    await sock.sendMessage(groupJid, { text: 'Usuário rebaixado com sucesso.' });
  },
};

export default rebaixarCommand; 