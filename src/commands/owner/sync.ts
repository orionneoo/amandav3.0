import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { GroupService } from '@/services/GroupService';
import { OwnerService } from '@/services/OwnerService';
import { TYPES } from '@/config/container';
import { MessageContext } from '@/handlers/message.handler';

@injectable()
export class SyncCommand implements IInjectableCommand {
  public name = 'sync';
  public description = '🔄 Sincroniza informações de todos os grupos com o WhatsApp (apenas dono)';
  public category = 'admin' as const;
  public usage = '!sync';
  public cooldown = 300; // 5 minutos
  public aliases = ['sync', 'sincronizar', 'atualizar'];

  constructor(
    @inject(TYPES.GroupService) private groupService: GroupService,
    @inject(TYPES.OwnerService) private ownerService: OwnerService
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message } = context;
    try {
      const senderJid = message.key.participant || message.key.remoteJid!;
      
      // Verificar se é o dono
      if (!this.ownerService.isOwner(senderJid)) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Apenas o dono pode usar este comando!'
        });
        return;
      }

      // Enviar mensagem de início
      await sock.sendMessage(message.key.remoteJid!, {
        text: '🔄 Iniciando sincronização de todos os grupos...\n\n⏳ Isso pode levar alguns segundos...'
      });

      // Executar sincronização
      await this.groupService.syncAllGroups(sock);

      // Obter estatísticas após sincronização
      const groups = await this.groupService.getAllGroups();
      
      let totalMembers = 0;
      let totalAdmins = 0;
      let groupsWithAI = 0;
      let groupsWithPersonality = new Map();
      
      groups.forEach(group => {
        totalMembers += group.totalMembers || 0;
        totalAdmins += group.totalAdmins || 0;
        if (group.settings?.aiEnabled) {
          groupsWithAI++;
        }
        
        // Contar personalidades
        const personality = group.activePersonality || 'padrao';
        groupsWithPersonality.set(personality, (groupsWithPersonality.get(personality) || 0) + 1);
      });

      // Criar lista de personalidades mais usadas
      const topPersonalities = Array.from(groupsWithPersonality.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      // Mensagem de conclusão
      let mensagem = `✅ *SINCRONIZAÇÃO CONCLUÍDA!*\n\n`;
      mensagem += `📊 *Estatísticas Gerais:*\n`;
      mensagem += `• Grupos sincronizados: ${groups.length}\n`;
      mensagem += `• Total de membros: ${totalMembers}\n`;
      mensagem += `• Total de admins: ${totalAdmins}\n`;
      mensagem += `• Grupos com IA ativa: ${groupsWithAI}\n\n`;
      
      mensagem += `🎭 *Personalidades Mais Usadas:*\n`;
      topPersonalities.forEach(([personality, count], index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        mensagem += `${emoji} ${personality}: ${count} grupos\n`;
      });
      
      mensagem += `\n🔄 Todos os dados foram atualizados com as informações mais recentes do WhatsApp!`;

      await sock.sendMessage(message.key.remoteJid!, { text: mensagem });
      
    } catch (error) {
      console.error('Erro ao executar comando sync:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Ops! Deu ruim na hora de sincronizar os grupos. Tenta de novo mais tarde!'
      });
    }
  }
} 