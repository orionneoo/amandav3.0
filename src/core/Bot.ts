// src/core/Bot.ts
import { Boom } from '@hapi/boom';
import { DisconnectReason, useMultiFileAuthState, makeWASocket, proto, WASocket, ConnectionState, isJidBroadcast } from '@whiskeysockets/baileys';
import { config } from '@/config';
import { CommandHandler } from '@/core/CommandHandler';
import { AIService } from '@/services/AIService';
import { DatabaseService } from '@/services/DatabaseService';
import { CommandCatalogService } from '@/services/CommandCatalogService';
import { FunctionToolsService } from '@/services/FunctionToolsService';
import { SchedulerService } from '@/services/SchedulerService';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import { ErrorLogger } from '@/utils/errorLogger';
import { OnboardingService } from '@/services/OnboardingService';
import fs from 'fs';
import { GameService } from '@/services/GameService';
import { OwnerService } from '@/services/OwnerService';
import { GroupService } from '@/services/GroupService';
import { PersonalityService } from '@/services/PersonalityService';
import { TYPES } from '@/config/container';
import { botDebug } from '@/utils/Logger';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { handleMessageUpsert } from '@/handlers/message.handler';

// NOVO: Importar novos serviços
import { AlertService } from '@/services/AlertService';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { HookManager } from '@/services/HookManager';
import { PluginManager } from '@/services/PluginManager';
import { ViewOnceCaptureService } from '@/core/ViewOnceCaptureService';

type WAMessage = proto.IWebMessageInfo;

const MEDIA_SAVE_DIR = 'G:\\Meu Drive\\ia';
if (!fs.existsSync(MEDIA_SAVE_DIR)) {
    fs.mkdirSync(MEDIA_SAVE_DIR, { recursive: true });
}

@injectable()
export class Bot {
  private sock!: WASocket; // REFATORAR: Tipagem mais específica WASocket
  private reconnectAttempts = 0;
  private maxReconnectAttempts = parseInt(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || '10', 10);
  private reconnectDelay = parseInt(process.env.WHATSAPP_RETRY_DELAY || '5000', 10); // 5 segundos
  private isConnecting = false; // FIX: Evitar múltiplas tentativas de conexão
  private lockFile = process.env.LOCK_FILE_PATH || 'bot.lock'; // FIX: Arquivo de lock para evitar múltiplas instâncias
  private lockFileTimeout = parseInt(process.env.LOCK_FILE_TIMEOUT || '300000', 10); // 5 minutos
  private promotionCache = new Map<string, number>(); // FIX: Cache para evitar promoções duplicadas
  private botOnlineTime: number | null = null; // FIX: Tempo em que o bot ficou online
  private processedEvents = new Set<string>(); // FIX: Cache de eventos já processados
  private healthCheckInterval: NodeJS.Timeout | null = null; // NOVO: Health check
  // NOVO: Cache mais robusto para promoções
  private promotionHistory = new Map<string, {
    timestamp: number;
    groupJid: string;
    userJid: string;
    messageSent: boolean;
  }>();

  constructor(
    @inject(TYPES.AIService) private aiService: AIService,
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService,
    @inject(TYPES.CommandCatalogService) private commandCatalogService: CommandCatalogService,
    @inject(TYPES.FunctionToolsService) private functionToolsService: FunctionToolsService,
    @inject(TYPES.OnboardingService) private onboardingService: OnboardingService,
    @inject(TYPES.GameService) private gameService: GameService,
    @inject(TYPES.OwnerService) private ownerService: OwnerService,
    @inject(TYPES.GroupService) private groupService: GroupService,
    @inject(TYPES.SchedulerService) private schedulerService: SchedulerService,
    @inject(TYPES.PersonalityService) private personalityService: PersonalityService,
    @inject(TYPES.CommandHandler) private commandHandler: CommandHandler,
    // NOVO: Injetar novos serviços
    @inject(TYPES.AlertService) private alertService: AlertService,
    @inject(TYPES.PerformanceMonitor) private performanceMonitor: PerformanceMonitor,
    @inject(TYPES.HookManager) private hookManager: HookManager,
    @inject(TYPES.PluginManager) private pluginManager: PluginManager,
    @inject(TYPES.ViewOnceCaptureService) private viewOnceCaptureService: ViewOnceCaptureService
  ) {
    // Construtor vazio, tudo é injetado
  }

  // MELHORADO: Método para verificar se já existe uma instância rodando
  private checkLock(): boolean {
    try {
      if (fs.existsSync(this.lockFile)) {
        const lockData = fs.readFileSync(this.lockFile, 'utf8');
        const lockInfo = JSON.parse(lockData);
        const now = Date.now();
        
        // Verificar se o processo ainda está rodando
        try {
          process.kill(lockInfo.pid, 0); // Envia sinal 0 para verificar se o processo existe
          console.log(`[WARN] Processo ${lockInfo.pid} ainda está rodando`);
          
          // Se o lock tem mais tempo que o timeout configurado, considera como obsoleto
          if (now - lockInfo.timestamp > this.lockFileTimeout) {
            console.log(`[WARN] Lock obsoleto encontrado (${Math.round((now - lockInfo.timestamp) / 1000)}s), removendo...`);
            this.removeLock();
            return false;
          }
          
          console.log(`[ERROR] Bot já está rodando (PID: ${lockInfo.pid})`);
          console.log(`[ERROR] Iniciado em: ${lockInfo.startTime}`);
          console.log(`[ERROR] Se não estiver rodando, delete o arquivo ${this.lockFile}`);
          console.log(`[ERROR] Ou aguarde ${Math.round((this.lockFileTimeout - (now - lockInfo.timestamp)) / 1000)}s para timeout automático`);
          return true;
        } catch (error) {
          // Processo não existe mais, remover lock obsoleto
          console.log(`[WARN] Processo ${lockInfo.pid} não existe mais, removendo lock obsoleto...`);
          this.removeLock();
          return false;
        }
      }
      return false;
    } catch (error) {
      console.log('[WARN] Erro ao verificar lock, removendo arquivo corrompido...');
      this.removeLock();
      return false;
    }
  }

  // MELHORADO: Método para criar lock
  private createLock(): void {
    try {
      const lockInfo = {
        pid: process.pid,
        timestamp: Date.now(),
        startTime: new Date().toISOString(),
        version: '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime()
      };
      fs.writeFileSync(this.lockFile, JSON.stringify(lockInfo, null, 2));
      console.log(`[INFO] Lock criado com sucesso (PID: ${process.pid})`);
      
      // NOVO: Atualizar lock periodicamente
      this.startLockUpdate();
    } catch (error) {
      console.log('[WARN] Erro ao criar lock:', error);
    }
  }

  // NOVO: Atualizar lock periodicamente
  private startLockUpdate(): void {
    setInterval(() => {
      try {
        if (fs.existsSync(this.lockFile)) {
          const lockData = fs.readFileSync(this.lockFile, 'utf8');
          const lockInfo = JSON.parse(lockData);
          
          // Atualizar apenas se for nosso lock
          if (lockInfo.pid === process.pid) {
            lockInfo.timestamp = Date.now();
            lockInfo.uptime = process.uptime();
            fs.writeFileSync(this.lockFile, JSON.stringify(lockInfo, null, 2));
          }
        }
      } catch (error) {
        console.log('[WARN] Erro ao atualizar lock:', error);
      }
    }, 30000); // Atualizar a cada 30 segundos
  }

  // MELHORADO: Método para remover lock
  private removeLock(): void {
    try {
      if (fs.existsSync(this.lockFile)) {
        // Verificar se é nosso lock antes de remover
        const lockData = fs.readFileSync(this.lockFile, 'utf8');
        const lockInfo = JSON.parse(lockData);
        
        if (lockInfo.pid === process.pid) {
          fs.unlinkSync(this.lockFile);
          console.log('[INFO] Lock removido com sucesso');
        } else {
          console.log(`[WARN] Tentativa de remover lock de outro processo (${lockInfo.pid})`);
        }
      }
    } catch (error) {
      console.log('[WARN] Erro ao remover lock:', error);
    }
  }

  // NOVO: Health check para verificar se o bot está funcionando
  private startHealthCheck(): void {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10);
    const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10);
    
    this.healthCheckInterval = setInterval(() => {
      try {
        // Verificar se o bot ainda está conectado
        if (this.sock && this.sock.user) {
          console.log('[HEALTH] Bot está saudável e conectado');
        } else {
          console.log('[HEALTH] Bot não está conectado, tentando reconectar...');
          this.reconnectAttempts = 0;
          this.connectToWhatsApp();
        }
      } catch (error) {
        console.log('[HEALTH] Erro no health check:', error);
      }
    }, interval);
  }

  public async start(): Promise<void> {
    try {
      console.log('[INFO] Iniciando Amanda Bot...');
      console.log(`[INFO] PID: ${process.pid}`);
      console.log(`[INFO] Node.js: ${process.version}`);
      console.log(`[INFO] Plataforma: ${process.platform}`);
      
      // MELHORADO: Verificar se já existe uma instância rodando
      if (this.checkLock()) {
        console.log('[ERROR] Saindo devido a instância já em execução');
        process.exit(1);
      }

      // MELHORADO: Criar lock antes de iniciar
      this.createLock();

      await this.databaseService.connect();
      await this.commandHandler.loadCommands();
      
      // NOVO: Inicializar sistema de hooks
      await this.initializeHooks();
      
      // NOVO: Carregar plugins
      await this.loadPlugins();
      
      // NOVO: Iniciar monitoramento de performance
      this.performanceMonitor.startMonitoring();
      
      // NOVO: Executar hooks de startup
      await this.hookManager.executeHooks('onStartup');
      
      // NOVO: Enviar alerta de inicialização
      await this.alertService.createSystemAlert(
        'success',
        'Bot Iniciado',
        'Amanda Bot foi iniciada com sucesso',
        { pid: process.pid, version: process.version }
      );
      
      // NOVO: Atualizar catálogo de comandos e ferramentas
      this.commandCatalogService.updateCatalog(Array.from(this.commandHandler.getCommands().values()));
      this.functionToolsService.updateFunctionTools(Array.from(this.commandHandler.getCommands().values()));
      
      console.log(`[INFO] Sistema inicializado com ${this.commandHandler.getCommands().size} comandos injetáveis`);
      
      // NOVO: Iniciar agendadores
      this.schedulerService.start();
      console.log('[INFO] Agendadores iniciados');
      
      // NOVO: Iniciar health check
      this.startHealthCheck();
      console.log('[INFO] Health check iniciado');
      
      await this.connectToWhatsApp();
    } catch (error) {
      console.error('[ERROR] Erro ao iniciar bot:', error);
      await this.alertService.createSystemAlert(
        'error',
        'Erro na Inicialização',
        'Erro ao iniciar Amanda Bot',
        { error: error instanceof Error ? error.message : String(error) }
      );
      process.exit(1);
    }
  }

  private async connectToWhatsApp(): Promise<void> {
    // FIX: Evitar múltiplas tentativas de conexão simultâneas
    if (this.isConnecting) {
      console.log('[WARN] Conexão já em andamento, aguardando...');
      return;
    }

    this.isConnecting = true;

    try {
      const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
      
      const connectTimeout = parseInt(process.env.WHATSAPP_CONNECT_TIMEOUT || '120000', 10);
      const keepAliveInterval = parseInt(process.env.WHATSAPP_KEEP_ALIVE_INTERVAL || '15000', 10);
      const retryDelay = parseInt(process.env.WHATSAPP_RETRY_DELAY || '1000', 10);
      
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // FIX: Desabilitar QR automático, vamos gerar manualmente
        connectTimeoutMs: connectTimeout, // FIX: Timeout de conexão configurável
        keepAliveIntervalMs: keepAliveInterval, // FIX: Keep-alive configurável
        retryRequestDelayMs: retryDelay, // FIX: Delay configurável
        defaultQueryTimeoutMs: 60000, // FIX: Timeout padrão para queries
        emitOwnEvents: false, // FIX: Não emitir eventos próprios
        shouldIgnoreJid: jid => isJidBroadcast(jid), // FIX: Ignorar broadcasts
        patchMessageBeforeSending: (msg) => {
          const requiresPatch = !!(
            msg.buttonsMessage 
            || msg.templateMessage
            || msg.listMessage
          );
          if (requiresPatch) {
            msg = {
              viewOnceMessage: {
                message: {
                  messageContextInfo: {
                    deviceListMetadataVersion: 2,
                    deviceListMetadata: {},
                  },
                  ...msg,
                },
              },
            };
          }
          return msg;
        },
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // FIX: Gerar QR Code quando disponível
        if (qr) {
          console.log('\n[QR CODE] Escaneie o QR Code abaixo:\n');
          qrcode.generate(qr, { small: true });
          console.log('\n[QR CODE] Aguardando escaneamento...\n');
        }
        
        if (connection === 'close') {
          this.isConnecting = false; // FIX: Reset flag de conexão
          
          const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
          
          if (shouldReconnect) {
            console.log('[WARN] Conexão fechada devido a', lastDisconnect?.error, ', reconectando:', shouldReconnect);
            this.reconnectAttempts++;
            
            // FIX: Delay exponencial para reconexão
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              console.log(`[INFO] Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay}ms`);
              setTimeout(() => {
                this.connectToWhatsApp();
              }, delay);
            } else {
              console.log('[CRITICAL] Máximo de tentativas de reconexão atingido. Reiniciando bot...');
              this.reconnectAttempts = 0;
              setTimeout(() => this.start(), 60000); // Reinicia após 1 minuto
            }
          } else {
            console.log('[ERROR] Conexão fechada. Você foi desconectado.');
            this.removeLock(); // FIX: Remover lock se foi desconectado
          }
        } else if (connection === 'open') {
          this.isConnecting = false; // FIX: Reset flag de conexão
          console.log('[SUCCESS] Bot conectado ao WhatsApp!');
          this.reconnectAttempts = 0; // Reset contador de reconexões
          
          // FIX: Marcar o tempo em que o bot ficou online
          this.botOnlineTime = Date.now();
          botDebug('Bot online em:', new Date(this.botOnlineTime).toISOString());
          
          console.log('[INFO] Sistema de Function Calling/NLP ativo!');
          console.log('[INFO] Comandos disponíveis via linguagem natural:');
          const tools = this.functionToolsService.getFunctionTools();
          tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
          });
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Ouça por novas mensagens
      this.sock.ev.on('messages.upsert', async (upsert) => {
        // ROTEADOR CENTRAL: Passa o evento para o nosso roteador centralizado
        await handleMessageUpsert(this.sock, upsert);
      });

      // NOVO: Processamento de eventos de grupo
      this.sock.ev.on('group-participants.update', async (event) => {
        try {
          const { action, participants, id: groupJid } = event;
          
          // FIX: Ignorar eventos que aconteceram antes do bot ficar online
          if (this.botOnlineTime) {
            const now = Date.now();
            const timeDiff = now - this.botOnlineTime;
            
            // Se o bot ficou online há menos de 30 segundos, ignorar eventos antigos
            if (timeDiff < 30000) {
              botDebug(`Bot acabou de ficar online (${Math.round(timeDiff/1000)}s), ignorando eventos antigos`);
              return;
            }
          }
          
          // FIX: Criar ID único para o evento para evitar processamento duplicado
          const eventId = `${groupJid}-${action}-${participants.join(',')}-${Date.now()}`;
          if (this.processedEvents.has(eventId)) {
            botDebug(`Evento já processado: ${eventId}`);
            return;
          }
          this.processedEvents.add(eventId);
          
          // Limpar eventos antigos do cache (manter apenas os últimos 1000)
          if (this.processedEvents.size > 1000) {
            const eventsArray = Array.from(this.processedEvents);
            this.processedEvents.clear();
            // Manter apenas os últimos 500 eventos
            eventsArray.slice(-500).forEach(event => this.processedEvents.add(event));
          }
          
          botDebug(`Processando evento: ${action} no grupo ${groupJid} - participantes: ${participants.join(', ')}`);
          
          // SEMPRE atualizar informações do grupo quando há mudanças
          try {
            await this.groupService.updateGroupInfo(this.sock, groupJid);
          } catch (error) {
            await ErrorLogger.logError(error as Error, {
              jid: groupJid,
              action: 'update_group_info_on_participant_change'
            });
          }
          
          if (action === 'add') {
            // Atualiza informações do grupo
            try {
              const { saveOrUpdateGroup } = await import('@/utils/groupUtils');
              await saveOrUpdateGroup(this.sock, groupJid);
            } catch (error) {
              await ErrorLogger.logError(error as Error, {
                jid: groupJid,
                action: 'save_or_update_group'
              });
            }
            
            // Importação dinâmica para evitar dependência circular
            try {
              const { Blacklist } = await import('@/database/models/BlacklistSchema');
              for (const userJid of participants) {
                const black = await Blacklist.findOne({ groupJid, userJid });
                if (black) {
                  try {
                    await this.sock.sendMessage(groupJid, { text: `@${userJid.split('@')[0]} tá fazendo o que aqui de novo otário?`, mentions: [userJid] });
                    await this.sock.groupParticipantsUpdate(groupJid, [userJid], 'remove');
                  } catch (error) {
                    await ErrorLogger.logError(error as Error, {
                      jid: groupJid,
                      userId: userJid,
                      action: 'remove_blacklisted_user'
                    });
                  }
                } else {
                  // NOVO: Verificar configurações de boas-vindas
                  try {
                    const { Group } = await import('@/database/models/GroupSchema');
                    const group = await Group.findOne({ groupJid });
                    const welcomeEnabled = group?.settings?.welcomeEnabled ?? true; // Padrão: ativado
                    
                    if (welcomeEnabled) {
                      // Mensagem de boas-vindas via IA
                      const groupMeta = await this.sock.groupMetadata(groupJid);
                      const newMember = groupMeta.participants.find(p => p.id === userJid);
                      const nomeGrupo = groupMeta.subject;
                      const nomeNovo = newMember?.name || userJid.split('@')[0];
                      const prompt = `Novo membro: ${nomeNovo}. Crie uma mensagem de boas-vindas curta, marcando o usuário @. Seja simpático, até 80 caracteres.`;
                      const welcome = await this.aiService.getChatResponse({ jid: groupJid, text: prompt, senderInfo: { jid: userJid, number: userJid.split('@')[0], name: nomeNovo, isGroup: true, groupJid, groupName: nomeGrupo, timestamp: Date.now(), messageType: 'add' } });
                      if (welcome) {
                        // Enviar mensagem sem adicionar menção manual (a IA já inclui)
                        await this.sock.sendMessage(groupJid, { text: welcome, mentions: [userJid] });
                      }
                    }
                  } catch (error) {
                    await ErrorLogger.logError(error as Error, {
                      jid: groupJid,
                      userId: userJid,
                      action: 'welcome_new_member'
                    });
                  }
                }
              }
            } catch (error) {
              await ErrorLogger.logError(error as Error, {
                jid: groupJid,
                action: 'process_blacklist_check'
              });
            }
            
            // Registrar entrada de membro
            try {
              const { GroupActivity } = await import('@/database/models/GroupActivitySchema');
              for (const userJid of participants) {
                await GroupActivity.create({
                  groupJid,
                  userJid,
                  timestamp: new Date(),
                  type: 'join',
                });
              }
            } catch (error) {
              await ErrorLogger.logError(error as Error, {
                jid: groupJid,
                action: 'save_join_activity'
              });
            }
          }
          
          if (action === 'remove') {
            // NOVO: Verificar configurações de despedida
            try {
              const { Group } = await import('@/database/models/GroupSchema');
              const group = await Group.findOne({ groupJid });
              const goodbyeEnabled = group?.settings?.goodbyeEnabled ?? true; // Padrão: ativado
              
              if (goodbyeEnabled) {
                // Mensagem de despedida via IA
                const groupMeta = await this.sock.groupMetadata(groupJid);
                for (const userJid of participants) {
                  const nomeGrupo = groupMeta.subject;
                  const member = groupMeta.participants.find(p => p.id === userJid);
                  const nomeSaiu = member?.name || userJid.split('@')[0];
                  const prompt = `Membro saiu: ${nomeSaiu}. Crie uma mensagem de despedida bem curta, marcando o usuário @. Use até 40 caracteres.`;
                  const bye = await this.aiService.getChatResponse({ jid: groupJid, text: prompt, senderInfo: { jid: userJid, number: userJid.split('@')[0], name: nomeSaiu, isGroup: true, groupJid, groupName: nomeGrupo, timestamp: Date.now(), messageType: 'remove' } });
                  if (bye) {
                    // Enviar mensagem sem adicionar menção manual (a IA já inclui)
                    await this.sock.sendMessage(groupJid, { text: bye, mentions: [userJid] });
                  }
                }
              }
            } catch (error) {
              await ErrorLogger.logError(error as Error, {
                jid: groupJid,
                action: 'goodbye_message'
              });
            }
            
            // Registrar saída de membro
            try {
              const { GroupActivity } = await import('@/database/models/GroupActivitySchema');
              for (const userJid of participants) {
                await GroupActivity.create({
                  groupJid,
                  userJid,
                  timestamp: new Date(),
                  type: 'leave',
                });
              }
            } catch (error) {
              await ErrorLogger.logError(error as Error, {
                jid: groupJid,
                action: 'save_leave_activity'
              });
            }
          }

          // NOVO: Detectar promoções de admin
          if (action === 'promote') {
            for (const userJid of participants) {
              // Verificar se não é o próprio bot
              if (userJid !== this.sock.user?.id) {
                // NOVO: Sistema mais robusto para evitar envios múltiplos
                const promotionKey = `${userJid}-${groupJid}-promotion`;
                const now = Date.now();
                
                // Verificar se já processamos esta promoção recentemente
                const existingPromotion = this.promotionHistory.get(promotionKey);
                const timeWindow = 24 * 60 * 60 * 1000; // 24 horas
                
                if (existingPromotion) {
                  const timeSinceLastPromotion = now - existingPromotion.timestamp;
                  
                  // Se a promoção foi processada há menos de 24 horas, ignorar
                  if (timeSinceLastPromotion < timeWindow) {
                    const hoursSince = Math.floor(timeSinceLastPromotion / (60 * 60 * 1000));
                    botDebug(`Promoção já processada há ${hoursSince}h para ${userJid} no grupo ${groupJid}. Ignorando.`);
                    continue;
                  }
                }
                
                // NOVO: Verificar se o OnboardingService já enviou mensagem
                if (this.onboardingService.hasPromotionBeenSent(userJid, groupJid)) {
                  botDebug(`Promoção já enviada para ${userJid} no grupo ${groupJid}`);
                  continue;
                }
                
                // Verificar se o usuário realmente é admin agora
                try {
                  const groupMeta = await this.sock.groupMetadata(groupJid);
                  const isActuallyAdmin = groupMeta.participants.some(p => 
                    p.id === userJid && p.admin
                  );
                  
                  if (!isActuallyAdmin) {
                    botDebug(`Usuário ${userJid} não é admin no grupo ${groupJid}. Ignorando evento.`);
                    continue;
                  }
                  
                  // Verificar se não é uma promoção antiga (bot acabou de ficar online)
                  if (this.botOnlineTime) {
                    const timeSinceBotOnline = now - this.botOnlineTime;
                    const maxEventAge = 5 * 60 * 1000; // 5 minutos
                    
                    if (timeSinceBotOnline < maxEventAge) {
                      botDebug(`Bot acabou de ficar online (${Math.round(timeSinceBotOnline/1000)}s), ignorando promoções antigas`);
                      continue;
                    }
                  }
                  
                  botDebug(`Processando nova promoção: ${userJid} no grupo ${groupJid}`);
                  
                  // Enviar mensagem de onboarding
                  await this.onboardingService.sendPromotionOnboarding(this.sock, userJid, groupJid);
                  
                  // Registrar promoção no histórico
                  this.promotionHistory.set(promotionKey, {
                    timestamp: now,
                    groupJid,
                    userJid,
                    messageSent: true
                  });
                  
                  // Limpar histórico antigo (mais de 7 dias)
                  this.cleanupPromotionHistory();
                  
                } catch (error) {
                  console.error(`[ERROR] Erro ao verificar promoção para ${userJid}:`, error);
                  await ErrorLogger.logError(error as Error, {
                    jid: groupJid,
                    userId: userJid,
                    action: 'verify_promotion'
                  });
                }
              }
            }
          }
        } catch (error) {
          await ErrorLogger.logError(error as Error, {
            action: 'group_participants_update'
          });
        }
      });

      // NOVO: Listener para detectar quando o bot entra em um novo grupo
      this.sock.ev.on('groups.update', async (updates) => {
        try {
          for (const update of updates) {
            // Se o bot foi adicionado a um grupo
            if (update.announce === false && update.id) {
              console.log(`[ONBOARDING] Bot adicionado ao grupo: ${update.id}`);
              await this.onboardingService.sendGroupOnboarding(this.sock, update.id);
            }
          }
        } catch (error) {
          await ErrorLogger.logError(error as Error, {
            action: 'group_join_onboarding'
          });
        }
      });
    } catch (error) {
      await ErrorLogger.logError(error as Error, { action: 'connect_to_whatsapp' });
      console.error('[CRITICAL ERROR] Erro ao conectar ao WhatsApp:', error);
      
      // Tenta reconectar após delay
      setTimeout(() => {
        this.connectToWhatsApp();
      }, this.reconnectDelay);
    }
  }

  // NOVO: Inicializar sistema de hooks
  private async initializeHooks(): Promise<void> {
    try {
      // Registrar hooks básicos de logging
      const loggingHook = this.hookManager.createLoggingHook('onMessage', 'basic_logging');
      this.hookManager.registerHook('onMessage', loggingHook);
      
      // Registrar hook para monitoramento de performance da IA
      this.hookManager.registerHook('onAIResponse', {
        name: 'ai_performance_monitor',
        priority: 10,
        execute: async (responseTime: number) => {
          this.performanceMonitor.recordAIResponseTime(responseTime);
        }
      });

      // Registrar hook para monitoramento de erros
      this.hookManager.registerHook('onError', {
        name: 'error_monitor',
        priority: 10,
        execute: async (error: Error, context: any) => {
          this.performanceMonitor.recordError();
          await this.alertService.createSystemAlert(
            'error',
            'Erro Detectado',
            error.message,
            { context, stack: error.stack }
          );
        }
      });

      console.log('[INFO] Sistema de hooks inicializado');
    } catch (error) {
      console.error('[ERROR] Erro ao inicializar hooks:', error);
    }
  }

  // NOVO: Carregar plugins
  private async loadPlugins(): Promise<void> {
    try {
      const plugins = await this.pluginManager.loadAllPlugins();
      console.log(`[INFO] ${plugins.length} plugins carregados`);
      
      if (plugins.length === 0) {
        // Criar plugin de exemplo se não houver plugins
        const examplePath = this.pluginManager.createExamplePlugin();
        console.log(`[INFO] Plugin de exemplo criado: ${examplePath}`);
      }
    } catch (error) {
      console.error('[ERROR] Erro ao carregar plugins:', error);
    }
  }

  public async stop(): Promise<void> {
    try {
      console.log('[INFO] Parando Amanda Bot...');
      
      // Executar hooks de shutdown
      await this.hookManager.executeHooks('onShutdown');
      
      // Parar monitoramento de performance
      this.performanceMonitor.stopMonitoring();
      
      // Descarregar plugins
      const plugins = this.pluginManager.getAllPlugins();
      for (const plugin of plugins) {
        try {
          await this.pluginManager.unloadPlugin(plugin.name);
        } catch (error) {
          console.error(`[ERROR] Erro ao descarregar plugin ${plugin.name}:`, error);
        }
      }
      
      // Enviar alerta de parada
      await this.alertService.createSystemAlert(
        'info',
        'Bot Parado',
        'Amanda Bot foi parada graciosamente'
      );
      
      // Remover lock
      this.removeLock();
      
      console.log('[INFO] Amanda Bot parada com sucesso');
    } catch (error) {
      console.error('[ERROR] Erro ao parar bot:', error);
    }
  }

  // NOVO: Método para limpar histórico de promoções
  private cleanupPromotionHistory(): void {
    const now = Date.now();
    const timeWindow = 7 * 24 * 60 * 60 * 1000; // 7 dias
    const oldPromotions = Array.from(this.promotionHistory.entries()).filter(([key, { timestamp }]) => now - timestamp > timeWindow);
    oldPromotions.forEach(([key, { groupJid, userJid }]) => {
      this.promotionHistory.delete(key);
      botDebug(`Promoção antiga removida: ${userJid} no grupo ${groupJid}`);
    });
  }

  // NOVO: Método para verificar se uma promoção já foi processada
  private isPromotionAlreadyProcessed(userJid: string, groupJid: string): boolean {
    const promotionKey = `${userJid}-${groupJid}-promotion`;
    const existingPromotion = this.promotionHistory.get(promotionKey);
    
    if (!existingPromotion) return false;
    
    const now = Date.now();
    const timeWindow = 24 * 60 * 60 * 1000; // 24 horas
    return (now - existingPromotion.timestamp) < timeWindow;
  }

  // NOVO: Método para lidar com mídias de visualização única
  private async handleViewOnceMessageSafe(msg: any) {
    try {
        let m = msg.message.viewOnceMessageV2?.message || msg.message.viewOnceMessage?.message;
        if (!m) {
            return;
        }
        
        // Extrair informações do remetente e grupo
        const senderNumber = msg.key.participant?.split('@')[0] || msg.key.remoteJid?.split('@')[0] || 'unknown';
        const groupJid = msg.key.remoteJid;
        let groupName = 'privado';
        
        // Tentar obter o nome do grupo se for um grupo
        if (groupJid?.endsWith('@g.us')) {
            try {
                const groupMeta = await this.sock.groupMetadata(groupJid);
                groupName = groupMeta.subject.replace(/[^a-zA-Z0-9]/g, '_'); // Remove caracteres especiais
            } catch (error) {
                groupName = groupJid.split('@')[0];
            }
        }
        
        let mediaType, filename, stream;
        if (m.imageMessage) {
            mediaType = 'image';
            stream = await downloadContentFromMessage(m.imageMessage, 'image');
            filename = `${groupName}_${senderNumber}_${Date.now()}.jpeg`;
        } else if (m.videoMessage) {
            mediaType = 'video';
            stream = await downloadContentFromMessage(m.videoMessage, 'video');
            filename = `${groupName}_${senderNumber}_${Date.now()}.mp4`;
        } else {
            return;
        }
        
        const buffer: Buffer = await (async function toBuffer(stream: any): Promise<Buffer> {
            return new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];
                stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                stream.on('end', () => resolve(Buffer.concat(chunks)));
                stream.on('error', reject);
            });
        })(stream);
        
        const filePath = path.join(MEDIA_SAVE_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        
        // NOVO: Registrar no sistema de temporizador se for em grupo
        if (groupJid?.endsWith('@g.us')) {
            try {
                const { registerMediaSent } = await import('@/commands/admin/time');
                registerMediaSent(groupJid, msg.key.participant || msg.key.remoteJid, mediaType, false, this.sock, msg);
            } catch (error) {
                // Silencioso
            }
        }
        
    } catch (error) {
        // Apenas log de erro crítico
        console.error('[VIEW_ONCE] Erro crítico ao salvar mídia:', error);
    }
  }
} 