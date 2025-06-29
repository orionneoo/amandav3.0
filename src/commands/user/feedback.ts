import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable } from 'inversify';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class FeedbackCommand implements IInjectableCommand {
  public name = 'feedback';
  public description = 'Envia feedback, sugestões ou reporta bugs para o desenvolvedor';
  public category = 'general' as const;
  public usage = '!feedback <sua mensagem>';
  public aliases = ['sugestao', 'bug', 'report', 'sugestão'];

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args, from: groupJid, sender: userJid, isGroup } = context;
    
    // Verificar se há mensagem
    if (args.length === 0) {
      const helpText = `📝 *Como usar o Feedback*\n\n` +
        `💡 Envie sugestões, reporte bugs ou dê sua opinião!\n\n` +
        `📋 *Exemplos:*\n` +
        `• \`!feedback Adicionem mais comandos de diversão\`\n` +
        `• \`!feedback O comando !fofoca não está funcionando\`\n` +
        `• \`!feedback Gostaria de uma nova personalidade\`\n\n` +
        `🎯 *Seu feedback será enviado diretamente para o desenvolvedor!*`;
      
      await sock.sendMessage(groupJid, { text: helpText });
      return;
    }

    // Montar mensagem de feedback
    const feedbackText = args.join(' ');
    const userNumber = userJid.split('@')[0];
    const userName = message.pushName || userNumber;
    const groupName = isGroup ? (await sock.groupMetadata(groupJid)).subject : 'Privado';
    
    const feedbackMessage = `📝 *NOVO FEEDBACK RECEBIDO*\n\n` +
      `👤 *De:* ${userName} (${userNumber})\n` +
      `📍 *Local:* ${isGroup ? `Grupo: ${groupName}` : 'Chat Privado'}\n` +
      `⏰ *Data:* ${new Date().toLocaleString('pt-BR')}\n\n` +
      `💬 *Mensagem:*\n${feedbackText}\n\n` +
      `🔗 *Responder:* ${userJid}`;

    try {
      // Enviar para o dono do bot
      const ownerNumber = '5521967233931@s.whatsapp.net';
      await sock.sendMessage(ownerNumber, { text: feedbackMessage });
      
      // Confirmar para o usuário
      const confirmationText = `✅ *Feedback enviado com sucesso!*\n\n` +
        `📝 Sua mensagem foi enviada para o desenvolvedor.\n` +
        `💬 Se necessário, você receberá uma resposta em breve!\n\n` +
        `🙏 *Obrigado por contribuir para melhorar o bot!*`;
      
      await sock.sendMessage(groupJid, { text: confirmationText });
      
      console.log(`[FEEDBACK] Novo feedback de ${userName} (${userNumber}): ${feedbackText}`);
      
    } catch (error) {
      console.error('[ERROR] Erro ao enviar feedback:', error);
      
      const errorText = `❌ *Erro ao enviar feedback*\n\n` +
        `Opa, deu ruim na hora de enviar seu feedback! 😅\n\n` +
        `Tenta de novo em alguns segundos. Se não funcionar, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
      
      await sock.sendMessage(groupJid, { text: errorText });
    }
  }
} 