import { WASocket, WAMessage, downloadMediaMessage } from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';

@injectable()
export class ViewOnceWatcherService {
  private readonly VIEW_ONCE_DIR = 'G:\\Meu Drive\\ia\\vu';

  constructor() {
    this.ensureDirectoryExists();
    console.log('[ViewOnceWatcher] 🕵️ Sistema de visualizações únicas inicializado e ATIVO 24h');
    console.log('[ViewOnceWatcher] 📁 Salvando em: G:\\Meu Drive\\ia\\vu');
    console.log('[ViewOnceWatcher] 👀 Monitorando todas as mensagens automaticamente...');
  }

  /**
   * Garante que o diretório de visualizações únicas existe
   */
  private ensureDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.VIEW_ONCE_DIR)) {
        fs.mkdirSync(this.VIEW_ONCE_DIR, { recursive: true });
        console.log(`[ViewOnceWatcher] 📁 Diretório criado: ${this.VIEW_ONCE_DIR}`);
      }
    } catch (error) {
      console.error('[ViewOnceWatcher] ❌ Erro ao criar diretório:', error);
    }
  }

  /**
   * Processa uma mensagem e captura visualizações únicas
   * Este método é chamado para TODAS as mensagens automaticamente
   */
  public async processMessage(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      // DEBUG: Log inicial para todas as mensagens
      const groupJid = message.key.remoteJid;
      const isGroup = groupJid?.endsWith('@g.us');
      const isPrivate = groupJid?.endsWith('@s.whatsapp.net');
      
      console.log('[ViewOnceWatcher] 📨 Processando mensagem:', {
        hasMessage: !!message.message,
        messageType: message.message ? Object.keys(message.message)[0] : 'none',
        from: groupJid?.slice(-10),
        participant: message.key.participant?.slice(-10),
        isGroup: isGroup,
        isPrivate: isPrivate,
        fullJid: groupJid
      });

      // Verificar se é visualização única
      if (!this.isViewOnceMessage(message)) {
        return; // Não é visualização única, ignora silenciosamente
      }

      console.log('[ViewOnceWatcher] 🚨 VISUALIZAÇÃO ÚNICA DETECTADA!');
      
      // Extrair informações básicas
      const senderNumber = message.key.participant?.split('@')[0] || message.key.remoteJid?.split('@')[0] || 'unknown';
      let groupName = 'privado';
      
      // Tentar obter o nome do grupo se for um grupo
      if (isGroup && groupJid) {
        try {
          const groupMeta = await sock.groupMetadata(groupJid);
          groupName = groupMeta.subject.replace(/[^a-zA-Z0-9]/g, '_'); // Remove caracteres especiais
          console.log(`[ViewOnceWatcher] 👥 Nome do grupo obtido: ${groupName}`);
        } catch (error) {
          groupName = groupJid.split('@')[0];
          console.log(`[ViewOnceWatcher] ⚠️ Erro ao obter nome do grupo, usando ID: ${groupName}`);
        }
      } else if (isPrivate) {
        groupName = 'privado';
        console.log(`[ViewOnceWatcher] 💬 Chat privado detectado`);
      }

      console.log(`[ViewOnceWatcher] 📊 Informações da captura:`, {
        senderNumber: senderNumber,
        groupName: groupName,
        isGroup: isGroup,
        isPrivate: isPrivate
      });

      // Capturar a visualização única
      await this.captureViewOnce(sock, message, groupName, senderNumber);

    } catch (error) {
      console.error('[ViewOnceWatcher] ❌ Erro ao processar mensagem:', error);
    }
  }

  /**
   * Verifica se uma mensagem é de visualização única
   */
  private isViewOnceMessage(message: WAMessage): boolean {
    const messageContent = message.message;
    if (!messageContent) return false;

    // DEBUG: Log detalhado para verificar a estrutura da mensagem
    console.log('[ViewOnceWatcher] 🔍 Verificando mensagem:', {
      hasViewOnceMessage: !!messageContent.viewOnceMessage,
      hasViewOnceMessageV2: !!messageContent.viewOnceMessageV2,
      messageKeys: Object.keys(messageContent)
    });

    // Verificar se é visualização única (apenas as duas versões válidas)
    const isViewOnce = !!(
      messageContent.viewOnceMessage || 
      messageContent.viewOnceMessageV2
    );
    
    if (isViewOnce) {
      console.log('[ViewOnceWatcher] 🎯 Visualização única detectada!');
      
      // Verificar se contém mídia válida (apenas as duas versões válidas)
      const viewOnceContent = 
        messageContent.viewOnceMessageV2?.message ||
        messageContent.viewOnceMessage?.message;
        
      if (viewOnceContent) {
        console.log('[ViewOnceWatcher] 📦 Conteúdo da visualização única:', {
          hasImage: !!viewOnceContent.imageMessage,
          hasVideo: !!viewOnceContent.videoMessage,
          contentKeys: Object.keys(viewOnceContent)
        });
        
        return !!(viewOnceContent.imageMessage || viewOnceContent.videoMessage);
      } else {
        console.log('[ViewOnceWatcher] ❌ Conteúdo da visualização única não encontrado');
      }
    }

    // NOVO: Verificar se é uma mídia com viewOnce: true
    const hasViewOnceMedia = !!(
      messageContent.imageMessage?.viewOnce ||
      messageContent.videoMessage?.viewOnce
    );

    if (hasViewOnceMedia) {
      console.log('[ViewOnceWatcher] 🎯 Mídia com viewOnce detectada!');
      return true;
    }

    // NOVO: Verificar se é uma mensagem de texto que responde a uma mídia com viewOnce
    if (messageContent.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quotedMessage = messageContent.extendedTextMessage.contextInfo.quotedMessage;
      
      // Verificar se a mensagem respondida tem viewOnce
      const quotedHasViewOnce = !!(
        quotedMessage.imageMessage?.viewOnce ||
        quotedMessage.videoMessage?.viewOnce
      );
      
      if (quotedHasViewOnce) {
        console.log('[ViewOnceWatcher] 🔄 Resposta a visualização única detectada!');
        return true;
      }
    }

    return false;
  }

  /**
   * Captura uma visualização única
   */
  private async captureViewOnce(sock: WASocket, message: WAMessage, groupName: string, senderNumber: string): Promise<void> {
    try {
      const messageContent = message.message;
      if (!messageContent) return;

      let mediaType: string;
      let fileExtension: string;
      let hasCaption = false;
      let caption = '';
      let targetMessage = message; // Mensagem que contém a mídia

      // Verificar se é visualização única tradicional
      const viewOnceContent = 
        messageContent.viewOnceMessageV2?.message ||
        messageContent.viewOnceMessage?.message;
      
      if (viewOnceContent) {
        // É uma visualização única tradicional
        if (viewOnceContent.imageMessage) {
          mediaType = 'image';
          fileExtension = '.jpg';
          hasCaption = !!viewOnceContent.imageMessage.caption;
          caption = viewOnceContent.imageMessage.caption || '';
        } else if (viewOnceContent.videoMessage) {
          mediaType = 'video';
          fileExtension = '.mp4';
          hasCaption = !!viewOnceContent.videoMessage.caption;
          caption = viewOnceContent.videoMessage.caption || '';
        } else {
          console.log('[ViewOnceWatcher] ❌ Tipo de mídia não suportado em visualização única:', Object.keys(viewOnceContent));
          return;
        }
      } else if (messageContent.extendedTextMessage?.contextInfo?.quotedMessage) {
        // É uma resposta a uma visualização única
        const quotedMessage = messageContent.extendedTextMessage.contextInfo.quotedMessage;
        
        if (quotedMessage.imageMessage?.viewOnce) {
          mediaType = 'image';
          fileExtension = '.jpg';
          hasCaption = !!quotedMessage.imageMessage.caption;
          caption = quotedMessage.imageMessage.caption || '';
          
          // Criar uma mensagem fake para download
          targetMessage = {
            ...message,
            message: {
              imageMessage: quotedMessage.imageMessage
            }
          };
        } else if (quotedMessage.videoMessage?.viewOnce) {
          mediaType = 'video';
          fileExtension = '.mp4';
          hasCaption = !!quotedMessage.videoMessage.caption;
          caption = quotedMessage.videoMessage.caption || '';
          
          // Criar uma mensagem fake para download
          targetMessage = {
            ...message,
            message: {
              videoMessage: quotedMessage.videoMessage
            }
          };
        } else {
          console.log('[ViewOnceWatcher] ❌ Tipo de mídia não suportado em resposta:', Object.keys(quotedMessage));
          return;
        }
      } else {
        // É uma mensagem com expiração
        if (messageContent.imageMessage) {
          mediaType = 'image';
          fileExtension = '.jpg';
          hasCaption = !!messageContent.imageMessage.caption;
          caption = messageContent.imageMessage.caption || '';
        } else if (messageContent.videoMessage) {
          mediaType = 'video';
          fileExtension = '.mp4';
          hasCaption = !!messageContent.videoMessage.caption;
          caption = messageContent.videoMessage.caption || '';
        } else {
          console.log('[ViewOnceWatcher] ❌ Tipo de mídia não suportado em mensagem com expiração:', Object.keys(messageContent));
          return;
        }
      }

      // Log de início da captura
      console.log(`[ViewOnceWatcher] 🚨 URGENTE: Capturando ${mediaType} de visualização única/expiração`);
      console.log(`[ViewOnceWatcher] 👤 Remetente: ${senderNumber}`);
      console.log(`[ViewOnceWatcher] 👥 Grupo: ${groupName}`);
      if (hasCaption) {
        console.log(`[ViewOnceWatcher] 📝 Legenda: "${caption}"`);
      }

      // Baixar a mídia (passar a mensagem correta)
      const buffer = await downloadMediaMessage(targetMessage, 'buffer', {});
      
      // Gerar nome do arquivo com nome do grupo e número do remetente
      const timestamp = Date.now();
      const filename = `${groupName}_${senderNumber}_${timestamp}${fileExtension}`;
      const filePath = path.join(this.VIEW_ONCE_DIR, filename);
      
      // Salvar arquivo
      fs.writeFileSync(filePath, buffer as Buffer);
      
      // Log de sucesso
      const fileSize = (buffer as Buffer).length;
      const fileSizeKB = (fileSize / 1024).toFixed(2);
      
      console.log(`[ViewOnceWatcher] ✅ VISUALIZAÇÃO ÚNICA SALVA COM SUCESSO!`);
      console.log(`[ViewOnceWatcher] 📁 Arquivo: ${filename}`);
      console.log(`[ViewOnceWatcher] 📊 Tamanho: ${fileSizeKB} KB`);
      console.log(`[ViewOnceWatcher] 🗂️ Localização: ${filePath}`);
      if (hasCaption) {
        console.log(`[ViewOnceWatcher] 📝 Legenda preservada: "${caption}"`);
      }
      console.log(`[ViewOnceWatcher] 🎯 Missão cumprida! Continuando observação...`);

    } catch (error) {
      console.error('[ViewOnceWatcher] ❌ ERRO CRÍTICO ao capturar visualização única:', error);
    }
  }

  /**
   * Obtém estatísticas de visualizações únicas capturadas
   */
  public getStats(): { total: number; images: number; videos: number } {
    try {
      if (!fs.existsSync(this.VIEW_ONCE_DIR)) {
        return { total: 0, images: 0, videos: 0 };
      }

      const files = fs.readdirSync(this.VIEW_ONCE_DIR);
      const stats = {
        total: files.length,
        images: 0,
        videos: 0
      };

      files.forEach(file => {
        const extension = path.extname(file).toLowerCase();
        if (extension === '.jpg' || extension === '.jpeg' || extension === '.png') {
          stats.images++;
        } else if (extension === '.mp4' || extension === '.avi' || extension === '.mov') {
          stats.videos++;
        }
      });

      return stats;
    } catch (error) {
      console.error('[ViewOnceWatcher] Erro ao obter estatísticas:', error);
      return { total: 0, images: 0, videos: 0 };
    }
  }
} 