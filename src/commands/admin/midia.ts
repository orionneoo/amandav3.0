import { WASocket } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';
import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';
import { MediaCaptureService } from '@/services/MediaCaptureService';

@injectable()
export class MidiaCommand implements IInjectableCommand {
  public readonly name = 'midia';
  public readonly description = 'Mostra estatísticas de mídia capturada';
  public readonly category = 'admin';
  public readonly usage = '!midia';
  public readonly aliases = ['media', 'mídia'];

  constructor(
    @inject(TYPES.MediaCaptureService) private mediaCaptureService: MediaCaptureService
  ) {}

  public async handle(context: MessageContext): Promise<void> {
    const { sock, from, messageInfo } = context;

    try {
      console.log('[MIDIA] Comando executado, obtendo estatísticas...');
      
      const stats = this.mediaCaptureService.getMediaStats();
      
      let response = `📊 *ESTATÍSTICAS DE MÍDIA*\n\n`;
      response += `📁 *Total de arquivos:* ${stats.total}\n\n`;
      
      if (Object.keys(stats.byType).length > 0) {
        response += `📋 *Por tipo:*\n`;
        
        if (stats.byType.image) {
          response += `🖼️ Imagens: ${stats.byType.image}\n`;
        }
        if (stats.byType.video) {
          response += `🎥 Vídeos: ${stats.byType.video}\n`;
        }
        if (stats.byType.audio) {
          response += `🎵 Áudios: ${stats.byType.audio}\n`;
        }
        if (stats.byType.document) {
          response += `📄 Documentos: ${stats.byType.document}\n`;
        }
        if (stats.byType.sticker) {
          response += `😀 Figurinhas: ${stats.byType.sticker}\n`;
        }
        if (stats.byType.other) {
          response += `📦 Outros: ${stats.byType.other}\n`;
        }
      } else {
        response += `📭 Nenhuma mídia capturada ainda.\n`;
      }
      
      response += `\n💾 *Localização:*\n`;
      response += `📂 Mídias normais: \`G:\\Meu Drive\\ia\`\n\n`;
      response += `💡 *Visualizações únicas:* Use \`!vu stats\` para ver estatísticas do sistema independente`;

      await sock.sendMessage(
        from,
        { text: response },
        { quoted: messageInfo }
      );

    } catch (error) {
      console.error('[MIDIA] Erro ao obter estatísticas:', error);
      await sock.sendMessage(
        from,
        { text: '❌ Erro ao obter estatísticas de mídia.' },
        { quoted: messageInfo }
      );
    }
  }
} 