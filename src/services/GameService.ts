import { injectable, inject } from 'inversify';
import { Game, IGame, ISubmission, IReaction } from '@/database/models/GameSchema';
import { Group } from '@/database/models/GroupSchema';
import { DatabaseService } from './DatabaseService';
import { ErrorLogger } from '@/utils/errorLogger';
import Logger from '@/utils/Logger';
import { MessageContext } from '@/handlers/message.handler';
import { TYPES } from '@/config/container';

export interface SubmissionData {
  senderJid: string;
  messageId: string;
  photoUrl: string;
  caption?: string;
}

export interface ConfessionData {
  senderJid: string;
  messageId: string;
  confession: string;
}

export interface ReactionData {
  reactorJid: string;
  reactionType: 'pego' | 'penso' | 'passo';
}

export interface ConfessionReactionData {
  reactorJid: string;
  reactionType: 'euTambem' | 'chocado' | 'mico';
}

export interface RankingData {
  userJid: string;
  userName: string;
  pegoCount: number;
  totalReactions: number;
}

export interface ConfessionRankingData {
  confession: string;
  euTambemCount: number;
  chocadoCount: number;
  micoCount: number;
  totalReactions: number;
}

export interface MatchData {
  user1Jid: string;
  user1Name: string;
  user2Jid: string;
  user2Name: string;
  mutualPego: boolean;
}

@injectable()
export class GameService {
  // MELHORIA: Singleton para acesso estático
  private static instance: GameService;

  constructor(
    @inject(TYPES.DatabaseService) private dbService: DatabaseService
  ) {
    // MELHORIA: Atribuição do Singleton
    GameService.instance = this;
  }
  
  /**
   * // MELHORIA: Ponto de entrada estático para o roteador de mensagens.
   * Processa uma mensagem privada para verificar se é uma submissão para um jogo ativo.
   * @param context O contexto da mensagem.
   * @returns `true` se a mensagem foi tratada como parte de um jogo, `false` caso contrário.
   */
  public static async processInput(context: MessageContext): Promise<boolean> {
    // REFACTOR: A lógica de jogos só atua em mensagens privadas
    if (context.isGroup) {
      return false;
    }
    
    try {
      // Por enquanto, vamos focar no jogo de Confissão que é o mais comum no privado.
      const activeGames = await this.instance.findActiveConfessionGamesForUser(context.sender);

      if (activeGames.length === 0) {
        return false; // Não há jogos ativos para este usuário, não faz nada.
      }

      console.log(`[GameService] Usuário ${context.sender} tem ${activeGames.length} jogos de confissão ativos.`);

      if (activeGames.length === 1) {
        const game = activeGames[0];
        await this.instance.addConfession(game.groupId, {
          senderJid: context.sender,
          messageId: context.messageInfo.key.id!,
          confession: context.text
        });
        await context.sock.sendMessage(context.from, { text: 'Sua confissão foi recebida e será enviada em breve! 🤫' });
      } else {
        // TODO: Implementar lógica de desambiguação para múltiplos jogos.
        await context.sock.sendMessage(context.from, { text: 'Você está em múltiplos jogos de confissão. Esta funcionalidade ainda está em desenvolvimento.' });
      }
      
      return true; // Mensagem foi processada pelo sistema de jogo.
    } catch (error) {
      console.error('[GameService] Erro ao processar input de jogo:', error);
      await context.sock.sendMessage(context.from, { text: 'Ocorreu um erro ao processar sua confissão. Tente novamente.' });
      return true; // Mesmo com erro, a intenção era de jogo, então o fluxo para aqui.
    }
  }

  /**
   * Cria um novo jogo ativo para um grupo
   */
  async createGame(groupId: string, createdBy: string, groupName?: string): Promise<IGame> {
    try {
      // Verifica se já existe um jogo ativo para este grupo
      const existingGame = await Game.findOne({ groupId, isActive: true });
      if (existingGame) {
        throw new Error('Já existe um jogo ativo neste grupo');
      }

      const game = await Game.create({
        gameName: 'ppp',
        groupId,
        groupName,
        isActive: true,
        createdBy,
        submissions: [],
        reactions: []
      });

      Logger.info('Jogo PPP criado', {
        groupId,
        createdBy,
        gameId: game._id
      });

      return game;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        createdBy,
        action: 'create_game'
      });
      throw error;
    }
  }

  /**
   * Finaliza um jogo ativo
   */
  async endGame(groupId: string): Promise<IGame | null> {
    try {
      const game = await Game.findOneAndUpdate(
        { groupId, isActive: true },
        { isActive: false },
        { new: true }
      );

      if (game) {
        Logger.info('Jogo PPP finalizado', {
          groupId,
          gameId: game._id,
          submissionsCount: game.submissions.length,
          reactionsCount: game.reactions.length
        });
      }

      return game;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'end_game'
      });
      throw error;
    }
  }

  /**
   * Busca um jogo ativo por grupo
   */
  async findActiveGameByGroupId(groupId: string): Promise<IGame | null> {
    try {
      return await Game.findOne({ groupId, isActive: true });
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'find_active_game'
      });
      throw error;
    }
  }

  /**
   * Busca o último jogo (ativo ou inativo) por grupo
   */
  async findLastGameByGroupId(groupId: string): Promise<IGame | null> {
    try {
      return await Game.findOne({ groupId, gameName: 'ppp' }).sort({ createdAt: -1 });
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'find_last_game'
      });
      throw error;
    }
  }

  /**
   * Adiciona uma submissão ao jogo
   */
  async addSubmission(groupId: string, submissionData: SubmissionData): Promise<IGame | null> {
    try {
      const game = await Game.findOneAndUpdate(
        { groupId, isActive: true },
        { 
          $push: { 
            submissions: {
              senderJid: submissionData.senderJid,
              messageId: submissionData.messageId,
              photoUrl: submissionData.photoUrl,
              caption: submissionData.caption,
              submittedAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (game) {
        Logger.info('Submissão adicionada ao jogo PPP', {
          groupId,
          senderJid: submissionData.senderJid,
          submissionsCount: game.submissions.length
        });
      }

      return game;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        senderJid: submissionData.senderJid,
        action: 'add_submission'
      });
      throw error;
    }
  }

  /**
   * Adiciona uma reação ao jogo
   */
  async addReaction(groupId: string, reactionData: ReactionData): Promise<IGame | null> {
    try {
      console.log(`[DEBUG] Adicionando reação: ${reactionData.reactorJid} -> ${reactionData.reactionType} no grupo ${groupId}`);
      
      const game = await Game.findOneAndUpdate(
        { groupId, gameName: 'ppp' },
        { 
          $push: { 
            reactions: {
              reactorJid: reactionData.reactorJid,
              reactionType: reactionData.reactionType,
              reactedAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (game) {
        console.log(`[DEBUG] Reação adicionada com sucesso. Total de reações: ${game.reactions.length}`);
        Logger.info('Reação adicionada ao jogo PPP', {
          groupId,
          reactorJid: reactionData.reactorJid,
          reactionType: reactionData.reactionType,
          reactionsCount: game.reactions.length
        });
      } else {
        console.log(`[DEBUG] Jogo não encontrado para adicionar reação`);
      }

      return game;
    } catch (error) {
      console.error(`[ERROR] Erro ao adicionar reação:`, error);
      await ErrorLogger.logError(error as Error, {
        groupId,
        reactorJid: reactionData.reactorJid,
        action: 'add_reaction'
      });
      throw error;
    }
  }

  /**
   * Obtém todas as submissões de um jogo
   */
  async getSubmissions(groupId: string): Promise<ISubmission[]> {
    try {
      const game = await Game.findOne({ groupId, isActive: true });
      return game?.submissions || [];
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_submissions'
      });
      throw error;
    }
  }

  /**
   * Obtém todas as reações de um jogo
   */
  async getReactions(groupId: string): Promise<IReaction[]> {
    try {
      const game = await this.findLastGameByGroupId(groupId);
      console.log(`[DEBUG] Buscando reações para grupo ${groupId}. Jogo encontrado: ${!!game}, Reações: ${game?.reactions?.length || 0}`);
      return game?.reactions || [];
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_reactions'
      });
      throw error;
    }
  }

  /**
   * Limpa as submissões de um jogo
   */
  async clearSubmissions(groupId: string): Promise<IGame | null> {
    try {
      const game = await Game.findOneAndUpdate(
        { groupId, isActive: true },
        { $set: { submissions: [] } },
        { new: true }
      );

      if (game) {
        Logger.info('Submissões do jogo PPP limpas', {
          groupId,
          gameId: game._id
        });
      }

      return game;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'clear_submissions'
      });
      throw error;
    }
  }

  /**
   * Busca jogos ativos para um usuário baseado nos grupos que ele participa
   * Se não encontrar grupos, retorna todos os jogos PPP ativos
   */
  async findActiveGamesForUser(userJid: string): Promise<IGame[]> {
    try {
      // Busca todos os grupos onde o usuário é membro
      const userGroups = await Group.find({
        members: userJid
      });

      const groupIds = userGroups.map(group => group.groupJid);

      let activeGames: IGame[] = [];
      if (groupIds.length > 0) {
        // Busca jogos ativos nesses grupos
        activeGames = await Game.find({
          groupId: { $in: groupIds },
          isActive: true,
          gameName: 'ppp'
        });
      }

      // Se não encontrou nenhum, busca todos os jogos PPP ativos
      if (activeGames.length === 0) {
        activeGames = await Game.find({ isActive: true, gameName: 'ppp' });
      }

      return activeGames;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        userJid,
        action: 'find_active_games_for_user'
      });
      throw error;
    }
  }

  /**
   * Verifica se um usuário já enviou submissão para um jogo
   */
  async hasUserSubmitted(groupId: string, userJid: string): Promise<boolean> {
    try {
      const game = await Game.findOne({ groupId, isActive: true });
      if (!game) return false;

      return game.submissions.some(submission => submission.senderJid === userJid);
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        userJid,
        action: 'check_user_submission'
      });
      return false;
    }
  }

  /**
   * Obtém estatísticas do jogo
   */
  async getGameStats(groupId: string): Promise<{ totalSubmissions: number; participants: string[] }> {
    try {
      const game = await Game.findOne({ groupId, isActive: true });
      if (!game) {
        return { totalSubmissions: 0, participants: [] };
      }

      const participants = [...new Set(game.submissions.map(s => s.senderJid))];

      return {
        totalSubmissions: game.submissions.length,
        participants
      };
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_game_stats'
      });
      return { totalSubmissions: 0, participants: [] };
    }
  }

  /**
   * Gera ranking dos mais "pegos" (apenas reações positivas)
   */
  async getRanking(groupId: string, userNames: Map<string, string>): Promise<RankingData[]> {
    try {
      const game = await this.findLastGameByGroupId(groupId);
      console.log(`[DEBUG] Gerando ranking para grupo ${groupId}. Jogo encontrado: ${!!game}, Reações: ${game?.reactions?.length || 0}`);
      
      if (!game) return [];

      // Obter lista de participantes (quem enviou fotos)
      const participants = [...new Set(game.submissions.map(s => s.senderJid))];
      
      // Conta reações "pego" recebidas por cada participante
      const pegoCounts = new Map<string, number>();
      const totalReactions = new Map<string, number>();

      // Inicializar contadores para todos os participantes
      participants.forEach(participant => {
        pegoCounts.set(participant, 0);
        totalReactions.set(participant, 0);
      });

      // Associar reações aos participantes na ordem das fotos
      let currentPhotoIndex = 0;
      
      game.reactions.forEach((reaction, index) => {
        if (currentPhotoIndex < participants.length) {
          const targetParticipant = participants[currentPhotoIndex];
          
          const currentPegoCount = pegoCounts.get(targetParticipant) || 0;
          const currentTotalCount = totalReactions.get(targetParticipant) || 0;
          
          if (reaction.reactionType === 'pego') {
            pegoCounts.set(targetParticipant, currentPegoCount + 1);
          }
          totalReactions.set(targetParticipant, currentTotalCount + 1);
        }
        
        // Avançar para próxima foto a cada 3 reações (pego, penso, passo)
        if ((index + 1) % 3 === 0) {
          currentPhotoIndex++;
        }
      });

      console.log(`[DEBUG] Contagem de reações:`, {
        totalReactions: game.reactions.length,
        participants: participants.length,
        pegoCounts: Array.from(pegoCounts.entries()),
        totalReactionsMap: Array.from(totalReactions.entries())
      });

      // Converte para array e ordena por "pego" recebido
      const ranking: RankingData[] = Array.from(pegoCounts.entries()).map(([userJid, pegoCount]) => ({
        userJid,
        userName: userNames.get(userJid) || userJid.split('@')[0],
        pegoCount,
        totalReactions: totalReactions.get(userJid) || 0
      }));

      // Ordena por quantidade de "pego" recebido (decrescente)
      const sortedRanking = ranking.sort((a, b) => b.pegoCount - a.pegoCount);
      console.log(`[DEBUG] Ranking gerado:`, sortedRanking);
      
      return sortedRanking;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_ranking'
      });
      return [];
    }
  }

  /**
   * Encontra casais (matches) baseado em "pego" mútuo
   */
  async getMatches(groupId: string, userNames: Map<string, string>): Promise<MatchData[]> {
    try {
      const game = await this.findLastGameByGroupId(groupId);
      if (!game) return [];

      const matches: MatchData[] = [];
      const pegoReactions = game.reactions.filter(r => r.reactionType === 'pego');

      // Obter lista de participantes (quem enviou fotos)
      const participants = [...new Set(game.submissions.map(s => s.senderJid))];
      
      // Criar mapa de quem marcou "pego" em quem
      const pegoMap = new Map<string, Set<string>>();
      
      // Para cada reação "pego", associar ao participante mais recente
      // (assumindo que as reações são feitas nas fotos na ordem que foram enviadas)
      let currentPhotoIndex = 0;
      
      pegoReactions.forEach((reaction, index) => {
        if (!pegoMap.has(reaction.reactorJid)) {
          pegoMap.set(reaction.reactorJid, new Set());
        }
        
        // Associar reação ao participante correspondente
        if (currentPhotoIndex < participants.length) {
          const targetParticipant = participants[currentPhotoIndex];
          pegoMap.get(reaction.reactorJid)!.add(targetParticipant);
        }
        
        // Avançar para próxima foto a cada 3 reações (pego, penso, passo)
        if ((index + 1) % 3 === 0) {
          currentPhotoIndex++;
        }
      });

      // Procura por matches mútuos
      const processedPairs = new Set<string>();
      
      for (const [user1, user1Pegos] of pegoMap.entries()) {
        for (const user2 of user1Pegos) {
          if (user1 === user2) continue; // Não pode marcar "pego" em si mesmo
          
          const pairKey = [user1, user2].sort().join('-');
          if (processedPairs.has(pairKey)) continue;
          
          const user2Pegos = pegoMap.get(user2);
          if (user2Pegos && user2Pegos.has(user1)) {
            // Match encontrado!
            matches.push({
              user1Jid: user1,
              user1Name: userNames.get(user1) || user1.split('@')[0],
              user2Jid: user2,
              user2Name: userNames.get(user2) || user2.split('@')[0],
              mutualPego: true
            });
            
            processedPairs.add(pairKey);
          }
        }
      }

      return matches;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_matches'
      });
      return [];
    }
  }

  /**
   * Obtém lista detalhada de reações para envio no privado
   */
  async getDetailedReactionsList(groupId: string, userNames: Map<string, string>): Promise<string> {
    try {
      const game = await this.findLastGameByGroupId(groupId);
      if (!game) return 'Nenhum jogo encontrado.';

      const reactions = game.reactions;
      if (reactions.length === 0) return 'Nenhuma reação registrada ainda.';

      // Obter lista de participantes (quem enviou fotos)
      const participants = [...new Set(game.submissions.map(s => s.senderJid))];

      let report = `📊 *LISTA DETALHADA DE REAÇÕES - JOGO PPP*\n\n`;
      report += `📸 *Fotos reveladas:* ${game.submissions.length}\n`;
      report += `💬 *Total de reações:* ${reactions.length}\n`;
      report += `📅 *Data do jogo:* ${game.createdAt.toLocaleString('pt-BR')}\n\n`;

      // Associar reações aos participantes na ordem das fotos
      let currentPhotoIndex = 0;
      
      for (let i = 0; i < reactions.length; i += 3) {
        if (currentPhotoIndex < participants.length) {
          const participant = participants[currentPhotoIndex];
          const participantName = userNames.get(participant) || participant.split('@')[0];
          
          report += `📸 *Foto ${currentPhotoIndex + 1} - ${participantName}:*\n`;
          
          // Reações para esta foto (3 reações: pego, penso, passo)
          const photoReactions = reactions.slice(i, i + 3);
          photoReactions.forEach((reaction, index) => {
            const reactionType = ['Pego 😏', 'Penso 🤔', 'Passo 😵‍💫'][index];
            report += `   ${reactionType}: ${reaction.reactorJid.split('@')[0]}\n`;
          });
          
          report += `\n`;
          currentPhotoIndex++;
        }
      }

      return report;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_detailed_reactions_list'
      });
      return 'Erro ao gerar lista de reações.';
    }
  }

  // ==================== MÉTODOS DO JOGO DE CONFISSÃO ====================

  /**
   * Cria um novo jogo de confissão ativo para um grupo
   */
  async createConfessionGame(groupId: string, createdBy: string, groupName?: string): Promise<IGame> {
    try {
      // Verifica se já existe um jogo de confissão ativo para este grupo
      const existingGame = await Game.findOne({ groupId, isActive: true, gameName: 'confissao' });
      if (existingGame) {
        throw new Error('Já existe um confessionário ativo neste grupo');
      }

      const game = await Game.create({
        gameName: 'confissao',
        groupId,
        groupName,
        isActive: true,
        createdBy,
        confessions: [],
        confessionReactions: []
      });

      Logger.info('Jogo de confissão criado', {
        groupId,
        createdBy,
        gameId: game._id
      });

      return game;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        createdBy,
        action: 'create_confession_game'
      });
      throw error;
    }
  }

  /**
   * Finaliza um jogo de confissão ativo
   */
  async endConfessionGame(groupId: string): Promise<IGame | null> {
    try {
      const game = await Game.findOneAndUpdate(
        { groupId, isActive: true, gameName: 'confissao' },
        { isActive: false },
        { new: true }
      );

      if (game) {
        Logger.info('Jogo de confissão finalizado', {
          groupId,
          gameId: game._id,
          confessionsCount: game.confessions?.length || 0,
          reactionsCount: game.confessionReactions?.length || 0
        });
      }

      return game;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'end_confession_game'
      });
      throw error;
    }
  }

  /**
   * Busca um jogo de confissão ativo por grupo
   */
  async findActiveConfessionGameByGroupId(groupId: string): Promise<IGame | null> {
    try {
      return await Game.findOne({ groupId, isActive: true, gameName: 'confissao' });
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'find_active_confession_game'
      });
      throw error;
    }
  }

  /**
   * Busca o último jogo de confissão (ativo ou inativo) por grupo
   */
  async findLastConfessionGameByGroupId(groupId: string): Promise<IGame | null> {
    try {
      return await Game.findOne({ groupId, gameName: 'confissao' }).sort({ createdAt: -1 });
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'find_last_confession_game'
      });
      throw error;
    }
  }

  /**
   * Adiciona uma confissão ao jogo
   */
  async addConfession(groupId: string, confessionData: ConfessionData): Promise<IGame | null> {
    try {
      const game = await Game.findOneAndUpdate(
        { groupId, isActive: true, gameName: 'confissao' },
        { 
          $push: { 
            confessions: {
              senderJid: confessionData.senderJid,
              messageId: confessionData.messageId,
              confession: confessionData.confession,
              submittedAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (game) {
        Logger.info('Confissão adicionada ao jogo', {
          groupId,
          senderJid: confessionData.senderJid,
          confessionsCount: game.confessions?.length || 0
        });
      }

      return game;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        senderJid: confessionData.senderJid,
        action: 'add_confession'
      });
      throw error;
    }
  }

  /**
   * Adiciona uma reação de confissão ao jogo
   */
  async addConfessionReaction(groupId: string, reactionData: ConfessionReactionData): Promise<IGame | null> {
    try {
      console.log(`[DEBUG] Adicionando reação de confissão: ${reactionData.reactorJid} -> ${reactionData.reactionType} no grupo ${groupId}`);
      
      const game = await Game.findOneAndUpdate(
        { groupId, gameName: 'confissao' },
        { 
          $push: { 
            confessionReactions: {
              reactorJid: reactionData.reactorJid,
              reactionType: reactionData.reactionType,
              reactedAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (game) {
        console.log(`[DEBUG] Reação de confissão adicionada com sucesso. Total de reações: ${game.confessionReactions?.length || 0}`);
        Logger.info('Reação de confissão adicionada ao jogo', {
          groupId,
          reactorJid: reactionData.reactorJid,
          reactionType: reactionData.reactionType,
          reactionsCount: game.confessionReactions?.length || 0
        });
      } else {
        console.log(`[DEBUG] Jogo de confissão não encontrado para adicionar reação`);
      }

      return game;
    } catch (error) {
      console.error(`[ERROR] Erro ao adicionar reação de confissão:`, error);
      await ErrorLogger.logError(error as Error, {
        groupId,
        reactorJid: reactionData.reactorJid,
        action: 'add_confession_reaction'
      });
      throw error;
    }
  }

  /**
   * Obtém todas as confissões de um jogo
   */
  async getConfessions(groupId: string): Promise<any[]> {
    try {
      const game = await Game.findOne({ groupId, isActive: true, gameName: 'confissao' });
      return game?.confessions || [];
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_confessions'
      });
      throw error;
    }
  }

  /**
   * Obtém todas as reações de confissão de um jogo
   */
  async getConfessionReactions(groupId: string): Promise<any[]> {
    try {
      const game = await this.findLastConfessionGameByGroupId(groupId);
      console.log(`[DEBUG] Buscando reações de confissão para grupo ${groupId}. Jogo encontrado: ${!!game}, Reações: ${game?.confessionReactions?.length || 0}`);
      return game?.confessionReactions || [];
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_confession_reactions'
      });
      throw error;
    }
  }

  /**
   * Limpa as confissões de um jogo
   */
  async clearConfessions(groupId: string): Promise<IGame | null> {
    try {
      const game = await Game.findOneAndUpdate(
        { groupId, isActive: true, gameName: 'confissao' },
        { $set: { confessions: [] } },
        { new: true }
      );

      if (game) {
        Logger.info('Confissões do jogo limpas', {
          groupId,
          gameId: game._id
        });
      }

      return game;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'clear_confessions'
      });
      throw error;
    }
  }

  /**
   * Busca jogos de confissão ativos para um usuário
   */
  async findActiveConfessionGamesForUser(userJid: string): Promise<IGame[]> {
    try {
      // NOVO: Verificar se o MongoDB está conectado antes de tentar acessá-lo
      if (!this.dbService.isMongoConnected()) {
        console.log('[GameService] MongoDB não está conectado, retornando lista vazia de jogos');
        return [];
      }

      // Busca todos os grupos onde o usuário é membro
      const userGroups = await Group.find({
        members: userJid
      });

      const groupIds = userGroups.map(group => group.groupJid);

      let activeGames: IGame[] = [];
      if (groupIds.length > 0) {
        // Busca jogos ativos nesses grupos
        activeGames = await Game.find({
          groupId: { $in: groupIds },
          isActive: true,
          gameName: 'confissao'
        });
      }

      // Se não encontrou nenhum, busca todos os jogos de confissão ativos
      if (activeGames.length === 0) {
        activeGames = await Game.find({ isActive: true, gameName: 'confissao' });
      }

      return activeGames;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        userJid,
        action: 'find_active_confession_games_for_user'
      });
      throw error;
    }
  }

  /**
   * Verifica se um usuário já enviou confissão para um jogo
   */
  async hasUserSubmittedConfession(groupId: string, userJid: string): Promise<boolean> {
    try {
      const game = await Game.findOne({ groupId, isActive: true, gameName: 'confissao' });
      if (!game) return false;

      return game.confessions?.some(confession => confession.senderJid === userJid) || false;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        userJid,
        action: 'check_user_confession'
      });
      return false;
    }
  }

  /**
   * Obtém estatísticas do jogo de confissão
   */
  async getConfessionGameStats(groupId: string): Promise<{ totalConfessions: number; participants: string[] }> {
    try {
      const game = await Game.findOne({ groupId, isActive: true, gameName: 'confissao' });
      if (!game) {
        return { totalConfessions: 0, participants: [] };
      }

      const participants = [...new Set(game.confessions?.map(c => c.senderJid) || [])];

      return {
        totalConfessions: game.confessions?.length || 0,
        participants
      };
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_confession_game_stats'
      });
      return { totalConfessions: 0, participants: [] };
    }
  }

  /**
   * Gera ranking das confissões mais populares (mais "Eu Também!")
   */
  async getConfessionRanking(groupId: string): Promise<ConfessionRankingData[]> {
    try {
      const game = await this.findLastConfessionGameByGroupId(groupId);
      console.log(`[DEBUG] Gerando ranking de confissões para grupo ${groupId}. Jogo encontrado: ${!!game}, Reações: ${game?.confessionReactions?.length || 0}`);
      
      if (!game || !game.confessions) return [];

      const confessions = game.confessions;
      const reactions = game.confessionReactions || [];
      
      // Conta reações por confissão
      const confessionStats: ConfessionRankingData[] = confessions.map((confession, index) => {
        const confessionReactions = reactions.filter((r, i) => Math.floor(i / 3) === index);
        
        const euTambemCount = confessionReactions.filter(r => r.reactionType === 'euTambem').length;
        const chocadoCount = confessionReactions.filter(r => r.reactionType === 'chocado').length;
        const micoCount = confessionReactions.filter(r => r.reactionType === 'mico').length;
        
        return {
          confession: confession.confession,
          euTambemCount,
          chocadoCount,
          micoCount,
          totalReactions: confessionReactions.length
        };
      });

      // Ordena por quantidade de "Eu Também!" (decrescente)
      const sortedRanking = confessionStats.sort((a, b) => b.euTambemCount - a.euTambemCount);
      console.log(`[DEBUG] Ranking de confissões gerado:`, sortedRanking);
      
      return sortedRanking;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_confession_ranking'
      });
      return [];
    }
  }

  /**
   * Gera ranking das confissões mais chocantes (mais "Chocado(a)!")
   */
  async getShockingConfessions(groupId: string): Promise<ConfessionRankingData[]> {
    try {
      const game = await this.findLastConfessionGameByGroupId(groupId);
      if (!game || !game.confessions) return [];

      const confessions = game.confessions;
      const reactions = game.confessionReactions || [];
      
      // Conta reações por confissão
      const confessionStats: ConfessionRankingData[] = confessions.map((confession, index) => {
        const confessionReactions = reactions.filter((r, i) => Math.floor(i / 3) === index);
        
        const euTambemCount = confessionReactions.filter(r => r.reactionType === 'euTambem').length;
        const chocadoCount = confessionReactions.filter(r => r.reactionType === 'chocado').length;
        const micoCount = confessionReactions.filter(r => r.reactionType === 'mico').length;
        
        return {
          confession: confession.confession,
          euTambemCount,
          chocadoCount,
          micoCount,
          totalReactions: confessionReactions.length
        };
      });

      // Ordena por quantidade de "Chocado(a)!" (decrescente)
      const sortedRanking = confessionStats.sort((a, b) => b.chocadoCount - a.chocadoCount);
      
      return sortedRanking;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_shocking_confessions'
      });
      return [];
    }
  }

  /**
   * Gera ranking das confissões mais engraçadas (mais "Que Mico!")
   */
  async getFunnyConfessions(groupId: string): Promise<ConfessionRankingData[]> {
    try {
      const game = await this.findLastConfessionGameByGroupId(groupId);
      if (!game || !game.confessions) return [];

      const confessions = game.confessions;
      const reactions = game.confessionReactions || [];
      
      // Conta reações por confissão
      const confessionStats: ConfessionRankingData[] = confessions.map((confession, index) => {
        const confessionReactions = reactions.filter((r, i) => Math.floor(i / 3) === index);
        
        const euTambemCount = confessionReactions.filter(r => r.reactionType === 'euTambem').length;
        const chocadoCount = confessionReactions.filter(r => r.reactionType === 'chocado').length;
        const micoCount = confessionReactions.filter(r => r.reactionType === 'mico').length;
        
        return {
          confession: confession.confession,
          euTambemCount,
          chocadoCount,
          micoCount,
          totalReactions: confessionReactions.length
        };
      });

      // Ordena por quantidade de "Que Mico!" (decrescente)
      const sortedRanking = confessionStats.sort((a, b) => b.micoCount - a.micoCount);
      
      return sortedRanking;
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupId,
        action: 'get_funny_confessions'
      });
      return [];
    }
  }
}
 