import { WASocket, proto } from '@whiskeysockets/baileys';
import { CommandHandler } from '@/core/CommandHandler';
import { AIService } from '@/services/AIService';
import { CommandCatalogService } from '@/services/CommandCatalogService';
import { GameService } from '@/services/GameService';
import { OwnerService } from '@/services/OwnerService';
import { GroupService } from '@/services/GroupService';
import { DatabaseService } from '@/services/DatabaseService';
import { BioExtractorService } from '@/services/BioExtractorService';
import { ISenderInfo } from '@/interfaces/ISenderInfo';
import { injectable, inject } from 'inversify';
import { ErrorLogger } from '@/utils/errorLogger';
import { getUserDisplayName } from '@/utils/userUtils';
import { registerMediaSent } from '@/commands/admin/time';
import { handlePrivatePhotoSubmission, handleGroupChoice, hasPendingChoice } from '@/commands/admin/brincadeira';
import { TYPES } from '@/config/container';
import { PersonalityService } from '@/services/PersonalityService';
import { messageDebug, conditionalDebug } from '@/utils/Logger';
import { handlePrivateConfessionSubmission, handleConfessionGroupChoice, hasPendingConfessionChoice } from '@/commands/admin/brincadeira';
import { ConfessionGame } from '@/commands/brincadeiras/confissao';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class MessageManager {
  private commandPrefix: string = '!'; // Prefixo para comandos
  // Controle de mensagens já processadas para evitar duplicidade (agora com TTL)
  private processedMessages = new Map<string, number>(); // Map<messageId, timestamp>
  private static readonly MESSAGE_TTL = 5 * 60 * 1000; // 5 minutos
  private cleanupInterval: NodeJS.Timeout;
  // NOVO: Controle de mensagens já salvas no banco
  private savedMessages = new Set<string>(); // Set<messageId>
  // FIX: Armazena o horário de quando o bot ficou online (não de inicialização)
  private botOnlineTime: number | null = null;

  constructor(
    @inject(TYPES.CommandHandler) private commandHandler: CommandHandler,
    @inject(TYPES.AIService) private aiService: AIService,
    @inject(TYPES.CommandCatalogService) private commandCatalogService: CommandCatalogService,
    @inject(TYPES.GameService) private gameService: GameService,
    @inject(TYPES.OwnerService) private ownerService: OwnerService,
    @inject(TYPES.GroupService) private groupService: GroupService,
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService,
    @inject(TYPES.PersonalityService) private personalityService: PersonalityService,
    @inject(TYPES.BioExtractorService) private bioExtractorService: BioExtractorService
  ) {
    // Inicia limpeza periódica
    this.cleanupInterval = setInterval(() => this.cleanupOldMessages(), 60 * 1000);
  }

  // NOVO: Método para marcar quando o bot ficou online
  public setBotOnline(): void {
    this.botOnlineTime = Date.now();
    messageDebug('Bot marcado como online em:', new Date(this.botOnlineTime).toISOString());
  }

  private cleanupOldMessages() {
    const now = Date.now();
    
    // Limpar mensagens processadas antigas
    for (const [messageId, timestamp] of this.processedMessages.entries()) {
      if (now - timestamp > MessageManager.MESSAGE_TTL) {
        this.processedMessages.delete(messageId);
      }
    }

    // NOVO: Limpar cache de mensagens salvas (manter apenas as últimas 1000)
    if (this.savedMessages.size > 1000) {
      const messagesArray = Array.from(this.savedMessages);
      const messagesToRemove = messagesArray.slice(0, messagesArray.length - 1000);
      messagesToRemove.forEach(id => this.savedMessages.delete(id));
      console.log(`[DEBUG] Limpeza de cache: removidas ${messagesToRemove.length} mensagens salvas antigas`);
    }
  }

  public async handleMessage(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      // FIX: Verificar se a mensagem é do próprio bot
      if (message.key.fromMe) {
        return;
      }

      // FIX: Verificar se a mensagem tem conteúdo válido
      if (!message.message || !message.key?.remoteJid) {
        messageDebug('Mensagem inválida, ignorando');
        return;
      }

      // FIX: Ignorar mensagens muito antigas (mais de 3 minutos)
      const messageTimestamp = message.messageTimestamp;
      if (typeof messageTimestamp !== 'number') {
        messageDebug('Mensagem sem timestamp numérico, ignorando');
        return;
      }
      
      const currentTime = Math.floor(Date.now() / 1000); // Converter para segundos
      const timeDiff = currentTime - messageTimestamp;
      const maxAgeMinutes = 3;
      const maxAgeSeconds = maxAgeMinutes * 60;
      
      if (timeDiff > maxAgeSeconds) {
        messageDebug(`Mensagem muito antiga ignorada - ${Math.round(timeDiff/60)} minutos de idade (limite: ${maxAgeMinutes} min)`);
        return;
      }

      // FIX: Melhorar filtro para ignorar mensagens de status, broadcast, lid
      const remoteJid = message.key.remoteJid;
      if (
        remoteJid.endsWith('@status') ||
        remoteJid.endsWith('@broadcast') ||
        remoteJid.endsWith('@newsletter')
      ) {
        messageDebug('Ignorando mensagem de status/broadcast/newsletter:', remoteJid);
        return;
      }

      // Ignorar tipos de mensagem que não são texto
      const statusTypes = [
        'protocolMessage',
        'senderKeyDistributionMessage',
        'messageContextInfo',
        'pollUpdateMessage',
        'pollCreationMessage',
        'ephemeralMessage',
        'deviceSentMessage',
        'documentWithCaptionMessage',
        'requestPaymentMessage',
        'paymentInviteMessage',
        'liveLocationMessage',
        'stickerMessage', // (opcional, se não quiser responder a stickers)
      ];
      const messageType = Object.keys(message.message!)[0];
      if (statusTypes.includes(messageType)) return;

      // NOVO: Processar reações de jogos
      if (messageType === 'reactionMessage' && remoteJid.endsWith('@g.us')) {
        try {
          messageDebug('Processando reação de jogo');
          // Processar reação do jogo PPP
          await this.handleGameReaction(sock, message, remoteJid, remoteJid.split('@')[0]);
          // Processar reação do jogo de confissão
          await this.handleConfessionReaction(sock, message, remoteJid, remoteJid.split('@')[0]);
          return; // Não processa como conversa normal
        } catch (error) {
          console.error('[ERROR] Erro ao processar reação de jogo:', error);
          await ErrorLogger.logError(error as Error, {
            messageId: message.key.id ?? undefined,
            jid: remoteJid,
            userId: remoteJid.split('@')[0],
            action: 'process_game_reaction'
          });
        }
      }

      // Evita processar a mesma mensagem mais de uma vez (agora com TTL)
      const messageId = message.key.id;
      if (!messageId) return; // Ignora mensagens sem ID
      if (this.processedMessages.has(messageId)) {
        return;
      }
      this.processedMessages.set(messageId, Date.now());
      // Não precisa mais limpar o Set manualmente, pois a limpeza é automática

      const text = message.message.conversation || 
                   message.message.extendedTextMessage?.text || 
                   message.message.imageMessage?.caption ||
                   message.message.videoMessage?.caption ||
                   message.message.documentMessage?.caption ||
                   '';
      messageDebug('Texto extraído:', text);
      messageDebug('Tipo de mensagem:', Object.keys(message.message || {}));
      const fromMe = message.key.fromMe;
      const participant = message.key.participant || remoteJid;
      const pushName = (message.pushName || '').trim();
      const timestamp = message.messageTimestamp;
      const isGroup = remoteJid.endsWith('@g.us');
      let groupName = '';
      let isAdmin = false;
      let activePersonality = 'padrao';
      
      if (isGroup) {
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          groupName = groupMetadata.subject;
          // Verificar se é admin
          const adminParticipant = groupMetadata.participants.find(p => p.id === participant);
          isAdmin = adminParticipant?.admin === 'admin' || adminParticipant?.admin === 'superadmin';
          
          // Buscar personalidade ativa do grupo
          const group = await this.groupService.getGroup(remoteJid);
          activePersonality = group?.activePersonality || 'padrao';
        } catch (e) {
          groupName = '';
          isAdmin = false;
          await ErrorLogger.logError(e as Error, {
            messageId: message.key.id ?? undefined,
            jid: remoteJid,
            userId: participant,
            action: 'get_group_metadata'
          });
        }
      }

      // NOVO: Salvar mensagem no banco de dados
      try {
        await this.saveMessageToDatabase(message, {
          text,
          messageType,
          isGroup,
          participant,
          activePersonality
        });
      } catch (error) {
        console.error('[ERROR] Erro ao salvar mensagem no banco:', error);
      }
      
      // FIX: Detectar mídia para o sistema de temporizador
      const isMediaMessage = [
        'imageMessage',
        'videoMessage', 
        'audioMessage',
        'documentMessage',
        'stickerMessage',
        'viewOnceMessage', // NOVO: Incluir visualização única
        'viewOnceMessageV2' // NOVO: Incluir visualização única v2
      ].includes(messageType);

      // NOVO: Detectar mídia dentro de visualização única
      const hasViewOnceMedia = message.message?.viewOnceMessage?.message?.imageMessage ||
                              message.message?.viewOnceMessage?.message?.videoMessage ||
                              message.message?.viewOnceMessageV2?.message?.imageMessage ||
                              message.message?.viewOnceMessageV2?.message?.videoMessage;

      const finalIsMediaMessage = isMediaMessage || hasViewOnceMedia;

      // FIX: Registrar mídia enviada se houver temporizador ativo
      if (finalIsMediaMessage && isGroup) {
        try {
          registerMediaSent(remoteJid, participant, messageType, isAdmin, sock, message);
        } catch (error) {
          console.error('[ERROR] Erro ao registrar mídia:', error);
        }
      }

      // FIX: Processar fotos privadas para o jogo PPP
      if (finalIsMediaMessage && !isGroup && messageType === 'imageMessage') {
        try {
          messageDebug('Processando foto privada para jogo PPP');
          await handlePrivatePhotoSubmission(sock, message, participant, this.gameService);
          return; // Não processa como conversa normal
        } catch (error) {
          console.error('[ERROR] Erro ao processar foto privada:', error);
          await ErrorLogger.logError(error as Error, {
            messageId: message.key.id ?? undefined,
            jid: remoteJid,
            userId: participant,
            action: 'process_private_photo'
          });
        }
      }

      // NOVO: Processar escolha de grupo para o jogo de confissão
      if (!isGroup && hasPendingConfessionChoice(participant)) {
        try {
          messageDebug('Processando escolha de grupo para jogo de confissão');
          const choice = text.trim();
          await handleConfessionGroupChoice(sock, message, participant, choice, this.gameService);
          return; // Não processa como conversa normal
        } catch (error) {
          console.error('[ERROR] Erro ao processar escolha de grupo de confissão:', error);
          await ErrorLogger.logError(error as Error, {
            messageId: message.key.id ?? undefined,
            jid: remoteJid,
            userId: participant,
            action: 'process_confession_group_choice'
          });
        }
      }

      // NOVO: Processar comandos específicos de confissão no privado (com ou sem prefixo !) - ANTES dos comandos normais
      console.log('[DEBUG] isGroup:', isGroup, 'messageType:', messageType, 'text:', text); // REFACTOR: log para debug
      if (!isGroup && (messageType === 'conversation' || messageType === 'extendedTextMessage')) {
        const lowerText = text.toLowerCase().trim();
        // DEBUG: Log para entender o que está acontecendo
        messageDebug(`[DEBUG] Verificando confissão - isGroup: ${isGroup}, messageType: ${messageType}, text: "${text}"`);
        // Verificar se é um comando de confissão (com ou sem prefixo !)
        const confessionCommands = ['!eununca', '!euja', '!umavez', 'eununca', 'euja', 'umavez'];
        const isConfessionCommand = confessionCommands.some(cmd => lowerText.startsWith(cmd));
        messageDebug(`[DEBUG] isConfessionCommand: ${isConfessionCommand}, lowerText: "${lowerText}"`);
        if (isConfessionCommand) {
          try {
            messageDebug(`Comando de confissão detectado: ${lowerText.split(' ')[0]}`);
            // Extrair a confissão (remover o comando)
            const commandPart = lowerText.split(' ')[0];
            const confession = text.substring(commandPart.length).trim();
            console.log('[DEBUG] Confissão extraída:', confession); // REFACTOR: log para debug
            console.log('[DEBUG] Comando extraído:', commandPart); // REFACTOR: log para debug
            
            if (confession.length < 10) {
              console.log('[DEBUG] Confissão muito curta, rejeitando'); // REFACTOR: log para debug
              await sock.sendMessage(remoteJid, { 
                text: 'Eita, baby! 🫣 Sua confissão tá muito curta! Escreva mais um pouquinho, pelo menos 10 caracteres! 💋' 
              });
              return;
            }

            // REFACTOR: Simplificar validação - aceitar qualquer texto após o comando
            console.log('[DEBUG] Confissão válida, processando...'); // REFACTOR: log para debug

            // Processar como confissão
            console.log('[DEBUG] Chamando ConfessionGame.processPrivateMessage'); // REFACTOR: log para debug
            await ConfessionGame.processPrivateMessage(sock, message, participant, this.gameService);
            console.log('[DEBUG] ConfessionGame.processPrivateMessage concluído'); // REFACTOR: log para debug
            return; // Não processa como conversa normal
          } catch (error) {
            console.error('[ERROR] Erro ao processar comando de confissão:', error);
            await ErrorLogger.logError(error as Error, {
              messageId: message.key.id ?? undefined,
              jid: remoteJid,
              userId: participant,
              action: 'process_confession_command'
            });
          }
        }
      }

      // NOVO: Verificar se é comando .bio (comando do Milton)
      if (text.toLowerCase().includes('.bio')) {
        messageDebug(`Comando .bio detectado de ${participant}`);
        
        try {
          // Extrair dados da bio
          const bioData = this.bioExtractorService.extractBioData(text, participant, remoteJid);
          
          if (bioData) {
            // Salvar no banco
            const success = await this.bioExtractorService.saveBioData(bioData);
            
            if (success) {
              messageDebug(`✅ Bio salva com sucesso para ${participant}`);
              // Não enviar resposta - o Milton vai responder
            } else {
              messageDebug(`❌ Erro ao salvar bio para ${participant}`);
            }
          } else {
            messageDebug(`Nenhum dado válido extraído da bio de ${participant}`);
          }
        } catch (error) {
          console.error('[ERROR] Erro ao processar comando .bio:', error);
        }
        
        // Não processar como conversa normal - deixar o Milton responder
        return;
      }

      // NOVO: Processar confissões privadas para o jogo de confissão (apenas se não for comando específico)
      if (!isGroup && messageType === 'conversation' && text.trim().length >= 10 && 
          !text.toLowerCase().trim().startsWith('!eununca') && 
          !text.toLowerCase().trim().startsWith('!euja') && 
          !text.toLowerCase().trim().startsWith('!umavez') &&
          !text.toLowerCase().trim().startsWith('eununca') && 
          !text.toLowerCase().trim().startsWith('euja') && 
          !text.toLowerCase().trim().startsWith('umavez')) {
        try {
          messageDebug('Processando confissão privada para jogo de confissão');
          await ConfessionGame.processPrivateMessage(sock, message, participant, this.gameService);
          return; // Não processa como conversa normal
        } catch (error) {
          console.error('[ERROR] Erro ao processar confissão privada:', error);
          await ErrorLogger.logError(error as Error, {
            messageId: message.key.id ?? undefined,
            jid: remoteJid,
            userId: participant,
            action: 'process_private_confession'
          });
        }
      }

      // FIX: Processar fotos do dono (broadcast e alterar foto)
      if (finalIsMediaMessage && !isGroup && this.isOwner(participant)) {
        try {
          messageDebug('Processando foto do dono');
          // Verificar se está aguardando foto para broadcast
          if (await this.ownerService.isWaitingForPhoto(remoteJid)) {
            messageDebug('Processando foto para broadcast');
            const result = await this.ownerService.broadcastPhoto(sock, message);
            await this.ownerService.setWaitingForPhoto(remoteJid, false);
            let resultMessage = `📢 *BROADCAST DE FOTO ENVIADO*\n\n` +
              `📊 *Resultado:*\n` +
              `✅ Enviado para: ${result.sentCount} grupos\n` +
              `❌ Falhou em: ${result.failedCount} grupos\n` +
              `⏱️ Tempo total: ${result.duration}ms`;

            // Adicionar detalhes dos erros se houver
            if (result.errors.length > 0) {
              resultMessage += `\n\n❌ *Erros Detalhados:*\n`;
              result.errors.slice(0, 5).forEach((error, index) => {
                resultMessage += `${index + 1}. ${error.groupName}: ${error.error}\n`;
              });
              
              if (result.errors.length > 5) {
                resultMessage += `... e mais ${result.errors.length - 5} erros\n`;
              }
            }

            await sock.sendMessage(remoteJid, { text: resultMessage });
            return;
          }

          // Verificar se está aguardando foto para alterar foto do perfil
          if (await this.ownerService.isWaitingForProfilePhoto(remoteJid)) {
            messageDebug('Processando foto para alterar perfil');
            const result = await this.ownerService.changeProfilePhoto(sock, message);
            await this.ownerService.setWaitingForProfilePhoto(remoteJid, false);
            
            const resultMessage = result.success
              ? `✅ *FOTO DO PERFIL ALTERADA COM SUCESSO!*\n\nA nova foto já está ativa no perfil do bot.`
              : `❌ *ERRO AO ALTERAR FOTO DO PERFIL*\n\nErro: ${result.error}`;
            
            await sock.sendMessage(remoteJid, { text: resultMessage });
            return;
          }
        } catch (error) {
          console.error('[ERROR] Erro ao processar foto do dono:', error);
          await ErrorLogger.logError(error as Error, {
            messageId: message.key.id ?? undefined,
            jid: remoteJid,
            userId: participant,
            action: 'process_owner_photo'
          });
        }
      }

      // FIX: Processar escolha de grupo para o jogo PPP
      if (!isGroup && hasPendingChoice(participant)) {
        try {
          messageDebug('Processando escolha de grupo para jogo PPP');
          const choice = text.trim();
          await handleGroupChoice(sock, message, participant, choice, this.gameService);
          return; // Não processa como conversa normal
        } catch (error) {
          console.error('[ERROR] Erro ao processar escolha de grupo:', error);
          await ErrorLogger.logError(error as Error, {
            messageId: message.key.id ?? undefined,
            jid: remoteJid,
            userId: participant,
            action: 'process_group_choice'
          });
        }
      }

      // FIX: Verificar se o bot foi mencionado (apenas em grupos)
      if (isGroup && message.message.extendedTextMessage?.contextInfo?.mentionedJid) {
        messageDebug('=== ANÁLISE DETALHADA DE MENÇÕES ===');
        messageDebug('Mensagem completa:', JSON.stringify(message, null, 2));
        messageDebug('Menções encontradas:', message.message.extendedTextMessage.contextInfo.mentionedJid);
        messageDebug('ID do bot:', sock.user?.id);
        messageDebug('Tipo do ID do bot:', typeof sock.user?.id);
        
        // FIX: Função para normalizar JIDs corretamente
        const normalizeJid = (jid: string): string => {
          // Remove sufixo de dispositivo se existir (:12)
          const cleanJid = jid.split(':')[0];
          // Adiciona @s.whatsapp.net apenas se não existir
          return cleanJid.includes('@s.whatsapp.net') ? cleanJid : `${cleanJid}@s.whatsapp.net`;
        };
        
        // Normalizar ID do bot
        const botId = normalizeJid(sock.user?.id ?? '');
        
        // Normalizar menções
        const normalizedMentions = message.message.extendedTextMessage.contextInfo.mentionedJid.map(normalizeJid);
        
        messageDebug('ID do bot normalizado:', botId);
        messageDebug('Menções normalizadas:', normalizedMentions);
        messageDebug('Tipos das menções normalizadas:', normalizedMentions.map(jid => typeof jid));
        
        // Verificar se o bot foi mencionado
        const botWasMentioned = normalizedMentions.includes(botId);
        
        messageDebug('Resultado da verificação:', botWasMentioned);
        messageDebug('=== FIM DA ANÁLISE ===');
        
        if (botWasMentioned) {
          messageDebug('✅ Bot foi mencionado corretamente!');
          
          // NOVO: Salvar interação com IA no banco
          try {
            await this.saveMessageToDatabase(message, {
              text,
              messageType,
              isGroup,
              participant,
              activePersonality,
              isAIInteraction: true
            });
          } catch (error) {
            console.error('[ERROR] Erro ao salvar interação IA:', error);
          }

          // Processar com IA
          await this.handleAIResponse(sock, message, text, participant, remoteJid, activePersonality);
          return;
        } else {
          messageDebug('❌ Bot NÃO foi reconhecido como mencionado.');
        }
      }

      // FIX: Verificar se é resposta a uma mensagem do bot (apenas em grupos)
      if (isGroup && message.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        // NOVO: Verificar se a mensagem citada é realmente do bot
        const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
        const quotedFromMe = (quotedMessage as any)?.key?.fromMe;
        
        if (quotedFromMe) {
          messageDebug('Resposta a mensagem do bot detectada, processando com IA');
          
          // NOVO: Salvar interação com IA no banco
          try {
            await this.saveMessageToDatabase(message, {
              text,
              messageType,
              isGroup,
              participant,
              activePersonality,
              isAIInteraction: true
            });
          } catch (error) {
            console.error('[ERROR] Erro ao salvar interação IA:', error);
          }

          // Processar com IA
          await this.handleAIResponse(sock, message, text, participant, remoteJid, activePersonality);
          return;
        } else {
          messageDebug('Resposta a mensagem de outro usuário, ignorando');
          return;
        }
      }

      // FIX: Verificar se é comando com prefixo !
      if (text.startsWith(this.commandPrefix)) {
        messageDebug(`Comando detectado: ${text}`);
        
        try {
          // Extrair comando e argumentos
          const commandText = text.slice(this.commandPrefix.length);
          const [commandName, ...args] = commandText.split(' ');
          
          messageDebug(`Executando comando: ${commandName} com args:`, args);
          
          // Executar comando
          await this.commandHandler.executeCommand(commandName, sock, message, args);
          return;
        } catch (error) {
          console.error('[ERROR] Erro ao executar comando:', error);
          await ErrorLogger.logError(error as Error, {
            messageId: message.key.id ?? undefined,
            jid: remoteJid,
            userId: participant,
            action: 'execute_command',
            command: text
          });
          
          // Enviar mensagem de erro para o usuário
          const errorMessage = '❌ Erro ao executar comando. Tente novamente ou use `!menu` para ver os comandos disponíveis.';
          await sock.sendMessage(remoteJid, { text: errorMessage });
          return;
        }
      }

      // FIX: Verificar se é mensagem privada (não comando)
      if (!isGroup && !text.startsWith(this.commandPrefix) && text.trim().length > 0) {
        messageDebug('Mensagem privada detectada, processando com IA');
        
        // NOVO: Salvar interação com IA no banco
        try {
          await this.saveMessageToDatabase(message, {
            text,
            messageType,
            isGroup,
            participant,
            activePersonality,
            isAIInteraction: true
          });
        } catch (error) {
          console.error('[ERROR] Erro ao salvar interação IA:', error);
        }

        // Processar com IA
        await this.handleAIResponse(sock, message, text, participant, remoteJid, activePersonality);
        return;
      }

      // FIX: Se chegou até aqui, é uma mensagem que não deve ser respondida
      messageDebug('Mensagem ignorada - não é comando, menção, resposta ao bot ou mensagem privada');

    } catch (error) {
      console.error('[ERROR] Erro no handleMessage:', error);
      await ErrorLogger.logError(error as Error, {
        messageId: message.key.id ?? undefined,
        jid: message.key.remoteJid ?? undefined,
        userId: message.key.participant ?? message.key.remoteJid ?? undefined,
        action: 'handle_message'
      });
    }
  }

  // NOVO: Método para processar respostas da IA
  private async handleAIResponse(
    sock: WASocket, 
    message: WAMessage, 
    text: string, 
    participant: string, 
    remoteJid: string, 
    activePersonality: string
  ): Promise<void> {
    try {
      const startTime = Date.now();
      
      // NOVO: Buscar perfil do usuário para incluir na resposta da IA
      let userProfileInfo = '';
      try {
        const userProfile = await this.bioExtractorService.getUserProfile(participant, remoteJid);
        if (userProfile) {
          userProfileInfo = this.bioExtractorService.formatProfileForAI(userProfile);
          messageDebug(`Perfil encontrado para ${participant}: ${userProfileInfo}`);
        }
      } catch (error) {
        messageDebug(`Erro ao buscar perfil de ${participant}:`, error);
      }
      
      // Obter resposta da IA
      const aiResponse = await this.aiService.getChatResponse({
        jid: remoteJid,
        text: text,
        senderInfo: {
          jid: participant,
          number: participant.split('@')[0],
          name: participant.split('@')[0],
          isGroup: remoteJid.endsWith('@g.us'),
          groupJid: remoteJid.endsWith('@g.us') ? remoteJid : undefined,
          groupName: '',
          timestamp: Date.now(),
          messageType: 'text'
        },
        // NOVO: Incluir informações do perfil do usuário
        userProfile: userProfileInfo
      });

      const processingTime = Date.now() - startTime;

      if (aiResponse) {
        // Enviar resposta
        await sock.sendMessage(remoteJid, { text: aiResponse });
        
        // Salvar resposta da IA no banco com contexto
        await this.saveMessageToDatabase(message, {
          text: aiResponse,
          messageType: 'textMessage',
          isGroup: remoteJid.endsWith('@g.us'),
          participant: sock.user?.id || 'bot',
          activePersonality: activePersonality,
          isAIInteraction: true,
          processingTime: processingTime,
          aiModel: 'gemini-2.0-flash'
        });

        // Registrar uso de comando de IA
        await this.databaseService.saveCommandUsage(
          remoteJid, 
          'ai_response', 
          participant,
          {
            success: true,
            executionTime: processingTime,
            isAIResponse: true
          }
        );
      }
    } catch (error) {
      console.error('[ERROR] Erro ao processar resposta de IA:', error);
      
      // Salvar erro no banco
      await this.databaseService.saveErrorLog({
        error: error instanceof Error ? error.message : 'Erro desconhecido na IA',
        stack: error instanceof Error ? error.stack : undefined,
        user: participant,
        group: remoteJid.endsWith('@g.us') ? remoteJid : undefined,
        command: 'ai_response',
        location: 'MessageManager.handleAIResponse',
        severity: 'high'
      });

      // Registrar falha no uso de comando
      await this.databaseService.saveCommandUsage(
        remoteJid, 
        'ai_response', 
        participant,
        {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          isAIResponse: true
        }
      );
    }
  }

  // NOVO: Método para salvar mensagem no banco de dados
  private async saveMessageToDatabase(
    message: WAMessage, 
    context: {
      text: string;
      messageType: string;
      isGroup: boolean;
      participant: string;
      activePersonality: string;
      isAIInteraction?: boolean;
      processingTime?: number;
      aiModel?: string;
    }
  ): Promise<void> {
    try {
      // NOVO: Verificar se a mensagem já foi salva
      const messageId = message.key.id;
      if (!messageId) {
        messageDebug('[WARN] Tentativa de salvar mensagem sem ID');
        return;
      }

      // Se é uma resposta de IA, usar um ID único
      const isAIResponse = context.isAIInteraction || false;
      const finalMessageId = isAIResponse ? `${messageId}_ai_response` : messageId;

      // Verificar se já foi salva
      if (this.savedMessages.has(finalMessageId)) {
        messageDebug('[DEBUG] Mensagem já salva no banco, ignorando:', finalMessageId);
        return;
      }

      // Determinar se é resposta de IA
      const isAIResponseFlag = context.isAIInteraction || false;
      
      // Extrair informações de mídia
      const mediaInfo = this.extractMediaInfo(message);
      
      // Extrair informações de menções
      const mentions = this.extractMentions(message);
      
      // Extrair informações de mensagem citada
      const quotedMessage = this.extractQuotedMessage(message);
      
      // Extrair informações de encaminhamento
      const forwardedFrom = this.extractForwardedInfo(message);

      const messageData = {
        _id: finalMessageId, // Usar ID único para respostas de IA
        jid: message.key.remoteJid!,
        from: context.participant,
        to: message.key.remoteJid!,
        participant: message.key.participant || undefined,
        timestamp: Number(message.messageTimestamp),
        type: context.messageType,
        text: context.text,
        media: mediaInfo,
        quotedMessage: quotedMessage,
        isFromMe: message.key.fromMe || false,
        isGroup: context.isGroup,
        mentions: mentions,
        commandUsed: context.text.startsWith(this.commandPrefix) ? {
          name: context.text.slice(this.commandPrefix.length).split(' ')[0].toLowerCase(),
          args: context.text.slice(this.commandPrefix.length).split(' ').slice(1)
        } : undefined,
        personality: isAIResponseFlag ? context.activePersonality : undefined,
        // NOVOS CAMPOS
        messageId: message.key.id!,
        mediaType: mediaInfo?.type,
        context: {
          isAIResponse: isAIResponseFlag,
          aiModel: context.aiModel || 'gemini-2.0-flash',
          processingTime: context.processingTime
        },
        forwardedFrom: forwardedFrom,
        botVersion: '2.0.0',
        userAgent: message.pushName || undefined
      };

      try {
        await this.databaseService.saveMessage(messageData);
        // NOVO: Marcar como salva
        this.savedMessages.add(finalMessageId);
        messageDebug('[DEBUG] Mensagem salva com sucesso:', finalMessageId);
      } catch (error: any) {
        if (error.code === 11000) {
          // Mensagem já existe, não precisa salvar de novo
          messageDebug('[WARN] Mensagem duplicada, ignorando:', finalMessageId);
          // Marcar como salva mesmo assim para evitar tentativas futuras
          this.savedMessages.add(finalMessageId);
        } else {
          console.error('[ERROR] Erro ao salvar mensagem no banco:', error);
        }
      }
    } catch (error) {
      console.error('[ERROR] Erro ao salvar mensagem no banco:', error);
      // Não propaga o erro para não interromper o processamento da mensagem
    }
  }

  // NOVOS MÉTODOS AUXILIARES

  private extractMediaInfo(message: WAMessage): any {
    const messageContent = message.message;
    if (!messageContent) return undefined;

    // Verificar diferentes tipos de mídia
    if (messageContent.imageMessage) {
      return {
        type: 'image',
        mimetype: messageContent.imageMessage.mimetype,
        size: messageContent.imageMessage.fileLength
      };
    } else if (messageContent.videoMessage) {
      return {
        type: 'video',
        mimetype: messageContent.videoMessage.mimetype,
        size: messageContent.videoMessage.fileLength
      };
    } else if (messageContent.audioMessage) {
      return {
        type: 'audio',
        mimetype: messageContent.audioMessage.mimetype,
        size: messageContent.audioMessage.fileLength
      };
    } else if (messageContent.documentMessage) {
      return {
        type: 'document',
        mimetype: messageContent.documentMessage.mimetype,
        size: messageContent.documentMessage.fileLength
      };
    } else if (messageContent.stickerMessage) {
      return {
        type: 'sticker',
        mimetype: messageContent.stickerMessage.mimetype,
        size: messageContent.stickerMessage.fileLength
      };
    }

    return undefined;
  }

  private extractMentions(message: WAMessage): string[] {
    const messageContent = message.message;
    if (!messageContent) return [];

    // Extrair menções de diferentes tipos de mensagem
    if (messageContent.extendedTextMessage?.contextInfo?.mentionedJid) {
      return messageContent.extendedTextMessage.contextInfo.mentionedJid;
    } else if (messageContent.imageMessage?.contextInfo?.mentionedJid) {
      return messageContent.imageMessage.contextInfo.mentionedJid;
    } else if (messageContent.videoMessage?.contextInfo?.mentionedJid) {
      return messageContent.videoMessage.contextInfo.mentionedJid;
    }

    return [];
  }

  private extractQuotedMessage(message: WAMessage): any {
    const messageContent = message.message;
    if (!messageContent) return undefined;

    // Extrair mensagem citada de diferentes tipos
    const contextInfo = messageContent.extendedTextMessage?.contextInfo ||
                       messageContent.imageMessage?.contextInfo ||
                       messageContent.videoMessage?.contextInfo ||
                       messageContent.audioMessage?.contextInfo ||
                       messageContent.documentMessage?.contextInfo;

    if (contextInfo?.quotedMessage) {
      return {
        id: contextInfo.stanzaId,
        text: contextInfo.quotedMessage.conversation || 
              contextInfo.quotedMessage.extendedTextMessage?.text ||
              contextInfo.quotedMessage.imageMessage?.caption ||
              contextInfo.quotedMessage.videoMessage?.caption,
        from: contextInfo.participant || contextInfo.remoteJid
      };
    }

    return undefined;
  }

  private extractForwardedInfo(message: WAMessage): any {
    const messageContent = message.message;
    if (!messageContent) return undefined;

    // Verificar se é mensagem encaminhada
    const contextInfo = messageContent.extendedTextMessage?.contextInfo ||
                       messageContent.imageMessage?.contextInfo ||
                       messageContent.videoMessage?.contextInfo ||
                       messageContent.audioMessage?.contextInfo ||
                       messageContent.documentMessage?.contextInfo;

    if (contextInfo?.isForwarded) {
      return {
        originalJid: contextInfo.remoteJid,
        originalMessageId: contextInfo.stanzaId,
        originalSender: contextInfo.participant || contextInfo.remoteJid
      };
    }

    return undefined;
  }

  // NOVO: Método para verificar se é o dono
  private isOwner(participant: string): boolean {
    const userNumber = participant.split('@')[0];
    const authorizedOwnerIds = [
      '5521967233931', // Número original
      '109311313363133' // ID que está chegando
    ];
    return authorizedOwnerIds.includes(userNumber);
  }

  // FIX: Novo método para obter nome de usuário otimizado para menções
  private async getUserDisplayNameForMention(
    sock: WASocket, 
    userJid: string, 
    groupJid: string,
    fallbackName?: string | null
  ): Promise<string> {
    try {
      // Se temos um nome de fallback válido, use-o primeiro
      if (fallbackName && fallbackName.trim() && fallbackName.trim().length > 0) {
        return fallbackName.trim();
      }

      // Se é um grupo, tenta obter o nome do participante
      if (groupJid && groupJid.endsWith('@g.us')) {
        try {
          const groupMetadata = await sock.groupMetadata(groupJid);
          const participant = groupMetadata.participants.find(p => p.id === userJid);
          
          // Prioriza o nome do participante no grupo
          if (participant?.name && participant.name.trim() && participant.name.trim().length > 0) {
            return participant.name.trim();
          }
        } catch (error) {
          messageDebug('[DEBUG] Erro ao obter metadata do grupo para menção:', error);
          // Ignora erro e continua
        }
      }

      // Se não conseguiu, retorna o número sem o código do país
      const number = userJid.split('@')[0];
      // Remove o código do país se presente (assume que começa com 55)
      if (number.startsWith('55') && number.length > 10) {
        return number.substring(2); // Remove o 55
      }
      return number;
    } catch (error) {
      messageDebug('[DEBUG] Erro geral em getUserDisplayNameForMention:', error);
      // Em caso de erro, retorna o número sem código do país
      const number = userJid.split('@')[0];
      if (number.startsWith('55') && number.length > 10) {
        return number.substring(2);
      }
      return number;
    }
  }

  // NOVO: Método unificado para criar menções com nome real
  private async createMentionWithName(
    sock: WASocket,
    userJid: string,
    groupJid: string,
    messageText: string,
    fallbackName?: string | null
  ): Promise<{ text: string; mentions: string[] }> {
    try {
      const displayName = await this.getUserDisplayNameForMention(sock, userJid, groupJid, fallbackName);
      
      // Se conseguimos obter um nome real (não é só número), usar o nome
      const userNumber = userJid.split('@')[0];
      const isRealName = displayName !== userNumber && displayName !== userNumber.substring(2);
      
      if (isRealName) {
        // Usar o nome real na menção
        const mentionText = `@${displayName} ${messageText}`;
        return { text: mentionText, mentions: [userJid] };
      } else {
        // Fallback para número se não conseguir nome real
        const cleanNumber = userNumber.startsWith('55') && userNumber.length > 10 ? userNumber.substring(2) : userNumber;
        const mentionText = `@${cleanNumber} ${messageText}`;
        return { text: mentionText, mentions: [userJid] };
      }
    } catch (error) {
      messageDebug('[DEBUG] Erro ao criar menção com nome, usando fallback:', error);
      // Fallback para número em caso de erro
      const userNumber = userJid.split('@')[0];
      const cleanNumber = userNumber.startsWith('55') && userNumber.length > 10 ? userNumber.substring(2) : userNumber;
      const mentionText = `@${cleanNumber} ${messageText}`;
      return { text: mentionText, mentions: [userJid] };
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // FIX: Método para processar reações do jogo PPP
  private async handleGameReaction(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      // Verificar se há jogo no grupo (ativo ou inativo)
      const game = await this.gameService.findLastGameByGroupId(groupJid);
      if (!game) {
        messageDebug('[DEBUG] Nenhum jogo PPP encontrado no grupo, ignorando reação');
        return;
      }

      // Extrair informações da reação
      const reactionMessage = message.message?.reactionMessage;
      if (!reactionMessage) {
        messageDebug('[DEBUG] Mensagem de reação inválida');
        return;
      }

      const reactionText = reactionMessage.text;
      messageDebug(`[DEBUG] Reação recebida: "${reactionText}" de ${userJid}`);
      
      if (!reactionText) {
        messageDebug('[DEBUG] Reação sem texto');
        return;
      }

      // Mapear emoji para tipo de reação (mais abrangente)
      let reactionType: 'pego' | 'penso' | 'passo' | null = null;
      
      // Detectar "pego"
      if (reactionText.includes('😏') || 
          reactionText.includes('pego') || 
          reactionText.includes('Pego') ||
          reactionText.includes('😍') ||
          reactionText.includes('🥵') ||
          reactionText.includes('🔥')) {
        reactionType = 'pego';
      } 
      // Detectar "penso"
      else if (reactionText.includes('🤔') || 
               reactionText.includes('penso') || 
               reactionText.includes('Penso') ||
               reactionText.includes('🤷') ||
               reactionText.includes('😐') ||
               reactionText.includes('🤨')) {
        reactionType = 'penso';
      } 
      // Detectar "passo"
      else if (reactionText.includes('😵‍💫') || 
               reactionText.includes('passo') || 
               reactionText.includes('Passo') ||
               reactionText.includes('😵') ||
               reactionText.includes('🤢') ||
               reactionText.includes('💀') ||
               reactionText.includes('😱')) {
        reactionType = 'passo';
      }

      if (!reactionType) {
        messageDebug('[DEBUG] Reação não reconhecida:', reactionText);
        return;
      }

      messageDebug(`[DEBUG] Reação PPP detectada: ${userJid} -> ${reactionType} (jogo ${game.isActive ? 'ativo' : 'inativo'})`);

      // Adicionar reação ao jogo
      await this.gameService.addReaction(groupJid, {
        reactorJid: userJid,
        reactionType
      });

      messageDebug(`[DEBUG] Reação PPP registrada com sucesso: ${userJid} -> ${reactionType}`);

    } catch (error) {
      console.error('[ERROR] Erro ao processar reação do jogo PPP:', error);
      throw error;
    }
  }

  // NOVO: Método para processar reações do jogo de confissão
  private async handleConfessionReaction(sock: WASocket, message: WAMessage, groupJid: string, userJid: string): Promise<void> {
    try {
      // Verificar se há jogo de confissão no grupo (ativo ou inativo)
      const game = await this.gameService.findLastConfessionGameByGroupId(groupJid);
      if (!game) {
        messageDebug('[DEBUG] Nenhum jogo de confissão encontrado no grupo, ignorando reação');
        return;
      }

      // Extrair informações da reação
      const reactionMessage = message.message?.reactionMessage;
      if (!reactionMessage) {
        messageDebug('[DEBUG] Mensagem de reação inválida');
        return;
      }

      const reactionText = reactionMessage.text;
      messageDebug(`[DEBUG] Reação de confissão recebida: "${reactionText}" de ${userJid}`);
      
      if (!reactionText) {
        messageDebug('[DEBUG] Reação sem texto');
        return;
      }

      // Mapear emoji para tipo de reação de confissão
      let reactionType: 'euTambem' | 'chocado' | 'mico' | null = null;
      
      // Detectar "Eu Também!"
      if (reactionText.includes('🙋‍♂️') || 
          reactionText.includes('eu tambem') || 
          reactionText.includes('Eu Também') ||
          reactionText.includes('eu também') ||
          reactionText.includes('Eu Tambem') ||
          reactionText.includes('🙋') ||
          reactionText.includes('👍') ||
          reactionText.includes('✅')) {
        reactionType = 'euTambem';
      } 
      // Detectar "Chocado(a)!"
      else if (reactionText.includes('😱') || 
               reactionText.includes('chocado') || 
               reactionText.includes('Chocado') ||
               reactionText.includes('chocada') ||
               reactionText.includes('Chocada') ||
               reactionText.includes('😨') ||
               reactionText.includes('😰') ||
               reactionText.includes('🤯') ||
               reactionText.includes('💀')) {
        reactionType = 'chocado';
      } 
      // Detectar "Que Mico!"
      else if (reactionText.includes('😂') || 
               reactionText.includes('mico') || 
               reactionText.includes('Mico') ||
               reactionText.includes('mico!') ||
               reactionText.includes('Mico!') ||
               reactionText.includes('😅') ||
               reactionText.includes('🤣') ||
               reactionText.includes('😆') ||
               reactionText.includes('😄')) {
        reactionType = 'mico';
      }

      if (!reactionType) {
        messageDebug('[DEBUG] Reação de confissão não reconhecida:', reactionText);
        return;
      }

      messageDebug(`[DEBUG] Reação de confissão detectada: ${userJid} -> ${reactionType} (jogo ${game.isActive ? 'ativo' : 'inativo'})`);

      // Adicionar reação ao jogo de confissão
      await this.gameService.addConfessionReaction(groupJid, {
        reactorJid: userJid,
        reactionType
      });

      messageDebug(`[DEBUG] Reação de confissão registrada com sucesso: ${userJid} -> ${reactionType}`);

    } catch (error) {
      console.error('[ERROR] Erro ao processar reação do jogo de confissão:', error);
      throw error;
    }
  }
}
