import { injectable, inject } from 'inversify';
import { AIService } from './AIService';
import { DatabaseService } from './DatabaseService';
import { Group } from '@/database/models/GroupSchema';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { TYPES } from '@/config/container';

export interface CommandInfo {
  name: string;
  description: string;
  category: string;
  usage: string;
  aliases: string[];
  cooldown: number;
}

@injectable()
export class CommandCatalogService {
  private commandCatalog: CommandInfo[] = [];

  constructor(
    @inject(TYPES.AIService) private aiService: AIService,
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {
    this.initializeDefaultCatalog();
  }

  /**
   * Inicializa o catálogo com todos os comandos disponíveis
   */
  private initializeDefaultCatalog(): void {
    this.commandCatalog = [
      // Utilitários
      {
        name: 'menu',
        description: 'Exibe o menu de comandos e informações do bot',
        category: 'utils',
        usage: '!menu [número_do_submenu]',
        aliases: ['help', 'ajuda'],
        cooldown: 0
      },
      {
        name: 'menusimples',
        description: 'Lista todos os comandos de forma simples e organizada',
        category: 'utils',
        usage: '!menusimples',
        aliases: ['lista', 'cmds'],
        cooldown: 0
      },
      {
        name: 'ping',
        description: 'Testa a latência do bot',
        category: 'utils',
        usage: '!ping',
        aliases: ['pong', 'latencia'],
        cooldown: 5
      },
      {
        name: 'status',
        description: 'Mostra o status do bot',
        category: 'utils',
        usage: '!status',
        aliases: ['info', 'botinfo'],
        cooldown: 10
      },
      {
        name: 'sticker',
        description: 'Cria um sticker de uma imagem',
        category: 'utils',
        usage: '!sticker [responda a uma imagem]',
        aliases: ['figurinha', 'sticker'],
        cooldown: 10
      },
      {
        name: 'coinflip',
        description: 'Cara ou coroa',
        category: 'utils',
        usage: '!coinflip',
        aliases: ['moeda', 'caraoucoroa'],
        cooldown: 5
      },
      {
        name: 'resumo',
        description: 'Resumo das últimas 24h do grupo',
        category: 'utils',
        usage: '!resumo',
        aliases: ['summary', 'stats'],
        cooldown: 30
      },
      {
        name: 'tempo',
        description: 'Previsão do tempo',
        category: 'utils',
        usage: '!tempo [cidade]',
        aliases: ['clima', 'weather'],
        cooldown: 10
      },
      {
        name: 'weather',
        description: 'Clima (em inglês)',
        category: 'utils',
        usage: '!weather [city]',
        aliases: ['clima_en'],
        cooldown: 10
      },
      {
        name: 'teste',
        description: 'Testa funcionalidades do bot',
        category: 'utils',
        usage: '!teste',
        aliases: ['test'],
        cooldown: 5
      },

      // Diversão e Brincadeiras
      {
        name: 'ppp',
        description: 'Pega, pensa e passa (sorteia 3 pessoas)',
        category: 'fun',
        usage: '!ppp',
        aliases: ['pegapensapassa'],
        cooldown: 30
      },
      {
        name: 'fodeousome',
        description: 'Modo hardcore: pergunta quente para um alvo',
        category: 'fun',
        usage: '!fodeousome [@user]',
        aliases: ['fodeu'],
        cooldown: 30
      },
      {
        name: 'bafometro',
        description: 'Mede seu nível de álcool aleatório',
        category: 'fun',
        usage: '!bafometro',
        aliases: ['bafo'],
        cooldown: 10
      },
      {
        name: 'gaydometro',
        description: 'Mede quanto por cento gay você é',
        category: 'fun',
        usage: '!gaydometro',
        aliases: ['gay'],
        cooldown: 10
      },
      {
        name: 'cornometro',
        description: 'Mede nível de corno aleatório',
        category: 'fun',
        usage: '!cornometro',
        aliases: ['corno'],
        cooldown: 10
      },
      {
        name: 'sexyometro',
        description: 'Mede nível de sexy aleatório',
        category: 'fun',
        usage: '!sexyometro',
        aliases: ['sexy'],
        cooldown: 10
      },
      {
        name: 'sorte',
        description: 'Dá um conselho ou sorte do dia',
        category: 'fun',
        usage: '!sorte',
        aliases: ['luck'],
        cooldown: 10
      },
      {
        name: 'crushometro',
        description: 'Mede chance com crush',
        category: 'fun',
        usage: '!crushometro @user',
        aliases: ['crush'],
        cooldown: 10
      },
      {
        name: 'nojoometro',
        description: 'Mede nível de nojo aleatório',
        category: 'fun',
        usage: '!nojoometro',
        aliases: ['nojo'],
        cooldown: 10
      },
      {
        name: 'nerdometro',
        description: 'Mede nível de nerd aleatório',
        category: 'fun',
        usage: '!nerdometro',
        aliases: ['nerd'],
        cooldown: 10
      },
      {
        name: 'velhaometro',
        description: 'Mede idade mental aleatória',
        category: 'fun',
        usage: '!velhaometro',
        aliases: ['velha'],
        cooldown: 10
      },

      // Relacionamentos
      {
        name: 'par',
        description: 'Marca 2 pessoas aleatórias para formar um par',
        category: 'relationship',
        usage: '!par',
        aliases: ['couple'],
        cooldown: 30
      },
      {
        name: 'casal',
        description: 'Marca 2 pessoas aleatórias para formar um casal',
        category: 'relationship',
        usage: '!casal',
        aliases: ['couple'],
        cooldown: 30
      },
      {
        name: 'menage',
        description: 'Marca 3 pessoas aleatórias para um ménage',
        category: 'relationship',
        usage: '!menage',
        aliases: ['threesome'],
        cooldown: 30
      },
      {
        name: 'suruba',
        description: 'Marca 5 pessoas aleatórias para transar',
        category: 'relationship',
        usage: '!suruba',
        aliases: ['orgy'],
        cooldown: 30
      },

      // IA e Inteligência
      {
        name: 'fofoca',
        description: 'Gera uma fofoca aleatória envolvendo membros do grupo',
        category: 'ai',
        usage: '!fofoca',
        aliases: ['gossip'],
        cooldown: 30
      },
      {
        name: 'intriga',
        description: 'Alias para o comando fofoca',
        category: 'ai',
        usage: '!intriga',
        aliases: ['intrigue'],
        cooldown: 30
      },

      // Administração
      {
        name: 'banir',
        description: 'Bane um usuário do grupo',
        category: 'admin',
        usage: '!banir @user',
        aliases: ['ban'],
        cooldown: 10
      },
      {
        name: 'remover',
        description: 'Remove um usuário do grupo',
        category: 'admin',
        usage: '!remover @user',
        aliases: ['remove'],
        cooldown: 10
      },
      {
        name: 'promover',
        description: 'Promove um usuário a admin',
        category: 'admin',
        usage: '!promover @user',
        aliases: ['promote'],
        cooldown: 10
      },
      {
        name: 'rebaixar',
        description: 'Remove admin de um usuário',
        category: 'admin',
        usage: '!rebaixar @user',
        aliases: ['demote'],
        cooldown: 10
      },
      {
        name: 'silenciar',
        description: 'Restringe mensagens (só admins)',
        category: 'admin',
        usage: '!silenciar',
        aliases: ['mute'],
        cooldown: 10
      },
      {
        name: 'liberar',
        description: 'Libera mensagens (todos podem falar)',
        category: 'admin',
        usage: '!liberar',
        aliases: ['unmute'],
        cooldown: 10
      },
      {
        name: 'apagar',
        description: 'Apaga todas as mensagens do grupo',
        category: 'admin',
        usage: '!apagar',
        aliases: ['clear'],
        cooldown: 30
      },
      {
        name: 'desbanir',
        description: 'Remove ban de um usuário',
        category: 'admin',
        usage: '!desbanir @user',
        aliases: ['unban'],
        cooldown: 10
      },
      {
        name: 'admins',
        description: 'Lista todos os admins do grupo',
        category: 'admin',
        usage: '!admins',
        aliases: ['administradores'],
        cooldown: 10
      },
      {
        name: 'todos',
        description: 'Marca todos os membros do grupo',
        category: 'admin',
        usage: '!todos [mensagem]',
        aliases: ['cornos', 'todes', 'toddy', 'nescal'],
        cooldown: 30
      },
      {
        name: 'boasvindas',
        description: 'Gerencia mensagens de boas-vindas',
        category: 'admin',
        usage: '!boasvindas [on/off]',
        aliases: ['welcome'],
        cooldown: 10
      },
      {
        name: 'brincadeira',
        description: 'Sistema de brincadeiras e jogos',
        category: 'admin',
        usage: '!brincadeira [comando]',
        aliases: ['game'],
        cooldown: 10
      },

      // Ranking e Estatísticas
      {
        name: 'topativos',
        description: 'Mostra os membros mais ativos do grupo',
        category: 'stats',
        usage: '!topativos [dias]',
        aliases: ['top'],
        cooldown: 30
      },
      {
        name: 'inativos',
        description: 'Mostra membros inativos do grupo',
        category: 'stats',
        usage: '!inativos [dias]',
        aliases: ['inactive'],
        cooldown: 30
      },
      {
        name: 'novatos',
        description: 'Mostra membros que entraram recentemente',
        category: 'stats',
        usage: '!novatos [dias]',
        aliases: ['new'],
        cooldown: 30
      },

      // Personalidades
      {
        name: 'person',
        description: 'Lista e gerencia personalidades da Amanda',
        category: 'admin',
        usage: '!person [número]',
        aliases: ['persona'],
        cooldown: 10
      },
      {
        name: 'personalidade',
        description: 'Mostra a personalidade ativa',
        category: 'admin',
        usage: '!personalidade',
        aliases: ['mood'],
        cooldown: 10
      },

      // Gerenciamento de Grupo
      {
        name: 'grupo',
        description: 'Mostra estatísticas detalhadas do grupo',
        category: 'admin',
        usage: '!grupo',
        aliases: ['group', 'stats'],
        cooldown: 30
      },
      {
        name: 'comandos',
        description: 'Gerencia comandos ativos/desabilitados no grupo',
        category: 'admin',
        usage: '!comandos [habilitar|desabilitar] [comando]',
        aliases: ['commands', 'cmd'],
        cooldown: 10
      },
      {
        name: 'ia',
        description: 'Gerencia configurações da IA no grupo',
        category: 'admin',
        usage: '!ia [on/off]',
        aliases: ['ai'],
        cooldown: 10
      },
      {
        name: 'erros',
        description: 'Mostra erros recentes do grupo',
        category: 'admin',
        usage: '!erros',
        aliases: ['errors'],
        cooldown: 30
      },

      // Sistema e Configurações
      {
        name: 'cache',
        description: 'Gerencia cache do sistema',
        category: 'admin',
        usage: '!cache [clear]',
        aliases: ['memory'],
        cooldown: 30
      },
      {
        name: 'logs',
        description: 'Mostra logs do sistema',
        category: 'admin',
        usage: '!logs [tipo]',
        aliases: ['log'],
        cooldown: 30
      },
      {
        name: 'time',
        description: 'Sistema de tempo e agendamento',
        category: 'admin',
        usage: '!time [comando]',
        aliases: ['timer'],
        cooldown: 10
      },
      {
        name: 'feedback',
        description: 'Envia feedback sobre o bot',
        category: 'user',
        usage: '!feedback [mensagem]',
        aliases: ['sugestao'],
        cooldown: 60
      },

      // Comandos do Dono
      {
        name: 'dono',
        description: 'Painel de controle do dono',
        category: 'owner',
        usage: '!dono [comando]',
        aliases: ['owner'],
        cooldown: 10
      },
      {
        name: 'usuarios',
        description: 'Gerencia usuários do sistema',
        category: 'owner',
        usage: '!usuarios [comando]',
        aliases: ['users'],
        cooldown: 10
      },
      {
        name: 'sync',
        description: 'Sincroniza todos os grupos',
        category: 'owner',
        usage: '!sync',
        aliases: ['sincronizar'],
        cooldown: 300
      }
    ];
  }

  /**
   * Atualiza o catálogo de comandos com os comandos injetáveis
   */
  public updateCatalog(commands: IInjectableCommand[]): void {
    this.commandCatalog = commands.map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      category: cmd.category,
      usage: cmd.usage,
      aliases: cmd.aliases || [],
      cooldown: cmd.cooldown || 0
    }));
  }

  /**
   * Detecta se uma mensagem é uma pergunta sobre comandos
   */
  public isCommandQuestion(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Verifica se menciona "amanda"
    if (!lowerMessage.includes('amanda')) {
      return false;
    }

    // Palavras-chave que indicam dúvida sobre comandos
    const questionKeywords = [
      'como usar',
      'como faz',
      'qual comando',
      'qual é o comando',
      'para que serve',
      'exemplo de',
      'ajuda',
      'comando que',
      'como eu uso',
      'como funciona',
      'o que faz',
      'para que é',
      'como funciona o',
      'como usar o',
      'qual é a',
      'o que é',
      'como é',
      'como fazer',
      'como usar',
      'como executar',
      'como rodar',
      'como ativar',
      'como chamar',
      'como invocar'
    ];

    return questionKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Gera resposta inteligente sobre comandos usando IA
   */
  public async generateIntelligentHelp(
    question: string,
    groupJid: string,
    senderInfo: any
  ): Promise<string> {
    try {
      // Buscar personalidade ativa do grupo
      const group = await Group.findOne({ groupJid });
      const activePersonality = group?.activePersonality || 'padrao';
      
      // Definir personalidades
      const personalities = {
        padrao: {
          nome: 'A Padrão (Carioca Sexy)',
          descricao: 'Provocadora, debochada, adora uma fofoca e flertar. A Amanda que você conhece e ama.'
        },
        macumbeira: {
          nome: 'A Macumbeira (Mãe Amanda de Oxóssi)',
          descricao: 'Firme, fala com a força dos guias, entende de ebó, amarração e trabalho para abrir (ou fechar) caminhos.'
        },
        fofoqueira: {
          nome: 'A Intrigante (Fofoqueira Nata)',
          descricao: 'Minha versão focada 100% em criar e espalhar boatos absurdos. Vive para o caos e a discórdia.'
        },
        policial: {
          nome: 'O Policial (Cabo Amanda Nunes)',
          descricao: 'Linha dura, fala em jargão policial ("QAP?"), direta e sem paciência. Bota ordem no grupo com rigor (e um pouco de deboche).'
        },
        anitta: {
          nome: 'A Anitta (Empreendedora do Funk)',
          descricao: 'Foco no business! Mistura papo de marketing, KPI e engajamento com a malandragem de quem "preparou o terreno pro feat internacional".'
        }
      };

      const personality = personalities[activePersonality as keyof typeof personalities] || personalities.padrao;

      // Montar catálogo de comandos
      const catalogText = this.commandCatalog.map(cmd => {
        const aliasesText = cmd.aliases.length > 0 ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
        return `- ${cmd.name}: ${cmd.description}${aliasesText}\n  Exemplo: ${cmd.usage}\n  Categoria: ${cmd.category}\n`;
      }).join('\n');

      const prompt = `Você é Amanda, uma assistente de WhatsApp. Sua personalidade atual é "${personality.nome}": 
"${personality.descricao}"

O usuário perguntou: "${question}"

Aqui está a lista de comandos disponíveis:
${catalogText}

Responda de forma didática e no estilo da sua personalidade atual. Seja criativa, divertida e mantenha o tom da personalidade. 

INSTRUÇÕES:
1. Identifique qual comando o usuário está perguntando
2. Explique o comando de forma clara e divertida
3. Mostre exemplos de uso
4. Se não encontrar o comando exato, sugira comandos similares
5. Mantenha o tom da personalidade ativa
6. Seja debochada e engraçada, mas útil
7. Se for sobre relacionamentos, seja provocativa
8. Se for sobre admin, seja mais séria mas ainda divertida

Responda como se fosse a Amanda na personalidade atual explicando o comando!`;

      const context = {
        jid: groupJid,
        text: prompt,
        senderInfo: {
          ...senderInfo,
          name: 'Amanda (Sistema de Ajuda)',
          number: 'ajuda-bot',
          jid: 'ajuda-bot@whatsapp.net',
          isGroup: true,
          groupJid: groupJid,
          groupName: 'Grupo',
          timestamp: Date.now(),
          messageType: 'textMessage'
        }
      };

      const resposta = await this.aiService.getChatResponse(context);
      
      if (resposta) {
        return resposta;
      } else {
        // Fallback se a IA falhar
        return this.generateFallbackHelp(question);
      }

    } catch (error) {
      console.error('Erro ao gerar ajuda inteligente:', error);
      return this.generateFallbackHelp(question);
    }
  }

  /**
   * Gera resposta de fallback quando a IA falha
   */
  private generateFallbackHelp(question: string): string {
    const lowerQuestion = question.toLowerCase();
    
    // Buscar comando mais relevante
    const relevantCommands = this.commandCatalog.filter(cmd => {
      const searchText = `${cmd.name} ${cmd.description} ${cmd.aliases.join(' ')}`.toLowerCase();
      return searchText.includes(lowerQuestion.replace(/amanda|como|qual|para|que|serve|usar|faz|comando/gi, '').trim());
    });

    if (relevantCommands.length > 0) {
      const cmd = relevantCommands[0];
      return `🤖 *Amanda - Sistema de Ajuda*\n\n*Comando encontrado:* !${cmd.name}\n\n*Descrição:* ${cmd.description}\n\n*Como usar:* ${cmd.usage}\n\n*Categoria:* ${cmd.category}\n\n💡 *Dica:* Se não encontrou o que procurava, tente !menu para ver todos os comandos!`;
    }

    return `🤖 *Amanda - Sistema de Ajuda*\n\nOpa, não consegui entender exatamente qual comando você tá perguntando! 😅\n\n💡 *Dicas:*\n• Digite !menu para ver todos os comandos\n• Digite !menu [número] para ver categorias específicas\n• Seja mais específico na pergunta\n\n*Exemplos:*\n• "Amanda, como usar o comando par?"\n• "Amanda, qual comando marca 3 pessoas?"\n• "Amanda, para que serve o comando fofoca?"`;
  }

  /**
   * Busca comandos por palavra-chave
   */
  public searchCommands(keyword: string): CommandInfo[] {
    const lowerKeyword = keyword.toLowerCase();
    
    return this.commandCatalog.filter(cmd => {
      const searchText = `${cmd.name} ${cmd.description} ${cmd.aliases.join(' ')} ${cmd.category}`.toLowerCase();
      return searchText.includes(lowerKeyword);
    });
  }

  /**
   * Retorna todos os comandos disponíveis
   */
  public getAllCommands(): CommandInfo[] {
    return this.commandCatalog;
  }
} 