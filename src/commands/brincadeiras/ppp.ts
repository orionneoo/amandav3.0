// Módulo do jogo PPP (Pego, Penso ou Passo)
// Aqui ficará toda a lógica do jogo PPP

import { WASocket, proto } from '@whiskeysockets/baileys';
import { getUserDisplayName } from '@/utils/userUtils';
import { GameService } from '@/services/GameService';
import * as fs from 'fs';
import * as path from 'path';

type WAMessage = proto.IWebMessageInfo;

const GAME_FOLDER = path.join(process.cwd(), 'jogos', 'ppp');

export const PPPGame = {
  activateGame: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const existingGame = await gameService.findActiveGameByGroupId(groupJid);
      if (existingGame) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Já tem um jogo PPP ativo! Use !brincadeira ppp enviar para revelar as fotos! 💋' 
        });
        return;
      }
      const lastGame = await gameService.findLastGameByGroupId(groupJid);
      if (lastGame && lastGame.isActive === false) {
        console.log('[DEBUG] Jogo anterior já está inativo');
      }
      const groupMetadata = await sock.groupMetadata(groupJid);
      const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);
      await gameService.createGame(groupJid, userJid, groupMetadata.subject);
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
  },
  sendSubmissions: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const submissions = await gameService.getSubmissions(groupJid);
      
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
                         `💬 *\"${submission.caption || 'Sem legenda'}\"*\n\n` +
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
      await gameService.clearSubmissions(groupJid);

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
  },
  getGameStatus: async function(sock: WASocket, message: WAMessage, groupJid: string, gameService: GameService) {
    try {
      const game = await gameService.findActiveGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *STATUS DO JOGO PPP*\n\n❌ Nenhum jogo ativo no momento.' 
        });
        return;
      }

      const stats = await gameService.getGameStats(groupJid);
      
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
  },
  cancelGame: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const game = await gameService.findActiveGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Não há jogo ativo para cancelar! 💋' 
        });
        return;
      }

      const stats = await gameService.getGameStats(groupJid);
      await gameService.clearSubmissions(groupJid);

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
  },
  finalizeGame: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const game = await gameService.findActiveGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Não há jogo ativo para finalizar! 💋' 
        });
        return;
      }

      const stats = await gameService.getGameStats(groupJid);
      await gameService.clearSubmissions(groupJid);
      await gameService.endGame(groupJid);

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
  },
  debugGame: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '🔍 *DEBUG PPP*\n\n❌ Nenhum jogo encontrado.' 
        });
        return;
      }

      const reactions = await gameService.getReactions(groupJid);
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
  },
  getRanking: async function(sock: WASocket, message: WAMessage, groupJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastGameByGroupId(groupJid);
      
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

      const ranking = await gameService.getRanking(groupJid, userNames);
      
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
  },
  getMatches: async function(sock: WASocket, message: WAMessage, groupJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastGameByGroupId(groupJid);
      
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

      const matches = await gameService.getMatches(groupJid, userNames);
      
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
  },
  getResults: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastGameByGroupId(groupJid);
      
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

      const ranking = await gameService.getRanking(groupJid, userNames);
      const matches = await gameService.getMatches(groupJid, userNames);
      const reactions = await gameService.getReactions(groupJid);
      
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
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
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
  },
  getDetailedList: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastGameByGroupId(groupJid);
      
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

      const detailedList = await gameService.getDetailedReactionsList(groupJid, userNames);
      
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
  },
  showHelp: async function(sock: WASocket, message: WAMessage, groupJid: string) {
    const helpMessage = `🎮 *COMANDO BRINCADEIRA - AJUDA* 🎮\n\n` +
                        `📝 *Como usar:*\n` +
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
                        `🎭 *Jogo PPP (Pego, Penso ou Passo):*\n` +
                        `• Usuários enviam fotos no privado\n` +
                        `• Admin revela as fotos no grupo\n` +
                        `• Galera reage: Pego 😏, Penso 🤔 ou Passo 😵‍💫\n` +
                        `• Dados ficam disponíveis até novo jogo\n\n` +
                        `⚠️ *ATENÇÃO:* Apenas admins podem usar este comando!`;

    await sock.sendMessage(groupJid, { 
      text: helpMessage
    });
  },
}; 