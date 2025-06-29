import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { config } from '@/config';
import { DatabaseService } from '@/services/DatabaseService';
import { UserSession, IUserSession, IMessage } from '@/database/UserSessionSchema';
import { defaultPersonality } from '@/personalities/default';
import { groupPersonality } from '@/personalities/group';
import { privatePersonality } from '@/personalities/private';
import * as fs from 'fs';
import * as path from 'path';
import { CacheService } from '@/services/CacheService';
import { FunctionToolsService } from '@/services/FunctionToolsService';
import { ISenderInfo } from '@/interfaces/ISenderInfo';
import { IFunctionCall } from '@/interfaces/IFunctionTool';
import axios from 'axios';
import { injectable, inject } from 'inversify';
import { PersonalityService } from './PersonalityService';
import { GroupService } from './GroupService';
import { BioExtractorService } from './BioExtractorService';
import { TYPES } from '@/config/container';
import { ErrorLogger } from '@/utils/errorLogger';
import { aiDebug } from '@/utils/Logger';
import { MessageContext } from '@/handlers/message.handler';
import { downloadMediaMessage, WAMessage } from '@whiskeysockets/baileys';
// import { sysLightPersonality } from '@/personalities/sys_light'; // Manter comentado por enquanto

export interface AIChatResponse {
  text?: string;
  functionCall?: IFunctionCall;
}

interface GeminiResponse {
  text?: string;
  functionCall?: IFunctionCall;
  modelUsed: string;
  apiKeyUsed: string;
}

@injectable()
export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private dbService: DatabaseService;
  private cacheService: CacheService;
  private functionToolsService: FunctionToolsService;
  private personalityService: PersonalityService;
  private groupService: GroupService;
  private bioExtractorService: BioExtractorService;
  private currentApiKeyIndex = 0;
  private currentModelIndex = 0;
  private apiKeyFailures = new Map<string, number>();
  private modelFailures = new Map<string, number>();

  // MELHORIA: Singleton para acesso estático a partir de handlers não-injetáveis
  private static instance: AIService;

  constructor(
    @inject(TYPES.DatabaseService) dbService: DatabaseService,
    @inject(TYPES.CacheService) cacheService: CacheService,
    @inject(TYPES.FunctionToolsService) functionToolsService: FunctionToolsService,
    @inject(TYPES.PersonalityService) personalityService: PersonalityService,
    @inject(TYPES.GroupService) groupService: GroupService,
    @inject(TYPES.BioExtractorService) bioExtractorService: BioExtractorService
  ) {
    if (!config.gemini.apiKeys || config.gemini.apiKeys.length === 0) {
      throw new Error('Nenhuma GEMINI_API_KEY configurada no ambiente.');
    }
    
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKeys[0]);
    this.model = this.genAI.getGenerativeModel({ model: config.gemini.models[0] });
    this.dbService = dbService;
    this.cacheService = cacheService;
    this.functionToolsService = functionToolsService;
    this.personalityService = personalityService;
    this.groupService = groupService;
    this.bioExtractorService = bioExtractorService;
    
    console.log('[AIService] Inicializado com sistema de fallback robusto');
    console.log(`[AIService] Chaves API disponíveis: ${config.gemini.apiKeys.length}`);
    console.log(`[AIService] Modelos disponíveis: ${config.gemini.models.join(', ')}`);
    
    // Limpar cache de falhas a cada 5 minutos
    setInterval(() => {
      this.clearFailureCache();
    }, 5 * 60 * 1000);

    // MELHORIA: Atribui a instância para o Singleton
    AIService.instance = this;
  }

  /**
   * Limpa o cache de falhas para permitir novas tentativas
   */
  private clearFailureCache(): void {
    const now = Date.now();
    let clearedApiKeys = 0;
    let clearedModels = 0;
    
    // Limpar falhas antigas de chaves API (mais de 2 minutos)
    for (const [apiKey, timestamp] of this.apiKeyFailures.entries()) {
      if (now - timestamp > 120000) { // 2 minutos
        this.apiKeyFailures.delete(apiKey);
        clearedApiKeys++;
      }
    }
    
    // Limpar falhas antigas de modelos (mais de 1 minuto)
    for (const [model, timestamp] of this.modelFailures.entries()) {
      if (now - timestamp > 60000) { // 1 minuto
        this.modelFailures.delete(model);
        clearedModels++;
      }
    }
    
    if (clearedApiKeys > 0 || clearedModels > 0) {
      console.log(`[AIService] Cache de falhas limpo: ${clearedApiKeys} chaves API, ${clearedModels} modelos`);
    }
  }

  /**
   * Sistema robusto de chamada da API Gemini com fallback
   */
  private async callGeminiAPI(
    systemPrompt: string,
    messages: any[],
    tools?: any[]
  ): Promise<GeminiResponse> {
    const maxRetries = config.gemini.maxRetries;
    let lastError: any = null;

    // Tentar todas as combinações de chave API e modelo
    let allApiKeysInCooldown = false;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      allApiKeysInCooldown = true;
      for (let apiKeyIndex = 0; apiKeyIndex < config.gemini.apiKeys.length; apiKeyIndex++) {
        const apiKey = config.gemini.apiKeys[apiKeyIndex];
        const lastFailure = this.apiKeyFailures.get(apiKey);
        const inCooldown = lastFailure && (Date.now() - lastFailure) < 10000;
        if (inCooldown) {
          console.log(`[AIService] Pulando chave API ${apiKeyIndex + 1} (${apiKey.slice(-6)}) (falha recente)`);
        } else {
          allApiKeysInCooldown = false;
        }
      }
      for (let apiKeyIndex = 0; apiKeyIndex < config.gemini.apiKeys.length; apiKeyIndex++) {
        const apiKey = config.gemini.apiKeys[apiKeyIndex];
        const lastFailure = this.apiKeyFailures.get(apiKey);
        const inCooldown = lastFailure && (Date.now() - lastFailure) < 10000;
        // Se todas estão em cooldown, ignora cooldown e tenta mesmo assim
        if (inCooldown && !allApiKeysInCooldown) continue;
        for (let modelIndex = 0; modelIndex < config.gemini.models.length; modelIndex++) {
          const model = config.gemini.models[modelIndex];
          const modelLastFailure = this.modelFailures.get(model);
          const modelInCooldown = modelLastFailure && (Date.now() - modelLastFailure) < 5000;
          if (modelInCooldown && !allApiKeysInCooldown) {
            console.log(`[AIService] Pulando modelo ${model} (falha recente)`);
            continue;
          }
          try {
            console.log(`[AIService] Tentativa ${attempt + 1}: API Key ${apiKeyIndex + 1} (${apiKey.slice(-6)}), Modelo ${model}${inCooldown ? ' [IGNORANDO COOLDOWN]' : ''}`);
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            const payload: any = {
              contents: messages,
              generationConfig: {
                temperature: config.gemini.temperature,
                maxOutputTokens: config.gemini.maxTokens,
              },
              safetySettings: [
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              ]
            };

            // Adicionar system instruction se não houver inlineData (imagens)
            const hasInlineData = messages.some(msg => 
              msg.parts?.some((part: any) => part.inlineData)
            );
            
            if (!hasInlineData) {
              payload.systemInstruction = { parts: [{ text: systemPrompt }] };
            }

            // Adicionar tools se for Function Calling
            if (tools && tools.length > 0) {
              payload.tools = tools;
            }

            const response = await axios.post(url, payload, { 
              headers: { 'Content-Type': 'application/json' },
              timeout: config.gemini.timeout
            });

            const candidate = response.data.candidates?.[0];
            if (!candidate) {
              throw new Error('Resposta vazia da API');
            }

            // Verificar se há function calls
            const functionCalls = candidate.content?.parts?.filter((part: any) => part.functionCall);
            if (functionCalls && functionCalls.length > 0) {
              const functionCall = functionCalls[0].functionCall;
              console.log(`[AIService] Function Call detectado com sucesso usando ${model}`);
              return {
                functionCall: {
                  name: functionCall.name,
                  args: functionCall.args,
                  confidence: 0.9
                },
                modelUsed: model,
                apiKeyUsed: `API_${apiKeyIndex + 1}`
              };
            }

            // Resposta de texto normal
            const textResponse = candidate.content?.parts?.find((part: any) => part.text)?.text;
            if (textResponse) {
              console.log(`[AIService] Resposta de texto gerada com sucesso usando ${model}`);
              return {
                text: textResponse,
                modelUsed: model,
                apiKeyUsed: `API_${apiKeyIndex + 1}`
              };
            }

            throw new Error('Resposta inválida da API');

          } catch (error: any) {
            lastError = error;
            console.error(`[AIService] Erro na tentativa ${attempt + 1} com API Key ${apiKeyIndex + 1}, Modelo ${model}:`, {
              message: error.message,
              status: error.response?.status,
              statusText: error.response?.statusText
            });

            // Registrar falha para cooldown
            this.apiKeyFailures.set(apiKey, Date.now());
            this.modelFailures.set(model, Date.now());

            // Se for erro de rate limit ou quota, pular para próxima chave
            if (error.response?.status === 429 || error.response?.status === 403) {
              console.log(`[AIService] Rate limit/quota excedida, pulando para próxima chave API`);
              break;
            }

            // Se for erro de timeout ou conexão, não bloquear a chave por muito tempo
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
              console.log(`[AIService] Erro de conexão, cooldown reduzido para esta chave`);
              // Cooldown reduzido para erros de conexão
              setTimeout(() => {
                this.apiKeyFailures.delete(apiKey);
                this.modelFailures.delete(model);
              }, 5000); // 5 segundos
            }

            // Aguardar antes da próxima tentativa
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, config.gemini.retryDelay));
            }
          }
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    console.error('[AIService] Todas as tentativas falharam:', lastError);
    throw new Error(`Falha em todas as tentativas: ${lastError?.message || 'Erro desconhecido'}. Chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧`);
  }

  /**
   * NOVO: Chama a API Gemini com uma imagem e um prompt de texto.
   */
  public async generateContentWithImage(prompt: string, imageBuffer: Buffer, caption: string, context: {
    senderName: string;
    groupName: string;
    personality: string;
    quotedMessageText: string;
  }): Promise<string> {
    try {
      console.log('[AIService] 🖼️ Processando imagem com Gemini...');
      console.log('[AIService] 📊 Dados da imagem:', {
        bufferSize: imageBuffer.length,
        caption: caption || 'Sem legenda',
        senderName: context.senderName,
        groupName: context.groupName
      });
      
      // Converter imagem para base64
      const base64Image = imageBuffer.toString('base64');
      const mimeType = 'image/jpeg'; // Assumindo JPEG por padrão
      
      // Montar prompt completo com contexto
      const fullPrompt = `
        Você é Amanda, uma assistente de WhatsApp inteligente e prestativa.
        
        ---
        Contexto da Conversa:
        - Você está no grupo: "${context.groupName}".
        - A mensagem foi enviada por: "${context.senderName}".
        - Legenda da imagem: "${caption}"
        - Personalidade ativa: "${context.personality}"
        ${context.quotedMessageText ? `- Contexto adicional: ${context.quotedMessageText}` : ''}
        ---

        Analise esta imagem e o contexto fornecido.
        Responda de forma criativa, relevante e dentro da sua personalidade.
        Seja natural, amigável e mantenha o tom apropriado para um grupo de WhatsApp.
        
        IMPORTANTE: Descreva o que você vê na imagem e responda ao contexto da conversa.
      `;
      
      console.log('[AIService] 📝 Prompt montado, enviando para Gemini...');
      
      // Montar mensagem com imagem (formato correto da API Gemini)
      const messages = [
        {
          role: 'user',
          parts: [
            { text: fullPrompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ];

      // Chamar Gemini com imagem (sem systemPrompt para imagens)
      console.log('[AIService] 🚀 Chamando API Gemini...');
      const result = await this.callGeminiAPI('', messages);
      
      if (result.text) {
        console.log('[AIService] ✅ Resposta de imagem gerada com sucesso');
        console.log('[AIService] 📋 Resposta:', result.text.substring(0, 200) + '...');
        return result.text;
      } else {
        console.warn('[AIService] ⚠️ Gemini retornou resposta vazia para imagem');
        return `🤖 ${context.senderName}, analisei sua imagem! É uma foto interessante. Se quiser que eu descreva mais detalhadamente, me avise! 📸`;
      }
      
    } catch (error: any) {
      console.error('[AIService] ❌ Erro ao processar imagem:', error);
      console.error('[AIService] 🔍 Detalhes do erro:', {
        errorMessage: error?.message || 'Erro desconhecido',
        errorStack: error?.stack?.substring(0, 500) || 'Stack não disponível'
      });
      return `🤖 ${context.senderName}, desculpe, tive dificuldade para analisar sua imagem. Mas posso ver que você me enviou uma foto! 📸`;
    }
  }

  /**
   * NOVO: Processa figurinhas e responde adequadamente
   */
  public async processStickerInteraction(context: MessageContext): Promise<string> {
    try {
      console.log('[AIService] Processando figurinha...');
      
      const { messageInfo, text, sender } = context;
      const senderName = messageInfo.pushName || 'alguém';
      
      // Verificar se é figurinha animada
      const isAnimated = messageInfo.message?.stickerMessage?.isAnimated || false;
      
      // Respostas baseadas no tipo de figurinha
      if (isAnimated) {
        return `😄 ${senderName} mandou uma figurinha animada! Que legal! 🎭`;
      } else {
        return `😊 ${senderName} mandou uma figurinha! Adoro figurinhas! 🎭✨`;
      }
      
    } catch (error) {
      console.error('[AIService] Erro ao processar figurinha:', error);
      return '😊 Figurinha recebida! Que fofa! 🎭';
    }
  }

  public async getChatResponse(context: { 
    jid: string, 
    text: string, 
    senderInfo: ISenderInfo, 
    sock?: any,
    currentPersonality?: string,
    userProfile?: string
  }): Promise<string | undefined> {
    try {
      const { jid, text, senderInfo, sock, currentPersonality, userProfile } = context;
      
      aiDebug('AIService.getChatResponse iniciado:', {
        jid,
        textLength: text.length,
        senderName: senderInfo.name,
        isGroup: senderInfo.isGroup,
        personalityProvided: !!currentPersonality,
        hasUserProfile: !!userProfile
      });

      // NOVO: Verificar se o MongoDB está conectado antes de tentar acessá-lo
      if (!this.dbService.isMongoConnected()) {
        console.warn('[WARN] MongoDB não está conectado, usando cache local apenas');
        // Usar apenas cache local quando MongoDB não está disponível
        let chatHistory = this.cacheService.getChatHistory(jid) || [];
        const newUserMessage: IMessage = { role: 'user', parts: text };
        chatHistory.push(newUserMessage);
        
        // Limitar histórico para 100 mensagens
        const recentHistory = chatHistory.slice(-100);
        
        // Usar personalidade padrão quando MongoDB não está disponível
        const personalityToUse = currentPersonality || defaultPersonality;
        
        const senderInfoString = `Remetente: ${senderInfo.name || senderInfo.number}\nNúmero: ${senderInfo.number}\nJID: ${senderInfo.jid}\nTipo: ${senderInfo.isGroup ? 'Grupo' : 'Privado'}${senderInfo.isGroup ? `\nGrupo: ${senderInfo.groupName} (${senderInfo.groupJid})` : ''}\nTimestamp: ${senderInfo.timestamp}\nTipo de mensagem: ${senderInfo.messageType}`;
        const profileInfo = userProfile ? `\n\n[PERFIL DO USUÁRIO]\n${userProfile}` : '';
        const systemPrompt = `${personalityToUse}\n\n[INFO DO REMETENTE]\n${senderInfoString}${profileInfo}`;

        try {
          const messages = recentHistory.map(h => ({ role: h.role, parts: [{ text: h.parts }] }));
          messages.push({ role: 'user', parts: [{ text }] });

          const result = await this.callGeminiAPI(systemPrompt, messages);
          
          if (result.text) {
            const aiResponseMessage: IMessage = { role: 'model', parts: result.text };
            chatHistory.push(aiResponseMessage);
            this.cacheService.setChatHistory(jid, chatHistory);
            
            aiDebug('Resposta da IA processada com sucesso (modo offline):', {
              jid: jid,
              responseLength: result.text.length,
              responsePreview: result.text.substring(0, 100) + (result.text.length > 100 ? '...' : ''),
              modelUsed: result.modelUsed,
              apiKeyUsed: result.apiKeyUsed
            });

            return result.text;
          } else {
            console.warn('[WARN] Gemini retornou resposta vazia');
            return 'Desculpe, não consegui gerar uma resposta no momento. Tenta de novo! Se continuar assim, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧';
          }
        } catch (apiError: any) {
          console.error('[ERROR] Erro na chamada da Gemini API:', {
            message: apiError.message,
            status: apiError.response?.status,
            statusText: apiError.response?.statusText,
            data: apiError.response?.data
          });

          if (apiError.response?.status === 429) {
            return 'Ops! Estou muito ocupada agora. Tenta de novo em alguns segundos! 😅 Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧';
          } else if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
            return 'Desculpe, demorei demais para responder. Tenta de novo! ⏰ Se continuar lenta, chama o meu criador: +55 21 6723-3931 - ele vai acelerar as coisas! 🚀';
          } else {
            return 'Tive um problema técnico aqui. Tenta de novo em alguns segundos! 🔧 Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver tudo! 💪';
          }
        }
      }

      // MongoDB está conectado, usar fluxo normal
      let userSession = await UserSession.findOne({ jid });
      if (!userSession) {
        userSession = new UserSession({ jid, chatHistory: [] });
      }

      let chatHistory = this.cacheService.getChatHistory(jid) || [];
      if (chatHistory.length === 0 && userSession.chatHistory.length > 0) {
        chatHistory = userSession.chatHistory;
        this.cacheService.setChatHistory(jid, chatHistory);
      } else if (chatHistory.length === 0 && userSession.chatHistory.length === 0) {
        chatHistory = [];
      }

      const newUserMessage: IMessage = { role: 'user', parts: text };
      chatHistory.push(newUserMessage);
      userSession.chatHistory.push(newUserMessage);

      // Limitando o histórico para as 100 últimas interações (user/model)
      const recentHistory = chatHistory.slice(-100);
      
      // FIX: Usar personalidade passada ou buscar do banco como fallback
      let personalityToUse: string;
      if (currentPersonality) {
        // Usar a personalidade que foi passada pelo MessageManager
        personalityToUse = currentPersonality;
        console.log(`[DEBUG] Usando personalidade passada para ${jid}`);
      } else if (jid.endsWith('@g.us')) {
        try {
          // Fallback: buscar do banco se não foi passada
          if (sock) {
            await this.groupService.ensureGroupExists(sock, jid);
          }
          
          personalityToUse = await this.personalityService.getActivePersonality(jid);
          console.log(`[DEBUG] Personalidade carregada do banco para grupo ${jid}: ${personalityToUse.substring(0, 100)}...`);
        } catch (error) {
          console.error(`[ERROR] Erro ao carregar personalidade do grupo ${jid}:`, error);
          personalityToUse = groupPersonality;
        }
      } else {
        // NOVO: Para conversas privadas, usar personalidade privada que identifica intenções
        personalityToUse = privatePersonality;
        console.log(`[DEBUG] Usando personalidade privada para conversa privada ${jid}`);
      }
      
      // NOVO: Montar contexto com informações do perfil do usuário
      const senderInfoString = `Remetente: ${senderInfo.name || senderInfo.number}\nNúmero: ${senderInfo.number}\nJID: ${senderInfo.jid}\nTipo: ${senderInfo.isGroup ? 'Grupo' : 'Privado'}${senderInfo.isGroup ? `\nGrupo: ${senderInfo.groupName} (${senderInfo.groupJid})` : ''}\nTimestamp: ${senderInfo.timestamp}\nTipo de mensagem: ${senderInfo.messageType}`;
      
      // NOVO: Buscar perfil do usuário se for grupo
      let userProfileInfo = userProfile || '';
      if (senderInfo.isGroup && senderInfo.groupJid) {
        try {
          const userProfile = await this.bioExtractorService.getUserProfile(senderInfo.jid, senderInfo.groupJid);
          if (userProfile) {
            userProfileInfo = this.bioExtractorService.formatProfileForAI(userProfile);
            console.log(`[DEBUG] Perfil encontrado para ${senderInfo.jid}: ${userProfileInfo.substring(0, 100)}...`);
          }
        } catch (error) {
          console.error(`[ERROR] Erro ao buscar perfil do usuário ${senderInfo.jid}:`, error);
        }
      }
      
      // NOVO: Adicionar informações do perfil se disponíveis
      const profileInfo = userProfileInfo ? `\n\n[PERFIL DO USUÁRIO]\n${userProfileInfo}` : '';
      
      const systemPrompt = `${personalityToUse}\n\n[INFO DO REMETENTE]\n${senderInfoString}${profileInfo}`;

      // LOG DETALHADO DO QUE VAI PARA GEMINI
      console.log('--- ENVIO PARA GEMINI ---');
      console.log('systemPrompt:', systemPrompt);
      console.log('history:', recentHistory);
      console.log('mensagem do usuário:', text);
      console.log('senderInfo:', senderInfo);
      console.log('userProfile:', userProfile || 'N/A');
      console.log('-------------------------');

      try {
      const messages = recentHistory.map(h => ({ role: h.role, parts: [{ text: h.parts }] }));
      messages.push({ role: 'user', parts: [{ text }] });

        const result = await this.callGeminiAPI(systemPrompt, messages);
        
        if (result.text) {
          const aiResponseMessage: IMessage = { role: 'model', parts: result.text };
      chatHistory.push(aiResponseMessage);
      userSession.chatHistory.push(aiResponseMessage);
      userSession.lastInteraction = new Date();
      await userSession.save();
      this.cacheService.setChatHistory(jid, chatHistory);

          // NOVO: Log da resposta processada
          aiDebug('Resposta da IA processada com sucesso:', {
            jid: jid,
            responseLength: result.text.length,
            responsePreview: result.text.substring(0, 100) + (result.text.length > 100 ? '...' : ''),
            modelUsed: result.modelUsed,
            apiKeyUsed: result.apiKeyUsed
          });

          return result.text;
        } else {
          console.warn('[WARN] Gemini retornou resposta vazia');
          return 'Desculpe, não consegui gerar uma resposta no momento. Tenta de novo! Se continuar assim, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧';
        }

      } catch (apiError: any) {
        console.error('[ERROR] Erro na chamada da Gemini API:', {
          message: apiError.message,
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data
        });

        // Retornar mensagem de erro amigável
        if (apiError.response?.status === 429) {
          return 'Ops! Estou muito ocupada agora. Tenta de novo em alguns segundos! 😅 Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧';
        } else if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
          return 'Desculpe, demorei demais para responder. Tenta de novo! ⏰ Se continuar lenta, chama o meu criador: +55 21 6723-3931 - ele vai acelerar as coisas! 🚀';
        } else {
          return 'Tive um problema técnico aqui. Tenta de novo em alguns segundos! 🔧 Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver tudo! 💪';
        }
      }

    } catch (error) {
      console.error(`[ERROR] Erro geral no AIService.getChatResponse:`, error);
      return 'Ops! Algo deu errado. Tenta de novo mais tarde! 😅 Se o problema continuar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧';
    }
  }

  /**
   * Processa mensagem com suporte a Function Calling
   */
  public async processMessageWithFunctionCalling(
    context: { 
      jid: string, 
      text: string, 
      senderInfo: ISenderInfo,
      mentionedJids?: string[],
      isAdmin?: boolean,
      sock?: any,
      currentPersonality?: string
    }
  ): Promise<AIChatResponse> {
    try {
      const { jid, text, senderInfo, mentionedJids = [], isAdmin = false, sock, currentPersonality } = context;

      // Verifica se a mensagem pode ser uma intenção de comando
      if (!this.shouldAttemptFunctionCall(text)) {
        // Resposta normal da IA com personalidade passada
        const response = await this.getChatResponse({ jid, text, senderInfo, sock, currentPersonality });
        return { text: response };
      }

      // Tenta Function Calling
      const functionCallResult = await this.attemptFunctionCall(text, jid, senderInfo, mentionedJids, isAdmin);
      if (functionCallResult.functionCall) {
        return functionCallResult;
      }

      // Se não conseguiu Function Calling, volta para resposta normal
      const response = await this.getChatResponse({ jid, text, senderInfo, sock, currentPersonality });
      return { text: response };

    } catch (error) {
      console.error('Erro ao processar mensagem com Function Calling:', error);
      // Fallback para resposta normal
      const response = await this.getChatResponse({ 
        jid: context.jid, 
        text: context.text, 
        senderInfo: context.senderInfo, 
        sock: context.sock,
        currentPersonality: context.currentPersonality
      });
      return { text: response };
    }
  }

  /**
   * Verifica se deve tentar Function Calling
   */
  private shouldAttemptFunctionCall(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Palavras que indicam intenção de ação
    const actionKeywords = [
      'banir', 'remover', 'tirar', 'expulsar', 'kick', 'ban',
      'promover', 'rebaixar', 'admin', 'moderador',
      'fofoca', 'intriga', 'gossip', 'chisme',
      'menage', 'ménage', 'par', 'casal', 'sortear',
      'personalidade', 'person', 'persona',
      'silenciar', 'liberar', 'apagar', 'desbanir',
      'fazer', 'criar', 'gerar', 'executar', 'usar'
    ];

    return actionKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Tenta fazer Function Calling
   */
  private async attemptFunctionCall(
    text: string, 
    jid: string, 
    senderInfo: ISenderInfo, 
    mentionedJids: string[], 
    isAdmin: boolean
  ): Promise<AIChatResponse> {
    try {
      const tools = this.functionToolsService.getGeminiTools();
      if (tools.length === 0) {
        return {};
      }

      // Monta contexto para a IA
      const contextInfo = {
        mentionedJids,
        isAdmin,
        isGroup: senderInfo.isGroup,
        groupName: senderInfo.groupName,
        senderName: senderInfo.name
      };

      const systemPrompt = `Você é Amanda, uma assistente de WhatsApp. Analise a mensagem do usuário e determine se ele quer executar alguma ação específica.

CONTEXTO:
- Menções: ${mentionedJids.join(', ') || 'Nenhuma'}
- É admin: ${isAdmin}
- É grupo: ${senderInfo.isGroup}
- Nome do grupo: ${senderInfo.groupName || 'N/A'}
- Nome do usuário: ${senderInfo.name}

Se o usuário quiser executar uma ação, use a função apropriada. Se for apenas conversa, responda normalmente.

IMPORTANTE: Use as funções disponíveis apenas quando o usuário claramente quiser executar uma ação. Para conversas normais, responda como Amanda.`;

      const messages = [{ role: 'user', parts: [{ text }] }];

      const result = await this.callGeminiAPI(systemPrompt, messages, tools);
      
      if (result.functionCall) {
        // Valida a função antes de retornar
        const isValid = this.functionToolsService.validateFunctionCall(
          result.functionCall.name,
          result.functionCall.args,
          isAdmin,
          senderInfo.isGroup
        );

        if (isValid) {
          console.log('Function Call detectado:', result.functionCall);
          return {
            functionCall: {
              name: result.functionCall.name,
              args: result.functionCall.args,
              confidence: 0.9
            }
          };
        }
      }

      // Se não há function call, retorna resposta normal
      if (result.text) {
        return { text: result.text };
      }

      return {};

    } catch (error) {
      console.error('Erro ao tentar Function Calling:', error);
      return {};
    }
  }

  /**
   * Retorna o status das chaves Gemini
   */
  public getApiKeysStatus(): Array<{ key: string; cooldown: number; lastFailure?: number }> {
    const now = Date.now();
    return config.gemini.apiKeys.map(key => {
      const lastFailure = this.apiKeyFailures.get(key);
      const cooldown = lastFailure ? Math.max(0, 10000 - (now - lastFailure)) : 0;
      return {
        key: key,
        cooldown,
        lastFailure
      };
    });
  }

  /**
   * Método estático para processar interações com IA a partir do MessageContext
   * Este é o ponto de entrada principal para interações com IA
   */
  public static async processInteraction(context: MessageContext): Promise<void> {
    try {
      const { sock, messageInfo, text, hasMedia, mediaType, isGroup, from: groupJid, sender } = context;

      // 1. EXTRAIR INFORMAÇÕES RICAS DO CONTEXTO
      const senderName = messageInfo.pushName || 'um membro';
      const groupMetadata = isGroup ? await sock.groupMetadata(groupJid) : null;
      const groupName = groupMetadata?.subject || 'conversa privada';

      // 2. EXTRAIR DADOS DA MENSAGEM RESPONDIDA
      const quotedMessageText = this.extractQuotedMessageContext(messageInfo, senderName, isGroup, groupMetadata);

      // 3. BUSCAR A PERSONALIDADE ATIVA DO GRUPO
      const personality = await this.getActivePersonality(isGroup, groupJid);

      // 4. PROCESSAR BASEADO NO TIPO DE MÍDIA
      let responseText = '';
      
      if (hasMedia && mediaType) {
        responseText = await this.processMediaInteraction(context, {
          senderName,
          groupName,
          personality,
          quotedMessageText
        });
      } else {
        responseText = await this.processTextInteraction(context, {
          senderName,
          groupName,
          personality,
          quotedMessageText
        });
      }

      // 5. ENVIAR A RESPOSTA
      if (responseText && responseText.trim()) {
        await sock.sendMessage(
          messageInfo.key.remoteJid!,
          { text: responseText },
          { quoted: messageInfo }
        );
      }

    } catch (error) {
      console.error('[AIService] Erro ao processar interação com IA:', error);
      await context.sock.sendMessage(context.messageInfo.key.remoteJid!, { 
        text: '🤖 Desculpe, minhas sinapses falharam. Tente de novo.' 
      });
    }
  }

  /**
   * Extrai contexto da mensagem respondida
   */
  private static extractQuotedMessageContext(
    messageInfo: WAMessage, 
    senderName: string, 
    isGroup: boolean, 
    groupMetadata: any
  ): string {
    const quotedMessageInfo = messageInfo.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedParticipantJid = messageInfo.message?.extendedTextMessage?.contextInfo?.participant;

    if (!quotedMessageInfo || !quotedParticipantJid) return '';

    try {
      // Buscar o nome do autor da mensagem respondida
      let quotedAuthorName = 'outra pessoa';
      if (isGroup && groupMetadata) {
        const quotedAuthorInfo = groupMetadata.participants.find((p: any) => p.id === quotedParticipantJid);
        quotedAuthorName = quotedAuthorInfo?.name || quotedAuthorInfo?.notify || 'outra pessoa';
      }

      // Extrair o texto da mensagem respondida
      const quotedText = quotedMessageInfo.conversation || 
                        quotedMessageInfo.extendedTextMessage?.text || 
                        quotedMessageInfo.imageMessage?.caption ||
                        quotedMessageInfo.videoMessage?.caption ||
                        '[Mídia ou mensagem sem texto]';
      
      console.log(`[AIService] Contexto de resposta detectado: ${quotedAuthorName} disse "${quotedText.substring(0, 50)}..."`);
      
      return `\n- Contexto Adicional: A mensagem de "${senderName}" é uma resposta à seguinte mensagem de "${quotedAuthorName}":\n  "${quotedText}"`;
    } catch (error) {
      console.error('[AIService] Erro ao extrair contexto da mensagem respondida:', error);
      return '';
    }
  }

  /**
   * Busca a personalidade ativa do grupo
   */
  private static async getActivePersonality(isGroup: boolean, groupJid: string): Promise<string> {
    if (!isGroup) return 'padrao';
    
    try {
      return await this.instance.personalityService.getActivePersonality(groupJid);
    } catch (error) {
      console.error('[AIService] Erro ao buscar personalidade do grupo:', error);
      return 'padrao';
    }
  }

  /**
   * Processa interações com mídia (imagens, vídeos, etc.)
   */
  private static async processMediaInteraction(
    context: MessageContext, 
    contextInfo: {
      senderName: string;
      groupName: string;
      personality: string;
      quotedMessageText: string;
    }
  ): Promise<string> {
    const { mediaType, messageInfo, text } = context;
    const { senderName } = contextInfo;

    console.log(`[AIService] Processando ${mediaType} de ${senderName}...`);

    switch (mediaType) {
      case 'image':
        return await this.instance.processImageInteraction(context, contextInfo);
      
      case 'video':
        return `🎥 ${senderName} mandou um vídeo! Que legal! Se quiser que eu analise o conteúdo, me avise! 📹✨`;
      
      case 'audio':
        return `🎵 ${senderName} mandou um áudio! Adoro ouvir a voz de vocês! 🎤💕`;
      
      case 'document':
        return `📄 ${senderName} mandou um documento! Se precisar de ajuda para analisar, é só falar! 📋✨`;
      
      case 'sticker':
        return await this.instance.processStickerInteraction(context);
      
      default:
        return `📦 ${senderName} mandou uma mídia! Que interessante! ✨`;
    }
  }

  /**
   * Processa interações com texto
   */
  private static async processTextInteraction(
    context: MessageContext,
    contextInfo: {
      senderName: string;
      groupName: string;
      personality: string;
      quotedMessageText: string;
    }
  ): Promise<string> {
    const { text, from: groupJid, sender, isGroup } = context;
    const { senderName, personality } = contextInfo;

    console.log(`[AIService] Processando texto de ${senderName}...`);

    // Montar o objeto senderInfo necessário para o getChatResponse
    const senderInfo: ISenderInfo = {
      jid: sender,
      name: senderName,
      number: sender.split('@')[0],
      isGroup: isGroup,
      groupJid: isGroup ? groupJid : undefined,
      timestamp: Date.now(),
      messageType: 'text'
    };

    // Buscar perfil do usuário se for grupo
    let userProfile = '';
    if (isGroup && groupJid) {
      try {
        const userProfileData = await this.instance.bioExtractorService.getUserProfile(sender, groupJid);
        if (userProfileData) {
          userProfile = this.instance.bioExtractorService.formatProfileForAI(userProfileData);
          console.log(`[DEBUG] Perfil encontrado para ${sender}: ${userProfile.substring(0, 100)}...`);
        }
      } catch (error) {
        console.error(`[ERROR] Erro ao buscar perfil do usuário ${sender}:`, error);
      }
    }

    return await this.instance.getChatResponse({ 
      jid: groupJid, 
      text: text, 
      senderInfo,
      currentPersonality: personality,
      userProfile: userProfile
    }) || 'Desculpe, não consegui processar sua mensagem.';
  }

  /**
   * Processa interação específica com imagem
   */
  private async processImageInteraction(
    context: MessageContext,
    contextInfo: {
      senderName: string;
      groupName: string;
      personality: string;
      quotedMessageText: string;
    }
  ): Promise<string> {
    try {
      console.log('[AIService] 🖼️ Processando interação com imagem...');
      console.log('[AIService] 📊 Contexto da imagem:', {
        senderName: contextInfo.senderName,
        groupName: contextInfo.groupName,
        personality: contextInfo.personality,
        hasQuotedText: !!contextInfo.quotedMessageText,
        caption: context.text || 'Sem legenda'
      });
      
      const buffer = await downloadMediaMessage(context.messageInfo, 'buffer', {});
      console.log('[AIService] ✅ Imagem baixada com sucesso, tamanho:', (buffer as Buffer).length, 'bytes');
      
      const response = await this.generateContentWithImage(
        'Analise esta imagem', 
        buffer as Buffer, 
        context.text,
        contextInfo
      );
      
      console.log('[AIService] ✅ Resposta da IA para imagem gerada:', response.substring(0, 100) + '...');
      return response;
      
    } catch (error: any) {
      console.error('[AIService] ❌ Erro ao processar imagem:', error);
      console.error('[AIService] 🔍 Detalhes do erro:', {
        errorMessage: error?.message || 'Erro desconhecido',
        errorStack: error?.stack?.substring(0, 500) || 'Stack não disponível'
      });
      return `🤖 ${contextInfo.senderName}, desculpe, tive dificuldade para analisar sua imagem. Mas posso ver que você me enviou uma foto! 📸`;
    }
  }
} 