import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { GroupService } from '@/services/GroupService';
import { TYPES } from '@/config/container';

@injectable()
export class GrupoCommand implements IInjectableCommand {
  public name = 'grupo';
  public description = '📊 Mostra estatísticas detalhadas do grupo';
  public category = 'admin' as const;
  public usage = '!grupo';
  public cooldown = 30;
  public aliases = ['grupo', 'group', 'stats'];

  constructor(
    @inject(TYPES.GroupService) private groupService: GroupService
  ) {}

  public async execute(sock: WASocket, message: proto.IWebMessageInfo, args: string[]): Promise<void> {
    try {
      const groupJid = message.key.remoteJid!;
      
      if (!groupJid?.endsWith('@g.us')) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Este comando só funciona em grupos!'
        });
        return;
      }

      // Atualizar informações do grupo primeiro
      await this.groupService.updateGroupInfo(sock, groupJid);
      
      // Obter estatísticas detalhadas
      const stats = await this.groupService.getGroupStats(groupJid);
      
      if (!stats) {
        await sock.sendMessage(groupJid, {
          text: '❌ Erro ao obter informações do grupo!'
        });
        return;
      }

      // Mapa de personalidades para nomes amigáveis
      const personalidades = {
        'padrao': 'A Padrão (Carioca Sexy)',
        'amante': 'A Especialista em Segredos',
        'casada': 'A Casada Safada',
        'desviada': 'A Crente Safada & Blasfema',
        'macumbeira': 'Mãe Amanda de Oxóssi',
        'cartomante': 'Madame Amanda',
        'astrologa': 'Shakira da Tijuca',
        'coach_quantica': 'Gabi da Abundância',
        'anitta': 'Empreendedora do Funk',
        'patroa': 'A Coach de Empoderamento',
        'policial': 'Cabo Amanda Nunes',
        'faria_limer': 'Jorginho do Bitcoin',
        'dr_fritz': 'Dr. Amanda Fritz',
        'crente': 'Irmã Amanda',
        'nerd': 'Doutora Amanda',
        'tia': 'Tia Amanda',
        'morty': 'O Ajudante Ansioso',
        'fofoqueira': 'A Intrigante',
        'cupido': 'A Juíza do Amor',
        'dona_do_jogo': 'A Dona do Cassino'
      };

      const nomePersonalidade = personalidades[stats.activePersonality as keyof typeof personalidades] || 'Desconhecida';
      
      // Formatar datas
      const dataCriacao = stats.createdAt ? new Date(stats.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A';
      
      const dataAtualizacao = stats.updatedAt ? new Date(stats.updatedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A';
      
      const dataPersonalidade = stats.lastPersonalityChange ? new Date(stats.lastPersonalityChange).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Nunca alterada';

      // Construir mensagem detalhada
      let mensagem = `📊 *ESTATÍSTICAS DO GRUPO*\n\n`;
      mensagem += `🏷️ *Nome:* ${stats.name}\n`;
      mensagem += `👥 *Membros:* ${stats.totalMembers}\n`;
      mensagem += `👑 *Admins:* ${stats.totalAdmins}\n`;
      mensagem += `📅 *Criado em:* ${dataCriacao}\n`;
      mensagem += `🔄 *Última atualização:* ${dataAtualizacao}\n\n`;
      
      mensagem += `🎭 *PERSONALIDADE*\n`;
      mensagem += `• *Ativa:* ${nomePersonalidade}\n`;
      mensagem += `• *Código:* \`${stats.activePersonality}\`\n`;
      mensagem += `• *Alterada em:* ${dataPersonalidade}\n`;
      
      if (stats.changedBy) {
        const adminNumber = stats.changedBy.split('@')[0];
        mensagem += `• *Por:* ${adminNumber}\n`;
      }
      
      // Adicionar descrição da personalidade
      const personalidadeDescricoes = {
        'padrao': 'Provocadora, debochada, adora uma fofoca e flertar',
        'amante': 'Sussurrante, discreta e perigosa. Dá conselhos para puladas de cerca',
        'casada': 'Cansada da rotina, mas cheia de desejo. Vive soltando indiretas pesadíssimas',
        'desviada': 'Mistura o sagrado com o profano, usando jargão de igreja para as maiores baixarias',
        'macumbeira': 'Firme, fala com a força dos guias, entende de ebó e amarração',
        'cartomante': 'Charlatã nata. Lê o futuro nas borras do emoji',
        'astrologa': 'Culpa tudo em Mercúrio Retrógrado, analisa o mapa astral',
        'coach_quantica': 'Só fala em "cocriar a realidade", "vibrar na frequência"',
        'anitta': 'Foco no business! Mistura papo de marketing com malandragem',
        'patroa': 'Discurso de "mulher de alto valor", focada em empoderamento',
        'policial': 'Linha dura, fala em jargão policial, bota ordem no grupo',
        'faria_limer': 'Usa "bróder", só fala em inglês de negócios, vê ROI em tudo',
        'dr_fritz': 'Sotaque alemão, super freudiano. Analisa tudo como traumas',
        'crente': 'Recatada, mansa, chama todos de "varão" e "varoa"',
        'nerd': 'Pedante, arrogante e intelectual. Corrige a gramática de todo mundo',
        'tia': 'Manda "Bom dia" com glitter, repassa fake news sobre chás',
        'morty': 'Gagueja, é pessimista, sempre acha que algo vai dar errado',
        'fofoqueira': 'Minha versão focada 100% em criar e espalhar boatos absurdos',
        'cupido': 'Especializada em juntar (ou separar) casais',
        'dona_do_jogo': 'Focada nos jogos e na economia do grupo'
      };
      
      const descricao = personalidadeDescricoes[stats.activePersonality as keyof typeof personalidadeDescricoes];
      if (descricao) {
        mensagem += `• *Descrição:* ${descricao}\n`;
      }
      mensagem += `\n`;
      
      mensagem += `⚙️ *CONFIGURAÇÕES*\n`;
      mensagem += `• *IA habilitada:* ${stats.settings?.aiEnabled ? '✅' : '❌'}\n`;
      mensagem += `• *Boas-vindas:* ${stats.settings?.welcomeEnabled ? '✅' : '❌'}\n`;
      mensagem += `• *Despedidas:* ${stats.settings?.goodbyeEnabled ? '✅' : '❌'}\n`;
      
      // Mostrar comandos desabilitados
      const disabledCommands = stats.settings?.disabledCommands || [];
      if (disabledCommands.length > 0) {
        mensagem += `• *Comandos desabilitados:* ${disabledCommands.length}\n`;
        mensagem += `  └ ${disabledCommands.slice(0, 5).join(', ')}${disabledCommands.length > 5 ? '...' : ''}\n`;
      } else {
        mensagem += `• *Comandos desabilitados:* Nenhum ✅\n`;
      }
      mensagem += `\n`;
      
      // Mostrar comandos ativos por categoria
      mensagem += `🎮 *COMANDOS ATIVOS*\n`;
      const allCommands = [
        { name: 'banir', category: 'admin' },
        { name: 'promover', category: 'admin' },
        { name: 'rebaixar', category: 'admin' },
        { name: 'remover', category: 'admin' },
        { name: 'silenciar', category: 'admin' },
        { name: 'liberar', category: 'admin' },
        { name: 'desbanir', category: 'admin' },
        { name: 'apagar', category: 'admin' },
        { name: 'person', category: 'admin' },
        { name: 'personalidade', category: 'admin' },
        { name: 'grupo', category: 'admin' },
        { name: 'fofoca', category: 'ai' },
        { name: 'intriga', category: 'ai' },
        { name: 'resumo', category: 'utils' },
        { name: 'feedback', category: 'user' },
        { name: 'brincadeira', category: 'admin' }
      ];
      
      const adminCommands = allCommands.filter(cmd => cmd.category === 'admin' && !disabledCommands.includes(cmd.name));
      const aiCommands = allCommands.filter(cmd => cmd.category === 'ai' && !disabledCommands.includes(cmd.name));
      const utilsCommands = allCommands.filter(cmd => cmd.category === 'utils' && !disabledCommands.includes(cmd.name));
      const userCommands = allCommands.filter(cmd => cmd.category === 'user' && !disabledCommands.includes(cmd.name));
      
      mensagem += `• *Admin:* ${adminCommands.length} comandos ativos\n`;
      mensagem += `• *IA:* ${aiCommands.length} comandos ativos\n`;
      mensagem += `• *Utilitários:* ${utilsCommands.length} comandos ativos\n`;
      mensagem += `• *Usuário:* ${userCommands.length} comandos ativos\n\n`;
      
      mensagem += `🔧 *PROPRIEDADES DO GRUPO*\n`;
      mensagem += `• *Somente admins:* ${stats.isAnnouncement ? '✅' : '❌'}\n`;
      mensagem += `• *Restrito:* ${stats.isRestricted ? '✅' : '❌'}\n`;
      mensagem += `• *Mensagens efêmeras:* ${stats.isEphemeral ? '✅' : '❌'}\n`;
      
      if (stats.isEphemeral && stats.ephemeralDuration > 0) {
        const horas = Math.floor(stats.ephemeralDuration / 3600);
        const minutos = Math.floor((stats.ephemeralDuration % 3600) / 60);
        mensagem += `• *Duração:* ${horas}h ${minutos}m\n`;
      }
      
      if (stats.inviteCode) {
        mensagem += `• *Código de convite:* ${stats.inviteCode}\n`;
      }
      
      mensagem += `\n💡 Use *!person* para alterar a personalidade!`;

      await sock.sendMessage(groupJid, { text: mensagem });
      
    } catch (error) {
      console.error('Erro ao executar comando grupo:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Ops! Deu ruim na hora de obter as estatísticas do grupo. Tenta de novo mais tarde!'
      });
    }
  }
}
