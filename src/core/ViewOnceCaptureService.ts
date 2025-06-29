import { WASocket, proto, downloadContentFromMessage } from '@whiskeysockets/baileys';
import { injectable } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';

type WAMessage = proto.IWebMessageInfo;

interface ViewOnceStats {
  totalCaptured: number;
  imagesCaptured: number;
  videosCaptured: number;
  errors: number;
  lastCapture: Date | null;
}

@injectable()
export class ViewOnceCaptureService {
  private readonly MEDIA_SAVE_DIR = 'G:\\Meu Drive\\ia';
  private readonly BACKUP_DIR = path.join(process.cwd(), 'viewonce_backup');
  private stats: ViewOnceStats = {
    totalCaptured: 0,
    imagesCaptured: 0,
    videosCaptured: 0,
    errors: 0,
    lastCapture: null
  };

  constructor() {
    this.ensureDirectories();
    this.loadStats();
  }

  private ensureDirectories(): void {
    // Criar diretório principal se não existir
    if (!fs.existsSync(this.MEDIA_SAVE_DIR)) {
      fs.mkdirSync(this.MEDIA_SAVE_DIR, { recursive: true });
    }

    // Criar diretório de backup se não existir
    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
    }
  }

  private loadStats(): void {
    const statsFile = path.join(this.BACKUP_DIR, 'stats.json');
    try {
      if (fs.existsSync(statsFile)) {
        const data = fs.readFileSync(statsFile, 'utf8');
        this.stats = { ...this.stats, ...JSON.parse(data) };
      }
    } catch (error) {
      // Silencioso
    }
  }

  private saveStats(): void {
    const statsFile = path.join(this.BACKUP_DIR, 'stats.json');
    try {
      fs.writeFileSync(statsFile, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      // Silencioso
    }
  }

  /**
   * Captura e salva uma mensagem de visualização única
   * Esta função é chamada para TODAS as mensagens, independente de serem processadas ou não
   */
  public async captureViewOnceMessage(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      // Verificar se é mensagem de visualização única
      if (!this.isViewOnceMessage(message)) {
        return;
      }

      // Extrair informações da mensagem
      const messageInfo = this.extractMessageInfo(message);

      // Baixar e salvar a mídia
      const result = await this.downloadAndSaveMedia(sock, message, messageInfo);
      
      if (result.success) {
        // Atualizar estatísticas
        this.stats.totalCaptured++;
        this.stats.lastCapture = new Date();
        
        if (result.mediaType === 'image') {
          this.stats.imagesCaptured++;
        } else if (result.mediaType === 'video') {
          this.stats.videosCaptured++;
        }

        this.saveStats();
        
        // Salvar log detalhado
        this.saveCaptureLog(messageInfo, result);
      } else {
        this.stats.errors++;
        this.saveStats();
      }

    } catch (error) {
      this.stats.errors++;
      this.saveStats();
      // Apenas log de erro crítico no terminal
      console.error(`[VIEW_ONCE] Erro crítico:`, error);
    }
  }

  /**
   * Verifica se a mensagem é de visualização única
   */
  private isViewOnceMessage(message: WAMessage): boolean {
    return !!(message.message?.viewOnceMessage || message.message?.viewOnceMessageV2);
  }

  /**
   * Extrai informações da mensagem
   */
  private extractMessageInfo(message: WAMessage): {
    messageId: string;
    senderJid: string;
    senderNumber: string;
    groupJid: string | null;
    groupName: string;
    timestamp: number;
    messageType: 'viewOnceMessage' | 'viewOnceMessageV2';
    hasImage: boolean;
    hasVideo: boolean;
  } {
    const messageId = message.key.id || 'unknown';
    const senderJid = message.key.participant || message.key.remoteJid || 'unknown';
    const senderNumber = senderJid.split('@')[0];
    const groupJid = message.key.remoteJid?.endsWith('@g.us') ? message.key.remoteJid : null;
    const timestamp = Number(message.messageTimestamp) || Date.now();

    // Determinar tipo de mensagem
    const messageType = message.message?.viewOnceMessageV2 ? 'viewOnceMessageV2' : 'viewOnceMessage';
    
    // Verificar conteúdo
    const viewOnceContent = message.message?.viewOnceMessageV2?.message || message.message?.viewOnceMessage?.message;
    const hasImage = !!viewOnceContent?.imageMessage;
    const hasVideo = !!viewOnceContent?.videoMessage;

    return {
      messageId,
      senderJid,
      senderNumber,
      groupJid,
      groupName: groupJid ? groupJid.split('@')[0] : 'privado',
      timestamp,
      messageType,
      hasImage,
      hasVideo
    };
  }

  /**
   * Baixa e salva a mídia
   */
  private async downloadAndSaveMedia(
    sock: WASocket, 
    message: WAMessage, 
    messageInfo: ReturnType<typeof this.extractMessageInfo>
  ): Promise<{
    success: boolean;
    mediaType?: 'image' | 'video';
    filePath?: string;
    error?: string;
  }> {
    try {
      // Obter o conteúdo da visualização única
      const viewOnceContent = message.message?.viewOnceMessageV2?.message || message.message?.viewOnceMessage?.message;
      
      if (!viewOnceContent) {
        return { success: false, error: 'Conteúdo da visualização única não encontrado' };
      }

      let mediaType: 'image' | 'video';
      let stream: any;
      let fileExtension: string;

      if (viewOnceContent.imageMessage) {
        mediaType = 'image';
        stream = await downloadContentFromMessage(viewOnceContent.imageMessage, 'image');
        fileExtension = '.jpeg';
      } else if (viewOnceContent.videoMessage) {
        mediaType = 'video';
        stream = await downloadContentFromMessage(viewOnceContent.videoMessage, 'video');
        fileExtension = '.mp4';
      } else {
        return { success: false, error: 'Tipo de mídia não suportado' };
      }

      // Converter stream para buffer
      const buffer: Buffer = await this.streamToBuffer(stream);

      // Gerar nome do arquivo
      const fileName = this.generateFileName(messageInfo, fileExtension);
      
      // Salvar no diretório principal
      const mainFilePath = path.join(this.MEDIA_SAVE_DIR, fileName);
      fs.writeFileSync(mainFilePath, buffer);

      // Salvar backup
      const backupFilePath = path.join(this.BACKUP_DIR, fileName);
      fs.writeFileSync(backupFilePath, buffer);

      return {
        success: true,
        mediaType,
        filePath: mainFilePath
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Converte stream para buffer
   */
  private streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Gera nome do arquivo
   */
  private generateFileName(messageInfo: ReturnType<typeof this.extractMessageInfo>, extension: string): string {
    const date = new Date(messageInfo.timestamp * 1000);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    
    const groupPrefix = messageInfo.groupJid ? messageInfo.groupName : 'privado';
    const mediaType = messageInfo.hasImage ? 'img' : 'vid';
    
    return `${dateStr}_${timeStr}_${groupPrefix}_${messageInfo.senderNumber}_${mediaType}_${messageInfo.messageId}${extension}`;
  }

  /**
   * Salva log detalhado da captura
   */
  private saveCaptureLog(messageInfo: ReturnType<typeof this.extractMessageInfo>, result: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      messageInfo,
      result,
      stats: { ...this.stats }
    };

    const logFile = path.join(this.BACKUP_DIR, 'capture_log.json');
    let logs = [];
    
    try {
      if (fs.existsSync(logFile)) {
        const data = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(data);
      }
    } catch (error) {
      console.log(`[VIEW_ONCE] Erro ao ler log existente:`, error);
    }

    logs.push(logEntry);

    // Manter apenas os últimos 1000 logs
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }

    try {
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.log(`[VIEW_ONCE] Erro ao salvar log:`, error);
    }
  }

  /**
   * Obtém estatísticas de captura
   */
  public getStats(): ViewOnceStats {
    return { ...this.stats };
  }

  /**
   * Reseta estatísticas
   */
  public resetStats(): void {
    this.stats = {
      totalCaptured: 0,
      imagesCaptured: 0,
      videosCaptured: 0,
      errors: 0,
      lastCapture: null
    };
    this.saveStats();
  }

  /**
   * Lista arquivos capturados
   */
  public listCapturedFiles(): { main: string[], backup: string[] } {
    const mainFiles = fs.existsSync(this.MEDIA_SAVE_DIR) 
      ? fs.readdirSync(this.MEDIA_SAVE_DIR).filter(f => f.includes('_img_') || f.includes('_vid_'))
      : [];
    
    const backupFiles = fs.existsSync(this.BACKUP_DIR)
      ? fs.readdirSync(this.BACKUP_DIR).filter(f => f.includes('_img_') || f.includes('_vid_'))
      : [];

    return { main: mainFiles, backup: backupFiles };
  }

  /**
   * Limpa arquivos antigos (mais de 30 dias)
   */
  public cleanupOldFiles(): { mainDeleted: number, backupDeleted: number } {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let mainDeleted = 0;
    let backupDeleted = 0;

    // Limpar diretório principal
    if (fs.existsSync(this.MEDIA_SAVE_DIR)) {
      const mainFiles = fs.readdirSync(this.MEDIA_SAVE_DIR);
      for (const file of mainFiles) {
        if (file.includes('_img_') || file.includes('_vid_')) {
          const filePath = path.join(this.MEDIA_SAVE_DIR, file);
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() < thirtyDaysAgo) {
            fs.unlinkSync(filePath);
            mainDeleted++;
          }
        }
      }
    }

    // Limpar diretório de backup
    if (fs.existsSync(this.BACKUP_DIR)) {
      const backupFiles = fs.readdirSync(this.BACKUP_DIR);
      for (const file of backupFiles) {
        if (file.includes('_img_') || file.includes('_vid_')) {
          const filePath = path.join(this.BACKUP_DIR, file);
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() < thirtyDaysAgo) {
            fs.unlinkSync(filePath);
            backupDeleted++;
          }
        }
      }
    }

    return { mainDeleted, backupDeleted };
  }
} 