import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

const removerCommand: ICommand = {
  name: 'remover',
  description: 'Remove um usuário do grupo (sem blacklist, só no amor).',
  category: 'admin',
  usage: '!remover @user',
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
      await sock.sendMessage(groupJid, { text: 'Marque o usuário que deseja remover.' });
      return;
    }
    await sock.groupParticipantsUpdate(groupJid, mentioned, 'remove');
    await sock.sendMessage(groupJid, { text: 'Usuário removido do grupo com carinho. 💖' });
  },
};

export default removerCommand; 