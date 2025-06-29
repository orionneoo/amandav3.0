import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { GroupService } from '@/services/GroupService';
import { TYPES } from '@/config/container';

@injectable()
export class ComandosCommand implements IInjectableCommand {
  public name = 'comandos';
  public description = '⚙️ Gerencia comandos ativos/desabilitados no grupo';
  public category = 'admin' as const;
  public usage = '!comandos [habilitar|desabilitar] [comando]';
  public cooldown = 10;
  public aliases = ['comandos', 'commands', 'cmd'];

  constructor(
    @inject(TYPES.GroupService) private groupService: GroupService
  ) {}

  public async execute(sock: WASocket, message: proto.IWebMessageInfo, args: string[]): Promise<void> {
    try {
      const groupJid = message.key.remoteJid!;
      const senderJid = message.key.participant!;
      
      if (!groupJid?.endsWith('@g.us')) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Este comando só funciona em grupos!'
        });
        return;
      }

      // Verificar se é admin
      const groupMetadata = await sock.groupMetadata(groupJid);
      const isAdmin = groupMetadata.participants.find(p => p.id === senderJid)?.admin;
      
      if (!isAdmin) {
        await sock.sendMessage(groupJid, {
          text: '❌ Apenas administradores podem gerenciar comandos!'
        });
        return;
      }

      // Se não passou argumentos, mostrar status atual
      if (args.length === 0) {
        await this.showCommandStatus(sock, groupJid);
        return;
      }

      const action = args[0].toLowerCase();
      const commandName = args[1]?.toLowerCase();

      if (!commandName) {
        await sock.sendMessage(groupJid, {
          text: '❌ Especifique o comando! Exemplo: !comandos desabilitar fofoca'
        });
        return;
      }

      // Lista de comandos disponíveis
      const availableCommands = [
        'banir', 'promover', 'rebaixar', 'remover', 'silenciar', 'liberar', 
        'desbanir', 'apagar', 'person', 'personalidade', 'grupo', 'comandos',
        'fofoca', 'intriga', 'resumo', 'feedback', 'brincadeira', 'todos',
        'ppp', 'confissao', 'fodeousome', 'bafometro', 'gaydometro', 'cornometro', 'sexyometro',
        'sorte', 'crushometro', 'nojoometro', 'nerdometro', 'velhaometro',
        'par', 'casal', 'menage', 'suruba', 'ping', 'menu', 'historico'
      ];

      if (!availableCommands.includes(commandName)) {
        await sock.sendMessage(groupJid, {
          text: `❌ Comando "${commandName}" não encontrado!\n\nComandos disponíveis:\n${availableCommands.join(', ')}`
        });
        return;
      }

      // Obter grupo atual
      const group = await this.groupService.getGroup(groupJid);
      if (!group) {
        await sock.sendMessage(groupJid, {
          text: '❌ Erro ao obter informações do grupo!'
        });
        return;
      }

      const disabledCommands = group.settings?.disabledCommands || [];

      if (action === 'desabilitar') {
        if (disabledCommands.includes(commandName)) {
          await sock.sendMessage(groupJid, {
            text: `❌ O comando "${commandName}" já está desabilitado!`
          });
          return;
        }

        disabledCommands.push(commandName);
        await this.groupService.updateGroup(groupJid, {
          settings: {
            ...group.settings,
            disabledCommands
          }
        });

        await sock.sendMessage(groupJid, {
          text: `✅ Comando "${commandName}" desabilitado com sucesso!`
        });

      } else if (action === 'habilitar') {
        if (!disabledCommands.includes(commandName)) {
          await sock.sendMessage(groupJid, {
            text: `❌ O comando "${commandName}" já está habilitado!`
          });
          return;
        }

        const newDisabledCommands = disabledCommands.filter(cmd => cmd !== commandName);
        await this.groupService.updateGroup(groupJid, {
          settings: {
            ...group.settings,
            disabledCommands: newDisabledCommands
          }
        });

        await sock.sendMessage(groupJid, {
          text: `✅ Comando "${commandName}" habilitado com sucesso!`
        });

      } else {
        await sock.sendMessage(groupJid, {
          text: '❌ Ação inválida! Use "habilitar" ou "desabilitar".'
        });
      }
      
    } catch (error) {
      console.error('Erro ao executar comando comandos:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Ops! Deu ruim na hora de gerenciar comandos. Tenta de novo mais tarde!'
      });
    }
  }

  private async showCommandStatus(sock: WASocket, groupJid: string): Promise<void> {
    try {
      const group = await this.groupService.getGroup(groupJid);
      if (!group) {
        await sock.sendMessage(groupJid, {
          text: '❌ Erro ao obter informações do grupo!'
        });
        return;
      }

      const disabledCommands = group.settings?.disabledCommands || [];
      
      // Lista de todos os comandos por categoria
      const allCommands = [
        { name: 'banir', category: 'Admin' },
        { name: 'promover', category: 'Admin' },
        { name: 'rebaixar', category: 'Admin' },
        { name: 'remover', category: 'Admin' },
        { name: 'silenciar', category: 'Admin' },
        { name: 'liberar', category: 'Admin' },
        { name: 'desbanir', category: 'Admin' },
        { name: 'apagar', category: 'Admin' },
        { name: 'person', category: 'Admin' },
        { name: 'personalidade', category: 'Admin' },
        { name: 'grupo', category: 'Admin' },
        { name: 'comandos', category: 'Admin' },
        { name: 'historico', category: 'Admin' },
        { name: 'fofoca', category: 'IA' },
        { name: 'intriga', category: 'IA' },
        { name: 'resumo', category: 'IA' },
        { name: 'feedback', category: 'IA' },
        { name: 'brincadeira', category: 'Diversão' },
        { name: 'ppp', category: 'Diversão' },
        { name: 'confissao', category: 'Diversão' },
        { name: 'fodeousome', category: 'Diversão' },
        { name: 'bafometro', category: 'Diversão' },
        { name: 'gaydometro', category: 'Diversão' },
        { name: 'cornometro', category: 'Diversão' },
        { name: 'sexyometro', category: 'Diversão' },
        { name: 'sorte', category: 'Diversão' },
        { name: 'crushometro', category: 'Diversão' },
        { name: 'nojoometro', category: 'Diversão' },
        { name: 'nerdometro', category: 'Diversão' },
        { name: 'velhaometro', category: 'Diversão' },
        { name: 'par', category: 'Relacionamentos' },
        { name: 'casal', category: 'Relacionamentos' },
        { name: 'menage', category: 'Relacionamentos' },
        { name: 'suruba', category: 'Relacionamentos' },
        { name: 'todos', category: 'Admin' },
        { name: 'ping', category: 'Utilitários' },
        { name: 'menu', category: 'Utilitários' }
      ];

      let mensagem = `⚙️ *STATUS DOS COMANDOS*\n\n`;
      
      // Agrupar por categoria
      const categories = ['Admin', 'IA', 'Utilitários', 'Diversão', 'Relacionamentos'];
      
      categories.forEach(category => {
        const categoryCommands = allCommands.filter(cmd => cmd.category === category);
        mensagem += `*${category}:*\n`;
        
        categoryCommands.forEach(cmd => {
          const isDisabled = disabledCommands.includes(cmd.name);
          const status = isDisabled ? '❌' : '✅';
          mensagem += `${status} \`${cmd.name}\`\n`;
        });
        
        mensagem += `\n`;
      });

      mensagem += `💡 Use: !comandos [habilitar|desabilitar] [comando]`;

      await sock.sendMessage(groupJid, { text: mensagem });
      
    } catch (error) {
      console.error('Erro ao mostrar status dos comandos:', error);
      await sock.sendMessage(groupJid, {
        text: '❌ Erro ao obter status dos comandos!'
      });
    }
  }
}