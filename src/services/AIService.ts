import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { config } from '@/config';
import { DatabaseService } from '@/services/DatabaseService';
import { UserSession, IUserSession, IMessage } from '@/database/UserSessionSchema';
import { defaultPersonality } from '@/personalities/default';
import { groupPersonality } from '@/personalities/group';
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
import { TYPES } from '@/config/container';
import { ErrorLogger } from '@/utils/errorLogger';
import { aiDebug } from '@/utils/Logger';
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
  private currentApiKeyIndex = 0;
  private currentModelIndex = 0;
  private apiKeyFailures = new Map<string, number>();
  private modelFailures = new Map<string, number>();

  constructor(
    @inject(TYPES.DatabaseService) dbService: DatabaseService,
    @inject(TYPES.CacheService) cacheService: CacheService,
    @inject(TYPES.FunctionToolsService) functionToolsService: FunctionToolsService,
    @inject(TYPES.PersonalityService) personalityService: PersonalityService,
    @inject(TYPES.GroupService) groupService: GroupService
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
    
    console.log('[AIService] Inicializado com sistema de fallback robusto');
    console.log(`[AIService] Chaves API disponíveis: ${config.gemini.apiKeys.length}`);
    console.log(`[AIService] Modelos disponíveis: ${config.gemini.models.join(', ')}`);
    
    // Limpar cache de falhas a cada 5 minutos
    setInterval(() => {
      this.clearFailureCache();
    }, 5 * 60 * 1000);
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
              system_instruction: { parts: [{ text: systemPrompt }] },
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
          personalityToUse = defaultPersonality;
        }
      } else {
        personalityToUse = defaultPersonality;
      }
      
      // NOVO: Montar contexto com informações do perfil do usuário
      const senderInfoString = `Remetente: ${senderInfo.name || senderInfo.number}\nNúmero: ${senderInfo.number}\nJID: ${senderInfo.jid}\nTipo: ${senderInfo.isGroup ? 'Grupo' : 'Privado'}${senderInfo.isGroup ? `\nGrupo: ${senderInfo.groupName} (${senderInfo.groupJid})` : ''}\nTimestamp: ${senderInfo.timestamp}\nTipo de mensagem: ${senderInfo.messageType}`;
      
      // NOVO: Adicionar informações do perfil se disponíveis
      const profileInfo = userProfile ? `\n\n[PERFIL DO USUÁRIO]\n${userProfile}` : '';
      
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
} 