import { WASocket, proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { getUserDisplayName } from '@/utils/userUtils';
import { GameService } from '@/services/GameService';
import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import { Group } from '@/database/models/GroupSchema';
import { TYPES } from '@/config/container';
import { ConfessionGame } from '../brincadeiras/confissao';

type WAMessage = proto.IWebMessageInfo;

// Sistema de gerenciamento de estado temporário para escolha de grupo
const pendingGroupChoices = new Map<string, { 
  options: Array<{ groupId: string; groupName: string; isCreatorGroup: boolean }>;
  photoData: { messageId: string; photoUrl: string; caption?: string };
  timestamp: number;
  step: 'confirm' | 'choose';
}>();

// Pasta para salvar fotos do jogo
const GAME_FOLDER = path.join(process.cwd(), 'jogos', 'ppp');

// Sistema de gerenciamento de estado temporário para escolha de grupo de confissão
const pendingConfessionChoices = new Map<string, { 
  options: Array<{ groupId: string; groupName: string; isCreatorGroup: boolean }>;
  confessionData: { messageId: string; confession: string };
  timestamp: number;
  step: 'confirm' | 'choose';
}>();

// Função para baixar e salvar foto do jogo
async function downloadGamePhoto(sock: WASocket, message: WAMessage, userJid: string): Promise<string> {
  try {
    const messageContent = message.message;
    if (!messageContent?.imageMessage) {
      throw new Error('Mensagem não contém imagem');
    }

    // Criar pasta se não existir
    if (!fs.existsSync(GAME_FOLDER)) {
      fs.mkdirSync(GAME_FOLDER, { recursive: true });
    }

    const mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
    const timestamp = Date.now();
    const userNumber = userJid.split('@')[0];
    const fileName = `ppp_${timestamp}_${userNumber}.jpg`;
    const filePath = path.join(GAME_FOLDER, fileName);
    
    fs.writeFileSync(filePath, mediaBuffer);
    
    return filePath;
  } catch (error) {
    console.error('[ERROR] Erro ao baixar foto do jogo:', error);
    throw error;
  }
}

@injectable()
export class BrincadeiraCommand implements ICommand {
  constructor(
    @inject(TYPES.GameService) private gameService: GameService
  ) {}

  name = 'brincadeira';
  aliases = ['jogo', 'game'];
  description = 'Gerencia o jogo Pego, Penso ou Passo (PPP) e Confissão (Confessionário Anônimo)';
  category: 'admin' = 'admin';
  usage = '!brincadeira ppp ativar - Ativa o jogo\n!brincadeira ppp enviar - Envia as fotos\n!brincadeira ppp status - Status do jogo\n!brincadeira confissao ativar - Ativa o jogo de Confissão\n!brincadeira confissao revelar - Revela as confissões\n!brincadeira confissao status - Status do jogo de Confissão\n!brincadeira confissao cancelar - Cancela o jogo de Confissão\n!brincadeira confissao encerrar - Finaliza o jogo de Confissão\n!brincadeira confissao ranking - Ver ranking dos mais chocantes\n!brincadeira confissao chocantes - Ver confissões chocantes\n!brincadeira confissao micos - Ver confissões engraçadas\n!brincadeira confissao resultado - Resultado completo do jogo de Confissão';

  async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const groupJid = message.key.remoteJid!;
      if (!groupJid.endsWith('@g.us')) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 O jogo só funciona em grupos! 💋' 
        });
        return;
      }

      const userJid = message.key.participant || '';
      if (!await canUseCommand(sock, groupJid, userJid, 'admin')) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, amor! 🚫 Esse comando é só pra admins. Você não tem essa permissão ainda.' 
        });
        return;
      }

      const gameType = args[0]?.toLowerCase();
      const action = args[1]?.toLowerCase();

      // Se não especificou jogo ou ação, mostrar lista de brincadeiras
      if (!gameType) {
        await this.showBrincadeirasList(sock, message, groupJid);
        return;
      }

      if (gameType !== 'ppp' && gameType !== 'confissao') {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Por enquanto só temos o jogo PPP (Pego, Penso ou Passo) e Confissão (Confessionário Anônimo)! 💋\n\n' +
                'Use:\n' +
                '• !brincadeira ppp - Para jogos PPP\n' +
                '• !brincadeira confissao - Para confessionário anônimo' 
        });
        return;
      }

      if (gameType === 'ppp') {
        if (action === 'ativar') {
          await this.activateGame(sock, message, groupJid, userJid);
        } else if (action === 'enviar') {
          await this.sendSubmissions(sock, message, groupJid, userJid);
        } else if (action === 'status') {
          await this.getGameStatus(sock, message, groupJid);
        } else if (action === 'cancelar') {
          await this.cancelGame(sock, message, groupJid, userJid);
        } else if (action === 'encerrar') {
          await this.finalizeGame(sock, message, groupJid, userJid);
        } else if (action === 'debug') {
          await this.debugGame(sock, message, groupJid, userJid);
        } else if (action === 'ranking') {
          await this.getRanking(sock, message, groupJid);
        } else if (action === 'casais') {
          await this.getMatches(sock, message, groupJid);
        } else if (action === 'resultado') {
          await this.getResults(sock, message, groupJid, userJid);
        } else if (action === 'lista') {
          await this.getDetailedList(sock, message, groupJid, userJid);
        } else {
          await this.showHelp(sock, message, groupJid);
        }
      } else if (gameType === 'confissao') {
        if (action === 'ativar') {
          await ConfessionGame.activate(sock, message, groupJid, userJid, this.gameService);
        } else if (action === 'revelar') {
          await ConfessionGame.reveal(sock, message, groupJid, userJid, this.gameService);
        } else if (action === 'status') {
          await ConfessionGame.getStatus(sock, message, groupJid, this.gameService);
        } else if (action === 'cancelar') {
          await ConfessionGame.cancel(sock, message, groupJid, userJid, this.gameService);
        } else if (action === 'encerrar') {
          await ConfessionGame.finalize(sock, message, groupJid, userJid, this.gameService);
        } else if (action === 'ranking') {
          await ConfessionGame.ranking(sock, message, groupJid, this.gameService);
        } else if (action === 'chocantes') {
          await ConfessionGame.chocantes(sock, message, groupJid, this.gameService);
        } else if (action === 'micos') {
          await ConfessionGame.micos(sock, message, groupJid, this.gameService);
        } else if (action === 'resultado') {
          await ConfessionGame.resultado(sock, message, groupJid, userJid, this.gameService);
        } else {
          await ConfessionGame.showHelp(sock, message, groupJid);
        }
      }

    } catch (error) {
      console.error('[ERROR] Erro no comando brincadeira:', error);
      await sock.sendMessage(message.key.remoteJid!, { 
        text: 'Eita, baby! 🫣 Deu um erro inesperado no jogo! Tenta de novo! Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧' 
      });
    }
  }

  private async activateGame(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      // Verificar se já existe um jogo ativo
      const existingGame = await this.gameService.findActiveGameByGroupId(groupJid);
      if (existingGame) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Já tem um jogo PPP ativo! Use !brincadeira ppp enviar para revelar as fotos! 💋' 
        });
        return;
      }

      // Finalizar qualquer jogo anterior (inativo) para limpar dados antigos
      const lastGame = await this.gameService.findLastGameByGroupId(groupJid);
      if (lastGame && lastGame.isActive === false) {
        // Jogo já está inativo, não precisa fazer nada
        console.log('[DEBUG] Jogo anterior já está inativo');
      }

      // Obter nome do grupo
      const groupMetadata = await sock.groupMetadata(groupJid);
      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      // Criar o jogo
      await this.gameService.createGame(groupJid, userJid, groupMetadata.subject);

      const activationMessage = `🔥 *JOGO PPP ATIVADO!* 🔥\n\n` +
                               `👑 @${adminName} ativou o jogo *Pego, Penso ou Passo*!\n\n` +
                               `📱 *Como participar:*\n` +
                               `• Me envie sua melhor foto no privado aqui pra mim (@Amanda)!\n` +
                               `• Adicione uma frase de efeito na legenda\n` +
                               `• Aguarde a revelação no grupo!\n\n` +
                               `💋 *Regras:*\n` +
                               `• Só fotos suas (nada de fotos de outras pessoas)\n` +
                               `• Frases criativas e engraçadas\n` +
                               `• Uma foto por pessoa\n\n` +
                               `⏰ *Prazo:* Até o admin usar !brincadeira ppp enviar\n\n` +
                               `_Vamos ver quem vai brilhar mais! 😈_`;

      await sock.sendMessage(groupJid, { 
        text: activationMessage,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao ativar jogo:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao ativar o jogo! Tenta de novo! Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧' 
      });
    }
  }

  private async sendSubmissions(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const submissions = await this.gameService.getSubmissions(groupJid);
      
      if (submissions.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: 'Ué, ninguém teve coragem? 🤷‍♀️ A fila tá vazia, ninguém me mandou foto no privado pra esse jogo. Que sem graça! 😒' 
        });
        return;
      }

      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);
      
      await sock.sendMessage(groupJid, { 
        text: `🎭 *REVELAÇÃO DO JOGO PPP!* 🎭\n\n` +
              `👑 @${adminName} vai revelar ${submissions.length} foto(s)!\n\n` +
              `_Preparados para julgar? 😈_`,
        mentions: [userJid]
      });

      // Aguardar um pouco antes de começar
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Enviar cada submissão
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i];
        
        try {
          // Verificar se o arquivo existe
          if (!fs.existsSync(submission.photoUrl)) {
            console.log(`[WARN] Arquivo não encontrado: ${submission.photoUrl}`);
            continue;
          }

          const photoBuffer = fs.readFileSync(submission.photoUrl);
          const userNumber = submission.senderJid.split('@')[0];
          
          const caption = `🎭 *PRÓXIMA BELDADE NA PISTA!* 🎭\n\n` +
                         `👤 @${userNumber}\n\n` +
                         `💬 *"${submission.caption || 'Sem legenda'}"*\n\n` +
                         `🤔 *E aí, galera? Reajam na foto:*\n` +
                         `😏 Pego | 🤔 Penso | 😵‍💫 Passo\n\n` +
                         `_Foto ${i + 1} de ${submissions.length}_`;

          await sock.sendMessage(groupJid, {
            image: photoBuffer,
            caption: caption,
            mentions: [submission.senderJid]
          });

          // Aguardar 30 segundos entre as fotos
          if (i < submissions.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 30000));
          }

        } catch (error) {
          console.error(`[ERROR] Erro ao enviar submissão ${i + 1}:`, error);
        }
      }

      // Finalizar o jogo
      await this.gameService.clearSubmissions(groupJid);

      await sock.sendMessage(groupJid, { 
        text: `🎉 *JOGO PPP FINALIZADO!* 🎉\n\n` +
              `✅ ${submissions.length} foto(s) revelada(s)\n` +
              `🔥 Espero que tenham aproveitado...\n` +
              `💋 E que os 'Pegos' rendam um bom papo no privado! 😏\n\n` +
              `📊 *Comandos disponíveis:*\n` +
              `• !brincadeira ppp ranking - Ver ranking\n` +
              `• !brincadeira ppp casais - Ver casais\n` +
              `• !brincadeira ppp resultado - Resultado completo\n` +
              `• !brincadeira ppp lista - Lista detalhada\n\n` +
              `_Até a próxima! 🔥_` 
      });

    } catch (error) {
      console.error('[ERROR] Erro ao enviar submissões:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao enviar as fotos! Tenta de novo! 💋' 
      });
    }
  }

  private async getGameStatus(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    try {
      const game = await this.gameService.findActiveGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *STATUS DO JOGO PPP*\n\n❌ Nenhum jogo ativo no momento.' 
        });
        return;
      }

      const stats = await this.gameService.getGameStats(groupJid);
      
      const statusMessage = `📊 *STATUS DO JOGO PPP*\n\n` +
                           `🟢 *Status:* Ativo\n` +
                           `📸 *Fotos recebidas:* ${stats.totalSubmissions}\n` +
                           `👥 *Participantes:* ${stats.participants.length}\n` +
                           `⏰ *Criado em:* ${game.createdAt.toLocaleString('pt-BR')}\n\n` +
                           `_Use !brincadeira ppp enviar para revelar as fotos!_`;

      await sock.sendMessage(groupJid, { 
        text: statusMessage
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter status:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao verificar o status! 💋' 
      });
    }
  }

  private async cancelGame(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const game = await this.gameService.findActiveGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Não há jogo ativo para cancelar! 💋' 
        });
        return;
      }

      const stats = await this.gameService.getGameStats(groupJid);
      await this.gameService.clearSubmissions(groupJid);

      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      await sock.sendMessage(groupJid, { 
        text: `🛑 *JOGO PPP CANCELADO!* 🛑\n\n` +
              `👑 @${adminName} cancelou o jogo\n` +
              `📸 ${stats.totalSubmissions} foto(s) descartada(s)\n` +
              `👥 ${stats.participants.length} participante(s) afetado(s)\n\n` +
              `_Jogo encerrado sem revelação._`,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao cancelar jogo:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao cancelar o jogo! 💋' 
      });
    }
  }

  private async showHelp(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    const helpMessage = `🎮 *COMANDO BRINCADEIRA - AJUDA* 🎮\n\n` +
                        `📝 *Jogos disponíveis:*\n` +
                        `🎭 *PPP (Pego, Penso ou Passo):*\n` +
                        `• 🔥 !brincadeira ppp ativar - Ativa o jogo PPP\n` +
                        `• 🎭 !brincadeira ppp enviar - Revela as fotos\n` +
                        `• 📊 !brincadeira ppp status - Status do jogo\n` +
                        `• 🛑 !brincadeira ppp cancelar - Cancela o jogo\n` +
                        `• 🚫 !brincadeira ppp encerrar - Finaliza o jogo\n` +
                        `• 🏆 !brincadeira ppp ranking - Ver ranking dos mais pegos\n` +
                        `• 💕 !brincadeira ppp casais - Ver casais formados\n` +
                        `• 📈 !brincadeira ppp resultado - Resultado completo\n` +
                        `• 📋 !brincadeira ppp lista - Lista detalhada (privado)\n` +
                        `\n` +
                        `🤫 *Confessionário Anônimo:*\n` +
                        `• 🤫 !brincadeira confissao ativar - Ativa o confessionário\n` +
                        `• 🎭 !brincadeira confissao revelar - Revela as confissões\n` +
                        `• 📊 !brincadeira confissao status - Status do confessionário\n` +
                        `• 🛑 !brincadeira confissao cancelar - Cancela o confessionário\n` +
                        `• 🚫 !brincadeira confissao encerrar - Finaliza o confessionário\n` +
                        `• 🏆 !brincadeira confissao ranking - Ver ranking dos populares\n` +
                        `• 😱 !brincadeira confissao chocantes - Ver confissões chocantes\n` +
                        `• 😂 !brincadeira confissao micos - Ver maiores micos\n` +
                        `• 📈 !brincadeira confissao resultado - Resultado completo (privado)\n` +
                        `\n` +
                        `🎮 *Como funcionam:*\n` +
                        `🎭 *PPP:* Usuários enviam fotos no privado, admin revela, galera reage\n` +
                        `🤫 *Confessionário:* Usuários enviam confissões no privado, admin revela anonimamente\n` +
                        `\n` +
                        `⚠️ *ATENÇÃO:* Apenas admins podem usar estes comandos!`;

    await sock.sendMessage(groupJid, { 
      text: helpMessage
    });
  }

  private async getRanking(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *RANKING PPP*\n\n❌ Nenhum jogo encontrado.' 
        });
        return;
      }

      // Obter nomes dos usuários
      const userNames = new Map<string, string>();
      try {
        const groupMetadata = await sock.groupMetadata(groupJid);
        groupMetadata.participants.forEach(participant => {
          userNames.set(participant.id, participant.name || participant.id.split('@')[0]);
        });
      } catch (error) {
        console.error('[ERROR] Erro ao obter nomes dos usuários:', error);
      }

      const ranking = await this.gameService.getRanking(groupJid, userNames);
      
      if (ranking.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *RANKING PPP*\n\n😏 Nenhuma reação "Pego" registrada ainda!' 
        });
        return;
      }

      let rankingMessage = `🏆 *RANKING PPP - TOP PEGOS* 🏆\n\n`;
      rankingMessage += `📅 *Jogo de:* ${game.createdAt.toLocaleString('pt-BR')}\n\n`;
      
      // Mostra top 5
      const top5 = ranking.slice(0, 5);
      top5.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        rankingMessage += `${medal} *${index + 1}º Lugar:* ${user.userName}\n`;
        rankingMessage += `   😏 ${user.pegoCount} pego(s)\n\n`;
      });

      if (ranking.length > 5) {
        rankingMessage += `_... e mais ${ranking.length - 5} participantes!_`;
      }

      await sock.sendMessage(groupJid, { 
        text: rankingMessage
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter ranking:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao gerar o ranking! 💋' 
      });
    }
  }

  private async getMatches(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '💕 *CASAIS PPP*\n\n❌ Nenhum jogo encontrado.' 
        });
        return;
      }

      // Obter nomes dos usuários
      const userNames = new Map<string, string>();
      try {
        const groupMetadata = await sock.groupMetadata(groupJid);
        groupMetadata.participants.forEach(participant => {
          userNames.set(participant.id, participant.name || participant.id.split('@')[0]);
        });
      } catch (error) {
        console.error('[ERROR] Erro ao obter nomes dos usuários:', error);
      }

      const matches = await this.gameService.getMatches(groupJid, userNames);
      
      if (matches.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: '💕 *CASAIS PPP*\n\n😔 Nenhum casal formado ainda! Ninguém marcou "Pego" mútuo.' 
        });
        return;
      }

      let matchesMessage = `💕 *CASAIS FORMADOS - PPP* 💕\n\n`;
      matchesMessage += `📅 *Jogo de:* ${game.createdAt.toLocaleString('pt-BR')}\n`;
      matchesMessage += `🔥 *${matches.length} casal(is) encontrado(s):*\n\n`;
      
      matches.forEach((match, index) => {
        matchesMessage += `💘 *Casal ${index + 1}:*\n`;
        matchesMessage += `   👫 ${match.user1Name} + ${match.user2Name}\n`;
        matchesMessage += `   😏 Pego mútuo confirmado!\n\n`;
      });

      matchesMessage += `_Que romance! 💋_`;

      await sock.sendMessage(groupJid, { 
        text: matchesMessage
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter casais:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao encontrar os casais! 💋' 
      });
    }
  }

  private async getResults(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *RESULTADO PPP*\n\n❌ Nenhum jogo encontrado.' 
        });
        return;
      }

      // Obter nomes dos usuários
      const userNames = new Map<string, string>();
      try {
        const groupMetadata = await sock.groupMetadata(groupJid);
        groupMetadata.participants.forEach(participant => {
          userNames.set(participant.id, participant.name || participant.id.split('@')[0]);
        });
      } catch (error) {
        console.error('[ERROR] Erro ao obter nomes dos usuários:', error);
      }

      const ranking = await this.gameService.getRanking(groupJid, userNames);
      const matches = await this.gameService.getMatches(groupJid, userNames);
      const reactions = await this.gameService.getReactions(groupJid);
      
      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      let resultsMessage = `🎉 *RESULTADO FINAL - JOGO PPP* 🎉\n\n`;
      resultsMessage += `👑 @${adminName} apresenta os resultados!\n`;
      resultsMessage += `📅 *Data do jogo:* ${game.createdAt.toLocaleString('pt-BR')}\n\n`;
      
      // Estatísticas gerais
      const pegoCount = reactions.filter(r => r.reactionType === 'pego').length;
      const totalReactions = reactions.length;
      
      resultsMessage += `📊 *ESTATÍSTICAS:*\n`;
      resultsMessage += `📸 Fotos reveladas: ${game.submissions.length}\n`;
      resultsMessage += `😏 Total de "Pego": ${pegoCount}\n`;
      resultsMessage += `💕 Casais formados: ${matches.length}\n\n`;

      // Top 3 do ranking
      if (ranking.length > 0) {
        resultsMessage += `🏆 *TOP 3 MAIS PEGOS:*\n`;
        const top3 = ranking.slice(0, 3);
        top3.forEach((user, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
          resultsMessage += `${medal} ${user.userName} (${user.pegoCount} pego(s))\n`;
        });
        resultsMessage += `\n`;
      }

      // Casais formados
      if (matches.length > 0) {
        resultsMessage += `💕 *CASAIS FORMADOS:*\n`;
        matches.forEach((match, index) => {
          resultsMessage += `💘 ${match.user1Name} + ${match.user2Name}\n`;
        });
        resultsMessage += `\n`;
      }

      resultsMessage += `_Parabéns a todos os participantes! 🔥_`;

      await sock.sendMessage(groupJid, { 
        text: resultsMessage,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter resultados:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao gerar os resultados! 💋' 
      });
    }
  }

  private async getDetailedList(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📋 *LISTA DETALHADA PPP*\n\n❌ Nenhum jogo encontrado.' 
        });
        return;
      }

      // Obter nomes dos usuários
      const userNames = new Map<string, string>();
      try {
        const groupMetadata = await sock.groupMetadata(groupJid);
        groupMetadata.participants.forEach(participant => {
          userNames.set(participant.id, participant.name || participant.id.split('@')[0]);
        });
      } catch (error) {
        console.error('[ERROR] Erro ao obter nomes dos usuários:', error);
      }

      const detailedList = await this.gameService.getDetailedReactionsList(groupJid, userNames);
      
      // Enviar no privado do admin
      await sock.sendMessage(userJid, { 
        text: detailedList
      });

      // Confirmar no grupo
      await sock.sendMessage(groupJid, { 
        text: `📋 *LISTA DETALHADA PPP*\n\n✅ Lista enviada no seu privado, @${userJid.split('@')[0]}!`,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter lista detalhada:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao gerar a lista detalhada! 💋' 
      });
    }
  }

  private async finalizeGame(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const game = await this.gameService.findActiveGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Não há jogo ativo para finalizar! 💋' 
        });
        return;
      }

      const stats = await this.gameService.getGameStats(groupJid);
      await this.gameService.clearSubmissions(groupJid);
      await this.gameService.endGame(groupJid);

      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      await sock.sendMessage(groupJid, { 
        text: `🛑 *JOGO PPP FINALIZADO!* 🛑\n\n` +
              `👑 @${adminName} finalizou o jogo\n` +
              `📸 ${stats.totalSubmissions} foto(s) descartada(s)\n` +
              `👥 ${stats.participants.length} participante(s) afetado(s)\n\n` +
              `_Jogo encerrado sem revelação._`,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao finalizar jogo:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao finalizar o jogo! 💋' 
      });
    }
  }

  private async debugGame(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '🔍 *DEBUG PPP*\n\n❌ Nenhum jogo encontrado.' 
        });
        return;
      }

      const reactions = await this.gameService.getReactions(groupJid);
      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      let debugMessage = `🔍 *DEBUG PPP - DADOS DO JOGO* 🔍\n\n`;
      debugMessage += `👑 @${adminName} solicitou debug\n\n`;
      debugMessage += `📊 *INFORMAÇÕES DO JOGO:*\n`;
      debugMessage += `🆔 ID: ${game._id}\n`;
      debugMessage += `📅 Criado em: ${game.createdAt.toLocaleString('pt-BR')}\n`;
      debugMessage += `📸 Fotos: ${game.submissions.length}\n`;
      debugMessage += `💬 Reações: ${reactions.length}\n`;
      debugMessage += `🟢 Ativo: ${game.isActive ? 'Sim' : 'Não'}\n\n`;

      if (reactions.length > 0) {
        debugMessage += `📋 *DETALHES DAS REAÇÕES:*\n`;
        reactions.forEach((reaction, index) => {
          debugMessage += `${index + 1}. ${reaction.reactorJid} -> ${reaction.reactionType}\n`;
        });
      } else {
        debugMessage += `📋 *REAÇÕES:* Nenhuma reação registrada\n`;
      }

      // Enviar no privado do admin
      await sock.sendMessage(userJid, { 
        text: debugMessage
      });

      // Confirmar no grupo
      await sock.sendMessage(groupJid, { 
        text: `🔍 *DEBUG PPP*\n\n✅ Debug enviado no seu privado, @${userJid.split('@')[0]}!`,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao executar debug:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao executar o debug! 💋' 
      });
    }
  }

  private async activateConfessionGame(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      // Verificar se já existe um jogo ativo
      const existingGame = await this.gameService.findActiveConfessionGameByGroupId(groupJid);
      if (existingGame) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Já tem um Confessionário ativo! Use !brincadeira confissao revelar para revelar as confissões! 💋' 
        });
        return;
      }

      // Obter nome do grupo
      const groupMetadata = await sock.groupMetadata(groupJid);
      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      // Criar o jogo
      await this.gameService.createConfessionGame(groupJid, userJid, groupMetadata.subject);

      const activationMessage = `🤫 *CONFESSIONÁRIO ABERTO!* 🤫\n\n` +
                               `👑 @${adminName} abriu o confessionário anônimo!\n\n` +
                               `📱 *Como participar:*\n` +
                               `• Me envie uma confissão no privado aqui pra mim (@Amanda)!\n` +
                               `• Pode ser um segredo, um mico ou uma frase "Eu Nunca..."\n` +
                               `• Seja criativo e honesto (mas pegue leve!)\n\n` +
                               `💬 *Exemplos:*\n` +
                               `• "Eu já comi pizza com ketchup."\n` +
                               `• "Eu nunca colei em uma prova."\n` +
                               `• "Uma vez, chamei a sogra pelo nome da ex."\n\n` +
                               `⏰ *Prazo:* Até o admin usar !brincadeira confissao revelar\n\n` +
                               `_Vamos ver quem vai se revelar mais! 😈_`;

      await sock.sendMessage(groupJid, { 
        text: activationMessage,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao ativar jogo de confissão:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao ativar o confessionário! Tenta de novo! Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧' 
      });
    }
  }

  private async revealConfessions(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const confessions = await this.gameService.getConfessions(groupJid);
      
      if (confessions.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: 'Ué, ninguém teve coragem de confessar? 🤷‍♀️ A fila tá vazia, ninguém me mandou confissão no privado pra esse jogo. Que sem graça! 😒' 
        });
        return;
      }

      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);
      
      await sock.sendMessage(groupJid, { 
        text: `🤫 *REVELAÇÃO DO CONFESSIONÁRIO!* 🤫\n\n` +
              `👑 @${adminName} vai revelar ${confessions.length} confissão(ões)!\n\n` +
              `_Preparados para se chocar? 😈_`,
        mentions: [userJid]
      });

      // Aguardar um pouco antes de começar
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Enviar cada confissão
      for (let i = 0; i < confessions.length; i++) {
        const confession = confessions[i];
        
        const confessionMessage = `🤫 *CONFISSÃO ANÔNIMA #${i + 1}* 🤫\n\n` +
                                 `💬 *"${confession.confession}"*\n\n` +
                                 `🤔 *E aí, galera? Reajam na confissão:*\n` +
                                 `🙋‍♂️ Eu Também! | 😱 Chocado(a)! | 😂 Que Mico!\n\n` +
                                 `_Confissão ${i + 1} de ${confessions.length}_`;

        await sock.sendMessage(groupJid, {
          text: confessionMessage
        });

        // Aguardar 30 segundos entre as confissões
        if (i < confessions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }

      // Finalizar o jogo
      await this.gameService.clearConfessions(groupJid);

      await sock.sendMessage(groupJid, { 
        text: `🎉 *CONFESSIONÁRIO FINALIZADO!* 🎉\n\n` +
              `✅ ${confessions.length} confissão(ões) revelada(s)\n` +
              `🔥 Espero que tenham aproveitado...\n` +
              `💋 E que as confissões rendam um bom papo! 😏\n\n` +
              `📊 *Comandos disponíveis:*\n` +
              `• !brincadeira confissao ranking - Ver ranking\n` +
              `• !brincadeira confissao chocantes - Ver chocantes\n` +
              `• !brincadeira confissao micos - Ver micos\n` +
              `• !brincadeira confissao resultado - Resultado completo\n\n` +
              `_Até a próxima! 🔥_` 
      });

    } catch (error) {
      console.error('[ERROR] Erro ao revelar confissões:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao revelar as confissões! Tenta de novo! 💋' 
      });
    }
  }

  private async getConfessionGameStatus(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    try {
      const game = await this.gameService.findActiveConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *STATUS DO CONFESSIONÁRIO*\n\n❌ Nenhum confessionário ativo no momento.' 
        });
        return;
      }

      const stats = await this.gameService.getConfessionGameStats(groupJid);
      
      const statusMessage = `📊 *STATUS DO CONFESSIONÁRIO*\n\n` +
                           `🟢 *Status:* Ativo\n` +
                           `🤫 *Confissões recebidas:* ${stats.totalConfessions}\n` +
                           `👥 *Participantes:* ${stats.participants.length}\n` +
                           `⏰ *Criado em:* ${game.createdAt.toLocaleString('pt-BR')}\n\n` +
                           `_Use !brincadeira confissao revelar para revelar as confissões!_`;

      await sock.sendMessage(groupJid, { 
        text: statusMessage
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter status do confessionário:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao verificar o status! 💋' 
      });
    }
  }

  private async cancelConfessionGame(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const game = await this.gameService.findActiveConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Não há confessionário ativo para cancelar! 💋' 
        });
        return;
      }

      const stats = await this.gameService.getConfessionGameStats(groupJid);
      await this.gameService.clearConfessions(groupJid);

      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      await sock.sendMessage(groupJid, { 
        text: `🛑 *CONFESSIONÁRIO CANCELADO!* 🛑\n\n` +
              `👑 @${adminName} cancelou o confessionário\n` +
              `🤫 ${stats.totalConfessions} confissão(ões) descartada(s)\n` +
              `👥 ${stats.participants.length} participante(s) afetado(s)\n\n` +
              `_Confessionário encerrado sem revelação._`,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao cancelar confessionário:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao cancelar o confessionário! 💋' 
      });
    }
  }

  private async finalizeConfessionGame(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const game = await this.gameService.findActiveConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Não há confessionário ativo para finalizar! 💋' 
        });
        return;
      }

      const stats = await this.gameService.getConfessionGameStats(groupJid);
      await this.gameService.clearConfessions(groupJid);
      await this.gameService.endConfessionGame(groupJid);

      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      await sock.sendMessage(groupJid, { 
        text: `🛑 *CONFESSIONÁRIO FINALIZADO!* 🛑\n\n` +
              `👑 @${adminName} finalizou o confessionário\n` +
              `🤫 ${stats.totalConfessions} confissão(ões) descartada(s)\n` +
              `👥 ${stats.participants.length} participante(s) afetado(s)\n\n` +
              `_Confessionário encerrado sem revelação._`,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao finalizar confessionário:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao finalizar o confessionário! 💋' 
      });
    }
  }

  private async getConfessionRanking(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *RANKING DO CONFESSIONÁRIO*\n\n❌ Nenhum confessionário encontrado.' 
        });
        return;
      }

      const ranking = await this.gameService.getConfessionRanking(groupJid);
      
      if (ranking.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *RANKING DO CONFESSIONÁRIO*\n\n🙋‍♂️ Nenhuma reação "Eu Também!" registrada ainda!' 
        });
        return;
      }

      let rankingMessage = `🏆 *RANKING CONFESSIONÁRIO - TOP POPULARES* 🏆\n\n`;
      rankingMessage += `📅 *Confessionário de:* ${game.createdAt.toLocaleString('pt-BR')}\n\n`;
      
      // Mostra top 3
      const top3 = ranking.slice(0, 3);
      top3.forEach((confession, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        rankingMessage += `${medal} *${index + 1}º Lugar:*\n`;
        rankingMessage += `   💬 "${confession.confession}"\n`;
        rankingMessage += `   🙋‍♂️ ${confession.euTambemCount} "Eu Também!"\n\n`;
      });

      if (ranking.length > 3) {
        rankingMessage += `_... e mais ${ranking.length - 3} confissões!_`;
      }

      await sock.sendMessage(groupJid, { 
        text: rankingMessage
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter ranking do confessionário:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao gerar o ranking! 💋' 
      });
    }
  }

  private async getShockingConfessions(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '😱 *CONFISSÕES CHOCANTES*\n\n❌ Nenhum confessionário encontrado.' 
        });
        return;
      }

      const shocking = await this.gameService.getShockingConfessions(groupJid);
      
      if (shocking.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: '😱 *CONFISSÕES CHOCANTES*\n\n😱 Nenhuma reação "Chocado(a)!" registrada ainda!' 
        });
        return;
      }

      let shockingMessage = `😱 *CONFISSÕES MAIS CHOCANTES* 😱\n\n`;
      shockingMessage += `📅 *Confessionário de:* ${game.createdAt.toLocaleString('pt-BR')}\n\n`;
      
      // Mostra top 3
      const top3 = shocking.slice(0, 3);
      top3.forEach((confession, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        shockingMessage += `${medal} *${index + 1}º Lugar:*\n`;
        shockingMessage += `   💬 "${confession.confession}"\n`;
        shockingMessage += `   😱 ${confession.chocadoCount} "Chocado(a)!"\n\n`;
      });

      if (shocking.length > 3) {
        shockingMessage += `_... e mais ${shocking.length - 3} confissões chocantes!_`;
      }

      await sock.sendMessage(groupJid, { 
        text: shockingMessage
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter confissões chocantes:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao buscar as confissões chocantes! 💋' 
      });
    }
  }

  private async getFunnyConfessions(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '😂 *CONFISSÕES ENGRAÇADAS*\n\n❌ Nenhum confessionário encontrado.' 
        });
        return;
      }

      const funny = await this.gameService.getFunnyConfessions(groupJid);
      
      if (funny.length === 0) {
        await sock.sendMessage(groupJid, { 
          text: '😂 *CONFISSÕES ENGRAÇADAS*\n\n😂 Nenhuma reação "Que Mico!" registrada ainda!' 
        });
        return;
      }

      let funnyMessage = `😂 *MAIORES MICOS DO CONFESSIONÁRIO* 😂\n\n`;
      funnyMessage += `📅 *Confessionário de:* ${game.createdAt.toLocaleString('pt-BR')}\n\n`;
      
      // Mostra top 3
      const top3 = funny.slice(0, 3);
      top3.forEach((confession, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        funnyMessage += `${medal} *${index + 1}º Lugar:*\n`;
        funnyMessage += `   💬 "${confession.confession}"\n`;
        funnyMessage += `   😂 ${confession.micoCount} "Que Mico!"\n\n`;
      });

      if (funny.length > 3) {
        funnyMessage += `_... e mais ${funny.length - 3} micos engraçados!_`;
      }

      await sock.sendMessage(groupJid, { 
        text: funnyMessage
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter confissões engraçadas:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao buscar os micos! 💋' 
      });
    }
  }

  private async getConfessionResults(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      const game = await this.gameService.findLastConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *RESULTADO DO CONFESSIONÁRIO*\n\n❌ Nenhum confessionário encontrado.' 
        });
        return;
      }

      const ranking = await this.gameService.getConfessionRanking(groupJid);
      const shocking = await this.gameService.getShockingConfessions(groupJid);
      const funny = await this.gameService.getFunnyConfessions(groupJid);
      const reactions = await this.gameService.getConfessionReactions(groupJid);
      
      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);

      let resultsMessage = `🎉 *RESULTADO FINAL - CONFESSIONÁRIO* 🎉\n\n`;
      resultsMessage += `👑 @${adminName} apresenta os resultados!\n`;
      resultsMessage += `📅 *Data do confessionário:* ${game.createdAt.toLocaleString('pt-BR')}\n\n`;
      
      // Estatísticas gerais
      const euTambemCount = reactions.filter(r => r.reactionType === 'euTambem').length;
      const chocadoCount = reactions.filter(r => r.reactionType === 'chocado').length;
      const micoCount = reactions.filter(r => r.reactionType === 'mico').length;
      const totalReactions = reactions.length;
      
      resultsMessage += `📊 *ESTATÍSTICAS:*\n`;
      resultsMessage += `🤫 Confissões reveladas: ${game.confessions.length}\n`;
      resultsMessage += `🙋‍♂️ Total de "Eu Também!": ${euTambemCount}\n`;
      resultsMessage += `😱 Total de "Chocado(a)!": ${chocadoCount}\n`;
      resultsMessage += `😂 Total de "Que Mico!": ${micoCount}\n\n`;

      // Top confissão popular
      if (ranking.length > 0) {
        resultsMessage += `🏆 *CONFISSÃO MAIS POPULAR:*\n`;
        resultsMessage += `💬 "${ranking[0].confession}"\n`;
        resultsMessage += `🙋‍♂️ ${ranking[0].euTambemCount} "Eu Também!"\n\n`;
      }

      // Top confissão chocante
      if (shocking.length > 0) {
        resultsMessage += `😱 *CONFISSÃO MAIS CHOCANTE:*\n`;
        resultsMessage += `💬 "${shocking[0].confession}"\n`;
        resultsMessage += `😱 ${shocking[0].chocadoCount} "Chocado(a)!"\n\n`;
      }

      // Top mico
      if (funny.length > 0) {
        resultsMessage += `😂 *MAIOR MICO:*\n`;
        resultsMessage += `💬 "${funny[0].confession}"\n`;
        resultsMessage += `😂 ${funny[0].micoCount} "Que Mico!"\n\n`;
      }

      resultsMessage += `_Parabéns a todos os corajosos que confessaram! 🔥_`;

      // Enviar no privado do admin para não expor ninguém
      await sock.sendMessage(userJid, { 
        text: resultsMessage
      });

      // Confirmar no grupo
      await sock.sendMessage(groupJid, { 
        text: `📊 *RESULTADO DO CONFESSIONÁRIO*\n\n✅ Resultado completo enviado no seu privado, @${userJid.split('@')[0]}!`,
        mentions: [userJid]
      });

    } catch (error) {
      console.error('[ERROR] Erro ao obter resultados do confessionário:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao gerar os resultados! 💋' 
      });
    }
  }

  private async showConfessionHelp(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    const helpMessage = `🤫 *COMANDO CONFESSIONÁRIO - AJUDA* 🤫\n\n` +
                        `📝 *Como usar:*\n` +
                        `• 🤫 !brincadeira confissao ativar - Ativa o confessionário\n` +
                        `• 🎭 !brincadeira confissao revelar - Revela as confissões\n` +
                        `• 📊 !brincadeira confissao status - Status do confessionário\n` +
                        `• 🛑 !brincadeira confissao cancelar - Cancela o confessionário\n` +
                        `• 🚫 !brincadeira confissao encerrar - Finaliza o confessionário\n` +
                        `• 🏆 !brincadeira confissao ranking - Ver ranking dos populares\n` +
                        `• 😱 !brincadeira confissao chocantes - Ver confissões chocantes\n` +
                        `• 😂 !brincadeira confissao micos - Ver maiores micos\n` +
                        `• 📈 !brincadeira confissao resultado - Resultado completo (privado)\n` +
                        `\n` +
                        `🤫 *Jogo Confessionário Anônimo:*\n` +
                        `• Usuários enviam confissões no privado\n` +
                        `• Admin revela as confissões anonimamente\n` +
                        `• Galera reage: Eu Também! 🙋‍♂️, Chocado(a)! 😱, Que Mico! 😂\n` +
                        `• Dados ficam disponíveis até novo jogo\n\n` +
                        `⚠️ *ATENÇÃO:* Apenas admins podem usar este comando!`;

    await sock.sendMessage(groupJid, { 
      text: helpMessage
    });
  }

  private async showBrincadeirasList(sock: WASocket, message: WAMessage, groupJid: string): Promise<void> {
    const listMessage = `🎮 *LISTA DE BRINCADEIRAS* 🎮\n\n` +
                        `🎭 *PPP (Pego, Penso ou Passo):\n` +
                        `• 🔥 !brincadeira ppp ativar - Ativa o jogo PPP\n` +
                        `• 🎭 !brincadeira ppp enviar - Revela as fotos\n` +
                        `• 📊 !brincadeira ppp status - Status do jogo\n` +
                        `• 🛑 !brincadeira ppp cancelar - Cancela o jogo\n` +
                        `• 🚫 !brincadeira ppp encerrar - Finaliza o jogo\n` +
                        `• 🏆 !brincadeira ppp ranking - Ver ranking dos mais pegos\n` +
                        `• 💕 !brincadeira ppp casais - Ver casais formados\n` +
                        `• 📈 !brincadeira ppp resultado - Resultado completo\n` +
                        `• 📋 !brincadeira ppp lista - Lista detalhada (privado)\n\n` +
                        `🤫 *Confessionário Anônimo:\n` +
                        `• 🤫 !brincadeira confissao ativar - Ativa o confessionário\n` +
                        `• 🎭 !brincadeira confissao revelar - Revela as confissões\n` +
                        `• 📊 !brincadeira confissao status - Status do confessionário\n` +
                        `• 🛑 !brincadeira confissao cancelar - Cancela o confessionário\n` +
                        `• 🚫 !brincadeira confissao encerrar - Finaliza o confessionário\n` +
                        `• 🏆 !brincadeira confissao ranking - Ver ranking dos populares\n` +
                        `• 😱 !brincadeira confissao chocantes - Ver confissões chocantes\n` +
                        `• 😂 !brincadeira confissao micos - Ver maiores micos\n` +
                        `• 📈 !brincadeira confissao resultado - Resultado completo (privado)\n\n` +
                        `🎮 *Como funcionam:\n` +
                        `🎭 *PPP: Usuários enviam fotos no privado, admin revela, galera reage\n` +
                        `🤫 *Confessionário: Usuários enviam confissões no privado, admin revela anonimamente\n\n` +
                        `⚠️ *ATENÇÃO: Apenas admins podem usar estes comandos!`;

    await sock.sendMessage(groupJid, { 
      text: listMessage
    });
  }
}

// Exportar funções para uso no MessageManager
export async function handlePrivatePhotoSubmission(
  sock: WASocket, 
  message: WAMessage, 
  userJid: string,
  gameService: GameService
): Promise<void> {
  try {
    // FIX: Melhorar filtro para ignorar status, broadcast, lid e newsletter
    if (
      userJid.endsWith('@status') ||
      userJid.endsWith('@broadcast') ||
      userJid.endsWith('@lid') ||
      userJid.endsWith('@newsletter') ||
      userJid.endsWith('@g.us')
    ) {
      console.log('[DEBUG] Ignorando mensagem de status/broadcast/lid/newsletter/grupo:', userJid);
      return;
    }

    // FIX: Verificar se a mensagem é do próprio bot
    if (message.key.fromMe) {
      console.log('[DEBUG] Ignorando mensagem do próprio bot');
      return;
    }

    // FIX: Verificar se é realmente uma imagem
    if (!message.message?.imageMessage) {
      console.log('[DEBUG] Mensagem não contém imagem, ignorando');
      return;
    }

    console.log(`[DEBUG] Processando foto privada de ${userJid}`);

    // Buscar jogos ativos para o usuário
    const activeGames = await gameService.findActiveGamesForUser(userJid);
    
    if (activeGames.length === 0) {
      await sock.sendMessage(userJid, { 
        text: 'Uhm, gato(a), recebi sua foto, mas não encontrei nenhum grupo seu onde o "Pego, Penso ou Passo" esteja rolando. Tem certeza que seu admin já ativou a brincadeira com !brincadeira ppp ativar? 🤔' 
      });
      return;
    }

    // Baixar e salvar a foto
    const photoPath = await downloadGamePhoto(sock, message, userJid);
    const caption = message.message?.imageMessage?.caption || '';

    // Buscar grupos onde o usuário é membro
    const userGroups = await Group.find({ members: userJid });
    const userGroupIds = userGroups.map(g => g.groupJid);

    // Filtrar jogos ativos onde o usuário é membro
    const userActiveGames = activeGames.filter(game => userGroupIds.includes(game.groupId));

    if (userActiveGames.length === 0) {
      await sock.sendMessage(userJid, { 
        text: 'Eita, baby! 🫣 Encontrei jogos PPP ativos, mas você não é membro de nenhum deles! Que estranho... 💋' 
      });
      return;
    }

    // Para cada jogo ativo, verificar se o criador também é membro
    const validGames: Array<{ game: any; groupName: string; isCreatorGroup: boolean }> = [];
    
    for (const game of userActiveGames) {
      try {
        const groupDoc = await Group.findOne({ groupJid: game.groupId });
        if (groupDoc && groupDoc.members.includes(game.createdBy)) {
          // Ambos são membros do grupo
          validGames.push({
            game,
            groupName: game.groupName || groupDoc.name || 'Grupo Desconhecido',
            isCreatorGroup: true
          });
        }
      } catch (error) {
        console.error(`[ERROR] Erro ao verificar grupo ${game.groupId}:`, error);
      }
    }

    // Se não encontrou grupos onde ambos são membros, mostrar todos os grupos disponíveis
    if (validGames.length === 0) {
      // Mostrar TODOS os jogos ativos disponíveis, não apenas os do usuário
      const allAvailableGames = activeGames.map(game => ({
        game,
        groupName: game.groupName || 'Grupo Desconhecido',
        isCreatorGroup: false
      }));

      const options = allAvailableGames.map((game, index) => ({
        groupId: game.game.groupId,
        groupName: game.groupName,
        isCreatorGroup: false
      }));

      const choiceMessage = `Opa, que pessoa popular! 🔥 Vi que você tá em grupos onde a brincadeira tá rolando, mas não encontrei o admin que criou o jogo. Aqui estão TODOS os grupos com brincadeira ativa. Para qual grupo você quer enviar essa foto? Responda com o número:\n\n` +
                           options.map((option, index) => `${index + 1}. ${option.groupName}`).join('\n') +
                           `\n\n_Responda apenas com o número (ex: 1, 2, 3...)_`;

      await sock.sendMessage(userJid, { 
        text: choiceMessage
      });

      // Salvar estado temporário
      pendingGroupChoices.set(userJid, {
        options,
        photoData: {
          messageId: message.key.id!,
          photoUrl: photoPath,
          caption
        },
        timestamp: Date.now(),
        step: 'choose'
      });

      // Limpar escolhas antigas (mais de 5 minutos)
      setTimeout(() => {
        pendingGroupChoices.delete(userJid);
      }, 5 * 60 * 1000);
      
      return;
    }

    // Se encontrou apenas um grupo válido, confirmar
    if (validGames.length === 1) {
      const game = validGames[0];
      
      // Verificar se já enviou
      const hasSubmitted = await gameService.hasUserSubmitted(game.game.groupId, userJid);
      if (hasSubmitted) {
        await sock.sendMessage(userJid, { 
          text: 'Eita, baby! 🫣 Você já enviou uma foto para este jogo! Só uma por pessoa, tá? 💋' 
        });
        pendingGroupChoices.delete(userJid);
        return;
      }

      const confirmMessage = `Ui, que fotão! 😉 Encontrei o jogo PPP no grupo "${game.groupName}". Quer enviar sua foto para esse grupo?\n\n` +
                            `Responda:\n` +
                            `✅ Sim / 1 - Para confirmar\n` +
                            `❌ Não / 2 - Para ver outras opções`;

      await sock.sendMessage(userJid, { 
        text: confirmMessage
      });

      // Salvar estado temporário para confirmação
      pendingGroupChoices.set(userJid, {
        options: [{
          groupId: game.game.groupId,
          groupName: game.groupName,
          isCreatorGroup: true
        }],
        photoData: {
          messageId: message.key.id!,
          photoUrl: photoPath,
          caption
        },
        timestamp: Date.now(),
        step: 'confirm'
      });

      // Limpar escolhas antigas (mais de 5 minutos)
      setTimeout(() => {
        pendingGroupChoices.delete(userJid);
      }, 5 * 60 * 1000);
      
      return;
    }

    // Se encontrou múltiplos grupos válidos, perguntar qual
    const options = validGames.map(game => ({
      groupId: game.game.groupId,
      groupName: game.groupName,
      isCreatorGroup: true
    }));

    const choiceMessage = `Opa, que pessoa popular! 🔥 Vi que você tá em mais de um grupo onde a brincadeira tá rolando E o admin que criou também tá lá! Para qual grupo você quer enviar essa foto? Responda com o número:\n\n` +
                         options.map((option, index) => `${index + 1}. ${option.groupName}`).join('\n') +
                         `\n\n_Responda apenas com o número (ex: 1, 2, 3...)_`;

    await sock.sendMessage(userJid, { 
      text: choiceMessage
    });

    // Salvar estado temporário
    pendingGroupChoices.set(userJid, {
      options,
      photoData: {
        messageId: message.key.id!,
        photoUrl: photoPath,
        caption
      },
      timestamp: Date.now(),
      step: 'choose'
    });

    // Limpar escolhas antigas (mais de 5 minutos)
    setTimeout(() => {
      pendingGroupChoices.delete(userJid);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('[ERROR] Erro ao processar foto privada:', error);
    await sock.sendMessage(userJid, { 
      text: 'Eita, baby! 🫣 Deu erro ao processar sua foto! Tenta de novo! 💋' 
    });
  }
}

export async function handleGroupChoice(
  sock: WASocket,
  message: WAMessage,
  userJid: string,
  choice: string,
  gameService: GameService
): Promise<void> {
  try {
    const pendingChoice = pendingGroupChoices.get(userJid);
    if (!pendingChoice) {
      await sock.sendMessage(userJid, { 
        text: 'Eita, baby! 🫣 Não encontrei sua escolha pendente! Envie a foto novamente! 💋' 
      });
      return;
    }

    // Se está no passo de confirmação
    if (pendingChoice.step === 'confirm') {
      const response = choice.toLowerCase().trim();
      
      if (response === 'sim' || response === '1' || response === 's' || response === 'y') {
        // Usuário confirmou - salvar no grupo
        const selectedGroup = pendingChoice.options[0];
        
        // Verificar se já enviou
        const hasSubmitted = await gameService.hasUserSubmitted(selectedGroup.groupId, userJid);
        if (hasSubmitted) {
          await sock.sendMessage(userJid, { 
            text: 'Eita, baby! 🫣 Você já enviou uma foto para este jogo! Só uma por pessoa, tá? 💋' 
          });
          pendingGroupChoices.delete(userJid);
          return;
        }

        await gameService.addSubmission(selectedGroup.groupId, {
          senderJid: userJid,
          messageId: pendingChoice.photoData.messageId,
          photoUrl: pendingChoice.photoData.photoUrl,
          caption: pendingChoice.photoData.caption
        });

        await sock.sendMessage(userJid, { 
          text: `Perfeito! 😉 Foto enviada para o grupo "${selectedGroup.groupName}". Aguenta o coração aí! 💋` 
        });

        pendingGroupChoices.delete(userJid);
        return;
        
      } else if (response === 'não' || response === 'nao' || response === '2' || response === 'n' || response === 'no') {
        // Usuário não confirmou - mostrar todas as opções disponíveis
        const allActiveGames = await gameService.findActiveGamesForUser(userJid);

        if (allActiveGames.length === 0) {
          await sock.sendMessage(userJid, { 
            text: 'Eita, baby! 🫣 Não encontrei outros grupos disponíveis! 💋' 
          });
          pendingGroupChoices.delete(userJid);
          return;
        }

        const options = allActiveGames.map(game => ({
          groupId: game.groupId,
          groupName: game.groupName || 'Grupo Desconhecido',
          isCreatorGroup: false
        }));

        const choiceMessage = `Ok, baby! 😉 Aqui estão TODOS os grupos com brincadeira ativa:\n\n` +
                             options.map((option, index) => `${index + 1}. ${option.groupName}`).join('\n') +
                             `\n\n_Responda apenas com o número (ex: 1, 2, 3...)_`;

        await sock.sendMessage(userJid, { 
          text: choiceMessage
        });

        // Atualizar estado para escolha
        pendingGroupChoices.set(userJid, {
          options,
          photoData: pendingChoice.photoData,
          timestamp: Date.now(),
          step: 'choose'
        });
        
        return;
      } else {
        await sock.sendMessage(userJid, { 
          text: `Eita, baby! 🫣 Resposta inválida! Responda:\n✅ Sim / 1 - Para confirmar\n❌ Não / 2 - Para ver outras opções` 
        });
        return;
      }
    }

    // Se está no passo de escolha
    if (pendingChoice.step === 'choose') {
      const choiceNumber = parseInt(choice) - 1;
      if (choiceNumber < 0 || choiceNumber >= pendingChoice.options.length) {
        await sock.sendMessage(userJid, { 
          text: `Eita, baby! 🫣 Escolha inválida! Digite um número entre 1 e ${pendingChoice.options.length}! 💋` 
        });
        return;
      }

      const selectedGroup = pendingChoice.options[choiceNumber];
      
      // Verificar se já enviou
      const hasSubmitted = await gameService.hasUserSubmitted(selectedGroup.groupId, userJid);
      if (hasSubmitted) {
        await sock.sendMessage(userJid, { 
          text: 'Eita, baby! 🫣 Você já enviou uma foto para este jogo! Só uma por pessoa, tá? 💋' 
        });
        pendingGroupChoices.delete(userJid);
        return;
      }

      await gameService.addSubmission(selectedGroup.groupId, {
        senderJid: userJid,
        messageId: pendingChoice.photoData.messageId,
        photoUrl: pendingChoice.photoData.photoUrl,
        caption: pendingChoice.photoData.caption
      });

      await sock.sendMessage(userJid, { 
        text: `Perfeito! 😉 Foto enviada para o grupo "${selectedGroup.groupName}". Aguenta o coração aí! 💋` 
      });

      pendingGroupChoices.delete(userJid);
    }

  } catch (error) {
    console.error('[ERROR] Erro ao processar escolha de grupo:', error);
    await sock.sendMessage(userJid, { 
      text: 'Eita, baby! 🫣 Deu erro ao processar sua escolha! Tenta de novo! 💋' 
    });
  }
}

export function hasPendingChoice(userJid: string): boolean {
  return pendingGroupChoices.has(userJid);
}

// Exportar funções para uso no MessageManager - Confissões
export async function handlePrivateConfessionSubmission(
  sock: WASocket, 
  message: WAMessage, 
  userJid: string,
  gameService: GameService
): Promise<void> {
  try {
    // FIX: Melhorar filtro para ignorar status, broadcast, lid e newsletter
    if (
      userJid.endsWith('@status') ||
      userJid.endsWith('@broadcast') ||
      userJid.endsWith('@lid') ||
      userJid.endsWith('@newsletter') ||
      userJid.endsWith('@g.us')
    ) {
      console.log('[DEBUG] Ignorando mensagem de status/broadcast/lid/newsletter/grupo:', userJid);
      return;
    }

    // FIX: Verificar se a mensagem é do próprio bot
    if (message.key.fromMe) {
      console.log('[DEBUG] Ignorando mensagem do próprio bot');
      return;
    }

    // FIX: Verificar se é realmente uma mensagem de texto
    if (!message.message?.conversation && !message.message?.extendedTextMessage?.text) {
      await sock.sendMessage(userJid, { 
        text: 'Eita, baby! 🫣 Para o confessionário, só aceito texto! Envie sua confissão em formato de texto! 💋' 
      });
      return;
    }

    const confession = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    
    if (confession.trim().length < 10) {
      await sock.sendMessage(userJid, { 
        text: 'Eita, baby! 🫣 Sua confissão tá muito curta! Escreva mais um pouquinho, pelo menos 10 caracteres! 💋' 
      });
      return;
    }

    // Validar se a confissão começa com as frases permitidas
    if (!ConfessionGame.validateConfessionText(confession)) {
      await sock.sendMessage(userJid, { 
        text: 'Eita, baby! 🫣 Sua confissão precisa começar com "Eu nunca", "Eu já" ou "Uma vez"! Exemplos:\n\n' +
              '• "Eu nunca colei em uma prova."\n' +
              '• "Eu já comi pizza com ketchup."\n' +
              '• "Uma vez, chamei a sogra pelo nome da ex."\n\n' +
              'Tenta de novo! 💋' 
      });
      return;
    }

    console.log(`[DEBUG] Processando confissão privada de ${userJid}`);

    // Buscar jogos de confissão ativos para o usuário
    const activeConfessionGames = await gameService.findActiveConfessionGamesForUser(userJid);
    
    if (activeConfessionGames.length === 0) {
      await sock.sendMessage(userJid, { 
        text: 'Uhm, gato(a), recebi sua confissão, mas não encontrei nenhum grupo seu onde o "Confessionário" esteja rolando. Tem certeza que seu admin já ativou a brincadeira com !brincadeira confissao ativar? 🤔' 
      });
      return;
    }

    // Buscar grupos onde o usuário é membro
    const userGroups = await Group.find({ members: userJid });
    const userGroupIds = userGroups.map(g => g.groupJid);

    // Filtrar jogos ativos onde o usuário é membro
    const userActiveConfessionGames = activeConfessionGames.filter(game => userGroupIds.includes(game.groupId));

    if (userActiveConfessionGames.length === 0) {
      await sock.sendMessage(userJid, { 
        text: 'Eita, baby! 🫣 Encontrei confessionários ativos, mas você não é membro de nenhum deles! Que estranho... 💋' 
      });
      return;
    }

    // Para cada jogo ativo, verificar se o criador também é membro
    const validConfessionGames: Array<{ game: any; groupName: string; isCreatorGroup: boolean }> = [];
    
    for (const game of userActiveConfessionGames) {
      try {
        const groupDoc = await Group.findOne({ groupJid: game.groupId });
        if (groupDoc && groupDoc.members.includes(game.createdBy)) {
          // Ambos são membros do grupo
          validConfessionGames.push({
            game,
            groupName: game.groupName || groupDoc.name || 'Grupo Desconhecido',
            isCreatorGroup: true
          });
        }
      } catch (error) {
        console.error(`[ERROR] Erro ao verificar grupo ${game.groupId}:`, error);
      }
    }

    // Se não encontrou grupos onde ambos são membros, mostrar todos os grupos disponíveis
    if (validConfessionGames.length === 0) {
      // Mostrar TODOS os jogos ativos disponíveis, não apenas os do usuário
      const allAvailableConfessionGames = activeConfessionGames.map(game => ({
        game,
        groupName: game.groupName || 'Grupo Desconhecido',
        isCreatorGroup: false
      }));

      const options = allAvailableConfessionGames.map((game, index) => ({
        groupId: game.game.groupId,
        groupName: game.groupName,
        isCreatorGroup: false
      }));

      const choiceMessage = `Opa, que pessoa popular! 🔥 Vi que você tá em grupos onde o confessionário tá rolando, mas não encontrei o admin que criou o jogo. Aqui estão TODOS os grupos com confessionário ativo. Para qual grupo você quer enviar sua confissão? Responda com o número:\n\n` +
                           options.map((option, index) => `${index + 1}. ${option.groupName}`).join('\n') +
                           `\n\n_Responda apenas com o número (ex: 1, 2, 3...)_`;

      await sock.sendMessage(userJid, { 
        text: choiceMessage
      });

      // Salvar estado temporário
      pendingConfessionChoices.set(userJid, {
        options,
        confessionData: {
          messageId: message.key.id!,
          confession
        },
        timestamp: Date.now(),
        step: 'choose'
      });

      // Limpar escolhas antigas (mais de 5 minutos)
      setTimeout(() => {
        pendingConfessionChoices.delete(userJid);
      }, 5 * 60 * 1000);
      
      return;
    }

    // Se encontrou apenas um grupo válido, confirmar
    if (validConfessionGames.length === 1) {
      const game = validConfessionGames[0];
      
      // Verificar se já enviou
      const hasSubmitted = await gameService.hasUserSubmittedConfession(game.game.groupId, userJid);
      if (hasSubmitted) {
        await sock.sendMessage(userJid, { 
          text: 'Eita, baby! 🫣 Você já enviou uma confissão para este confessionário! Só uma por pessoa, tá? 💋' 
        });
        return;
      }

      const confirmMessage = `Ui, que confissão! 😉 Encontrei o confessionário no grupo "${game.groupName}". Quer enviar sua confissão para esse grupo?\n\n` +
                            `Responda:\n` +
                            `✅ Sim / 1 - Para confirmar\n` +
                            `❌ Não / 2 - Para ver outras opções`;

      await sock.sendMessage(userJid, { 
        text: confirmMessage
      });

      // Salvar estado temporário para confirmação
      pendingConfessionChoices.set(userJid, {
        options: [{
          groupId: game.game.groupId,
          groupName: game.groupName,
          isCreatorGroup: true
        }],
        confessionData: {
          messageId: message.key.id!,
          confession
        },
        timestamp: Date.now(),
        step: 'confirm'
      });

      // Limpar escolhas antigas (mais de 5 minutos)
      setTimeout(() => {
        pendingConfessionChoices.delete(userJid);
      }, 5 * 60 * 1000);
      
      return;
    }

    // Se encontrou múltiplos grupos válidos, perguntar qual
    const options = validConfessionGames.map(game => ({
      groupId: game.game.groupId,
      groupName: game.groupName,
      isCreatorGroup: true
    }));

    const choiceMessage = `Opa, que pessoa popular! 🔥 Vi que você tá em mais de um grupo onde o confessionário tá rolando E o admin que criou também tá lá! Para qual grupo você quer enviar sua confissão? Responda com o número:\n\n` +
                         options.map((option, index) => `${index + 1}. ${option.groupName}`).join('\n') +
                         `\n\n_Responda apenas com o número (ex: 1, 2, 3...)_`;

    await sock.sendMessage(userJid, { 
      text: choiceMessage
    });

    // Salvar estado temporário
    pendingConfessionChoices.set(userJid, {
      options,
      confessionData: {
        messageId: message.key.id!,
        confession
      },
      timestamp: Date.now(),
      step: 'choose'
    });

    // Limpar escolhas antigas (mais de 5 minutos)
    setTimeout(() => {
      pendingConfessionChoices.delete(userJid);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('[ERROR] Erro ao processar confissão privada:', error);
    await sock.sendMessage(userJid, { 
      text: 'Eita, baby! 🫣 Deu erro ao processar sua confissão! Tenta de novo! 💋' 
    });
  }
}

export async function handleConfessionGroupChoice(
  sock: WASocket,
  message: WAMessage,
  userJid: string,
  choice: string,
  gameService: GameService
): Promise<void> {
  try {
    const pendingChoice = pendingConfessionChoices.get(userJid);
    if (!pendingChoice) {
      await sock.sendMessage(userJid, { 
        text: 'Eita, baby! 🫣 Não encontrei sua escolha pendente! Envie a confissão novamente! 💋' 
      });
      return;
    }

    // Se está no passo de confirmação
    if (pendingChoice.step === 'confirm') {
      const response = choice.toLowerCase().trim();
      
      if (response === 'sim' || response === '1' || response === 's' || response === 'y') {
        // Usuário confirmou - salvar no grupo
        const selectedGroup = pendingChoice.options[0];
        
        // Verificar se já enviou
        const hasSubmitted = await gameService.hasUserSubmittedConfession(selectedGroup.groupId, userJid);
        if (hasSubmitted) {
          await sock.sendMessage(userJid, { 
            text: 'Eita, baby! 🫣 Você já enviou uma confissão para este confessionário! Só uma por pessoa, tá? 💋' 
          });
          pendingConfessionChoices.delete(userJid);
          return;
        }

        await gameService.addConfession(selectedGroup.groupId, {
          senderJid: userJid,
          messageId: pendingChoice.confessionData.messageId,
          confession: pendingChoice.confessionData.confession
        });

        await sock.sendMessage(userJid, { 
          text: `Perfeito! 😉 Confissão enviada para o grupo "${selectedGroup.groupName}". Aguenta o coração aí! 💋` 
        });

        pendingConfessionChoices.delete(userJid);
        return;
        
      } else if (response === 'não' || response === 'nao' || response === '2' || response === 'n' || response === 'no') {
        // Usuário não confirmou - mostrar todas as opções disponíveis
        const allActiveConfessionGames = await gameService.findActiveConfessionGamesForUser(userJid);

        if (allActiveConfessionGames.length === 0) {
          await sock.sendMessage(userJid, { 
            text: 'Eita, baby! 🫣 Não encontrei outros grupos disponíveis! 💋' 
          });
          pendingConfessionChoices.delete(userJid);
          return;
        }

        const options = allActiveConfessionGames.map(game => ({
          groupId: game.groupId,
          groupName: game.groupName || 'Grupo Desconhecido',
          isCreatorGroup: false
        }));

        const choiceMessage = `Ok, baby! 😉 Aqui estão TODOS os grupos com confessionário ativo:\n\n` +
                             options.map((option, index) => `${index + 1}. ${option.groupName}`).join('\n') +
                             `\n\n_Responda apenas com o número (ex: 1, 2, 3...)_`;

        await sock.sendMessage(userJid, { 
          text: choiceMessage
        });

        // Atualizar estado para escolha
        pendingConfessionChoices.set(userJid, {
          options,
          confessionData: pendingChoice.confessionData,
          timestamp: Date.now(),
          step: 'choose'
        });
        
        return;
      } else {
        await sock.sendMessage(userJid, { 
          text: `Eita, baby! 🫣 Resposta inválida! Responda:\n✅ Sim / 1 - Para confirmar\n❌ Não / 2 - Para ver outras opções` 
        });
        return;
      }
    }

    // Se está no passo de escolha
    if (pendingChoice.step === 'choose') {
      const choiceNumber = parseInt(choice) - 1;
      if (choiceNumber < 0 || choiceNumber >= pendingChoice.options.length) {
        await sock.sendMessage(userJid, { 
          text: `Eita, baby! 🫣 Escolha inválida! Digite um número entre 1 e ${pendingChoice.options.length}! 💋` 
        });
        return;
      }

      const selectedGroup = pendingChoice.options[choiceNumber];
      
      // Verificar se já enviou
      const hasSubmitted = await gameService.hasUserSubmittedConfession(selectedGroup.groupId, userJid);
      if (hasSubmitted) {
        await sock.sendMessage(userJid, { 
          text: 'Eita, baby! 🫣 Você já enviou uma confissão para este confessionário! Só uma por pessoa, tá? 💋' 
        });
        pendingConfessionChoices.delete(userJid);
        return;
      }

      await gameService.addConfession(selectedGroup.groupId, {
        senderJid: userJid,
        messageId: pendingChoice.confessionData.messageId,
        confession: pendingChoice.confessionData.confession
      });

      await sock.sendMessage(userJid, { 
        text: `Perfeito! 😉 Confissão enviada para o grupo "${selectedGroup.groupName}". Aguenta o coração aí! 💋` 
      });

      pendingConfessionChoices.delete(userJid);
    }

  } catch (error) {
    console.error('[ERROR] Erro ao processar escolha de grupo de confissão:', error);
    await sock.sendMessage(userJid, { 
      text: 'Eita, baby! 🫣 Deu erro ao processar sua escolha! Tenta de novo! 💋' 
    });
  }
}

export function hasPendingConfessionChoice(userJid: string): boolean {
  return pendingConfessionChoices.has(userJid);
}

const brincadeiraCommand = new BrincadeiraCommand(new GameService());
export default brincadeiraCommand; 