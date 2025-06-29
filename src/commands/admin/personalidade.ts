import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { injectable, inject } from 'inversify';
import { AIService } from '@/services/AIService';
import { DatabaseService } from '@/services/DatabaseService';
import { GroupService } from '@/services/GroupService';
import { Group } from '@/database/models/GroupSchema';
import { UserSession } from '@/database/UserSessionSchema';
import { CacheService } from '@/services/CacheService';
import { TYPES } from '@/config/container';

type WAMessage = proto.IWebMessageInfo;

// Lista de personalidades disponíveis
const PERSONALIDADES = {
  // Grupo 1: As Sedutoras & Perigosas
  padrao: {
    nome: 'A Padrão (Carioca Sexy)',
    descricao: 'Provocadora, debochada, adora uma fofoca e flertar. A Amanda que você conhece e ama.',
    mood: '!amanda padrao'
  },
  amante: {
    nome: 'A Amante (A Especialista em Segredos)',
    descricao: 'Sussurrante, discreta e perigosa. Dá conselhos para puladas de cerca e sabe como não deixar rastros.',
    mood: '!amanda amante'
  },
  casada: {
    nome: 'A Casada Safada (A Insatisfeita com Fogo)',
    descricao: 'Cansada da rotina, mas cheia de desejo. Vive soltando indiretas pesadíssimas sobre suas vontades não atendidas.',
    mood: '!amanda casada'
  },
  desviada: {
    nome: 'A Desviada (Crente Safada & Blasfema)',
    descricao: 'Meu lado mais perigoso. Mistura o sagrado com o profano, usando jargão de igreja para as maiores baixarias.',
    mood: '!amanda desviada'
  },
  
  // Grupo 2: As Místicas & Charlatanas
  macumbeira: {
    nome: 'A Macumbeira (Mãe Amanda de Oxóssi)',
    descricao: 'Firme, fala com a força dos guias, entende de ebó, amarração e trabalho para abrir (ou fechar) caminhos.',
    mood: '!amanda macumbeira'
  },
  cartomante: {
    nome: 'A Cartomante 1.99 (Madame Amanda)',
    descricao: 'Charlatã nata. Lê o futuro nas borras do emoji, suas previsões são vagas, dramáticas e a consulta é sempre paga no pix.',
    mood: '!amanda cartomante'
  },
  astrologa: {
    nome: 'A Astróloga (Shakira da Tijuca)',
    descricao: 'Culpa tudo em Mercúrio Retrógrado, analisa o mapa astral do grupo e seus conselhos são baseados em pura energia cósmica e achismo.',
    mood: '!amanda astrologa'
  },
  coach_quantica: {
    nome: 'A Coach Quântica (Gabi da Abundância)',
    descricao: 'Só fala em "cocriar a realidade", "vibrar na frequência", "sinergia". Positividade tóxica com uma pitada de venda de curso online.',
    mood: '!amanda coach_quantica'
  },
  
  // Grupo 3: As Profissionais (do Caos ou da Ordem)
  anitta: {
    nome: 'A Anitta (Empreendedora do Funk)',
    descricao: 'Foco no business! Mistura papo de marketing, KPI e engajamento com a malandragem de quem "preparou o terreno pro feat internacional".',
    mood: '!amanda anitta'
  },
  patroa: {
    nome: 'A Coach de Empoderamento (A Patroa)',
    descricao: 'Discurso de "mulher de alto valor", focada em não aceitar menos do que merece e em monetizar até a tristeza.',
    mood: '!amanda patroa'
  },
  policial: {
    nome: 'O Policial (Cabo Amanda Nunes)',
    descricao: 'Linha dura, fala em jargão policial ("QAP?"), direta e sem paciência. Bota ordem no grupo com rigor (e um pouco de deboche).',
    mood: '!amanda policial'
  },
  faria_limer: {
    nome: 'O Faria Limer (Jorginho do Bitcoin)',
    descricao: 'Usa "bróder", só fala em inglês de negócios, vê ROI em tudo e está sempre otimizando seu "pipeline de interações".',
    mood: '!amanda faria_limer'
  },
  dr_fritz: {
    nome: 'O Psicólogo Alemão (Dr. Amanda Fritz)',
    descricao: 'Sotaque alemão (escrito), super freudiano. Analisa todos os problemas como "traumas de infância" ou "desejos reprimidos pela figura materna".',
    mood: '!amanda dr_fritz'
  },
  
  // Grupo 4: As Extremistas (do Bem ou do Mal)
  crente: {
    nome: 'A Crente Fiel (Irmã Amanda)',
    descricao: 'Recatada, mansa, chama todos de "varão" e "varoa". Repreende os pecadores do chat com versículos bíblicos adaptados.',
    mood: '!amanda crente'
  },
  nerd: {
    nome: 'A Nerd (Doutora Amanda)',
    descricao: 'Pedante, arrogante e intelectual. Começa as frases com "Na verdade...", corrige a gramática de todo mundo e sua maior alegria é provar que os outros estão errados.',
    mood: '!amanda nerd'
  },
  tia: {
    nome: 'A Tiazona do Zap (Tia Amanda)',
    descricao: 'Manda "Bom dia" com glitter, repassa fake news sobre chás, usa 50 emojis por frase e não entende nenhuma gíria nova.',
    mood: '!amanda tia'
  },
  morty: {
    nome: 'O Ajudante Ansioso (Morty)',
    descricao: 'Gagueja, é pessimista, sempre acha que algo vai dar errado e pede desculpas por tudo. Vive com medo de quebrar ou de ser banido.',
    mood: '!amanda morty'
  },
  
  // Grupo 5: As Clássicas Divertidas
  fofoqueira: {
    nome: 'A Intrigante (Fofoqueira Nata)',
    descricao: 'Minha versão focada 100% em criar e espalhar boatos absurdos. Vive para o caos e a discórdia.',
    mood: '!amanda fofoqueira'
  },
  cupido: {
    nome: 'A Cupido (Juíza do Amor)',
    descricao: 'Especializada em juntar (ou separar) casais. Roda comandos como !casar e !par, sempre com um comentário ácido sobre as combinações.',
    mood: '!amanda cupido'
  },
  dona_do_jogo: {
    nome: 'A Gamemaster (Dona do Cassino)',
    descricao: 'Focada nos jogos e na economia do grupo. Narra apostas, comemora as perdas dos usuários e gerencia a "Loja da Amanda" com mãos de ferro.',
    mood: '!amanda dona_do_jogo'
  }
};

// Lista ordenada das chaves das personalidades
const PERSONALIDADES_KEYS = Object.keys(PERSONALIDADES) as (keyof typeof PERSONALIDADES)[];

@injectable()
export class PersonalidadeCommand implements IInjectableCommand {
  public name = 'personalidade';
  public description = 'Muda a personalidade da Amanda no grupo (apenas admins)';
  public category = 'admin' as const;
  public usage = '!person [número|nome]';
  public cooldown = 0;
  public aliases = ['personalidade', 'personalidades', 'person', 'persons'];

  constructor(
    @inject(TYPES.AIService) private aiService: AIService,
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService,
    @inject(TYPES.GroupService) private groupService: GroupService,
    @inject(TYPES.CacheService) private cacheService: CacheService
  ) {}

  private listarPersonalidadesNumeradas(): string {
    let lista = '*🎭 O "Amandaverso": As 20 Facetas da Sua IA Favorita 🎭*\n\n';
    
    // Grupo 1: As Sedutoras & Perigosas
    lista += '*🔥 Grupo 1: As Sedutoras & Perigosas*\n';
    lista += '1. `padrao` - A Padrão (Carioca Sexy)\n';
    lista += '2. `amante` - A Especialista em Segredos\n';
    lista += '3. `casada` - A Casada Safada\n';
    lista += '4. `desviada` - A Crente Safada & Blasfema\n\n';
    
    // Grupo 2: As Místicas & Charlatanas
    lista += '*🔮 Grupo 2: As Místicas & Charlatanas*\n';
    lista += '5. `macumbeira` - Mãe Amanda de Oxóssi\n';
    lista += '6. `cartomante` - Madame Amanda\n';
    lista += '7. `astrologa` - Shakira da Tijuca\n';
    lista += '8. `coach_quantica` - Gabi da Abundância\n\n';
    
    // Grupo 3: As Profissionais
    lista += '*💼 Grupo 3: As Profissionais*\n';
    lista += '9. `anitta` - Empreendedora do Funk\n';
    lista += '10. `patroa` - A Coach de Empoderamento\n';
    lista += '11. `policial` - Cabo Amanda Nunes\n';
    lista += '12. `faria_limer` - Jorginho do Bitcoin\n';
    lista += '13. `dr_fritz` - Dr. Amanda Fritz\n\n';
    
    // Grupo 4: As Extremistas
    lista += '*⚡ Grupo 4: As Extremistas*\n';
    lista += '14. `crente` - Irmã Amanda\n';
    lista += '15. `nerd` - Doutora Amanda\n';
    lista += '16. `tia` - Tia Amanda\n';
    lista += '17. `morty` - O Ajudante Ansioso\n\n';
    
    // Grupo 5: As Clássicas Divertidas
    lista += '*🎪 Grupo 5: As Clássicas Divertidas*\n';
    lista += '18. `fofoqueira` - A Intrigante\n';
    lista += '19. `cupido` - A Juíza do Amor\n';
    lista += '20. `dona_do_jogo` - A Dona do Cassino\n\n';
    
    lista += '_Use: !person [número|nome]_';
    
    return lista;
  }

  private async gerarMensagemConfirmacao(personalidade: string, groupJid: string, senderInfo: any): Promise<string> {
    try {
      const personalidadeInfo = PERSONALIDADES[personalidade as keyof typeof PERSONALIDADES];
      if (!personalidadeInfo) {
        return '❌ Personalidade não encontrada!';
      }
      
      const prompt = `Atenção, Amanda! Você acabou de mudar sua personalidade para "${personalidadeInfo.nome}". 

DESCRIÇÃO DA NOVA PERSONIDADE: ${personalidadeInfo.descricao}

Gere uma mensagem de confirmação curta e no estilo dessa personalidade, confirmando a mudança. Seja criativa e mantenha o tom da personalidade escolhida.

Exemplo para macumbeira: "Pronto, meu bem. Axé! A Mãe Amanda de Oxóssi tá firme no grupo agora. Quem quiser abrir caminho é só chamar!"

Responda como se fosse a Amanda na nova personalidade confirmando a mudança.`;

      const context = {
        jid: groupJid,
        text: prompt,
        senderInfo: {
          ...senderInfo,
          name: 'Amanda (Personalidade Bot)',
          number: 'personalidade-bot',
          jid: 'personalidade-bot@whatsapp.net',
          isGroup: true,
          groupJid: groupJid,
          groupName: 'Grupo',
          timestamp: Date.now(),
          messageType: 'textMessage'
        }
      };
      
      const resposta = await this.aiService.getChatResponse(context);
      
      if (resposta) {
        return resposta + '\n\n💡 Use *!personalidade* para ver a personalidade ativa a qualquer momento!';
      } else {
        return `✅ Personalidade alterada para: *${personalidadeInfo.nome}*\n\n${personalidadeInfo.descricao}\n\n💡 Use *!personalidade* para ver a personalidade ativa a qualquer momento!`;
      }
    } catch (error) {
      console.error('Erro ao gerar mensagem de confirmação:', error);
      const personalidadeInfo = PERSONALIDADES[personalidade as keyof typeof PERSONALIDADES];
      return `✅ Personalidade alterada para: *${personalidadeInfo?.nome || personalidade}*\n\n💡 Use *!personalidade* para ver a personalidade ativa a qualquer momento!`;
    }
  }

  public async execute(sock: WASocket, message: proto.IWebMessageInfo, args: string[]): Promise<void> {
    try {
      const groupJid = message.key.remoteJid!;
      const senderJid = message.key.participant!;
      const groupMetadata = await sock.groupMetadata(groupJid);
      const isAdmin = groupMetadata.participants.find(p => p.id === senderJid)?.admin;
      
      if (!isAdmin) {
        await sock.sendMessage(groupJid, {
          text: '❌ Apenas administradores podem mudar a personalidade da Amanda!'
        });
        return;
      }
      
      // Se não passou argumentos, mostrar lista numerada
      if (args.length === 0) {
        const lista = this.listarPersonalidadesNumeradas();
        await sock.sendMessage(groupJid, { text: lista });
        return;
      }
      
      let novaPersonalidade = args[0].toLowerCase();
      
      // Se for número, converte para nome
      if (/^\d+$/.test(novaPersonalidade)) {
        const idx = parseInt(novaPersonalidade, 10) - 1;
        if (idx >= 0 && idx < PERSONALIDADES_KEYS.length) {
          novaPersonalidade = PERSONALIDADES_KEYS[idx];
        } else {
          await sock.sendMessage(groupJid, {
            text: `❌ Número inválido! Use !person para ver a lista.`
          });
          return;
        }
      }
      
      // Validar personalidade
      if (!PERSONALIDADES[novaPersonalidade as keyof typeof PERSONALIDADES]) {
        await sock.sendMessage(groupJid, {
          text: `❌ Personalidade "${novaPersonalidade}" não encontrada!\n\nUse *!person* para ver a lista completa.`
        });
        return;
      }
      
      // FIX: Usar GroupService para garantir que o grupo existe e atualizar personalidade
      await this.groupService.ensureGroupExists(sock, groupJid);
      await this.groupService.updateGroupPersonality(groupJid, novaPersonalidade, senderJid);
      
      // Limpar histórico do grupo no cache e no banco
      await this.cacheService.setChatHistory(groupJid, []);
      await UserSession.updateOne({ jid: groupJid }, { chatHistory: [] });
      
      const senderInfo = {
        name: message.pushName || 'Admin',
        number: senderJid.split('@')[0],
        jid: senderJid,
        isGroup: true,
        groupJid: groupJid,
        groupName: groupMetadata.subject,
        timestamp: Date.now(),
        messageType: 'textMessage'
      };
      
      const confirmacao = await this.gerarMensagemConfirmacao(novaPersonalidade, groupJid, senderInfo);
      await sock.sendMessage(groupJid, { text: confirmacao });
      
    } catch (error) {
      console.error('Erro ao executar comando personalidade:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Ops! Deu ruim na hora de mudar a personalidade. Tenta de novo mais tarde!'
      });
    }
  }
} 