import {
  downloadMediaMessage,
  isJidGroup,
  jidNormalizedUser,
  type WAMessage,
  type WASocket,
  type MessageUpsertType,
} from '@whiskeysockets/baileys';
import fs from 'fs/promises';
import path from 'path';
import { CommandHandler } from '../core/CommandHandler';
import { AIService } from '../services/AIService';
import { GameService } from '../services/GameService';
import { BioExtractorService } from '../services/BioExtractorService';
import { MediaCaptureService } from '../services/MediaCaptureService';
import { ViewOnceWatcherService } from '../services/ViewOnceWatcherService';
import { container } from '../core/container';
import { TYPES } from '../config/container';

// MELHORIA: Instância única do CommandHandler (Singleton Pattern)
const commandHandler = new CommandHandler();
// MELHORIA: Carrega os comandos uma única vez na inicialização
commandHandler.loadCommands();

// NOVO: Instância do ViewOnceWatcherService (sistema independente)
let viewOnceWatcher: ViewOnceWatcherService;

// REFACTOR: Remover instâncias globais que causam problemas de inicialização
// const bioExtractorService = container.get<BioExtractorService>(TYPES.BioExtractorService);
// const mediaCaptureService = container.get<MediaCaptureService>(TYPES.MediaCaptureService);

// // MELHORIA: Placeholders para os handlers que serão implementados ou conectados
// import { processarComGemini, processarImagemComGemini } from '../services/AIService';
// import { handleGameInput } from '../services/GameService';

// Interface para nosso objeto de Contexto, padronizando os dados da mensagem
export interface MessageContext {
  sock: WASocket;
  messageInfo: WAMessage;
  text: string;
  isGroup: boolean;
  isCommand: boolean;
  command?: string;
  args: string[];
  isReplyToBot: boolean;
  isMentioningBot: boolean;
  hasMedia: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  isViewOnce: boolean;
  from: string;
  sender: string;
}

/**
 * Ponto de entrada central para todas as mensagens.
 * Atua como um roteador para diferentes handlers, seguindo uma ordem de prioridade.
 */
export const handleMessageUpsert = async (sock: WASocket, upsert: { messages: WAMessage[], type: MessageUpsertType }) => {
  const messageInfo = upsert.messages[0];

  // LOG DE BAIXO NÍVEL
  console.log('[RAW MESSAGE]', JSON.stringify(messageInfo.message, null, 2));

  // 1. FILTRAGEM ESSENCIAL: Ignora mensagens próprias, sem conteúdo ou de listas de transmissão/canais.
  if (!messageInfo.message || messageInfo.key.fromMe) {
    return;
  }
  if (messageInfo.key.remoteJid?.endsWith('@broadcast') || messageInfo.key.remoteJid?.endsWith('@newsletter')) {
    return;
  }

  // NOVO: SISTEMA INDEPENDENTE DE OBSERVAÇÃO DE VISUALIZAÇÕES ÚNICAS
  // Este sistema roda ANTES de qualquer outro processamento
  try {
    if (!viewOnceWatcher) {
      viewOnceWatcher = container.get<ViewOnceWatcherService>(TYPES.ViewOnceWatcherService);
    }
    
    // Processa a mensagem no observador independente (sempre ativo)
    await viewOnceWatcher.processMessage(sock, messageInfo);
  } catch (error) {
    console.error('[ViewOnceWatcher] Erro no sistema independente:', error);
  }

  // 2. CRIAÇÃO DE CONTEXTO: Monta um objeto padronizado com todas as informações relevantes.
  const context = await createMessageContext(sock, messageInfo);
  if (!context) return; // Se não for possível criar contexto, ignora

  // NOVO: Captura automática de mídia (antes de qualquer processamento)
  if (context.hasMedia) {
    try {
      const mediaCaptureService = container.get<MediaCaptureService>(TYPES.MediaCaptureService);
      if (mediaCaptureService.hasMedia(messageInfo)) {
        console.log('[MediaCapture] Mídia detectada, iniciando captura...');
        await mediaCaptureService.captureMedia(sock, messageInfo);
      }
    } catch (error) {
      console.error('[MediaCapture] Erro ao capturar mídia:', error);
    }
  }

  // 3. ROTEAMENTO POR PRIORIDADE
  
  // Prioridade 1: Interação com IA (Menção ou Resposta direta ao Bot) + Mídia
  if ((context.isReplyToBot || context.isMentioningBot) && context.hasMedia) {
    console.log('[ROTEAMENTO] 🎯 Prioridade 1: IA + Mídia detectada');
    await handleAiMediaInteraction(context);
    return;
  }

  // Prioridade 1.5: Interação com IA (Menção ou Resposta direta ao Bot) - Só texto
  if (context.isReplyToBot || context.isMentioningBot) {
    console.log('[ROTEAMENTO] 🎯 Prioridade 1.5: IA + Texto detectada');
    await handleAiInteraction(context);
    return;
  }

  // Prioridade 2: Processamento de mensagens .bio
  if (context.text.toLowerCase().includes('.bio')) {
    console.log('[ROTEAMENTO] 🎯 Prioridade 2: Comando .bio detectado');
    await handleBioMessage(context);
    return;
  }

  // Prioridade 3: Comandos explícitos com '!'
  if (context.isCommand) {
    console.log('[ROTEAMENTO] 🎯 Prioridade 3: Comando detectado');
    await commandHandler.handle(context); // Delega para o CommandHandler
    return;
  }

  // Prioridade 4: Mensagens para Jogos Ativos (apenas em chat privado)
  if (!context.isGroup) {
    console.log('[ROTEAMENTO] 🎯 Prioridade 4: Jogo em privado detectado');
    const gameHandled = await GameService.processInput(context); // Delega para o GameService
    if (gameHandled) {
        return; // Encerra o fluxo se o GameService processou a mensagem
    }
  }
  
  // Se nenhuma das condições acima for atendida, a mensagem é ignorada.
  console.log('[ROTEAMENTO] ❌ Nenhuma prioridade atendida, mensagem ignorada');
};

/**
 * Cria um objeto de contexto padronizado a partir de uma nova mensagem.
 * @param sock A instância do socket.
 * @param messageInfo A informação da mensagem recebida.
 * @returns Um objeto MessageContext ou null se informações essenciais estiverem faltando.
 */
async function createMessageContext(sock: WASocket, messageInfo: WAMessage): Promise<MessageContext | null> {
  const botJid = sock.user?.id;
  if (!messageInfo.message || !botJid) return null;

  const messageContent = messageInfo.message;
  const contextInfo = messageContent.extendedTextMessage?.contextInfo;

  const text = messageContent.conversation || 
               messageContent.extendedTextMessage?.text || 
               messageContent.imageMessage?.caption || 
               messageContent.videoMessage?.caption || '';

  // 1. CORREÇÃO DA RESPOSTA AO BOT
  const isReply = !!contextInfo?.quotedMessage;
  const isReplyToBot = isReply && jidNormalizedUser(contextInfo?.participant || '') === jidNormalizedUser(botJid);

  // 2. CORREÇÃO DA MENÇÃO AO BOT
  const mentionedJids = contextInfo?.mentionedJid || [];
  const isMentioningBot = mentionedJids.map(jid => jidNormalizedUser(jid)).includes(jidNormalizedUser(botJid));

  // 3. Detecção textual (melhorada para incluir legendas de mídia)
  const botJidFull = botJid || '';
  const botNumber = botJidFull.split('@')[0];

  const textMentionPatterns = [
    `@${botNumber}`,
    botNumber,
    '@amanda',
    '@Amanda',
    '@AMANDA',
    'amanda',
    'Amanda',
    'AMANDA',
    'amanda!',
    'Amanda!',
    'AMANDA!',
    'amanda?',
    'Amanda?',
    'AMANDA?'
  ];
  
  // NOVO: Verificar menções tanto no texto quanto na legenda de mídia
  const fullTextToCheck = text + ' ' + (messageContent.imageMessage?.caption || '') + ' ' + (messageContent.videoMessage?.caption || '');
  const isTextMentioningBot = textMentionPatterns.some(pattern => 
    fullTextToCheck.toLowerCase().includes(pattern.toLowerCase())
  ) || new RegExp(`@?${botNumber}\\b`, 'i').test(fullTextToCheck);

  // Combina as formas de menção
  const isMentioningBotFinal = isReplyToBot || isMentioningBot || isTextMentioningBot;

  // NOVO: Declarar mediaType antes dos logs
  const mediaType = messageContent.imageMessage ? 'image' : 
                   (messageContent.videoMessage ? 'video' : 
                   (messageContent.audioMessage ? 'audio' : 
                   (messageContent.documentMessage ? 'document' : 
                   (messageContent.stickerMessage ? 'sticker' : undefined))));

  // DEBUG: Log para verificar se está detectando corretamente
  if (isReplyToBot || isMentioningBotFinal) {
    console.log('[DEBUG] Interação com IA detectada:', {
      botJid: botJid?.slice(-10),
      isReplyToBot,
      isMentioningBot,
      isTextMentioningBot,
      isMentioningBotFinal,
      mentionedJids: mentionedJids.map(jid => jid?.slice(-10)),
      text: text.substring(0, 50) + '...',
      imageCaption: messageContent.imageMessage?.caption?.substring(0, 30) + '...' || 'N/A',
      videoCaption: messageContent.videoMessage?.caption?.substring(0, 30) + '...' || 'N/A',
      fullTextChecked: fullTextToCheck.substring(0, 50) + '...',
      hasMedia: !!mediaType,
      mediaType: mediaType
    });
  }

  // DEBUG: Log para TODAS as mensagens para verificar o que está chegando
  console.log('[DEBUG] Mensagem recebida:', {
    botJid: botJid?.slice(-10),
    text: text.substring(0, 30) + '...',
    isReply,
    isReplyToBot,
    mentionedJids: mentionedJids.map(jid => jid?.slice(-10)),
    isMentioningBot,
    isTextMentioningBot,
    isMentioningBotFinal,
    hasExtendedText: !!messageContent.extendedTextMessage,
    contextInfo: !!contextInfo,
    hasMedia: !!mediaType,
    mediaType: mediaType
  });

  const isCommand = text.startsWith('!');
  const command = isCommand ? text.split(' ')[0].substring(1).toLowerCase() : undefined;
  const args = isCommand ? text.split(' ').slice(1) : [];

  const isViewOnce = !!messageContent.viewOnceMessageV2;

  // NOVO: Log detalhado de mídia
  if (mediaType) {
    console.log(`[DEBUG] Mídia detectada:`, {
      type: mediaType,
      hasCaption: !!(messageContent.imageMessage?.caption || messageContent.videoMessage?.caption),
      caption: messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || 'Sem legenda',
      isAnimated: messageContent.stickerMessage?.isAnimated || false,
      fileLength: messageContent.imageMessage?.fileLength || 
                 messageContent.videoMessage?.fileLength || 
                 messageContent.audioMessage?.fileLength || 
                 messageContent.documentMessage?.fileLength || 
                 messageContent.stickerMessage?.fileLength || 'N/A'
    });
  }

  return {
    sock,
    messageInfo,
    text,
    isGroup: isJidGroup(messageInfo.key.remoteJid!) ?? false,
    isCommand,
    command,
    args,
    isReplyToBot,
    isMentioningBot: isMentioningBotFinal,
    hasMedia: !!mediaType,
    mediaType,
    isViewOnce,
    from: messageInfo.key.remoteJid!,
    sender: messageInfo.key.participant?.toString() || messageInfo.key.remoteJid!
  };
}

/**
 * Handler para mensagens .bio. Extrai e salva dados de perfil do usuário.
 * @param context O contexto da mensagem.
 */
async function handleBioMessage(context: MessageContext) {
  try {
    console.log(`[BIO] Processando mensagem .bio de ${context.sender} no ${context.isGroup ? 'grupo' : 'privado'}`);
    
    // Verificar se é o Milton (ignorar)
    const senderName = context.messageInfo.pushName || '';
    const miltonVariations = ['milton', 'Milton', 'MILTON', 'milto', 'Milto', 'MILTO'];
    const isMilton = miltonVariations.some(variation => senderName.toLowerCase().includes(variation.toLowerCase()));
    
    if (isMilton) {
      console.log(`[BIO] Ignorando mensagem do Milton: ${senderName}`);
      return; // Silenciosamente ignora
    }
    
    // Obter instância do BioExtractorService
    const bioExtractorService = container.get<BioExtractorService>(TYPES.BioExtractorService);
    
    // Extrair dados da mensagem .bio
    const extractedData = bioExtractorService.extractBioData(
      context.text, 
      context.sender, 
      context.from
    );

    if (extractedData) {
      // Salvar dados no banco
      const saved = await bioExtractorService.saveBioData(extractedData);
      
      if (saved) {
        console.log(`[BIO] ✅ Perfil salvo com sucesso para ${context.sender}`);
        
        // Capturar foto se houver mídia
        let photoInfo = '';
        if (context.hasMedia && context.mediaType === 'image') {
          try {
            console.log(`[BIO] 📸 Capturando foto do perfil...`);
            const mediaCaptureService = container.get<MediaCaptureService>(TYPES.MediaCaptureService);
            await mediaCaptureService.captureMedia(context.sock, context.messageInfo);
            photoInfo = '\n📸 *Foto do perfil capturada com sucesso!*';
          } catch (error) {
            console.error('[BIO] Erro ao capturar foto:', error);
          }
        }
        
        // Preparar dados para IA
        const profileData = bioExtractorService.formatProfileForAI(extractedData as any);
        const senderDisplayName = context.messageInfo.pushName || context.sender.split('@')[0];
        
        // Criar prompt para IA com boas-vindas personalizadas
        const aiPrompt = `🤖 *NOVA PESSOA DETECTADA!*\n\n👤 *Nome:* ${senderDisplayName}\n📝 *Perfil:* ${profileData}\n\n💬 *Mensagem para IA:*\n\nOlá Amanda! Uma pessoa nova acabou de usar o comando .bio no grupo. Aqui estão as informações dela:\n\n${profileData}\n\n${photoInfo ? 'Ela também enviou uma foto do perfil!' : ''}\n\nPor favor, dê boas-vindas personalizadas para ela, seja simpática e sexy como sempre. Use as informações do perfil para personalizar sua mensagem. Seja criativa e divertida!`;
        
        // Enviar para IA processar
        try {
          const aiResponse = await AIService.processInteraction({
            ...context,
            text: aiPrompt
          });
          
          // Enviar resposta da IA
          await context.sock.sendMessage(
            context.from,
            { text: aiResponse },
            { quoted: context.messageInfo }
          );
          
        } catch (aiError) {
          console.error('[BIO] Erro ao processar com IA:', aiError);
          
          // Fallback: mensagem padrão
          const fallbackMessage = `💋 *Bem-vinda(o), ${senderDisplayName}!* 💋\n\n${profileData}\n\n${photoInfo}\n\n😏 Agora você está no meu radar, cria! Se precisar de algo, é só chamar! 🔥`;
          
          await context.sock.sendMessage(
            context.from,
            { text: fallbackMessage },
            { quoted: context.messageInfo }
          );
        }
        
      } else {
        console.error(`[BIO] ❌ Erro ao salvar perfil para ${context.sender}`);
        // Não enviar mensagem de erro (conforme solicitado)
      }
    } else {
      console.log(`[BIO] Nenhum dado válido extraído da mensagem de ${context.sender}`);
      // Não enviar mensagem de erro (conforme solicitado)
    }

  } catch (error) {
    console.error('[BIO] Erro ao processar mensagem .bio:', error);
    // Não enviar mensagem de erro (conforme solicitado)
  }
}

/**
 * Handler para interações com a IA. Orquestra a chamada ao AIService.
 * @param context O contexto da mensagem.
 */
async function handleAiInteraction(context: MessageContext) {
  try {
    console.log('[IA] Iniciando processamento de IA...');
    
    // Usar o novo método processInteraction que recebe o MessageContext completo
    await AIService.processInteraction(context);
    
  } catch (error) {
    console.error('[IA] Erro na interação com IA:', error);
    await context.sock.sendMessage(context.from, { 
      text: '🤖 Desculpe, tive um curto-circuito tentando processar isso.' 
    });
  }
}

/**
 * Handler para interações com a IA, especialmente para mídia.
 * @param context O contexto da mensagem.
 */
async function handleAiMediaInteraction(context: MessageContext) {
  try {
    console.log('[IA] Iniciando processamento de IA para mídia...');
    
    // Usar o novo método processInteraction que recebe o MessageContext completo
    await AIService.processInteraction(context);
    
  } catch (error) {
    console.error('[IA] Erro na interação com IA para mídia:', error);
    await context.sock.sendMessage(context.from, { 
      text: '🤖 Desculpe, tive um curto-circuito tentando processar isso.' 
    });
  }
}