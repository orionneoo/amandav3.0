import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { getUserDisplayName } from '@/utils/userUtils';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

const promoverCommand: ICommand = {
  name: 'promover',
  description: 'Promove um usuário a admin (admin apenas).',
  category: 'admin',
  usage: '!promover @user',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message, args, from: groupJid, sender: userJid, isGroup } = context;
    try {
      if (!isGroup) {
        await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
        return;
      }

      if (!await canUseCommand(sock, groupJid, userJid, 'admin')) {
        await sock.sendMessage(groupJid, { text: 'Apenas admins podem usar este comando.' });
        return;
      }

      // FIX: Verificar se o bot é admin do grupo
      const groupMetadata = await sock.groupMetadata(groupJid);
      const botJid = sock.user?.id;
      const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
      
      if (!botParticipant || botParticipant.admin !== 'admin') {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Eu preciso ser admin do grupo pra poder promover alguém! 💋' 
        });
        return;
      }

      const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (!mentioned || mentioned.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: 'Ei, gracinha! 🫣 Marca quem você quer promover!\n\n💡 Exemplo: !promover @usuario' 
        });
        return;
      }

      const targetJid = mentioned[0];
      
      // FIX: Verificar se o usuário já é admin
      const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
      if (targetParticipant?.admin === 'admin') {
        const targetName = await getUserDisplayName(sock, targetJid, groupJid);
        await sock.sendMessage(groupJid, { 
          text: `Eita, baby! 🫣 O @${targetName} já é admin! 😏`,
          mentions: [targetJid]
        });
        return;
      }

      // FIX: Tentar promover com tratamento de erro
      try {
        await sock.groupParticipantsUpdate(groupJid, [targetJid], 'promote');
        
        const targetName = await getUserDisplayName(sock, targetJid, groupJid);
        const promoterName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);
        
        await sock.sendMessage(groupJid, { 
          text: `🎉 *PROMOÇÃO REALIZADA!* 🎉\n\n` +
                `👑 @${targetName} foi promovido a admin por @${promoterName}!\n\n` +
                `_Agora ele pode ajudar a moderar o grupo!_ ✨`,
          mentions: [targetJid, userJid]
        });
        
      } catch (error) {
        console.error('[ERROR] Erro ao promover usuário:', error);
        
        // FIX: Verificar tipo específico de erro
        if (error instanceof Error) {
          if (error.message.includes('forbidden')) {
            await sock.sendMessage(groupJid, { 
              text: 'Eita, baby! 🫣 Não consegui promover. Pode ser que eu não tenha permissão ou o usuário já seja admin! 💋' 
            });
          } else if (error.message.includes('not-authorized')) {
            await sock.sendMessage(groupJid, { 
              text: 'Eita, baby! 🫣 Não tenho permissão para promover neste grupo! 💋' 
            });
          } else {
            await sock.sendMessage(groupJid, { 
              text: 'Eita, baby! 🫣 Deu um erro inesperado! Tenta de novo! Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧' 
            });
          }
        } else {
          await sock.sendMessage(groupJid, { 
            text: 'Eita, baby! 🫣 Deu um erro inesperado ao promover! 💋' 
          });
        }
      }
      
    } catch (error) {
      console.error('[ERROR] Erro no comando promover:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu um erro inesperado! Tenta de novo! 💋' 
      });
    }
  },
};

export default promoverCommand; 