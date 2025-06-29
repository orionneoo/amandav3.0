import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { OwnerService } from '@/services/OwnerService';
import { TYPES } from '@/config/container';
import Logger from '@/utils/Logger';
import { commandDebug } from '@/utils/Logger';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class DonoCommand implements IInjectableCommand {
  public name = 'dono';
  public description = 'Comandos exclusivos do dono do bot';
  public category = 'admin' as const;
  public usage = '!dono [comando] [opções]';
  public aliases = ['owner', 'master', 'admin'];

  private readonly OWNER_NUMBER = '5521967233931';
  private readonly OWNER_PASSWORD = 'We1802!';
  
  // NOVO: Lista de números/IDs autorizados do dono
  private readonly AUTHORIZED_OWNER_IDS = [
    '5521967233931', // Número original
    '109311313363133' // ID que está chegando
  ];

  constructor(
    @inject(TYPES.OwnerService) private ownerService: OwnerService
  ) {}

  public async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    const userJid = message.key.participant || message.key.remoteJid!;
    const isPrivate = !message.key.remoteJid!.endsWith('@g.us');
    
    // Verificar se é o dono - extrair apenas a parte numérica do ID
    const userNumber = userJid.split('@')[0];
    
    if (!this.AUTHORIZED_OWNER_IDS.includes(userNumber)) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: `🚫 *Acesso Negado*\n\nEste comando é exclusivo do dono do bot!\n\n📱 ID detectado: ${userJid}\n📱 Número extraído: ${userNumber}\n📱 IDs autorizados: ${this.AUTHORIZED_OWNER_IDS.join(', ')}`
      });
      return;
    }

    commandDebug(`[DEBUG] ✅ Dono autorizado executando comando: ${userJid} (número: ${userNumber})`);

    // Verificar se é conversa privada
    if (!isPrivate) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '🔒 *Comando Privado*\n\nEste comando só pode ser usado em conversa privada com o bot!'
      });
      return;
    }

    // Verificar autenticação
    const isAuthenticated = await this.ownerService.isAuthenticated(userJid);
    
    if (!isAuthenticated) {
      if (args.length === 0 || args[0] !== 'senha') {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `🔐 *Autenticação Necessária*\n\nPara usar os comandos do dono, você precisa se autenticar primeiro.\n\n💡 Use: \`!dono senha [sua_senha]\``
        });
        return;
      }

      if (args.length < 2) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ *Senha Obrigatória*\n\nUse: `!dono senha [sua_senha]`'
        });
        return;
      }

      const password = args[1];
      if (password !== this.OWNER_PASSWORD) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ *Senha Incorreta*\n\nTente novamente ou entre em contato com o desenvolvedor.'
        });
        return;
      }

      // Autenticar o dono
      await this.ownerService.authenticate(userJid);
      
      await sock.sendMessage(message.key.remoteJid!, {
        text: `✅ *Autenticação Bem-sucedida!*\n\n🎉 Agora você tem acesso total aos comandos do dono!\n\n📋 Use \`!dono ajuda\` para ver todos os comandos disponíveis.`
      });
      return;
    }

    // Comandos autenticados
    const command = args[0]?.toLowerCase();

    switch (command) {
      case 'status':
        await this.showStatus(sock, message);
        break;
      case 'broadcast':
        await this.broadcastMessage(sock, message, args.slice(1));
        break;
      case 'foto':
        await this.broadcastPhoto(sock, message, args.slice(1));
        break;
      case 'fotocomlegenda':
        await this.broadcastPhotoWithCaption(sock, message, args.slice(1));
        break;
      case 'alterarfoto':
        await this.changeBotPhoto(sock, message);
        break;
      case 'estatisticas':
        await this.showStatistics(sock, message, args.slice(1));
        break;
      case 'erros':
        await this.showErrors(sock, message, args.slice(1));
        break;
      case 'grupos':
        await this.showGroups(sock, message);
        break;
      case 'comandos':
        await this.showCommandStats(sock, message, args.slice(1));
        break;
      case 'gemini':
        await this.showGeminiStats(sock, message, args.slice(1));
        break;
      case 'limpar':
      case 'clear':
        await this.clearData(sock, message, args);
        break;
      case 'limparia':
        await this.clearAIFailureCache(sock, message);
        break;
      case 'reiniciar':
        await this.restartBot(sock, message);
        break;
      case 'logout':
        await this.logout(sock, message);
        break;
      case 'ajuda':
      case 'help':
        await this.showHelp(sock, message);
        break;
      case 'chavesgemini':
        await this.showGeminiStats(sock, message, args.slice(1));
        break;
      case 'statusbanco':
        await sock.sendMessage(message.key.remoteJid!, {
          text: '📊 *STATUS DO BANCO*\n\nFuncionalidade em desenvolvimento.\n\nUse \`!dono status\` para ver o status geral do bot.'
        });
        break;
      case 'promocoes':
      case 'promotions':
        await this.managePromotions(sock, message, args);
        break;
      case 'debug':
        await this.manageDebug(sock, message, args);
        break;
      default:
        await this.showHelp(sock, message);
        break;
    }
  }

  private async showStatus(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      const status = await this.ownerService.getBotStatus();
      
      const statusMessage = `🤖 *STATUS DO BOT*\n\n` +
        `🟢 *Status:* ${status.isOnline ? 'Online' : 'Offline'}\n` +
        `⏰ *Uptime:* ${status.uptime}\n` +
        `💾 *Memória:* ${status.memoryUsage}\n` +
        `📊 *CPU:* ${status.cpuUsage}\n` +
        `🌐 *Grupos:* ${status.totalGroups}\n` +
        `👥 *Usuários:* ${status.totalUsers}\n` +
        `📝 *Mensagens Hoje:* ${status.messagesToday}\n` +
        `🤖 *IA Hoje:* ${status.aiRequestsToday}\n` +
        `⚡ *Comandos Hoje:* ${status.commandsToday}\n\n` +
        `📈 *Performance:* ${status.performanceStatus}`;

      await sock.sendMessage(message.key.remoteJid!, { text: statusMessage });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter status do bot. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async broadcastMessage(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    if (args.length === 0) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Mensagem Obrigatória*\n\nUse: `!dono broadcast [sua_mensagem]`'
      });
      return;
    }

    const broadcastMessage = args.join(' ');
    
    try {
      const result = await this.ownerService.broadcastMessage(broadcastMessage, sock);
      
      let resultMessage = `📢 *BROADCAST ENVIADO*\n\n` +
        `📝 *Mensagem:* ${broadcastMessage}\n\n` +
        `📊 *Resultado:*\n` +
        `✅ Enviado para: ${result.sentCount} grupos\n` +
        `❌ Falhou em: ${result.failedCount} grupos\n` +
        `⏱️ Tempo total: ${result.duration}ms`;

      // Adicionar detalhes dos erros se houver
      if (result.errors.length > 0) {
        resultMessage += `\n\n❌ *Erros Detalhados:*\n`;
        result.errors.slice(0, 5).forEach((error, index) => {
          resultMessage += `${index + 1}. ${error.groupName}: ${error.error}\n`;
        });
        
        if (result.errors.length > 5) {
          resultMessage += `... e mais ${result.errors.length - 5} erros\n`;
        }
      }

      await sock.sendMessage(message.key.remoteJid!, { text: resultMessage });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao enviar broadcast. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async broadcastPhoto(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    await sock.sendMessage(message.key.remoteJid!, {
      text: '📸 *ENVIE A FOTO*\n\nEnvie a foto que deseja transmitir para todos os grupos.\n\n⚠️ A foto será enviada para todos os grupos onde o bot está presente.'
    });
    
    // Marcar que está aguardando foto para broadcast
    await this.ownerService.setWaitingForPhoto(message.key.remoteJid!, true);
  }

  private async broadcastPhotoWithCaption(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    if (args.length === 0) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Legenda Obrigatória*\n\nUse: `!dono fotocomlegenda [sua_legenda]`\n\nExemplo: `!dono fotocomlegenda Manutenção programada às 2h`'
      });
      return;
    }

    const caption = args.join(' ');
    
    await sock.sendMessage(message.key.remoteJid!, {
      text: `📸 *ENVIE A FOTO*\n\nEnvie a foto que será transmitida para todos os grupos com a legenda:\n\n"${caption}"\n\n⚠️ A foto será enviada para todos os grupos onde o bot está presente.`
    });
    
    // Marcar que está aguardando foto para broadcast com legenda
    await this.ownerService.setWaitingForPhotoWithCaption(message.key.remoteJid!, true);
    await this.ownerService.setPhotoCaption(message.key.remoteJid!, caption);
  }

  private async changeBotPhoto(sock: WASocket, message: WAMessage): Promise<void> {
    await sock.sendMessage(message.key.remoteJid!, {
      text: '🖼️ *ALTERAR FOTO DO BOT*\n\nEnvie a nova foto de perfil do bot.\n\n⚠️ A foto será alterada imediatamente.'
    });
    
    // Marcar que está aguardando foto para alterar perfil
    await this.ownerService.setWaitingForProfilePhoto(message.key.remoteJid!, true);
  }

  private async showStatistics(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const period = args[0] || 'hoje';
      const stats = await this.ownerService.getStatistics(period);
      
      const statsMessage = `📊 *ESTATÍSTICAS - ${period.toUpperCase()}*\n\n` +
        `📝 *Mensagens:* ${stats.totalMessages}\n` +
        `🤖 *IA:* ${stats.aiRequests}\n` +
        `⚡ *Comandos:* ${stats.commands}\n` +
        `❌ *Erros:* ${stats.errors}\n` +
        `👥 *Usuários Únicos:* ${stats.uniqueUsers}\n` +
        `🌐 *Grupos Ativos:* ${stats.activeGroups}\n\n` +
        `🏆 *Comandos Mais Usados:*\n${stats.topCommands.map((cmd, i) => `${i + 1}. ${cmd.name}: ${cmd.count}x`).join('\n')}\n\n` +
        `🌐 *Grupos Mais Ativos:*\n${stats.topGroups.map((group, i) => `${i + 1}. ${group.name}: ${group.messages} msgs`).join('\n')}`;

      await sock.sendMessage(message.key.remoteJid!, { text: statsMessage });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter estatísticas. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async showErrors(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const period = args[0] || 'hoje';
      const errors = await this.ownerService.getErrors(period);
      
      if (errors.length === 0) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: `✅ *Nenhum Erro - ${period.toUpperCase()}*\n\n🎉 O bot está funcionando perfeitamente!`
        });
        return;
      }

      let errorMessage = `❌ *ERROS - ${period.toUpperCase()}*\n\n`;
      
      errors.slice(0, 10).forEach((error, index) => {
        errorMessage += `*${index + 1}. ${error.timestamp}*\n` +
          `🔧 Ação: ${error.action}\n` +
          `👤 Usuário: ${error.userId}\n` +
          `🌐 Grupo: ${error.groupName || 'Privado'}\n` +
          `❌ Erro: ${error.message.substring(0, 100)}${error.message.length > 100 ? '...' : ''}\n\n`;
      });

      if (errors.length > 10) {
        errorMessage += `... e mais ${errors.length - 10} erros\n\n`;
      }

      errorMessage += `💡 Use \`!dono erros [periodo]\` para ver outros períodos\n` +
        `📅 Períodos: hoje, ontem, semana, mes`;

      await sock.sendMessage(message.key.remoteJid!, { text: errorMessage });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter logs de erro. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async showGroups(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      const groups = await this.ownerService.getGroups();
      
      let groupsMessage = `🌐 *GRUPOS DO BOT*\n\n` +
        `📊 Total: ${groups.length} grupos\n\n`;
      
      // Mostrar todos os grupos, não apenas 15
      groups.forEach((group, index) => {
        groupsMessage += `*${index + 1}. ${group.name}*\n` +
          `👥 Membros: ${group.participantCount}\n` +
          `📝 Msgs hoje: ${group.messagesToday}\n` +
          `🤖 IA hoje: ${group.aiRequestsToday}\n` +
          `🔄 Status: ${group.isActive ? '🟢 Ativo' : '🔴 Inativo'}\n\n`;
      });

      // Se a mensagem ficar muito grande, dividir em partes
      if (groupsMessage.length > 4000) {
        const parts = Math.ceil(groupsMessage.length / 4000);
        for (let i = 0; i < parts; i++) {
          const start = i * 4000;
          const end = Math.min((i + 1) * 4000, groupsMessage.length);
          const part = groupsMessage.substring(start, end);
          
          if (i === 0) {
            await sock.sendMessage(message.key.remoteJid!, { text: part });
          } else {
            await sock.sendMessage(message.key.remoteJid!, { 
              text: `🌐 *GRUPOS DO BOT (Parte ${i + 1}/${parts})*\n\n${part}` 
            });
          }
          
          // Pequeno delay entre mensagens
          if (i < parts - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        await sock.sendMessage(message.key.remoteJid!, { text: groupsMessage });
      }
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter lista de grupos. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async showCommandStats(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const period = args[0] || 'hoje';
      const stats = await this.ownerService.getCommandStats(period);
      
      let statsMessage = `⚡ *ESTATÍSTICAS DE COMANDOS - ${period.toUpperCase()}*\n\n` +
        `📊 Total de comandos: ${stats.totalCommands}\n` +
        `✅ Sucessos: ${stats.successCount}\n` +
        `❌ Falhas: ${stats.errorCount}\n` +
        `📈 Taxa de sucesso: ${stats.successRate}%\n\n` +
        `🏆 *Comandos Mais Usados:*\n`;
      
      stats.topCommands.forEach((cmd, index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📊';
        statsMessage += `${emoji} ${cmd.name}: ${cmd.count}x (${cmd.percentage}%)\n`;
      });

      statsMessage += `\n🐌 *Comandos Mais Lentos:*\n`;
      stats.slowestCommands.forEach((cmd, index) => {
        statsMessage += `${index + 1}. ${cmd.name}: ${cmd.avgTime}ms\n`;
      });

      await sock.sendMessage(message.key.remoteJid!, { text: statsMessage });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter estatísticas de comandos. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async showGeminiStats(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const period = args[0] || 'hoje';
      const stats = await this.ownerService.getGeminiStats(period);
      
      let statsMessage = `🤖 *ESTATÍSTICAS GEMINI - ${period.toUpperCase()}*\n\n` +
        `📊 Total de requisições: ${stats.totalRequests}\n` +
        `✅ Sucessos: ${stats.successCount}\n` +
        `❌ Falhas: ${stats.errorCount}\n` +
        `📈 Taxa de sucesso: ${stats.successRate}%\n` +
        `⏱️ Tempo médio: ${stats.avgResponseTime}ms\n\n` +
        `🔑 *Uso por Chave API:*\n`;
      
      stats.apiKeyUsage.forEach((key, index) => {
        statsMessage += `${index + 1}. ${key.name}: ${key.count} reqs (${key.percentage}%)\n`;
      });

      statsMessage += `\n🧠 *Uso por Modelo:*\n`;
      stats.modelUsage.forEach((model, index) => {
        statsMessage += `${index + 1}. ${model.name}: ${model.count} reqs (${model.percentage}%)\n`;
      });

      statsMessage += `\n🌐 *Grupos que mais usam IA:*\n`;
      stats.topGroups.forEach((group, index) => {
        statsMessage += `${index + 1}. ${group.name}: ${group.requests} reqs\n`;
      });

      await sock.sendMessage(message.key.remoteJid!, { text: statsMessage });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter estatísticas da Gemini. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async clearData(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    if (args.length === 0) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ *Tipo de Dados Obrigatório*\n\nUse:\n• `!dono limpar cache` - Limpa cache\n• `!dono limpar logs` - Limpa logs\n• `!dono limpar tudo` - Limpa tudo'
      });
      return;
    }

    const type = args[0].toLowerCase();
    
    try {
      let result: string;
      
      switch (type) {
        case 'cache':
          await this.ownerService.clearCache();
          result = '✅ Cache limpo com sucesso!';
          break;
        case 'logs':
          await this.ownerService.clearLogs();
          result = '✅ Logs limpos com sucesso!';
          break;
        case 'tudo':
          await this.ownerService.clearAllData();
          result = '✅ Todos os dados limpos com sucesso!';
          break;
        default:
          result = '❌ Tipo inválido. Use: cache, logs ou tudo';
      }

      await sock.sendMessage(message.key.remoteJid!, { text: result });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao limpar dados. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async clearAIFailureCache(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      // Limpar cache de falhas da IA
      await this.ownerService.clearAIFailureCache();
      
      await sock.sendMessage(message.key.remoteJid!, { 
        text: '🤖 *Cache de Falhas da IA Limpo*\n\n✅ O cache de falhas da IA foi limpo com sucesso!\n\n🔄 Agora a IA deve funcionar normalmente novamente.' 
      });
    } catch (error) {
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao limpar cache da IA. Se o problema persistir, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
      });
    }
  }

  private async restartBot(sock: WASocket, message: WAMessage): Promise<void> {
    await sock.sendMessage(message.key.remoteJid!, {
      text: '🔄 *Reiniciando Bot...*\n\n⚠️ O bot será reiniciado em 5 segundos.\n\n📱 Aguarde alguns instantes e tente novamente.'
    });
    
    // Reiniciar o bot após 5 segundos
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  }

  private async logout(sock: WASocket, message: WAMessage): Promise<void> {
    await sock.sendMessage(message.key.remoteJid!, {
      text: '🔐 *Logout Realizado*\n\nSua sessão foi encerrada. Use `!dono senha [sua_senha]` para se autenticar novamente.'
    });
    
    // Desautenticar o dono
    const userJid = message.key.participant || message.key.remoteJid!;
    await this.ownerService.logout(userJid);
  }

  private async showHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpMessage = `🔐 *COMANDOS DO DONO*\n\n` +
      `📊 *Informações:*\n` +
      `• \`!dono status\` - Status do bot\n` +
      `• \`!dono estatisticas [periodo]\` - Estatísticas gerais\n` +
      `• \`!dono erros [periodo]\` - Logs de erro\n` +
      `• \`!dono grupos\` - Lista de grupos\n` +
      `• \`!dono comandos [periodo]\` - Estatísticas de comandos\n` +
      `• \`!dono gemini [periodo]\` - Estatísticas da IA\n\n` +
      `📢 *Broadcast:*\n` +
      `• \`!dono broadcast [mensagem]\` - Envia mensagem para todos os grupos\n` +
      `• \`!dono foto\` - Envia foto para todos os grupos\n` +
      `• \`!dono fotocomlegenda [legenda]\` - Envia foto com legenda para todos os grupos\n` +
      `• \`!dono alterarfoto\` - Altera foto do bot\n\n` +
      `🛠️ *Manutenção:*\n` +
      `• \`!dono limpar [tipo]\` - Limpa dados (cache/logs/tudo)\n` +
      `• \`!dono limparia\` - Limpa cache de falhas da IA\n` +
      `• \`!dono reiniciar\` - Reinicia o bot\n` +
      `• \`!dono logout\` - Desconecta do dono\n` +
      `• \`!dono ajuda\` - Mostra este menu de ajuda\n\n` +
      `📋 *Comandos Adicionais:*\n` +
      `• \`!dono chavesgemini\` - Ver status das chaves da Gemini\n` +
      `• \`!dono statusbanco\` - Ver status do banco de dados\n` +
      `• \`!dono promocoes [ação]\` - Gerencia promoções\n` +
      `• \`!dono debug [ação]\` - Gerencia logs de debug\n\n` +
      `🎉 *PROMOÇÕES*\n` +
      `• \`!dono promocoes status\` - Ver status do cache de promoções\n` +
      `• \`!dono promocoes limpar\` - Limpar cache de promoções\n` +
      `• \`!dono promocoes listar\` - Listar promoções no cache\n\n` +
      `🔧 *DEBUG*\n` +
      `• \`!dono debug status\` - Ver configuração de debug\n` +
      `• \`!dono debug set [modulo] [nivel]\` - Configurar debug\n` +
      `• \`!dono debug reset\` - Resetar debug\n\n` +
      `📋 *COMANDOS*\n` +
      `• \`!dono comandos [periodo]\` - Ver estatísticas de comandos\n\n` +
      `🔄 *MANUTENÇÃO*\n` +
      `• \`!dono limpar [tipo]\` - Limpar dados (cache/logs/tudo)\n` +
      `• \`!dono limparia\` - Limpar cache de falhas da IA\n` +
      `• \`!dono reiniciar\` - Reiniciar o bot\n` +
      `• \`!dono logout\` - Desconectar do dono\n\n` +
      `🔐 *AUTENTICAÇÃO*\n` +
      `• \`!dono senha [senha]\` - Autenticar como dono`;

    await sock.sendMessage(message.key.remoteJid!, { text: helpMessage });
  }

  // NOVO: Métodos para gerenciamento de promoções
  private async managePromotions(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const action = args[1]?.toLowerCase() || 'status';

      switch (action) {
        case 'status':
          await this.showPromotionStatus(sock, message);
          break;
        
        case 'limpar':
        case 'clear':
          await this.clearPromotionCache(sock, message);
          break;
        
        case 'listar':
        case 'list':
          await this.listPromotions(sock, message);
          break;
        
        default:
          await this.showPromotionHelp(sock, message);
          break;
      }
    } catch (error) {
      Logger.error('Erro no gerenciamento de promoções', { error, args });
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao processar comando de promoções'
      });
    }
  }

  private async showPromotionStatus(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      // Acessar o cache de promoções do OnboardingService
      const { container } = await import('@/core/container');
      const onboardingService = container.get(TYPES.OnboardingService);
      
      // Usar reflection para acessar o cache privado
      const sentPromotions = (onboardingService as any).sentPromotions;
      const cacheSize = sentPromotions ? sentPromotions.size : 0;
      
      let statusText = '🎉 *STATUS DE PROMOÇÕES*\n\n';
      statusText += `📊 Cache de promoções: ${cacheSize} entradas\n`;
      statusText += `⏰ Janela de cache: 24 horas\n`;
      statusText += `🔄 Status: Ativo\n\n`;
      
      statusText += '💡 *Comandos disponíveis:*\n';
      statusText += `• \`!dono promocoes\` - Ver este status\n`;
      statusText += `• \`!dono promocoes limpar\` - Limpar cache\n`;
      statusText += `• \`!dono promocoes listar\` - Listar promoções\n`;

      await sock.sendMessage(message.key.remoteJid!, { text: statusText });
    } catch (error) {
      Logger.error('Erro ao mostrar status de promoções', { error });
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter status de promoções'
      });
    }
  }

  private async clearPromotionCache(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      // Acessar o cache de promoções do OnboardingService
      const { container } = await import('@/core/container');
      const onboardingService = container.get(TYPES.OnboardingService);
      
      // Usar reflection para limpar o cache
      const sentPromotions = (onboardingService as any).sentPromotions;
      if (sentPromotions) {
        const cacheSize = sentPromotions.size;
        sentPromotions.clear();
        
        await sock.sendMessage(message.key.remoteJid!, {
          text: `🗑️ *CACHE DE PROMOÇÕES LIMPO*\n\n${cacheSize} entradas foram removidas do cache.`
        });
      } else {
        await sock.sendMessage(message.key.remoteJid!, {
          text: 'ℹ️ *CACHE VAZIO*\n\nNão há entradas no cache de promoções.'
        });
      }
    } catch (error) {
      Logger.error('Erro ao limpar cache de promoções', { error });
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao limpar cache de promoções'
      });
    }
  }

  private async listPromotions(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      // Acessar o cache de promoções do OnboardingService
      const { container } = await import('@/core/container');
      const onboardingService = container.get(TYPES.OnboardingService);
      
      // Usar reflection para acessar o cache
      const sentPromotions = (onboardingService as any).sentPromotions;
      
      if (!sentPromotions || sentPromotions.size === 0) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '📋 *LISTA DE PROMOÇÕES*\n\nNenhuma promoção registrada no cache.'
        });
        return;
      }

      let listText = `📋 *PROMOÇÕES NO CACHE* (${sentPromotions.size})\n\n`;
      
      const now = Date.now();
      let count = 0;
      
      for (const [key, timestamp] of sentPromotions.entries()) {
        if (count >= 10) break; // Limitar a 10 entradas
        
        const [userJid, groupJid] = key.split('-');
        const timeSince = now - timestamp;
        const hoursSince = Math.floor(timeSince / (60 * 60 * 1000));
        
        listText += `👤 ${userJid.split('@')[0]}\n`;
        listText += `   📍 ${groupJid.split('@')[0]}\n`;
        listText += `   ⏰ Há ${hoursSince}h\n\n`;
        
        count++;
      }
      
      if (sentPromotions.size > 10) {
        listText += `... e mais ${sentPromotions.size - 10} entradas\n`;
      }

      await sock.sendMessage(message.key.remoteJid!, { text: listText });
    } catch (error) {
      Logger.error('Erro ao listar promoções', { error });
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao listar promoções'
      });
    }
  }

  private async showPromotionHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpText = `🎉 *GERENCIAMENTO DE PROMOÇÕES*\n\n` +
                    `*Uso:* \`!dono promocoes [ação]\`\n\n` +
                    `*Ações disponíveis:*\n` +
                    `📊 \`status\` - Ver status do cache\n` +
                    `🗑️ \`limpar\` - Limpar cache de promoções\n` +
                    `📋 \`listar\` - Listar promoções no cache\n\n` +
                    `*Exemplos:*\n` +
                    `• \`!dono promocoes\` - Ver status\n` +
                    `• \`!dono promocoes limpar\` - Limpar cache\n` +
                    `• \`!dono promocoes listar\` - Listar promoções`;

    await sock.sendMessage(message.key.remoteJid!, { text: helpText });
  }

  private async manageDebug(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const { setDebugLevel, getDebugConfig } = await import('@/utils/Logger');
      const action = args[1]?.toLowerCase() || 'status';

      switch (action) {
        case 'status':
          await this.showDebugStatus(sock, message);
          break;
        
        case 'set':
          await this.setDebugLevel(sock, message, args);
          break;
        
        case 'reset':
          await this.resetDebugLevels(sock, message);
          break;
        
        default:
          await this.showDebugHelp(sock, message);
          break;
      }
    } catch (error) {
      Logger.error('Erro no gerenciamento de debug', { error, args });
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao processar comando de debug'
      });
    }
  }

  private async showDebugStatus(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      const { getDebugConfig } = await import('@/utils/Logger');
      const config = getDebugConfig();
      
      let statusText = '🔧 *STATUS DE DEBUG*\n\n';
      statusText += `🌐 *Global:* ${config.global}\n\n`;
      statusText += `📋 *Módulos:*\n`;
      
      Object.entries(config.modules).forEach(([module, level]) => {
        statusText += `• ${module}: ${level}\n`;
      });
      
      statusText += '\n💡 *Níveis:* NONE < ERROR < WARN < INFO < DEBUG < VERBOSE\n';
      statusText += '💡 Use `!dono debug set [modulo] [nivel]` para configurar';

      await sock.sendMessage(message.key.remoteJid!, { text: statusText });
    } catch (error) {
      Logger.error('Erro ao mostrar status de debug', { error });
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao obter status de debug'
      });
    }
  }

  private async setDebugLevel(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
    try {
      const { setDebugLevel } = await import('@/utils/Logger');
      
      if (args.length < 4) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ *Parâmetros Insuficientes*\n\nUse: `!dono debug set [modulo] [nivel]`\n\nExemplo: `!dono debug set MessageManager DEBUG`'
        });
        return;
      }

      const module = args[2];
      const level = args[3].toUpperCase();
      
      setDebugLevel(module, level);
      
      await sock.sendMessage(message.key.remoteJid!, {
        text: `✅ *DEBUG CONFIGURADO*\n\nMódulo: ${module}\nNível: ${level}\n\nUse \`!dono debug status\` para verificar`
      });
    } catch (error) {
      Logger.error('Erro ao configurar debug', { error });
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao configurar debug'
      });
    }
  }

  private async resetDebugLevels(sock: WASocket, message: WAMessage): Promise<void> {
    try {
      const { setDebugLevel } = await import('@/utils/Logger');
      
      // Resetar para níveis padrão
      setDebugLevel('MessageManager', 'ERROR');
      setDebugLevel('AIService', 'ERROR');
      setDebugLevel('Bot', 'ERROR');
      setDebugLevel('Commands', 'ERROR');
      setDebugLevel('Database', 'ERROR');
      setDebugLevel('Onboarding', 'INFO');
      
      await sock.sendMessage(message.key.remoteJid!, {
        text: '🔄 *DEBUG RESETADO*\n\nTodos os níveis foram resetados para os valores padrão.\n\nUse \`!dono debug status\` para verificar'
      });
    } catch (error) {
      Logger.error('Erro ao resetar debug', { error });
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Erro ao resetar debug'
      });
    }
  }

  private async showDebugHelp(sock: WASocket, message: WAMessage): Promise<void> {
    const helpText = `🔧 *GERENCIAMENTO DE DEBUG*\n\n` +
                    `*Uso:* \`!dono debug [ação]\`\n\n` +
                    `*Ações disponíveis:*\n` +
                    `📊 \`status\` - Ver configuração atual\n` +
                    `⚙️ \`set [modulo] [nivel]\` - Configurar nível\n` +
                    `🔄 \`reset\` - Resetar para padrão\n\n` +
                    `*Módulos disponíveis:*\n` +
                    `• MessageManager - Processamento de mensagens\n` +
                    `• AIService - Serviço de IA\n` +
                    `• Bot - Bot principal\n` +
                    `• Commands - Comandos\n` +
                    `• Database - Banco de dados\n` +
                    `• Onboarding - Promoções\n\n` +
                    `*Níveis:* NONE < ERROR < WARN < INFO < DEBUG < VERBOSE\n\n` +
                    `*Exemplos:*\n` +
                    `• \`!dono debug status\` - Ver status\n` +
                    `• \`!dono debug set MessageManager DEBUG\` - Ativar debug de mensagens\n` +
                    `• \`!dono debug reset\` - Resetar tudo`;

    await sock.sendMessage(message.key.remoteJid!, { text: helpText });
  }
}