import { WASocket, proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { canUseCommand } from '@/utils/permissions';
import { getUserDisplayName } from '@/utils/userUtils';
import * as fs from 'fs';
import * as path from 'path';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

// FIX: Interface para o temporizador
interface TimeSession {
  groupJid: string;
  mediaDeadline: number; // prazo para enviar mídia (em minutos)
  totalDuration: number; // duração total do timer (em minutos)
  startTime: Date;
  mediaDeadlineTime: Date; // quando termina o prazo para mídia
  endTime: Date; // quando termina o timer total
  participants: Set<string>; // participantes que precisam enviar mídia
  mediaSent: Set<string>; // participantes que já enviaram mídia
  warnings: Map<string, number>; // contador de avisos por usuário
  isActive: boolean;
  confirmed: boolean; // confirmação dupla
  removedUsers: Set<string>; // FIX: Adicionar registro de usuários removidos
  mediaDeadlineCompleted: boolean; // FIX: Marcar se o prazo de mídia já foi finalizado
}

// FIX: Armazenamento global dos temporizadores ativos
const activeTimers = new Map<string, TimeSession>();

// FIX: Adicionar controle de tentativas inválidas (3 etapas: aviso, advertência, remoção)
const invalidMediaAttempts = new Map<string, number>(); // Map<groupJid:userJid, count>

// FIX: Sistema simples de download de mídias
const TEMP_FOLDER = path.join(process.cwd(), 'temporario');
let mediaCounter = 0;

// FIX: Função para baixar mídia de forma simples
async function downloadSimpleMedia(sock: WASocket, message: WAMessage, groupJid: string, userJid: string) {
  console.log(`[DEBUG] downloadSimpleMedia iniciado para ${userJid} no grupo ${groupJid}`);
  
  try {
    const messageContent = message.message;
    if (!messageContent) {
      console.log(`[DEBUG] Sem conteúdo de mensagem`);
      return;
    }
    
    let mediaBuffer: Buffer | null = null;
    let fileExtension = '';

    // NOVO: Verificar se é mensagem de visualização única
    if (messageContent.viewOnceMessage || messageContent.viewOnceMessageV2) {
      console.log(`[DEBUG] Detectada mensagem de visualização única`);
      const viewOnceContent = messageContent.viewOnceMessageV2?.message || messageContent.viewOnceMessage?.message;
      
      if (viewOnceContent?.imageMessage) {
        console.log(`[DEBUG] Detectada imagem em visualização única`);
        mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
        fileExtension = '.jpg';
      } else if (viewOnceContent?.videoMessage) {
        console.log(`[DEBUG] Detectado vídeo em visualização única`);
        mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
        fileExtension = '.mp4';
      } else {
        console.log(`[DEBUG] Tipo de mídia não suportado em visualização única:`, Object.keys(viewOnceContent || {}));
        return;
      }
    } else {
      // FIX: Extrair mídia baseada no tipo
      if (messageContent.imageMessage) {
        console.log(`[DEBUG] Detectada imagem`);
        mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
        fileExtension = '.jpg';
      } else if (messageContent.videoMessage) {
        console.log(`[DEBUG] Detectado vídeo`);
        mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
        fileExtension = '.mp4';
      } else if (messageContent.audioMessage) {
        console.log(`[DEBUG] Detectado áudio`);
        mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
        fileExtension = '.mp3';
      } else if (messageContent.documentMessage) {
        console.log(`[DEBUG] Detectado documento`);
        mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
        const fileName = messageContent.documentMessage.fileName || 'document';
        fileExtension = path.extname(fileName) || '.bin';
      } else if (messageContent.stickerMessage) {
        console.log(`[DEBUG] Detectado sticker`);
        mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
        fileExtension = '.webp';
      }
    }

    if (mediaBuffer) {
      console.log(`[DEBUG] Buffer de mídia obtido, tamanho: ${mediaBuffer.length} bytes`);
      
      // FIX: Nome simples: grupo_numero.extensao
      const groupNumber = groupJid.split('@')[0].replace('g.us', '');
      const userNumber = userJid.split('@')[0];
      const timestamp = Date.now();
      
      const fileName = `${groupNumber}_${userNumber}_${timestamp}${fileExtension}`;
      const filePath = path.join(TEMP_FOLDER, fileName);
      
      console.log(`[DEBUG] Salvando arquivo: ${filePath}`);
      fs.writeFileSync(filePath, mediaBuffer);
      
      console.log(`[TIMER] Mídia salva: ${fileName}`);
    } else {
      console.log(`[DEBUG] Nenhum buffer de mídia obtido`);
    }
  } catch (error) {
    console.error('[ERROR] Erro ao baixar mídia:', error);
  }
}

// FIX: Comando de temporizador com confirmação dupla
const timeCommand: ICommand = {
  name: 'time',
  aliases: ['timer', 'temporizador'],
  description: 'Inicia um temporizador que remove quem não enviar mídia (confirmação dupla)',
  category: 'admin',
  usage: '!time on [minutos] - Inicia temporizador\n!time off - Para temporizador\n!time status - Status atual',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message, args, from: groupJid, sender: userJid, isGroup } = context;
    try {
      if (!isGroup) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 O !time só funciona em grupos! 💋' 
        });
        return;
      }

      if (!await canUseCommand(sock, groupJid, userJid, 'admin')) {
        await sock.sendMessage(groupJid, { 
          text: 'Eita, amor! 🚫 Esse comando !time é só pra admins. Você não tem essa permissão ainda.' 
        });
        return;
      }

      // FIX: Verificar se o bot é admin
      const groupMetadata = await sock.groupMetadata(groupJid);
      const botJid = sock.user?.id;
      
      // FIX: Remover sufixo :11 do JID do bot para encontrar na lista de participantes
      const normalizedBotJid = botJid?.replace(/:11@s\.whatsapp\.net$/, '@s.whatsapp.net');
      const botParticipant = groupMetadata.participants.find(p => p.id === normalizedBotJid);
      
      console.log('[DEBUG] Verificação de admin do bot:', {
        botJid,
        normalizedBotJid,
        groupJid,
        botParticipant,
        allParticipants: groupMetadata.participants.map(p => ({ id: p.id, admin: p.admin }))
      });
      
      if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
        console.log('[DEBUG] Bot não é admin:', { botParticipant, botJid, normalizedBotJid });
        await sock.sendMessage(groupJid, { 
          text: 'Eita, baby! 🫣 Eu preciso ser admin do grupo pra poder usar o !time! 💋' 
        });
        return;
      }
      
      console.log('[DEBUG] Bot é admin, continuando...');

      const action = args[0]?.toLowerCase();
      const currentTimer = activeTimers.get(groupJid);

      if (action === 'on') {
        // FIX: Iniciar temporizador
        if (currentTimer && currentTimer.isActive) {
          await sock.sendMessage(groupJid, { 
            text: 'Eita, baby! 🫣 Já tem um temporizador ativo! Use !time off para parar primeiro! 💋' 
          });
          return;
        }

        // FIX: Verificar se foram passados os parâmetros
        if (!args[1] || !args[2]) {
          const helpMessage = `⏰ *COMO USAR O COMANDO TIME* ⏰\n\n` +
                             `📝 *Sintaxe:*\n` +
                             `!time on [prazo] [duração]\n\n` +
                             `📱 *Exemplos:*\n` +
                             `• !time on 5 30 - 5 min para mídia, timer dura 30 min\n` +
                             `• !time on 1 20 - 1 min para mídia, timer dura 20 min\n` +
                             `• !time on 10 - 10 min para mídia, timer dura 10 min\n\n` +
                             `⚠️ *ATENÇÃO:* Remove usuários que não enviarem mídia!\n\n` +
                             `_Digite o comando com os tempos desejados!_`;

          await sock.sendMessage(groupJid, { 
            text: helpMessage
          });
          return;
        }

        // FIX: Aceitar dois parâmetros: prazo para mídia e duração total
        const mediaDeadline = parseInt(args[1]) || 20; // Prazo para enviar mídia (padrão: 20 min)
        const totalDuration = parseInt(args[2]) || mediaDeadline; // Duração total (padrão: igual ao prazo)
        
        if (mediaDeadline < 1 || mediaDeadline > 1440) { // Máximo: 24 horas
          await sock.sendMessage(groupJid, { 
            text: 'Eita, baby! 🫣 O prazo para mídia deve ser entre 1 e 1440 minutos (24 horas)! 💋' 
          });
          return;
        }
        
        if (totalDuration < mediaDeadline || totalDuration > 1440) { // Total deve ser >= prazo e <= 24h
          await sock.sendMessage(groupJid, { 
            text: 'Eita, baby! 🫣 A duração total deve ser maior ou igual ao prazo para mídia e no máximo 1440 minutos! 💋' 
          });
          return;
        }

        // FIX: Primeira confirmação
        const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);
        const confirmMessage = `⏰ *TEMPORIZADOR DE MÍDIA* ⏰\n\n` +
                              `👑 @${adminName} quer iniciar um temporizador!\n\n` +
                              `📱 *Regras:*\n` +
                              `• Prazo para enviar mídia: ${mediaDeadline} minutos\n` +
                              `• Duração total do timer: ${totalDuration} minutos\n` +
                              `• Quem não enviar será removido automaticamente\n` +
                              `• Avisos serão enviados aos 2 minutos finais do prazo\n\n` +
                              `⚠️ *ATENÇÃO:* Este comando remove usuários!\n\n` +
                              `🔴 Para confirmar: !time confirm ${mediaDeadline} ${totalDuration}\n` +
                              `🟢 Para cancelar: !time cancel`;

        await sock.sendMessage(groupJid, { 
          text: confirmMessage,
          mentions: [userJid]
        });

        // FIX: Criar sessão pendente de confirmação
        const pendingSession: TimeSession = {
          groupJid,
          mediaDeadline,
          totalDuration,
          startTime: new Date(),
          mediaDeadlineTime: new Date(Date.now() + mediaDeadline * 60 * 1000),
          endTime: new Date(Date.now() + totalDuration * 60 * 1000),
          participants: new Set(),
          mediaSent: new Set(),
          warnings: new Map(),
          isActive: false,
          confirmed: false,
          removedUsers: new Set(),
          mediaDeadlineCompleted: false
        };

        activeTimers.set(groupJid, pendingSession);

      } else if (action === 'confirm') {
        // FIX: Segunda confirmação
        if (!currentTimer || currentTimer.confirmed) {
          await sock.sendMessage(groupJid, { 
            text: 'Eita, baby! 🫣 Não há temporizador pendente para confirmar! 💋' 
          });
          return;
        }

        const mediaDeadline = parseInt(args[1]);
        const totalDuration = parseInt(args[2]);
        
        if (mediaDeadline !== currentTimer.mediaDeadline || totalDuration !== currentTimer.totalDuration) {
          await sock.sendMessage(groupJid, { 
            text: 'Eita, baby! 🫣 Os valores não conferem! Use os mesmos valores do comando anterior! 💋' 
          });
          return;
        }

        // FIX: Ativar temporizador
        currentTimer.isActive = true;
        currentTimer.confirmed = true;
        currentTimer.startTime = new Date();
        currentTimer.mediaDeadlineTime = new Date(Date.now() + mediaDeadline * 60 * 1000);
        currentTimer.endTime = new Date(Date.now() + totalDuration * 60 * 1000);

        // FIX: Adicionar todos os participantes (exceto admins)
        for (const participant of groupMetadata.participants) {
          if (participant.admin !== 'admin' && participant.admin !== 'superadmin' && participant.id !== normalizedBotJid) {
            currentTimer.participants.add(participant.id);
          }
        }

        const adminName = await getUserDisplayName(sock, userJid, groupJid, message.pushName);
        const startMessage = `🚀 *TEMPORIZADOR ATIVADO!* 🚀\n\n` +
                            `⏰ *Prazo para mídia:* ${mediaDeadline} minutos\n` +
                            `⏰ *Duração total:* ${totalDuration} minutos\n` +
                            `👥 *Participantes:* ${currentTimer.participants.size} pessoas\n` +
                            `⏰ *Prazo termina em:* ${currentTimer.mediaDeadlineTime.toLocaleTimeString('pt-BR')}\n` +
                            `⏰ *Timer termina em:* ${currentTimer.endTime.toLocaleTimeString('pt-BR')}\n\n` +
                            `📱 *Envie uma mídia agora ou será removido!*\n\n` +
                            `_Temporizador iniciado por @${adminName}_`;

        await sock.sendMessage(groupJid, { 
          text: startMessage,
          mentions: [userJid]
        });

        // FIX: Iniciar monitoramento
        startTimerMonitoring(sock, groupJid, mediaDeadline, totalDuration);

      } else if (action === 'cancel') {
        // FIX: Cancelar temporizador pendente
        if (!currentTimer || currentTimer.isActive) {
          await sock.sendMessage(groupJid, { 
            text: 'Eita, baby! 🫣 Não há temporizador pendente para cancelar! 💋' 
          });
          return;
        }

        activeTimers.delete(groupJid);
        await sock.sendMessage(groupJid, { 
          text: '✅ *TEMPORIZADOR CANCELADO!*\n\n_Nenhum usuário será removido._' 
        });

      } else if (action === 'off') {
        // FIX: Parar temporizador ativo
        if (!currentTimer || !currentTimer.isActive) {
          await sock.sendMessage(groupJid, { 
            text: 'Eita, baby! 🫣 Não há temporizador ativo para parar! 💋' 
          });
          return;
        }

        const remainingParticipants = currentTimer.participants.size - currentTimer.mediaSent.size;
        const totalRemoved = currentTimer.removedUsers.size;
        
        activeTimers.delete(groupJid);

        if (totalRemoved > 0) {
          const removedNames = await Promise.all(
            Array.from(currentTimer.removedUsers).map(async (userId) => {
              try {
                return await getUserDisplayName(sock, userId, groupJid);
              } catch {
                return userId.split('@')[0];
              }
            })
          );

          await sock.sendMessage(groupJid, { 
            text: `🛑 *TEMPORIZADOR PARADO!*\n\n` +
                  `📊 *Resultado:*\n` +
                  `✅ Mídia enviada: ${currentTimer.mediaSent.size} pessoas\n` +
                  `❌ Removidos: ${totalRemoved} pessoas\n` +
                  `⏳ Pendentes: ${remainingParticipants} pessoas\n\n` +
                  `👥 *Removidos:*\n${removedNames.map(name => `• ${name}`).join('\n')}\n\n` +
                  `_Temporizador parado manualmente._`
          });
        } else {
          await sock.sendMessage(groupJid, { 
            text: `🛑 *TEMPORIZADOR PARADO!*\n\n` +
                  `📊 *Resultado:*\n` +
                  `✅ Mídia enviada: ${currentTimer.mediaSent.size} pessoas\n` +
                  `❌ Não enviaram: ${remainingParticipants} pessoas\n\n` +
                  `_Ninguém foi removido._`
          });
        }

      } else if (action === 'status') {
        // FIX: Status do temporizador
        if (!currentTimer) {
          await sock.sendMessage(groupJid, { 
            text: '📊 *STATUS DO TEMPORIZADOR*\n\n❌ Nenhum temporizador ativo.' 
          });
          return;
        }

        const now = new Date();
        const mediaTimeLeft = Math.max(0, currentTimer.mediaDeadlineTime.getTime() - now.getTime());
        const totalTimeLeft = Math.max(0, currentTimer.endTime.getTime() - now.getTime());
        const mediaMinutesLeft = Math.ceil(mediaTimeLeft / (60 * 1000));
        const totalMinutesLeft = Math.ceil(totalTimeLeft / (60 * 1000));
        const remainingParticipants = currentTimer.participants.size - currentTimer.mediaSent.size;
        const totalRemoved = currentTimer.removedUsers.size;

        const statusMessage = `📊 *STATUS DO TEMPORIZADOR*\n\n` +
                             `⏰ *Prazo para mídia:* ${mediaMinutesLeft} minutos restantes\n` +
                             `⏰ *Duração total:* ${totalMinutesLeft} minutos restantes\n` +
                             `👥 *Participantes:* ${currentTimer.participants.size} pessoas\n` +
                             `✅ *Mídia enviada:* ${currentTimer.mediaSent.size} pessoas\n` +
                             `❌ *Removidos:* ${totalRemoved} pessoas\n` +
                             `⏳ *Pendentes:* ${remainingParticipants} pessoas\n` +
                             `🔄 *Status:* ${currentTimer.isActive ? 'Ativo' : 'Pendente de confirmação'}`;

        await sock.sendMessage(groupJid, { 
          text: statusMessage
        });

      } else if (action === 'debug') {
        // FIX: Comando de debug para listar todos os temporizadores
        const allTimers = Array.from(activeTimers.entries());
        if (allTimers.length === 0) {
          await sock.sendMessage(groupJid, { 
            text: '🔍 *DEBUG - TEMPORIZADORES*\n\n❌ Nenhum temporizador encontrado.' 
          });
          return;
        }

        let debugMessage = '🔍 *DEBUG - TEMPORIZADORES ATIVOS*\n\n';
        for (const [timerGroupJid, timer] of allTimers) {
          debugMessage += `📱 *Grupo:* ${timerGroupJid}\n` +
                         `🔄 *Ativo:* ${timer.isActive ? 'Sim' : 'Não'}\n` +
                         `✅ *Confirmado:* ${timer.confirmed ? 'Sim' : 'Não'}\n` +
                         `👥 *Participantes:* ${timer.participants.size}\n` +
                         `📸 *Mídia enviada:* ${timer.mediaSent.size}\n` +
                         `❌ *Removidos:* ${timer.removedUsers.size}\n\n`;
        }

        await sock.sendMessage(groupJid, { 
          text: debugMessage
        });

      } else {
        // FIX: Ajuda
        await sock.sendMessage(groupJid, { 
          text: `⏰ *COMANDO TIME - AJUDA* ⏰\n\n` +
                `📝 *Como usar:*\n` +
                `• !time on [prazo] [duração] - Inicia temporizador\n` +
                `• !time confirm [prazo] [duração] - Confirma temporizador\n` +
                `• !time cancel - Cancela temporizador pendente\n` +
                `• !time off - Para temporizador ativo\n` +
                `• !time status - Status atual\n` +
                `• !time debug - Lista todos os temporizadores\n\n` +
                `📱 *Exemplo:*\n` +
                `• !time on 5 30 - 5 min para mídia, timer dura 30 min\n` +
                `• !time on 10 - 10 min para mídia, timer dura 10 min\n\n` +
                `⚠️ *ATENÇÃO:* Remove usuários que não enviarem mídia!`
        });
      }

    } catch (error) {
      console.error('[ERROR] Erro no comando time:', error);
      await sock.sendMessage(groupJid, { 
        text: 'Eita, baby! 🫣 Deu erro no comando !time! Tenta de novo! 💋' 
      });
    }
  },
};

// FIX: Função para monitorar o temporizador
function startTimerMonitoring(sock: WASocket, groupJid: string, mediaDeadline: number, totalDuration: number) {
  const timer = activeTimers.get(groupJid);
  if (!timer) return;

  const checkInterval = setInterval(async () => {
    try {
      const currentTimer = activeTimers.get(groupJid);
      if (!currentTimer || !currentTimer.isActive) {
        clearInterval(checkInterval);
        return;
      }

      const now = new Date();
      const mediaTimeLeft = currentTimer.mediaDeadlineTime.getTime() - now.getTime();
      const totalTimeLeft = currentTimer.endTime.getTime() - now.getTime();
      const mediaMinutesLeft = Math.ceil(mediaTimeLeft / (60 * 1000));

      // FIX: Aviso aos 2 minutos finais do prazo para mídia
      if (mediaMinutesLeft === 2) {
        const pendingUsers = Array.from(currentTimer.participants)
          .filter(userId => !currentTimer.mediaSent.has(userId));

        if (pendingUsers.length > 0) {
          const warningMessage = `⚠️ *AVISO FINAL - 2 MINUTOS!* ⚠️\n\n` +
                                `@${pendingUsers.join(' @')}\n\n` +
                                `📱 *Vocês não enviaram mídia e serão removidos em 2 minutos!*\n\n` +
                                `_Enviem uma foto, vídeo ou áudio agora!_`;

          await sock.sendMessage(groupJid, { 
            text: warningMessage,
            mentions: pendingUsers
          });
        }
      }

      // FIX: Finalizar prazo de mídia (remover quem não enviou)
      if (mediaTimeLeft <= 0) {
        await finalizeMediaDeadline(sock, groupJid);
      }

      // FIX: Finalizar temporizador total
      if (totalTimeLeft <= 0) {
        clearInterval(checkInterval);
        await finalizeTimer(sock, groupJid);
      }

    } catch (error) {
      console.error('[ERROR] Erro no monitoramento do timer:', error);
    }
  }, 30000); // Verificar a cada 30 segundos
}

// FIX: Função para finalizar o prazo de mídia
async function finalizeMediaDeadline(sock: WASocket, groupJid: string) {
  try {
    const timer = activeTimers.get(groupJid);
    if (!timer) return;

    // FIX: Evitar executar duas vezes
    if (timer.mediaDeadlineCompleted) return;

    const usersToRemove = Array.from(timer.participants)
      .filter(userId => !timer.mediaSent.has(userId));

    if (usersToRemove.length > 0) {
      // FIX: Remover usuários que não enviaram mídia
      await sock.groupParticipantsUpdate(groupJid, usersToRemove, 'remove');

      const removedNames = await Promise.all(
        usersToRemove.map(async (userId) => {
          try {
            return await getUserDisplayName(sock, userId, groupJid);
          } catch {
            return userId.split('@')[0];
          }
        })
      );

      const deadlineMessage = `⏰ *PRAZO DE MÍDIA FINALIZADO!* ⏰\n\n` +
                             `✅ *Mídia enviada:* ${timer.mediaSent.size} pessoas\n` +
                             `❌ *Removidos:* ${usersToRemove.length} pessoas\n\n` +
                             `👥 *Removidos:*\n${removedNames.map(name => `• ${name}`).join('\n')}\n\n` +
                             `_Timer continua ativo até o fim da duração total._`;

      await sock.sendMessage(groupJid, { 
        text: deadlineMessage
      });

      // Limpar participantes removidos da lista
      for (const userId of usersToRemove) {
        timer.participants.delete(userId);
        timer.removedUsers.add(userId);
      }
    } else {
      await sock.sendMessage(groupJid, { 
        text: `🎉 *PRAZO DE MÍDIA FINALIZADO!*\n\n✅ Todos enviaram mídia! Ninguém foi removido.\n\n_Timer continua ativo até o fim da duração total._` 
      });
    }

    // FIX: Marcar que o prazo de mídia foi finalizado
    timer.mediaDeadlineCompleted = true;

  } catch (error) {
    console.error('[ERROR] Erro ao finalizar prazo de mídia:', error);
    await sock.sendMessage(groupJid, { 
      text: 'Eita, baby! 🫣 Deu erro ao finalizar o prazo de mídia! Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧' 
    });
  }
}

// FIX: Função para finalizar o temporizador
async function finalizeTimer(sock: WASocket, groupJid: string) {
  try {
    const timer = activeTimers.get(groupJid);
    if (!timer) return;

    // FIX: Se o prazo de mídia já foi finalizado, não precisa verificar novamente
    if (timer.mediaDeadlineCompleted) {
      const totalRemoved = timer.removedUsers.size;
      const totalSent = timer.mediaSent.size;
      
      if (totalRemoved > 0) {
        const removedNames = await Promise.all(
          Array.from(timer.removedUsers).map(async (userId) => {
            try {
              return await getUserDisplayName(sock, userId, groupJid);
            } catch {
              return userId.split('@')[0];
            }
          })
        );

        const finalMessage = `⏰ *TEMPORIZADOR FINALIZADO!* ⏰\n\n` +
                            `✅ *Mídia enviada:* ${totalSent} pessoas\n` +
                            `❌ *Removidos:* ${totalRemoved} pessoas\n\n` +
                            `👥 *Removidos:*\n${removedNames.map(name => `• ${name}`).join('\n')}\n\n` +
                            `_Temporizador encerrado automaticamente._`;

        await sock.sendMessage(groupJid, { 
          text: finalMessage
        });
      } else {
        await sock.sendMessage(groupJid, { 
          text: `🎉 *TEMPORIZADOR FINALIZADO!*\n\n✅ Todos enviaram mídia! Ninguém foi removido.` 
        });
      }
    } else {
      // FIX: Se o prazo de mídia não foi finalizado, verificar usuários pendentes
      const usersToRemove = Array.from(timer.participants)
        .filter(userId => !timer.mediaSent.has(userId));

      if (usersToRemove.length > 0) {
        // FIX: Remover usuários que não enviaram mídia
        await sock.groupParticipantsUpdate(groupJid, usersToRemove, 'remove');

        const removedNames = await Promise.all(
          usersToRemove.map(async (userId) => {
            try {
              return await getUserDisplayName(sock, userId, groupJid);
            } catch {
              return userId.split('@')[0];
            }
          })
        );

        const finalMessage = `⏰ *TEMPORIZADOR FINALIZADO!* ⏰\n\n` +
                            `✅ *Mídia enviada:* ${timer.mediaSent.size} pessoas\n` +
                            `❌ *Removidos:* ${usersToRemove.length} pessoas\n\n` +
                            `👥 *Removidos:*\n${removedNames.map(name => `• ${name}`).join('\n')}\n\n` +
                            `_Temporizador encerrado automaticamente._`;

        await sock.sendMessage(groupJid, { 
          text: finalMessage
        });
      } else {
        await sock.sendMessage(groupJid, { 
          text: `🎉 *TEMPORIZADOR FINALIZADO!*\n\n✅ Todos enviaram mídia! Ninguém foi removido.` 
        });
      }
    }

    activeTimers.delete(groupJid);

  } catch (error) {
    console.error('[ERROR] Erro ao finalizar timer:', error);
    await sock.sendMessage(groupJid, { 
      text: 'Eita, baby! 🫣 Deu erro ao finalizar o temporizador! Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧' 
    });
  }
}

// FIX: Função para registrar mídia enviada (será chamada pelo MessageManager)
export function registerMediaSent(groupJid: string, userJid: string, messageType?: string, isAdmin?: boolean, sock?: WASocket, message?: WAMessage) {
  console.log(`[DEBUG] registerMediaSent chamado:`, {
    groupJid,
    userJid,
    messageType,
    isAdmin
  });

  const timer = activeTimers.get(groupJid);
  console.log(`[DEBUG] Timer encontrado:`, {
    hasTimer: !!timer,
    isActive: timer?.isActive,
    hasParticipant: timer?.participants.has(userJid),
    participantsCount: timer?.participants.size,
    mediaSentCount: timer?.mediaSent.size
  });

  if (!timer || !timer.isActive) {
    console.log(`[DEBUG] Mídia ignorada - não há timer ativo`);
    return;
  }

  // NOVO: Verificar se é mensagem de visualização única
  const isViewOnceMessage = messageType === 'viewOnceMessage' || messageType === 'viewOnceMessageV2';
  const hasViewOnceMedia = message?.message?.viewOnceMessage?.message?.imageMessage ||
                          message?.message?.viewOnceMessage?.message?.videoMessage ||
                          message?.message?.viewOnceMessageV2?.message?.imageMessage ||
                          message?.message?.viewOnceMessageV2?.message?.videoMessage;

  // Só conta como mídia válida: foto, vídeo ou áudio (incluindo visualização única)
  const validTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'];
  const isValidMedia = validTypes.includes(messageType || '') || (isViewOnceMessage && hasViewOnceMedia);
  
  if (isValidMedia) {
    // Salva para admins e não-admins
    if (timer.participants.has(userJid)) {
      timer.mediaSent.add(userJid);
      if (invalidMediaAttempts.has(`${groupJid}:${userJid}`)) {
        invalidMediaAttempts.delete(`${groupJid}:${userJid}`);
      }
      console.log(`[TIMER] Mídia válida registrada para ${userJid} no grupo ${groupJid} (tipo: ${messageType})`);
    } else {
      console.log(`[TIMER] Mídia de admin registrada para ${userJid} no grupo ${groupJid} (tipo: ${messageType})`);
    }
    // Salva a mídia independente de ser admin ou não
    if (sock && message) {
      console.log(`[DEBUG] Iniciando download da mídia...`);
      downloadSimpleMedia(sock, message, groupJid, userJid);
    }
    return;
  }

  // Se for admin, ignora advertências
  if (isAdmin) {
    console.log(`[DEBUG] Mídia ignorada - usuário é admin e não é mídia válida`);
    return;
  }

  // Se for texto ou outro tipo de mídia, avisa, adverte e remove na terceira vez
  const key = `${groupJid}:${userJid}`;
  const attempts = invalidMediaAttempts.get(key) || 0;
  if (attempts === 0) {
    invalidMediaAttempts.set(key, 1);
    if (sock) {
      sock.sendMessage(groupJid, {
        text: `⚠️ @${userJid.split('@')[0]}, só vale *foto, vídeo ou áudio*! Se mandar de novo, será advertido.`,
        mentions: [userJid]
      });
    }
  } else if (attempts === 1) {
    invalidMediaAttempts.set(key, 2);
    if (sock) {
      sock.sendMessage(groupJid, {
        text: `🚨 @${userJid.split('@')[0]}, esta é sua *advertência*! Só vale foto, vídeo ou áudio. Se insistir, será removido.`,
        mentions: [userJid]
      });
    }
  } else {
    // Terceira tentativa: remove
    invalidMediaAttempts.delete(key);
    if (sock) {
      sock.groupParticipantsUpdate(groupJid, [userJid], 'remove');
      sock.sendMessage(groupJid, {
        text: `❌ @${userJid.split('@')[0]} foi removido por insistir em enviar mensagem inválida durante o temporizador!`,
        mentions: [userJid]
      });
    }
    // Também remove da lista de participantes do timer e adiciona ao registro de removidos
    timer.participants.delete(userJid);
    timer.removedUsers.add(userJid);
  }
}

// FIX: Função para verificar se há temporizador ativo
export function hasActiveTimer(groupJid: string): boolean {
  const timer = activeTimers.get(groupJid);
  return timer ? timer.isActive : false;
}

export default timeCommand; 