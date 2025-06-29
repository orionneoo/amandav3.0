import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import Logger from '@/utils/Logger';
import fs from 'fs/promises';
import path from 'path';
import { DatabaseStatus } from '@/utils/databaseStatus';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

interface LogStats {
  totalErrors: number;
  totalCommands: number;
  successRate: number;
  averageExecutionTime: number;
  mostUsedCommands: Array<{ command: string; count: number }>;
  recentErrors: Array<{ timestamp: string; command: string; error: string }>;
}

const command: ICommand = {
  name: 'logs',
  description: '📊 Analisa logs do sistema e mostra estatísticas',
  aliases: ['log', 'estatisticas', 'stats'],
  category: 'admin',
  usage: '!logs [opção]',
  async handle(context: MessageContext): Promise<void> {
    const { sock, messageInfo: message, args, sender: userJid, from: groupJid } = context;
    
    // Verificar se é admin (implementar verificação de admin)
    const isAdmin = true; // TODO: Implementar verificação real
    
    if (!isAdmin) {
      await sock.sendMessage(groupJid, {
        text: '❌ *Acesso Negado*\n\nVocê não tem permissão para usar este comando, meu bem! 😅'
      });
      return;
    }

    // Verificar se o banco está offline
    if (DatabaseStatus.getInstance().isDatabaseOffline()) {
      await sock.sendMessage(groupJid, {
        text: DatabaseStatus.getInstance().getOfflineMessage('Logs')
      });
      return;
    }

    const option = args[0]?.toLowerCase();
    
    try {
      switch (option) {
        case 'errors':
          await showRecentErrors(sock, message);
          break;
        case 'performance':
          await showPerformanceStats(sock, message);
          break;
        case 'commands':
          await showCommandStats(sock, message);
          break;
        case 'system':
          await showSystemLogs(sock, message);
          break;
        default:
          await showGeneralStats(sock, message);
          break;
      }
    } catch (error) {
      Logger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        command: 'logs',
        userId: userJid,
        groupId: groupJid?.endsWith('@g.us') ? groupJid : undefined,
        errorMessage: `Erro ao analisar logs: ${error instanceof Error ? error.message : String(error)}`,
        stackTrace: error instanceof Error ? error.stack : undefined,
        metadata: { option, args }
      });

      await sock.sendMessage(groupJid, {
        text: '❌ *Erro na Análise*\n\nOpa, deu ruim na hora de analisar os logs! 😅\n\nTente novamente ou me avise se o problema persistir! Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }
};

async function showGeneralStats(sock: WASocket, message: WAMessage): Promise<void> {
  const logDir = path.join(process.cwd(), 'logs');
  
  try {
    const files = await fs.readdir(logDir);
    const today = new Date().toISOString().split('T')[0];
    
    let totalErrors = 0;
    let totalCommands = 0;
    let successCommands = 0;
    
    // Contar logs do dia
    for (const file of files) {
      if (file.includes(today)) {
        const filePath = path.join(logDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const logEntry = JSON.parse(line);
              
              if (logEntry.type === 'error') {
                totalErrors++;
              } else if (logEntry.type === 'command_execution') {
                totalCommands++;
                if (logEntry.success) {
                  successCommands++;
                }
              }
            } catch (e) {
              // Ignorar linhas inválidas
            }
          }
        }
      }
    }
    
    const successRate = totalCommands > 0 ? ((successCommands / totalCommands) * 100).toFixed(1) : '0.0';
    
    const statsMessage = `📊 *Estatísticas do Sistema - ${today}*\n\n` +
      `🔴 *Erros:* ${totalErrors}\n` +
      `📝 *Comandos Executados:* ${totalCommands}\n` +
      `✅ *Taxa de Sucesso:* ${successRate}%\n` +
      `📈 *Status:* ${totalErrors === 0 ? '🟢 Tudo OK!' : totalErrors < 5 ? '🟡 Atenção' : '🔴 Crítico'}\n\n` +
      `*Opções disponíveis:*\n` +
      `• \`!logs errors\` - Erros recentes\n` +
      `• \`!logs performance\` - Performance\n` +
      `• \`!logs commands\` - Comandos mais usados\n` +
      `• \`!logs system\` - Logs do sistema`;
    
    await sock.sendMessage(message.key.remoteJid!, { text: statsMessage });
    
  } catch (error) {
    throw new Error(`Erro ao ler logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function showRecentErrors(sock: WASocket, message: WAMessage): Promise<void> {
  const logDir = path.join(process.cwd(), 'logs');
  const today = new Date().toISOString().split('T')[0];
  const errorFile = path.join(logDir, `errors-${today}.log`);
  
  try {
    const content = await fs.readFile(errorFile, 'utf-8');
    const lines = content.trim().split('\n').reverse().slice(0, 10); // Últimos 10 erros
    
    let errorMessage = `🔴 *Erros Recentes - ${today}*\n\n`;
    
    if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
      errorMessage += '✅ *Nenhum erro registrado hoje!*\n\nTudo funcionando perfeitamente! 🎉';
    } else {
      let errorCount = 0;
      
      for (const line of lines) {
        if (line.trim() && errorCount < 5) {
          try {
            const logEntry = JSON.parse(line);
            const timestamp = new Date(logEntry.timestamp).toLocaleTimeString('pt-BR');
            
            errorMessage += `⏰ *${timestamp}*\n` +
              `📝 Comando: \`${logEntry.command || 'N/A'}\`\n` +
              `👤 Usuário: \`${logEntry.userId || 'N/A'}\`\n` +
              `❌ Erro: \`${logEntry.errorMessage || 'N/A'}\`\n\n`;
            
            errorCount++;
          } catch (e) {
            // Ignorar linhas inválidas
          }
        }
      }
      
      if (errorCount === 0) {
        errorMessage += '✅ *Nenhum erro estruturado encontrado!*\n\n';
      }
    }
    
    errorMessage += `📊 Use \`!logs\` para estatísticas gerais`;
    
    await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
    
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '✅ *Nenhum Erro Encontrado*\n\nNão há arquivo de erros para hoje! Tudo funcionando perfeitamente! 🎉'
      });
    } else {
      throw error;
    }
  }
}

async function showPerformanceStats(sock: WASocket, message: WAMessage): Promise<void> {
  const logDir = path.join(process.cwd(), 'logs');
  const today = new Date().toISOString().split('T')[0];
  const commandFile = path.join(logDir, `commands-${today}.log`);
  
  try {
    const content = await fs.readFile(commandFile, 'utf-8');
    const lines = content.trim().split('\n');
    
    const commandTimes: { [key: string]: number[] } = {};
    let totalCommands = 0;
    let totalTime = 0;
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const logEntry = JSON.parse(line);
          
          if (logEntry.type === 'command_execution' && logEntry.success && logEntry.executionTime) {
            const command = logEntry.command;
            if (!commandTimes[command]) {
              commandTimes[command] = [];
            }
            commandTimes[command].push(logEntry.executionTime);
            totalCommands++;
            totalTime += logEntry.executionTime;
          }
        } catch (e) {
          // Ignorar linhas inválidas
        }
      }
    }
    
    // Calcular médias e encontrar comandos lentos
    const commandAverages: Array<{ command: string; avgTime: number; count: number }> = [];
    
    for (const [command, times] of Object.entries(commandTimes)) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      commandAverages.push({ command, avgTime, count: times.length });
    }
    
    // Ordenar por tempo médio (mais lentos primeiro)
    commandAverages.sort((a, b) => b.avgTime - a.avgTime);
    
    const avgExecutionTime = totalCommands > 0 ? (totalTime / totalCommands).toFixed(0) : '0';
    
    let performanceMessage = `⚡ *Performance - ${today}*\n\n` +
      `📊 *Estatísticas Gerais:*\n` +
      `• Total de comandos: ${totalCommands}\n` +
      `• Tempo médio: ${avgExecutionTime}ms\n\n` +
      `🐌 *Comandos Mais Lentos:*\n`;
    
    if (commandAverages.length === 0) {
      performanceMessage += 'Nenhum comando executado hoje! 📝';
    } else {
      const slowCommands = commandAverages.slice(0, 5);
      
      for (const { command, avgTime, count } of slowCommands) {
        const emoji = avgTime > 5000 ? '🐌' : avgTime > 2000 ? '🐢' : '⚡';
        performanceMessage += `${emoji} \`${command}\`: ${avgTime.toFixed(0)}ms (${count}x)\n`;
      }
    }
    
    performanceMessage += `\n📈 Use \`!logs\` para estatísticas gerais`;
    
    await sock.sendMessage(message.key.remoteJid!, { text: performanceMessage });
    
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '📝 *Nenhum Dado de Performance*\n\nNão há dados de comandos para hoje! 📊'
      });
    } else {
      throw error;
    }
  }
}

async function showCommandStats(sock: WASocket, message: WAMessage): Promise<void> {
  const logDir = path.join(process.cwd(), 'logs');
  const today = new Date().toISOString().split('T')[0];
  const commandFile = path.join(logDir, `commands-${today}.log`);
  
  try {
    const content = await fs.readFile(commandFile, 'utf-8');
    const lines = content.trim().split('\n');
    
    const commandCounts: { [key: string]: number } = {};
    let totalCommands = 0;
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const logEntry = JSON.parse(line);
          
          if (logEntry.type === 'command_execution') {
            const command = logEntry.command;
            commandCounts[command] = (commandCounts[command] || 0) + 1;
            totalCommands++;
          }
        } catch (e) {
          // Ignorar linhas inválidas
        }
      }
    }
    
    // Ordenar por uso
    const sortedCommands = Object.entries(commandCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    let commandMessage = `📊 *Comandos Mais Usados - ${today}*\n\n` +
      `📝 Total de execuções: ${totalCommands}\n\n` +
      `🏆 *Top 10 Comandos:*\n`;
    
    if (sortedCommands.length === 0) {
      commandMessage += 'Nenhum comando executado hoje! 📝';
    } else {
      for (let i = 0; i < sortedCommands.length; i++) {
        const [command, count] = sortedCommands[i];
        const percentage = ((count / totalCommands) * 100).toFixed(1);
        const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '📊';
        
        commandMessage += `${emoji} \`${command}\`: ${count}x (${percentage}%)\n`;
      }
    }
    
    commandMessage += `\n📈 Use \`!logs\` para estatísticas gerais`;
    
    await sock.sendMessage(message.key.remoteJid!, { text: commandMessage });
    
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '📝 *Nenhum Dado de Comandos*\n\nNão há dados de comandos para hoje! 📊'
      });
    } else {
      throw error;
    }
  }
}

async function showSystemLogs(sock: WASocket, message: WAMessage): Promise<void> {
  const logDir = path.join(process.cwd(), 'logs');
  const today = new Date().toISOString().split('T')[0];
  const systemFile = path.join(logDir, `amanda-${today}.log`);
  
  try {
    const content = await fs.readFile(systemFile, 'utf-8');
    const lines = content.trim().split('\n').reverse().slice(0, 10); // Últimos 10 logs
    
    let systemMessage = `🔧 *Logs do Sistema - ${today}*\n\n`;
    
    if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
      systemMessage += '📝 Nenhum log do sistema encontrado para hoje!';
    } else {
      let logCount = 0;
      
      for (const line of lines) {
        if (line.trim() && logCount < 5) {
          try {
            const logEntry = JSON.parse(line);
            
            if (logEntry.type === 'system') {
              const timestamp = new Date(logEntry.timestamp).toLocaleTimeString('pt-BR');
              
              systemMessage += `⏰ *${timestamp}*\n` +
                `📝 ${logEntry.message}\n\n`;
              
              logCount++;
            }
          } catch (e) {
            // Ignorar linhas inválidas
          }
        }
      }
      
      if (logCount === 0) {
        systemMessage += '📝 Nenhum log do sistema encontrado!';
      }
    }
    
    systemMessage += `\n📊 Use \`!logs\` para estatísticas gerais`;
    
    await sock.sendMessage(message.key.remoteJid!, { text: systemMessage });
    
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '📝 *Nenhum Log do Sistema*\n\nNão há logs do sistema para hoje! 🔧'
      });
    } else {
      throw error;
    }
  }
}

export default command; 