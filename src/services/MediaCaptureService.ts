import { WASocket, WAMessage, downloadMediaMessage } from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';

@injectable()
export class MediaCaptureService {
  private readonly MEDIA_SAVE_DIR = 'G:\\Meu Drive\\ia';
  private readonly VIEW_ONCE_DIR = 'G:\\Meu Drive\\ia\\vu';

  constructor() {
    // Criar diretórios se não existirem
    this.ensureDirectoryExists();
  }

  /**
   * Garante que os diretórios de mídia existem
   */
  private ensureDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.MEDIA_SAVE_DIR)) {
        fs.mkdirSync(this.MEDIA_SAVE_DIR, { recursive: true });
        console.log(`[MediaCapture] Diretório criado: ${this.MEDIA_SAVE_DIR}`);
      }
      
      if (!fs.existsSync(this.VIEW_ONCE_DIR)) {
        fs.mkdirSync(this.VIEW_ONCE_DIR, { recursive: true });
        console.log(`[MediaCapture] Diretório de visualização única criado: ${this.VIEW_ONCE_DIR}`);
      }
    } catch (error) {
      console.error('[MediaCapture] Erro ao criar diretórios:', error);
    }
  }

  /**
   * Processa e salva qualquer tipo de mídia
   */
  public async captureMedia(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      const messageContent = message.message;
      if (!messageContent) return;

      // Extrair informações básicas
      const senderNumber = message.key.participant?.split('@')[0] || message.key.remoteJid?.split('@')[0] || 'unknown';
      const groupJid = message.key.remoteJid;
      let groupName = 'privado';
      
      // Tentar obter o nome do grupo se for um grupo
      if (groupJid?.endsWith('@g.us')) {
        try {
          const groupMeta = await sock.groupMetadata(groupJid);
          groupName = groupMeta.subject.replace(/[^a-zA-Z0-9]/g, '_'); // Remove caracteres especiais
        } catch (error) {
          groupName = groupJid.split('@')[0];
        }
      }

      // Processar mídias normais (visualizações únicas são tratadas pelo ViewOnceWatcherService)
      await this.captureNormalMedia(message, groupName, senderNumber);

    } catch (error) {
      console.error('[MediaCapture] Erro ao capturar mídia:', error);
    }
  }

  /**
   * Captura mídias normais
   */
  private async captureNormalMedia(message: WAMessage, groupName: string, senderNumber: string): Promise<void> {
    try {
      const messageContent = message.message;
      if (!messageContent) return;

      let mediaType: string;
      let fileExtension: string;
      let caption: string = '';

      // Detectar tipo de mídia
      if (messageContent.imageMessage) {
        mediaType = 'image';
        fileExtension = '.jpg';
        caption = messageContent.imageMessage.caption || '';
      } else if (messageContent.videoMessage) {
        mediaType = 'video';
        fileExtension = '.mp4';
        caption = messageContent.videoMessage.caption || '';
      } else if (messageContent.audioMessage) {
        mediaType = 'audio';
        fileExtension = '.mp3';
      } else if (messageContent.documentMessage) {
        mediaType = 'document';
        const fileName = messageContent.documentMessage.fileName || 'document';
        fileExtension = path.extname(fileName) || '.bin';
      } else if (messageContent.stickerMessage) {
        mediaType = 'sticker';
        fileExtension = '.webp';
      } else {
        return; // Não é mídia
      }

      console.log(`[MediaCapture] Baixando ${mediaType} de ${senderNumber} no grupo ${groupName}`);
      
      const buffer = await downloadMediaMessage(message, 'buffer', {});
      const timestamp = Date.now();
      const filename = `${groupName}_${senderNumber}_${timestamp}${fileExtension}`;
      const filePath = path.join(this.MEDIA_SAVE_DIR, filename);
      
      fs.writeFileSync(filePath, buffer as Buffer);
      
      // Log detalhado
      const fileSize = (buffer as Buffer).length;
      const fileSizeKB = (fileSize / 1024).toFixed(2);
      
      console.log(`[MediaCapture] ✅ ${mediaType} salva: ${filename} (${fileSizeKB} KB)`);
      if (caption) {
        console.log(`[MediaCapture] 📝 Legenda: "${caption}"`);
      }

    } catch (error) {
      console.error('[MediaCapture] Erro ao capturar mídia normal:', error);
    }
  }

  /**
   * Verifica se uma mensagem contém mídia
   */
  public hasMedia(message: WAMessage): boolean {
    const messageContent = message.message;
    if (!messageContent) return false;

    // Verificar mídias normais (visualizações únicas são tratadas pelo ViewOnceWatcherService)
    return !!(
      messageContent.imageMessage ||
      messageContent.videoMessage ||
      messageContent.audioMessage ||
      messageContent.documentMessage ||
      messageContent.stickerMessage
    );
  }

  /**
   * Obtém estatísticas de mídia salva
   */
  public getMediaStats(): { total: number; byType: Record<string, number> } {
    try {
      const stats = {
        total: 0,
        byType: {} as Record<string, number>
      };

      // Contar mídias normais
      if (fs.existsSync(this.MEDIA_SAVE_DIR)) {
        const files = fs.readdirSync(this.MEDIA_SAVE_DIR);
        stats.total += files.length;

        files.forEach(file => {
          const extension = path.extname(file).toLowerCase();
          const type = this.getMediaTypeFromExtension(extension);
          stats.byType[type] = (stats.byType[type] || 0) + 1;
        });
      }

      return stats;
    } catch (error) {
      console.error('[MediaCapture] Erro ao obter estatísticas:', error);
      return { total: 0, byType: {} };
    }
  }

  /**
   * Mapeia extensão para tipo de mídia
   */
  private getMediaTypeFromExtension(extension: string): string {
    switch (extension) {
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
        return 'image';
      case '.mp4':
      case '.avi':
      case '.mov':
        return 'video';
      case '.mp3':
      case '.wav':
      case '.ogg':
        return 'audio';
      case '.pdf':
      case '.doc':
      case '.docx':
      case '.txt':
        return 'document';
      case '.webp':
        return 'sticker';
      default:
        return 'other';
    }
  }
} 