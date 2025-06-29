import { injectable, inject } from 'inversify';
import { WASocket } from '@whiskeysockets/baileys';
import { DatabaseService } from './DatabaseService';
import { Group, IGroup } from '@/database/models/GroupSchema';
import { ErrorLogger } from '@/utils/errorLogger';
import { TYPES } from '@/config/container';
import { CacheService } from './CacheService';
import { UserSession } from '@/database/UserSessionSchema';

@injectable()
export class GroupService {
  constructor(
    @inject(TYPES.DatabaseService) private dbService: DatabaseService,
    @inject(TYPES.CacheService) private cacheService: CacheService
  ) {}

  /**
   * Garante que um grupo existe no banco de dados
   * Se não existir, cria automaticamente com configurações padrão
   * SEMPRE atualiza as informações do grupo com dados do WhatsApp
   */
  public async ensureGroupExists(sock: WASocket, groupJid: string): Promise<IGroup> {
    try {
      console.log(`[GroupService] Verificando/atualizando grupo ${groupJid}...`);
      
      // Obter metadados completos do grupo do WhatsApp
      const groupMetadata = await sock.groupMetadata(groupJid);
      
      // Extrair informações detalhadas do grupo
      const groupInfo = {
        groupJid,
        name: groupMetadata.subject || 'Grupo',
        description: groupMetadata.desc || '',
        admins: groupMetadata.participants.filter(p => p.admin).map(p => p.id),
        members: groupMetadata.participants.map(p => p.id),
        totalMembers: groupMetadata.participants.length,
        totalAdmins: groupMetadata.participants.filter(p => p.admin).length,
        isAnnouncement: groupMetadata.announce || false,
        isRestricted: groupMetadata.restrict || false,
        isEphemeral: groupMetadata.ephemeralDuration !== undefined,
        ephemeralDuration: groupMetadata.ephemeralDuration || 0,
        inviteCode: groupMetadata.inviteCode || '',
        inviteCodeExp: 0,
        createdAt: groupMetadata.creation || new Date(),
        updatedAt: new Date()
      };

      // Verificar se o grupo já existe no banco
      let group = await Group.findOne({ groupJid });
      
      if (!group) {
        console.log(`[GroupService] Grupo ${groupJid} não encontrado, criando automaticamente...`);
        
        // Criar grupo com configurações padrão + dados do WhatsApp
        group = await Group.create({
          ...groupInfo,
          activePersonality: 'padrao', // Personalidade padrão
          lastPersonalityChange: new Date(),
          changedBy: '',
          settings: {
            welcomeEnabled: true,
            goodbyeEnabled: true,
            disabledCommands: [],
            aiEnabled: true
          }
        });
        
        console.log(`[GroupService] ✅ Grupo criado automaticamente: ${group.name} (${groupJid})`);
        console.log(`[GroupService] 📊 Dados: ${group.totalMembers} membros, ${group.totalAdmins} admins`);
      } else {
        console.log(`[GroupService] Grupo ${groupJid} já existe, atualizando informações...`);
        
        // Atualizar informações do grupo com dados mais recentes do WhatsApp
        const updatedGroup = await Group.findOneAndUpdate(
          { groupJid },
          {
            ...groupInfo,
            // Manter configurações existentes
            activePersonality: group.activePersonality,
            lastPersonalityChange: group.lastPersonalityChange,
            changedBy: group.changedBy,
            settings: group.settings,
            // Atualizar timestamps
            updatedAt: new Date()
          },
          { new: true }
        );
        
        if (updatedGroup) {
          group = updatedGroup;
          console.log(`[GroupService] ✅ Grupo atualizado: ${group.name} (${groupJid})`);
          console.log(`[GroupService] 📊 Dados atualizados: ${group.totalMembers} membros, ${group.totalAdmins} admins`);
        }
      }
      
      return group;
    } catch (error) {
      console.error(`[GroupService] Erro ao garantir existência do grupo ${groupJid}:`, error);
      await ErrorLogger.logError(error as Error, {
        groupJid,
        action: 'ensure_group_exists'
      });
      
      // Retornar grupo padrão em caso de erro
      return {
        groupJid,
        name: 'Grupo',
        description: '',
        admins: [],
        members: [],
        totalMembers: 0,
        totalAdmins: 0,
        isAnnouncement: false,
        isRestricted: false,
        isEphemeral: false,
        ephemeralDuration: 0,
        inviteCode: '',
        inviteCodeExp: 0,
        activePersonality: 'padrao',
        lastPersonalityChange: new Date(),
        changedBy: '',
        settings: {
          welcomeEnabled: true,
          goodbyeEnabled: true,
          disabledCommands: [],
          aiEnabled: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      } as any; // Usar any para evitar problemas de tipo
    }
  }

  /**
   * Atualiza informações de um grupo com dados do WhatsApp
   * Usado quando há mudanças no grupo (membros, admins, etc.)
   */
  public async updateGroupInfo(sock: WASocket, groupJid: string): Promise<IGroup | null> {
    try {
      console.log(`[GroupService] Atualizando informações do grupo ${groupJid}...`);
      
      // Obter metadados atualizados do WhatsApp
      const groupMetadata = await sock.groupMetadata(groupJid);
      
      // Extrair informações detalhadas
      const groupInfo = {
        name: groupMetadata.subject || 'Grupo',
        description: groupMetadata.desc || '',
        admins: groupMetadata.participants.filter(p => p.admin).map(p => p.id),
        members: groupMetadata.participants.map(p => p.id),
        totalMembers: groupMetadata.participants.length,
        totalAdmins: groupMetadata.participants.filter(p => p.admin).length,
        isAnnouncement: groupMetadata.announce || false,
        isRestricted: groupMetadata.restrict || false,
        isEphemeral: groupMetadata.ephemeralDuration !== undefined,
        ephemeralDuration: groupMetadata.ephemeralDuration || 0,
        inviteCode: groupMetadata.inviteCode || '',
        inviteCodeExp: 0,
        updatedAt: new Date()
      };

      // Atualizar no banco
      const group = await Group.findOneAndUpdate(
        { groupJid },
        groupInfo,
        { new: true }
      );
      
      if (group) {
        console.log(`[GroupService] ✅ Informações do grupo atualizadas: ${group.name}`);
        console.log(`[GroupService] 📊 Dados: ${group.totalMembers} membros, ${group.totalAdmins} admins`);
      }
      
      return group;
    } catch (error) {
      console.error(`[GroupService] Erro ao atualizar informações do grupo ${groupJid}:`, error);
      await ErrorLogger.logError(error as Error, {
        groupJid,
        action: 'update_group_info'
      });
      return null;
    }
  }

  /**
   * Busca um grupo no banco de dados
   * Se não existir, retorna null
   */
  public async getGroup(groupJid: string): Promise<IGroup | null> {
    try {
      return await Group.findOne({ groupJid });
    } catch (error) {
      console.error(`[GroupService] Erro ao buscar grupo ${groupJid}:`, error);
      await ErrorLogger.logError(error as Error, {
        groupJid,
        action: 'get_group'
      });
      return null;
    }
  }

  /**
   * Atualiza informações de um grupo
   */
  public async updateGroup(groupJid: string, updateData: Partial<IGroup>): Promise<IGroup | null> {
    try {
      const group = await Group.findOneAndUpdate(
        { groupJid },
        { 
          ...updateData,
          updatedAt: new Date()
        },
        { new: true }
      );
      
      if (group) {
        console.log(`[GroupService] ✅ Grupo atualizado: ${group.name} (${groupJid})`);
      }
      
      return group;
    } catch (error) {
      console.error(`[GroupService] Erro ao atualizar grupo ${groupJid}:`, error);
      await ErrorLogger.logError(error as Error, {
        groupJid,
        action: 'update_group',
        updateData
      });
      return null;
    }
  }

  /**
   * Atualiza a personalidade ativa de um grupo E LIMPA O HISTÓRICO
   */
  public async updateGroupPersonality(
    groupJid: string, 
    personality: string, 
    changedBy: string
  ): Promise<IGroup | null> {
    try {
      const group = await Group.findOneAndUpdate(
        { groupJid },
        {
          activePersonality: personality,
          lastPersonalityChange: new Date(),
          changedBy,
          updatedAt: new Date()
        },
        { new: true }
      );
      
      if (group) {
        console.log(`[GroupService] ✅ Personalidade atualizada para ${personality} no grupo ${group.name}`);
        
        // NOVO: Limpar histórico de conversa para garantir mudança consistente de humor
        await this.clearChatHistoryForPersonalityChange(groupJid, personality, changedBy);
      }
      
      return group;
    } catch (error) {
      console.error(`[GroupService] Erro ao atualizar personalidade do grupo ${groupJid}:`, error);
      await ErrorLogger.logError(error as Error, {
        groupJid,
        personality,
        changedBy,
        action: 'update_group_personality'
      });
      return null;
    }
  }

  /**
   * NOVO: Limpa o histórico de conversa quando a personalidade é alterada
   */
  private async clearChatHistoryForPersonalityChange(
    groupJid: string, 
    newPersonality: string, 
    changedBy: string
  ): Promise<void> {
    try {
      console.log(`[GroupService] 🧹 Limpando histórico de conversa para mudança de personalidade: ${newPersonality}`);
      
      // 1. Limpar cache de histórico
      this.cacheService.deleteChatHistory(groupJid);
      
      // 2. Limpar histórico no banco de dados
      await UserSession.findOneAndUpdate(
        { jid: groupJid },
        { 
          chatHistory: [],
          lastInteraction: new Date(),
          $push: {
            personalityChanges: {
              from: 'unknown', // Não sabemos qual era a anterior
              to: newPersonality,
              changedBy: changedBy,
              timestamp: new Date(),
              reason: 'manual_change'
            }
          }
        },
        { upsert: true }
      );
      
      // 3. Log da limpeza
      console.log(`[GroupService] ✅ Histórico limpo com sucesso para grupo ${groupJid}`);
      console.log(`[GroupService] 📝 Nova personalidade: ${newPersonality}`);
      console.log(`[GroupService] 👤 Alterado por: ${changedBy}`);
      
      // 4. Salvar log de auditoria da mudança
      await this.dbService.saveErrorLog({
        error: `Mudança de personalidade: ${newPersonality}`,
        stack: `Histórico limpo para garantir consistência`,
        user: changedBy,
        group: groupJid,
        command: 'personality_change',
        location: 'GroupService.clearChatHistoryForPersonalityChange',
        severity: 'low'
      });
      
    } catch (error) {
      console.error(`[GroupService] ❌ Erro ao limpar histórico para mudança de personalidade:`, error);
      await ErrorLogger.logError(error as Error, {
        groupJid,
        newPersonality,
        changedBy,
        action: 'clear_chat_history_for_personality_change'
      });
    }
  }

  /**
   * NOVO: Método público para limpar histórico manualmente
   */
  public async clearGroupChatHistory(groupJid: string, reason: string = 'manual'): Promise<boolean> {
    try {
      console.log(`[GroupService] 🧹 Limpeza manual de histórico solicitada para grupo ${groupJid}`);
      
      // Limpar cache
      this.cacheService.deleteChatHistory(groupJid);
      
      // Limpar banco
      await UserSession.findOneAndUpdate(
        { jid: groupJid },
        { 
          chatHistory: [],
          lastInteraction: new Date()
        },
        { upsert: true }
      );
      
      console.log(`[GroupService] ✅ Histórico limpo manualmente para grupo ${groupJid}`);
      
      // Log de auditoria
      await this.dbService.saveErrorLog({
        error: `Limpeza manual de histórico`,
        stack: `Motivo: ${reason}`,
        user: 'system',
        group: groupJid,
        command: 'clear_history',
        location: 'GroupService.clearGroupChatHistory',
        severity: 'low'
      });
      
      return true;
    } catch (error) {
      console.error(`[GroupService] ❌ Erro na limpeza manual de histórico:`, error);
      return false;
    }
  }

  /**
   * Verifica se a IA está habilitada em um grupo
   */
  public async isAIEnabled(groupJid: string): Promise<boolean> {
    try {
      const group = await Group.findOne({ groupJid });
      return group?.settings?.aiEnabled ?? true; // Por padrão, IA ligada
    } catch (error) {
      console.error(`[GroupService] Erro ao verificar IA habilitada no grupo ${groupJid}:`, error);
      return true; // Em caso de erro, assume que está habilitada
    }
  }

  /**
   * Lista todos os grupos com suas personalidades e estatísticas
   */
  public async getAllGroups(): Promise<IGroup[]> {
    try {
      return await Group.find({}).select('groupJid name activePersonality lastPersonalityChange changedBy totalMembers totalAdmins updatedAt');
    } catch (error) {
      console.error('[GroupService] Erro ao listar grupos:', error);
      await ErrorLogger.logError(error as Error, {
        action: 'get_all_groups'
      });
      return [];
    }
  }

  /**
   * Obtém estatísticas detalhadas de um grupo
   */
  public async getGroupStats(groupJid: string): Promise<any> {
    try {
      const group = await Group.findOne({ groupJid });
      if (!group) {
        return null;
      }

      return {
        name: group.name,
        totalMembers: group.totalMembers,
        totalAdmins: group.totalAdmins,
        activePersonality: group.activePersonality,
        lastPersonalityChange: group.lastPersonalityChange,
        changedBy: group.changedBy,
        isAnnouncement: group.isAnnouncement,
        isRestricted: group.isRestricted,
        isEphemeral: group.isEphemeral,
        ephemeralDuration: group.ephemeralDuration,
        settings: group.settings,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      };
    } catch (error) {
      console.error(`[GroupService] Erro ao obter estatísticas do grupo ${groupJid}:`, error);
      await ErrorLogger.logError(error as Error, {
        groupJid,
        action: 'get_group_stats'
      });
      return null;
    }
  }

  /**
   * Sincroniza informações de todos os grupos com o WhatsApp
   * Útil para manter o banco atualizado
   */
  public async syncAllGroups(sock: WASocket): Promise<void> {
    try {
      console.log('[GroupService] Iniciando sincronização de todos os grupos...');
      
      const groups = await Group.find({});
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const group of groups) {
        try {
          await this.updateGroupInfo(sock, group.groupJid);
          updatedCount++;
        } catch (error) {
          console.error(`[GroupService] Erro ao sincronizar grupo ${group.groupJid}:`, error);
          errorCount++;
        }
      }
      
      console.log(`[GroupService] ✅ Sincronização concluída: ${updatedCount} grupos atualizados, ${errorCount} erros`);
    } catch (error) {
      console.error('[GroupService] Erro na sincronização geral:', error);
      await ErrorLogger.logError(error as Error, {
        action: 'sync_all_groups'
      });
    }
  }
} 