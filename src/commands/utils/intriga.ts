import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const intrigaCommand: ICommand = {
  name: 'intriga',
  description: '😈 Gera uma intriga sexual e provocativa',
  aliases: ['intriga'],
  category: 'utils',
  usage: '!intriga',
  cooldown: 30,
  execute: async (sock: WASocket, message: WAMessage, args: string[]): Promise<void> => {
    const groupJid = message.key.remoteJid;
    
    try {
      if (!groupJid) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Este comando só funciona em grupos!'
        });
        return;
      }
      
      const groupMetadata = await sock.groupMetadata(groupJid);
      const participants = groupMetadata.participants;
      const numParticipants = Math.floor(Math.random() * 4) + 1;
      const selectedParticipants = [];
      const participantesDisponiveis = [...participants];
      
      while (selectedParticipants.length < numParticipants && participantesDisponiveis.length > 0) {
        const randomIndex = Math.floor(Math.random() * participantesDisponiveis.length);
        const participante = participantesDisponiveis.splice(randomIndex, 1)[0];
        selectedParticipants.push(participante.id);
      }
      
      const intrigasFallback = [
        `🔥 *BOMBA! INTRIGA SEXUAL EXCLUSIVA!* 🔥\n\nMermão, cês não tão ligados no caô que chegou aqui pra mim! ${selectedParticipants.map(p => '@' + p.split('@')[0]).join(', ')} tão numa treta quente! Dizem que rolou uma festa e ninguém lembra direito, mas foi bem quente! 🔥💋\n\nMe contaram, só repasso, tá, meus anjos? Não me metam nisso! 💋`,
        `💋 *INTRIGA QUENTÍSSIMA DA CENTRAL AMANDA!* 💋\n\nFala sério, ${selectedParticipants.map(p => '@' + p.split('@')[0]).join(', ')} tão numa situação bem complicada! Parece que tem um triângulo amoroso rolando e tá todo mundo sabendo menos eles! 😏\n\nSó sei que foi assim, não me metam nisso! 😈`,
        `😈 *INTRIGA SEXUAL BOMBÁSTICA!* 😈\n\nGente, ${selectedParticipants.map(p => '@' + p.split('@')[0]).join(', ')} tão numa competição de sedução e tá pegando fogo! Dizem que tem uma aposta rolando e tá saindo do controle! 🔥\n\nMe contaram, só repasso! Não me metam nisso! 💋`
      ];
      
      const intriga = intrigasFallback[Math.floor(Math.random() * intrigasFallback.length)];
      
      await sock.sendMessage(groupJid, {
        text: intriga,
        mentions: selectedParticipants
      });
      
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Ops! Deu ruim na hora de gerar a intriga. Tenta de novo mais tarde!'
      });
    }
  },
};

export default intrigaCommand; 