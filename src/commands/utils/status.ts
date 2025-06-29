import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { createValidatedCommand } from '@/utils/commandWrapper';

type WAMessage = proto.IWebMessageInfo;

// FIX: Comando de status com tratamento de erro robusto
const statusCommand: ICommand = {
  name: 'status',
  aliases: ['botstatus', 'health', 'saude'],
  description: 'Mostra o status e saúde do bot',
  category: 'utils',
  usage: '!status [detalhado]',
  execute: async (sock: WASocket, message: WAMessage, args: string[]) => {
    try {
      const groupJid = message.key.remoteJid!;
      const isDetailed = args.includes('detalhado') || args.includes('detailed');
      
      // FIX: Coletar informações do sistema
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // FIX: Formatar tempo de atividade
      const formatUptime = (seconds: number): string => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
      };
      
      // FIX: Formatar uso de memória
      const formatMemory = (bytes: number): string => {
        const gb = bytes / 1024 / 1024 / 1024;
        return `${gb.toFixed(2)} GB`;
      };
      
      // FIX: Calcular porcentagem de uso de memória com limite real de 8GB
      const memoryLimitGB = 8; // Limite configurado com --max-old-space-size=8192
      const memoryUsedGB = memoryUsage.heapUsed / 1024 / 1024 / 1024;
      const memoryPercent = (memoryUsedGB / memoryLimitGB) * 100;
      
      // FIX: Status básico
      let statusText = `🤖 *Status do Bot*\n\n`;
      statusText += `⏰ *Uptime:* ${formatUptime(uptime)}\n`;
      statusText += `💾 *Memória:* ${formatMemory(memoryUsage.heapUsed)} / ${memoryLimitGB}.00 GB (${memoryPercent.toFixed(2)}%)\n`;
      statusText += `🔄 *Status:* Online e funcionando\n`;
      statusText += `📊 *Versão:* Amanda v3.9.0\n\n`;
      
      // FIX: Informações detalhadas se solicitado
      if (isDetailed) {
        statusText += `📈 *Informações Detalhadas:*\n`;
        statusText += `• Memória RSS: ${formatMemory(memoryUsage.rss)}\n`;
        statusText += `• Memória Externa: ${formatMemory(memoryUsage.external)}\n`;
        statusText += `• CPU User: ${(cpuUsage.user / 1000000).toFixed(2)}s\n`;
        statusText += `• CPU System: ${(cpuUsage.system / 1000000).toFixed(2)}s\n`;
        statusText += `• Node.js: ${process.version}\n`;
        statusText += `• Plataforma: ${process.platform}\n`;
        statusText += `• PID: ${process.pid}\n\n`;
        
        // FIX: Tentar obter estatísticas de comandos (pode falhar)
        try {
          const { CommandUsage } = await import('@/database/models/CommandUsageSchema');
          const totalCommands = await CommandUsage.aggregate([
            { $group: { _id: null, total: { $sum: '$count' } } }
          ]);
          
          if (totalCommands.length > 0) {
            statusText += `📊 *Estatísticas:*\n`;
            statusText += `• Total de comandos executados: ${totalCommands[0].total}\n`;
          }
        } catch (dbError) {
          statusText += `📊 *Estatísticas:* Não disponível (erro no banco)\n`;
        }
      }
      
      statusText += `\n_Use !status detalhado para mais informações_`;
      
      await sock.sendMessage(groupJid, { text: statusText });
      
    } catch (error) {
      // FIX: Este erro será capturado pelo wrapper, mas aqui temos tratamento específico
      console.error('[STATUS_COMMAND] Erro específico:', error);
      
      // FIX: Mensagem de erro específica para este comando
      const errorMessage = `❌ Erro ao obter status do bot: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧`;
      await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
    }
  },
};

// FIX: Exportar comando protegido automaticamente
export default createValidatedCommand(statusCommand, {
  maxArgs: 2,
  optionalArgs: ['detalhado', 'detailed']
}); 