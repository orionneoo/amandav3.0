import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';
import { commandDebug } from '@/utils/Logger';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class TodosCommand implements IInjectableCommand {
  public name = 'todos';
  public description = 'Marca todos os membros do grupo';
  public category = 'admin' as const;
  public usage = '!todos [mensagem]';
  public aliases = ['cornos', 'todes', 'toddy', 'nescal'];

  constructor() {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args, from: groupJid, sender: senderJid, isGroup } = context;
    try {
      // Verificar se é um grupo
      if (!isGroup) {
        await sock.sendMessage(groupJid, {
          text: '❌ Este comando só pode ser usado em grupos!'
        });
        return;
      }

      // Verificar se o bot é admin
      const groupMetadata = await sock.groupMetadata(groupJid);
      const botParticipant = groupMetadata.participants.find(p => p.id === sock.user?.id);
      if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
        await sock.sendMessage(groupJid, {
          text: '❌ Preciso ser admin para marcar todos os membros!'
        });
        return;
      }

      // Verificar se quem enviou é admin
      const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
      
      if (!senderParticipant?.admin) {
        await sock.sendMessage(groupJid, {
          text: '❌ Apenas admins podem usar este comando!'
        });
        return;
      }

      // Obter a mensagem
      const mensagem = args.join(' ');
      if (!mensagem.trim()) {
        await sock.sendMessage(groupJid, {
          text: '❌ *Uso:* `!todos [mensagem]`\n\nExemplo: `!todos Atenção galera!`'
        });
        return;
      }

      // Obter nome do remetente
      const senderName = senderParticipant.name || senderJid.split('@')[0];

      // Obter todos os membros (exceto o bot)
      const allMembers = groupMetadata.participants
        .filter(p => p.id !== sock.user?.id) // Excluir o bot
        .map(p => p.id);

      if (allMembers.length === 0) {
        await sock.sendMessage(groupJid, {
          text: '❌ Não há membros para marcar!'
        });
        return;
      }

      // Criar mensagem com menção
      const mensagemCompleta = `📢 *${senderName}* quer que vocês leiam essa mensagem:\n\n${mensagem}`;

      commandDebug(`Comando !todos executado por ${senderName} - Marcando ${allMembers.length} membros`);

      // Enviar mensagem marcando todos
      await sock.sendMessage(groupJid, {
        text: mensagemCompleta,
        mentions: allMembers
      });

    } catch (error) {
      commandDebug('Erro ao executar comando !todos:', error);
      await sock.sendMessage(groupJid, {
        text: '❌ Erro ao marcar todos os membros. Tente novamente!'
      });
    }
  }
} 