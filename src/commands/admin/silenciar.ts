import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';

type WAMessage = proto.IWebMessageInfo;

const silenciarCommand: ICommand = {
  name: 'silenciar',
  description: 'Restringe mensagens no grupo (só admins podem falar).',
  category: 'admin',
  usage: '!silenciar',
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
    await sock.groupSettingUpdate(groupJid, 'announcement');
    await sock.sendMessage(groupJid, { text: 'Grupo silenciado! Agora só admins podem enviar mensagens.' });
  },
};

export default silenciarCommand; 