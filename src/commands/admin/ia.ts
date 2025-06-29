import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { Group } from '@/database/models/GroupSchema';
import { injectable } from 'inversify';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class IaCommand implements IInjectableCommand {
  public name = 'ia';
  public description = 'Liga ou desliga a IA no grupo';
  public category = 'admin' as const;
  public usage = '!ia [on/off/status]';
  public aliases = ['ai', 'bot', 'amanda'];

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args, from: groupJid, sender: userJid, isGroup } = context;
    
    if (!isGroup) {
      await sock.sendMessage(groupJid, { text: 'Este comando só pode ser usado em grupos.' });
      return;
    }

    if (!await canUseCommand(sock, groupJid, userJid, 'admin')) {
      await sock.sendMessage(groupJid, { text: 'Apenas admins podem usar este comando.' });
      return;
    }

    try {
      // Buscar ou criar configuração do grupo
      let group = await Group.findOne({ groupJid });
      if (!group) {
        // Obter informações do grupo do WhatsApp
        let groupName = 'Grupo';
        try {
          const groupMetadata = await sock.groupMetadata(groupJid);
          groupName = groupMetadata.subject || 'Grupo';
        } catch (metadataError) {
          console.warn('Erro ao obter metadata do grupo:', metadataError);
          groupName = 'Grupo';
        }
        
        group = new Group({
          groupJid,
          name: groupName,
          settings: {
            welcomeEnabled: true,
            goodbyeEnabled: true,
            disabledCommands: [],
            aiEnabled: true // Por padrão, IA ligada
          }
        });
        await group.save();
      }

      // Garantir que settings.aiEnabled existe
      if (group.settings?.aiEnabled === undefined) {
        group.settings = group.settings || {};
        group.settings.aiEnabled = true; // Por padrão, IA ligada
        await group.save();
      }

      const action = args[0]?.toLowerCase() || 'status';

      if (action === 'on' || action === 'ligar' || action === 'ativar') {
        group.settings.aiEnabled = true;
        await group.save();
        
        await sock.sendMessage(groupJid, {
          text: '🤖 *IA Ativada!*\n\n💬 Agora eu vou responder às mensagens do grupo!\n\n💡 *Como me chamar:*\n• Mencione @5521971200821\n• Ou responda a uma das minhas mensagens'
        });
      } else if (action === 'off' || action === 'desligar' || action === 'desativar') {
        group.settings.aiEnabled = false;
        await group.save();
        
        await sock.sendMessage(groupJid, {
          text: '🔇 *IA Desativada!*\n\n🤐 Agora eu não vou mais responder às mensagens do grupo.\n\n💡 Use `!ia on` para me reativar quando quiser!'
        });
      } else if (action === 'status' || action === 'info') {
        const isEnabled = group.settings?.aiEnabled ?? true;
        const status = isEnabled ? '✅ *ATIVADA*' : '❌ *DESATIVADA*';
        const statusText = isEnabled ? 'respondendo às mensagens' : 'silenciosa';
        
        let message = `🤖 *Status da IA*\n\n${status}\n\n`;
        message += `📋 *Situação atual:* ${statusText}\n\n`;
        
        if (isEnabled) {
          message += `💡 *Como me chamar:*\n`;
          message += `• Mencione @5521971200821\n`;
          message += `• Ou responda a uma das minhas mensagens\n\n`;
          message += `🔧 *Comandos:*\n`;
          message += `• \`!ia off\` - Me desativar\n`;
          message += `• \`!ia status\` - Ver este status`;
        } else {
          message += `🔧 *Comandos:*\n`;
          message += `• \`!ia on\` - Me ativar\n`;
          message += `• \`!ia status\` - Ver este status`;
        }
        
        await sock.sendMessage(groupJid, { text: message });
      } else {
        await sock.sendMessage(groupJid, {
          text: '❌ *Comando inválido!*\n\n💡 *Como usar:*\n• `!ia on` - Ativar a IA\n• `!ia off` - Desativar a IA\n• `!ia status` - Ver status atual'
        });
      }
    } catch (error) {
      console.error('Erro ao gerenciar IA:', error);
      await sock.sendMessage(groupJid, {
        text: '❌ Erro ao gerenciar IA. Tente novamente mais tarde. Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }
}

export default IaCommand; 