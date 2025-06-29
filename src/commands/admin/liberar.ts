import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

const liberarCommand: ICommand = {
  name: 'liberar',
  description: 'Libera mensagens no grupo (todos podem falar).',
  category: 'admin',
  usage: '!liberar',
  handle: async (context: MessageContext) => {
    const { sock, from: groupJid, sender: userJid, isGroup } = context;
    if (!isGroup) {
      await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
      return;
    }
    if (!await canUseCommand(sock, groupJid, userJid, 'admin')) {
      await sock.sendMessage(groupJid, { text: 'Apenas admins podem usar este comando.' });
      return;
    }
    await sock.groupSettingUpdate(groupJid, 'not_announcement');
    await sock.sendMessage(groupJid, { text: 'Grupo liberado! Todos podem enviar mensagens.' });
  },
};

export default liberarCommand; 