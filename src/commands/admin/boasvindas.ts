import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { Group } from '@/database/models/GroupSchema';
import { canUseCommand } from '@/utils/permissions';
import { injectable } from 'inversify';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class BoasvindasCommand implements IInjectableCommand {
  public name = 'boasvindas';
  public description = 'Configura as mensagens de boas-vindas e despedida do grupo';
  public category = 'admin' as const;
  public usage = '!boasvindas [on/off]';
  public aliases = ['welcome', 'bemvindo'];

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
        group = new Group({ 
          groupJid, 
          name: 'Grupo',
          settings: { welcomeEnabled: true, goodbyeEnabled: true, disabledCommands: [] }
        });
      }

      if (args.length === 0) {
        // Mostrar status atual
        const status = `🔧 *Configurações de Mensagens do Grupo*\n\n` +
          `👋 *Boas-vindas:* ${group.settings?.welcomeEnabled ? '✅ Ativada' : '❌ Desativada'}\n` +
          `👋 *Despedidas:* ${group.settings?.goodbyeEnabled ? '✅ Ativada' : '❌ Desativada'}\n\n` +
          `💡 *Como usar:*\n` +
          `• \`!boasvindas on\` - 🟢 Ativa as mensagens\n` +
          `• \`!boasvindas off\` - 🔴 Desativa as mensagens\n` +
          `• \`!boasvindas\` - 📊 Mostra o status atual`;
        
        await sock.sendMessage(groupJid, { text: status });
        return;
      }

      const action = args[0].toLowerCase();
      
      if (action === 'on') {
        group.settings = group.settings || {};
        group.settings.welcomeEnabled = true;
        group.settings.goodbyeEnabled = true;
        await group.save();
        
        await sock.sendMessage(groupJid, { 
          text: '✅ *Mensagens ativadas!*\n\n👋 As mensagens de boas-vindas e despedidas estão agora ativas no grupo.\n\n🎉 Novos membros receberão uma mensagem de boas-vindas!\n👋 Membros que saírem receberão uma mensagem de despedida!' 
        });
      } else if (action === 'off') {
        group.settings = group.settings || {};
        group.settings.welcomeEnabled = false;
        group.settings.goodbyeEnabled = false;
        await group.save();
        
        await sock.sendMessage(groupJid, { 
          text: '❌ *Mensagens desativadas!*\n\n🔇 As mensagens de boas-vindas e despedidas foram desativadas no grupo.\n\n🤐 Novos membros não receberão mais mensagens de boas-vindas.\n🔇 Membros que saírem não receberão mais mensagens de despedida.' 
        });
      } else {
        await sock.sendMessage(groupJid, { 
          text: '❌ *Comando inválido!*\n\n💡 Use:\n• `!boasvindas on` - 🟢 Para ativar\n• `!boasvindas off` - 🔴 Para desativar' 
        });
      }
    } catch (error) {
      console.error('Erro ao configurar boas-vindas:', error);
      await sock.sendMessage(groupJid, { 
        text: '❌ Erro ao configurar as mensagens. Tente novamente mais tarde. Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧' 
      });
    }
  }
}

export default BoasvindasCommand; 