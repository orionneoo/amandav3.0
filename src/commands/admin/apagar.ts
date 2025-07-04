import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

const apagarCommand: ICommand = {
  name: 'apagar',
  description: 'Apaga mensagens do grupo (admin apenas).',
  category: 'admin',
  usage: '!apagar',
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
    // Exemplo: apagar a mensagem à qual está respondendo
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsgId = contextInfo?.stanzaId;
    const quotedParticipant = contextInfo?.participant;
    if (!quotedMsgId || !quotedParticipant) {
      await sock.sendMessage(groupJid, { text: 'Responda a uma mensagem para apagá-la.' });
      return;
    }
    await sock.sendMessage(groupJid, {
      delete: {
        remoteJid: groupJid,
        fromMe: false,
        id: quotedMsgId,
        participant: quotedParticipant
      }
    });
    await sock.sendMessage(groupJid, { text: 'Mensagem apagada com sucesso.' });
  },
};

export default apagarCommand; 