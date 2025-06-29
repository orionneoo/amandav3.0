import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { GroupService } from '@/services/GroupService';
import { container } from '@/core/container';
import { TYPES } from '@/config/container';

const clearHistoryCommand: ICommand = {
  name: 'clearhistory',
  description: 'Limpa o histórico de conversa da Amanda no grupo (apenas admins)',
  category: 'admin',
  usage: '!clearhistory [motivo]',
  aliases: ['clear', 'limpar', 'reset'],
  execute: async (sock: WASocket, message: proto.IWebMessageInfo, args: string[]): Promise<void> => {
    try {
      const groupJid = message.key.remoteJid!;
      const senderJid = message.key.participant!;
      const groupMetadata = await sock.groupMetadata(groupJid);
      const isAdmin = groupMetadata.participants.find(p => p.id === senderJid)?.admin;
      
      if (!isAdmin) {
        await sock.sendMessage(groupJid, {
          text: '❌ Apenas administradores podem limpar o histórico da Amanda!'
        });
        return;
      }
      
      const motivo = args.join(' ') || 'Limpeza manual solicitada';
      
      // Usar GroupService para limpar o histórico
      const groupService = container.get<GroupService>(TYPES.GroupService);
      const success = await groupService.clearGroupChatHistory(groupJid, motivo);
      
      if (success) {
        const confirmacao = `🧹 *HISTÓRICO LIMPO COM SUCESSO!*\n\n✅ Todo o histórico de conversa da Amanda foi removido.\n📝 Motivo: ${motivo}\n🎭 A Amanda agora começará uma nova conversa do zero!\n\n💡 *Dica:* Use !person para mudar a personalidade também.`;
        await sock.sendMessage(groupJid, { text: confirmacao });
      } else {
        await sock.sendMessage(groupJid, {
          text: '❌ Erro ao limpar histórico. Tenta de novo mais tarde!'
        });
      }
      
    } catch (error) {
      console.error('Erro ao executar comando clearhistory:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Ops! Deu ruim na hora de limpar o histórico. Tenta de novo mais tarde!'
      });
    }
  }
};

export default clearHistoryCommand; 