import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { getRandomInt } from '@/utils/random';
import { getUserDisplayName } from '@/utils/userUtils';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

// FIX: Comando crushometro com validação personalizada
const crushometroCommand: ICommand = {
  name: 'crushometro',
  aliases: ['crush', 'amor'],
  description: 'Mede a chance de dar match com seu crush',
  category: 'utils',
  usage: '!crushometro @usuario',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    try {
      const groupJid = message.key.remoteJid!;
      const userJid = message.key.participant || message.key.remoteJid!;
      
      // FIX: Verificar se é um grupo
      if (!groupJid.endsWith('@g.us')) {
        await sock.sendMessage(groupJid, { 
          text: `Eita, baby! 🫣 O !crushometro só funciona em grupos. Marca alguém lá no grupo! 💋` 
        });
        return;
      }
      
      // FIX: Verificar se tem menção
      const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentionedJids.length === 0) {
        // FIX: Mensagem de erro mais amigável da Amanda
        await sock.sendMessage(groupJid, { 
          text: `Ei, gracinha! 🫣 Pra usar o !crushometro você precisa marcar alguém.\n\n💡 Exemplo: !crushometro @crush\n\nTenta de novo, meu bem! ✨` 
        });
        return;
      }
      
      const targetJid = mentionedJids[0];
      const targetNumber = targetJid.split('@')[0];
      
      // FIX: Verificar se não está marcando a si mesmo
      if (targetJid === userJid) {
        await sock.sendMessage(groupJid, { 
          text: `Eita, baby! 🫣 Não pode usar o !crushometro em si mesmo! Marca outra pessoa! 😏` 
        });
        return;
      }
      
      // FIX: Gerar resultado aleatório
      const chance = getRandomInt(0, 100);
      let result = '';
      let emoji = '';
      
      if (chance >= 80) {
        result = 'MATCH PERFEITO! 💘';
        emoji = '💘💕💖';
      } else if (chance >= 60) {
        result = 'Muito provável! 😍';
        emoji = '😍💕';
      } else if (chance >= 40) {
        result = 'Tem chance! 😊';
        emoji = '😊💫';
      } else if (chance >= 20) {
        result = 'Difícil, mas não impossível! 🤔';
        emoji = '🤔💭';
      } else {
        result = 'Melhor nem tentar... 😅';
        emoji = '😅💔';
      }
      
      const response = `💕 *CRUSHOMETRO DA AMANDA* 💕\n\n` +
                      `@${userJid.split('@')[0]} + @${targetNumber}\n\n` +
                      `📊 *Chance de dar match:* ${chance}%\n` +
                      `🎯 *Resultado:* ${result}\n\n` +
                      `${emoji}\n\n` +
                      `_A Amanda sempre acerta!_ 🔮✨`;
      
      // FIX: Marcar corretamente os usuários
      const userDisplayName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);
      const targetDisplayName = await getUserDisplayName(sock, targetJid, groupJid);
      
      const responseComMencao = response
        .replace(`@${userJid.split('@')[0]}`, `@${userDisplayName}`)
        .replace(`@${targetNumber}`, `@${targetDisplayName}`);
      
      await sock.sendMessage(groupJid, { 
        text: responseComMencao,
        mentions: [userJid, targetJid]
      });
      
    } catch (error) {
      // FIX: Este erro será capturado pelo wrapper e mostrará a mensagem personalizada da Amanda
      throw error;
    }
  },
};

// FIX: Exportar comando sem validação de argumentos (validação feita internamente)
export default crushometroCommand; 