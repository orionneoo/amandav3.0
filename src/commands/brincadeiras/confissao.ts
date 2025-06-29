// Módulo do jogo Confessionário Anônimo / Eu Nunca...
// Aqui ficará toda a lógica do confessionário

import { WASocket, proto, MessageUpsertType } from '@whiskeysockets/baileys';
import { getUserDisplayName } from '../../utils/userUtils';
import { GameService } from '../../services/GameService';
import { isAdmin } from '../../utils/groupUtils';

type WAMessage = proto.IWebMessageInfo;

export const ConfessionGame = {
  activate: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      // Verificar se o usuário é administrador
      if (!await isAdmin(sock, groupJid, userJid)) {
        await sock.sendMessage(groupJid, { 
          text: 'Desculpe, apenas administradores podem ativar o confessionário. 💼'
        });
        return;
      }

      // Verificar se já existe um jogo ativo
      const existingGame = await gameService.findActiveConfessionGameByGroupId(groupJid);
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
      await gameService.createConfessionGame(groupJid, userJid, groupMetadata.subject);

      const activationMessage = `🤫 *CONFESSIONÁRIO ABERTO!* 🤫\n\n` +
                               `👑 @${adminName} abriu o confessionário anônimo!\n\n` +
                               `📱 *Como participar:*\n` +
                               `• Me envie uma confissão no privado aqui pra mim (@Amanda)!\n` +
                               `• Use os comandos específicos para evitar confusão:\n\n` +
                               `💬 *Comandos disponíveis:*\n` +
                               `• !eununca [sua confissão] - Para "Eu nunca..."\n` +
                               `• !euja [sua confissão] - Para "Eu já..."\n` +
                               `• !umavez [sua confissão] - Para "Uma vez..."\n\n` +
                               `💬 *Exemplos:*\n` +
                               `• !eununca Eu nunca colei em uma prova.\n` +
                               `• !euja Eu já comi pizza com ketchup.\n` +
                               `• !umavez Uma vez, chamei a sogra pelo nome da ex.\n\n` +
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
  },

  reveal: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      // Verificar se o usuário é administrador
      if (!await isAdmin(sock, groupJid, userJid)) {
        await sock.sendMessage(groupJid, { 
          text: 'Desculpe, apenas administradores podem revelar as confissões. 💼'
        });
        return;
      }

      const confessions = await gameService.getConfessions(groupJid);
      
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

      // Enviar instruções de como reagir uma única vez
      await sock.sendMessage(groupJid, {
        text: `🤔 *COMO REAGIR:*\n` +
              `Para cada confissão que aparecer, basta reagir diretamente na mensagem com um dos emojis:\n\n` +
              `🙋‍♂️ para "Eu Também!"\n` +
              `😱 para "Chocado(a)!"\n` +
              `😂 para "Que Mico!"\n\n` +
              `_Vamos lá... a primeira confissão é:_`
      });

      // Aguardar um pouco antes de começar (dando tempo para ler)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Enviar cada confissão
      for (let i = 0; i < confessions.length; i++) {
        const confession = confessions[i];
        
        const confessionMessage = `🤫 *CONFISSÃO ANÔNIMA #${i + 1}* 🤫\n\n` +
                                 `💬 *"${confession.confession}"*\n\n` +
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
      await gameService.clearConfessions(groupJid);

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
  },

  getStatus: async function(sock: WASocket, message: WAMessage, groupJid: string, gameService: GameService) {
    try {
      const game = await gameService.findActiveConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *STATUS DO CONFESSIONÁRIO*\n\n❌ Nenhum confessionário ativo no momento.' 
        });
        return;
      }

      const stats = await gameService.getConfessionGameStats(groupJid);
      
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
  },

  cancel: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const game = await gameService.findActiveConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Não há confessionário ativo para cancelar! 💋' 
        });
        return;
      }

      const stats = await gameService.getConfessionGameStats(groupJid);
      await gameService.clearConfessions(groupJid);

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
  },

  finalize: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const game = await gameService.findActiveConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Não há confessionário ativo para finalizar! 💋' 
        });
        return;
      }

      const stats = await gameService.getConfessionGameStats(groupJid);
      await gameService.clearConfessions(groupJid);
      await gameService.endConfessionGame(groupJid);

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
  },

  ranking: async function(sock: WASocket, message: WAMessage, groupJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *RANKING DO CONFESSIONÁRIO*\n\n❌ Nenhum confessionário encontrado.' 
        });
        return;
      }

      const ranking = await gameService.getConfessionRanking(groupJid);
      
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
  },

  chocantes: async function(sock: WASocket, message: WAMessage, groupJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '😱 *CONFISSÕES CHOCANTES*\n\n❌ Nenhum confessionário encontrado.' 
        });
        return;
      }

      const shocking = await gameService.getShockingConfessions(groupJid);
      
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
  },

  micos: async function(sock: WASocket, message: WAMessage, groupJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '😂 *CONFISSÕES ENGRAÇADAS*\n\n❌ Nenhum confessionário encontrado.' 
        });
        return;
      }

      const funny = await gameService.getFunnyConfessions(groupJid);
      
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
  },

  resultado: async function(sock: WASocket, message: WAMessage, groupJid: string, userJid: string, gameService: GameService) {
    try {
      const game = await gameService.findLastConfessionGameByGroupId(groupJid);
      
      if (!game) {
        await sock.sendMessage(groupJid, { 
          text: '📊 *RESULTADO DO CONFESSIONÁRIO*\n\n❌ Nenhum confessionário encontrado.' 
        });
        return;
      }

      const ranking = await gameService.getConfessionRanking(groupJid);
      const shocking = await gameService.getShockingConfessions(groupJid);
      const funny = await gameService.getFunnyConfessions(groupJid);
      const reactions = await gameService.getConfessionReactions(groupJid);
      
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
  },

  showHelp: async function(sock: WASocket, message: WAMessage, groupJid: string) {
    const helpMessage = `🤫 *Confessionário* 🤫\n\n` +
                        `Use os comandos abaixo para a brincadeira:\n\n` +
                        `*!brincadeira confissao ativar*\n`+
                        `▶️ Inicia uma nova rodada e libera o envio de confissões no meu privado.\n\n` +
                        `*!brincadeira confissao revelar*\n`+
                        `🚫 Revela todos os segredos no grupo e encerra a rodada atual.`;

    await sock.sendMessage(groupJid, { 
      text: helpMessage
    });
  },

  processPrivateMessage: async function(sock: WASocket, message: WAMessage, userJid: string, gameService: GameService) {
    try {
      console.log(`[DEBUG] processPrivateMessage: Iniciando para ${userJid}`);
      const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
      if (!this.validateConfessionText(text)) {
        await sock.sendMessage(userJid, { 
          text: 'Desculpe, baby, a mensagem não está no formato correto. Use !eununca, !euja ou !umavez. 💋'
        });
        return;
      }
      console.log('[DEBUG] processPrivateMessage: Confissão validada.');

      console.log('[DEBUG] processPrivateMessage: Buscando jogos ativos...');
      const activeGames = await gameService.findActiveConfessionGamesForUser(userJid);
      const groupIds = activeGames.map(game => game.groupId);
      console.log(`[DEBUG] processPrivateMessage: Encontrado(s) ${groupIds.length} jogo(s) ativo(s).`);

      if (groupIds.length === 0) {
        console.log('[DEBUG] processPrivateMessage: Nenhum jogo ativo encontrado. Enviando mensagem de aviso.');
        await sock.sendMessage(userJid, { 
          text: 'Você não está participando de nenhum confessionário ativo, baby. 😘'
        });
        return;
      }

      let groupJid = groupIds[0];
      if (groupIds.length > 1) {
        console.log('[DEBUG] processPrivateMessage: Múltiplos jogos encontrados. Solicitando escolha do usuário.');
        // Listar grupos e pedir ao usuário para escolher
        const groupList = activeGames.map((game, index) => `${index + 1}. ${game.groupName || game.groupId}`).join('\n'); // Adicionado groupName como fallback
        await sock.sendMessage(userJid, { 
          text: `Você está em mais de um grupo com confessionário ativo, baby. Por favor, escolha o grupo enviando o número correspondente:\n${groupList}`
        });

        // Aguardar resposta do usuário
        console.log('[DEBUG] processPrivateMessage: Aguardando resposta do usuário...');
        const response = await this.awaitUserResponse(sock, userJid);
        console.log(`[DEBUG] processPrivateMessage: Resposta recebida: "${response}"`);
        const chosenIndex = parseInt(response.trim()) - 1;

        if (chosenIndex >= 0 && chosenIndex < groupIds.length) {
          groupJid = groupIds[chosenIndex];
          console.log(`[DEBUG] processPrivateMessage: Grupo escolhido: ${groupJid}`);
        } else {
          console.log('[DEBUG] processPrivateMessage: Escolha inválida.');
          await sock.sendMessage(userJid, { 
            text: 'Escolha inválida, baby. Tente novamente. 💌'
          });
          return;
        }
      }

      console.log(`[DEBUG] processPrivateMessage: Preparando para adicionar confissão ao grupo ${groupJid}`);
      const confessionData = {
        senderJid: userJid,
        messageId: message.key.id || '',
        confession: text
      };

      await gameService.addConfession(groupJid, confessionData);
      console.log('[DEBUG] processPrivateMessage: Confissão adicionada com sucesso ao banco de dados.');

      await sock.sendMessage(userJid, { 
        text: 'Confissão recebida com sucesso, baby! Obrigado por compartilhar. 💖'
      });
      console.log('[DEBUG] processPrivateMessage: Mensagem de confirmação enviada.');

    } catch (error) {
      console.error('[ERROR] Erro ao processar mensagem privada:', error);
      await sock.sendMessage(userJid, { 
        text: 'Eita, baby! 🫣 Deu erro ao processar sua confissão! Tenta de novo! 💋'
      });
    }
  },

  awaitUserResponse: async function(sock: WASocket, userJid: string): Promise<string> {
    // Implementar lógica alternativa para aguardar resposta do usuário
    // Usar uma abordagem baseada em promessas ou callbacks
    return new Promise((resolve) => {
      const messageQueue: WAMessage[] = [];

      const listener = (upsert: { messages: WAMessage[], type: MessageUpsertType }) => {
        // Pega a primeira e mais recente mensagem do array
        const messageInfo = upsert.messages[0];

        // Verificação de segurança:
        // 1. Garante que existe uma mensagem.
        // 2. Garante que a mensagem não é uma notificação do próprio bot (fromMe: true).
        // 3. Garante que a mensagem tem conteúdo (messageInfo.message).
        if (!messageInfo || !messageInfo.message || messageInfo.key.fromMe) {
          return; // Ignora se não for uma mensagem válida de um usuário
        }

        // AGORA, sua lógica original pode ser usada, mas com a variável 'messageInfo'
        if (messageInfo.key.remoteJid === userJid) {
          console.log('[DEBUG] awaitUserResponse: Mensagem recebida do usuário alvo.');
          const text = messageInfo.message.conversation || messageInfo.message.extendedTextMessage?.text;
          if (text) {
            messageQueue.push(messageInfo);
          }
        }
      };

      sock.ev.on('messages.upsert', listener);

      const checkQueue = () => {
        if (messageQueue.length > 0) {
          const lastMessage = messageQueue.shift();
          sock.ev.off('messages.upsert', listener);
          console.log('[DEBUG] awaitUserResponse: Resolvendo promessa com a mensagem.');
          resolve(lastMessage?.message?.conversation || lastMessage?.message?.extendedTextMessage?.text || '');
        } else {
          setTimeout(checkQueue, 1000); // Verificar novamente após 1 segundo
        }
      };

      checkQueue();
    });
  },

  validateConfessionText: function(text: string): boolean {
    const lowerText = text.trim().toLowerCase();
    // Valida se a mensagem começa com um dos comandos de confissão, com ou sem "!"
    const validCommands = ['eununca', 'euja', 'eu já', 'umavez'];
    
    // Remove o "!" opcional do início
    const textWithoutBang = lowerText.startsWith('!') ? lowerText.substring(1) : lowerText;

    // Verifica se o texto (sem "!") começa com algum dos comandos válidos, seguido de um espaço ou fim da linha
    return validCommands.some(cmd => {
      if (textWithoutBang.startsWith(cmd)) {
        // Garante que não é apenas parte de outra palavra (ex: "eujantei")
        const afterCommand = textWithoutBang.substring(cmd.length);
        return afterCommand.length === 0 || afterCommand.startsWith(' ');
      }
      return false;
    });
  }
}; 