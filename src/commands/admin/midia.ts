import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { MediaCaptureService } from '@/services/MediaCaptureService';
import { ViewOnceWatcherService } from '@/services/ViewOnceWatcherService';
import { TYPES } from '@/config/container';
import { MessageContext } from '@/handlers/message.handler';

@injectable()
export class MidiaCommand implements IInjectableCommand {
  public name = 'midia';
  public description = '📊 Mostra estatísticas de mídia capturada';
  public category = 'admin' as const;
  public usage = '!midia';
  public cooldown = 10;
  public aliases = ['media', 'mídia'];

  constructor(
    @inject(TYPES.MediaCaptureService) private mediaCaptureService: MediaCaptureService,
    @inject(TYPES.ViewOnceWatcherService) private viewOnceWatcherService: ViewOnceWatcherService
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, from: groupJid } = context;
    
    try {
      // Obter estatísticas de mídia normal
      const mediaStats = this.mediaCaptureService.getMediaStats();
      
      // Obter estatísticas de visualizações únicas
      const viewOnceStats = this.viewOnceWatcherService.getStats();
      
      const mensagem = `📊 *ESTATÍSTICAS DE MÍDIA*\n\n` +
        `📁 *Mídia Normal:*\n` +
        `• Total: ${mediaStats.total} arquivos\n` +
        `• Por tipo: ${Object.entries(mediaStats.byType).map(([type, count]) => `${type}: ${count}`).join(', ') || 'Nenhuma'}\n\n` +
        `🕵️ *Visualizações Únicas:*\n` +
        `• Total: ${viewOnceStats.total} arquivos\n` +
        `• Imagens: ${viewOnceStats.images}\n` +
        `• Vídeos: ${viewOnceStats.videos}\n\n` +
        `📂 *Localização:*\n` +
        `• Mídia normal: G:\\Meu Drive\\ia\\\n` +
        `• Visualizações únicas: G:\\Meu Drive\\ia\\vu\\\n\n` +
        `🕵️ *Sistema de Visualizações Únicas:*\n` +
        `• Status: ✅ ATIVO 24h\n` +
        `• Monitoramento: Todas as mensagens\n` +
        `• Captura automática: Sim\n` +
        `• Nomenclatura: {grupo}_{numero}_{timestamp}.{extensao}`;

      await sock.sendMessage(groupJid, { text: mensagem });
      
    } catch (error) {
      console.error('Erro ao executar comando midia:', error);
      await sock.sendMessage(groupJid, {
        text: '❌ Erro ao obter estatísticas de mídia.'
      });
    }
  }
} 