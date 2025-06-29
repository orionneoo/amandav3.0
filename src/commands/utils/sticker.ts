import { WASocket, proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const stickerCommand: ICommand = {
  name: 'sticker',
  description: 'Converte imagem em sticker (figurinha).',
  category: 'utils',
  usage: '!sticker (responda a uma imagem)',
  execute: async (sock: WASocket, message: WAMessage) => {
    const groupJid = message.key.remoteJid!;
    // Verifica se é reply a uma imagem
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;
    if (!quotedMsg || !quotedMsg.imageMessage) {
      await sock.sendMessage(groupJid, { text: 'Responda a uma imagem com !sticker para converter em figurinha.' });
      return;
    }
    // Baixa a imagem
    const buffer = await downloadMediaMessage(
      {
        key: {
          remoteJid: groupJid,
          id: contextInfo.stanzaId!,
          fromMe: false,
          participant: contextInfo.participant,
        },
        message: quotedMsg,
      },
      'buffer',
      {}
    );
    if (!buffer) {
      await sock.sendMessage(groupJid, { text: 'Não consegui baixar a imagem.' });
      return;
    }
    // Envia como sticker
    await sock.sendMessage(groupJid, { sticker: buffer }, { quoted: message });
  },
};

export default stickerCommand; 