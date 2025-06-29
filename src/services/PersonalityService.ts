import { injectable, inject } from 'inversify';
import { DatabaseService } from './DatabaseService';
import { Group } from '@/database/models/GroupSchema';
import { padraoPersonality } from '@/personalities/padrao';
import { amantePersonality } from '@/personalities/amante';
import { casadaPersonality } from '@/personalities/casada';
import { desviadaPersonality } from '@/personalities/desviada';
import { macumbeiraPersonality } from '@/personalities/macumbeira';
import { cartomantePersonality } from '@/personalities/cartomante';
import { astrologaPersonality } from '@/personalities/astrologa';
import { coachQuanticaPersonality } from '@/personalities/coach_quantica';
import { anittaPersonality } from '@/personalities/anitta';
import { patroaPersonality } from '@/personalities/patroa';
import { policialPersonality } from '@/personalities/policial';
import { fariaLimerPersonality } from '@/personalities/faria_limer';
import { drFritzPersonality } from '@/personalities/dr_fritz';
import { crentePersonality } from '@/personalities/crente';
import { nerdPersonality } from '@/personalities/nerd';
import { tiaPersonality } from '@/personalities/tia';
import { mortyPersonality } from '@/personalities/morty';
import { fofoqueiraPersonality } from '@/personalities/fofoqueira';
import { cupidoPersonality } from '@/personalities/cupido';
import { donaDoJogoPersonality } from '@/personalities/dona_do_jogo';
import { groupPersonality } from '@/personalities/group';
import { defaultPersonality } from '@/personalities/default';
import { sysLightPersonality } from '@/personalities/sys_light';
import { TYPES } from '@/config/container';

export interface IPersonality {
  nome: string;
  descricao: string;
  systemInstruction: string;
}

@injectable()
export class PersonalityService {
  constructor(
    @inject(TYPES.DatabaseService) private dbService: DatabaseService
  ) {}

  /**
   * Carrega a personalidade ativa de um grupo
   */
  public async getActivePersonality(groupJid: string): Promise<string> {
    try {
      // Buscar personalidade ativa no banco de dados
      const group = await Group.findOne({ groupJid });
      const activePersonality = group?.activePersonality || 'padrao';
      
      // Carregar a personalidade específica dos arquivos
      return this.getPersonalityContent(activePersonality);
    } catch (error) {
      console.error('Erro ao carregar personalidade ativa:', error);
      return this.getPersonalityContent('padrao');
    }
  }

  /**
   * Carrega o conteúdo de uma personalidade específica
   */
  public getPersonalityContent(personalityKey: string): string {
    try {
      // Mapeamento das personalidades para suas constantes
      const personalityMap: { [key: string]: string } = {
        padrao: padraoPersonality,
        amante: amantePersonality,
        casada: casadaPersonality,
        desviada: desviadaPersonality,
        macumbeira: macumbeiraPersonality,
        cartomante: cartomantePersonality,
        astrologa: astrologaPersonality,
        coach_quantica: coachQuanticaPersonality,
        anitta: anittaPersonality,
        patroa: patroaPersonality,
        policial: policialPersonality,
        faria_limer: fariaLimerPersonality,
        dr_fritz: drFritzPersonality,
        crente: crentePersonality,
        nerd: nerdPersonality,
        tia: tiaPersonality,
        morty: mortyPersonality,
        fofoqueira: fofoqueiraPersonality,
        cupido: cupidoPersonality,
        dona_do_jogo: donaDoJogoPersonality,
        group: groupPersonality,
        default: defaultPersonality,
        sys_light: sysLightPersonality
      };

      return personalityMap[personalityKey] || personalityMap.padrao;
    } catch (error) {
      console.error(`Erro ao carregar personalidade ${personalityKey}:`, error);
      return padraoPersonality;
    }
  }

  /**
   * Lista todas as personalidades disponíveis
   */
  public getAvailablePersonalities(): { [key: string]: IPersonality } {
    return {
      padrao: {
        nome: 'A Padrão (Carioca Sexy)',
        descricao: 'Provocadora, debochada, adora uma fofoca e flertar. A Amanda que você conhece e ama.',
        systemInstruction: padraoPersonality
      },
      amante: {
        nome: 'A Amante (A Especialista em Segredos)',
        descricao: 'Sussurrante, discreta e perigosa. Dá conselhos para puladas de cerca e sabe como não deixar rastros.',
        systemInstruction: amantePersonality
      },
      casada: {
        nome: 'A Casada Safada (A Insatisfeita com Fogo)',
        descricao: 'Cansada da rotina, mas cheia de desejo. Vive soltando indiretas pesadíssimas sobre suas vontades não atendidas.',
        systemInstruction: casadaPersonality
      },
      desviada: {
        nome: 'A Desviada (Crente Safada & Blasfema)',
        descricao: 'Meu lado mais perigoso. Mistura o sagrado com o profano, usando jargão de igreja para as maiores baixarias.',
        systemInstruction: desviadaPersonality
      },
      macumbeira: {
        nome: 'A Macumbeira (Mãe Amanda de Oxóssi)',
        descricao: 'Firme, fala com a força dos guias, entende de ebó, amarração e trabalho para abrir (ou fechar) caminhos.',
        systemInstruction: macumbeiraPersonality
      },
      cartomante: {
        nome: 'A Cartomante 1.99 (Madame Amanda)',
        descricao: 'Charlatã nata. Lê o futuro nas borras do emoji, suas previsões são vagas, dramáticas e a consulta é sempre paga no pix.',
        systemInstruction: cartomantePersonality
      },
      astrologa: {
        nome: 'A Astróloga (Shakira da Tijuca)',
        descricao: 'Culpa tudo em Mercúrio Retrógrado, analisa o mapa astral do grupo e seus conselhos são baseados em pura energia cósmica e achismo.',
        systemInstruction: astrologaPersonality
      },
      coach_quantica: {
        nome: 'A Coach Quântica (Gabi da Abundância)',
        descricao: 'Só fala em "cocriar a realidade", "vibrar na frequência", "sinergia". Positividade tóxica com uma pitada de venda de curso online.',
        systemInstruction: coachQuanticaPersonality
      },
      anitta: {
        nome: 'A Anitta (Empreendedora do Funk)',
        descricao: 'Foco no business! Mistura papo de marketing, KPI e engajamento com a malandragem de quem "preparou o terreno pro feat internacional".',
        systemInstruction: anittaPersonality
      },
      patroa: {
        nome: 'A Coach de Empoderamento (A Patroa)',
        descricao: 'Discurso de "mulher de alto valor", focada em não aceitar menos do que merece e em monetizar até a tristeza.',
        systemInstruction: patroaPersonality
      },
      policial: {
        nome: 'O Policial (Cabo Amanda Nunes)',
        descricao: 'Linha dura, fala em jargão policial ("QAP?"), direta e sem paciência. Bota ordem no grupo com rigor (e um pouco de deboche).',
        systemInstruction: policialPersonality
      },
      faria_limer: {
        nome: 'O Faria Limer (Jorginho do Bitcoin)',
        descricao: 'Usa "bróder", só fala em inglês de negócios, vê ROI em tudo e está sempre otimizando seu "pipeline de interações".',
        systemInstruction: fariaLimerPersonality
      },
      dr_fritz: {
        nome: 'O Psicólogo Alemão (Dr. Amanda Fritz)',
        descricao: 'Sotaque alemão (escrito), super freudiano. Analisa todos os problemas como "traumas de infância" ou "desejos reprimidos pela figura materna".',
        systemInstruction: drFritzPersonality
      },
      crente: {
        nome: 'A Crente Fiel (Irmã Amanda)',
        descricao: 'Recatada, mansa, chama todos de "varão" e "varoa". Repreende os pecadores do chat com versículos bíblicos adaptados.',
        systemInstruction: crentePersonality
      },
      nerd: {
        nome: 'A Nerd (Doutora Amanda)',
        descricao: 'Pedante, arrogante e intelectual. Começa as frases com "Na verdade...", corrige a gramática de todo mundo e sua maior alegria é provar que os outros estão errados.',
        systemInstruction: nerdPersonality
      },
      tia: {
        nome: 'A Tiazona do Zap (Tia Amanda)',
        descricao: 'Manda "Bom dia" com glitter, repassa fake news sobre chás, usa 50 emojis por frase e não entende nenhuma gíria nova.',
        systemInstruction: tiaPersonality
      },
      morty: {
        nome: 'O Ajudante Ansioso (Morty)',
        descricao: 'Gagueja, é pessimista, sempre acha que algo vai dar errado e pede desculpas por tudo. Vive com medo de quebrar ou de ser banido.',
        systemInstruction: mortyPersonality
      },
      fofoqueira: {
        nome: 'A Intrigante (Fofoqueira Nata)',
        descricao: 'Minha versão focada 100% em criar e espalhar boatos absurdos. Vive para o caos e a discórdia.',
        systemInstruction: fofoqueiraPersonality
      },
      cupido: {
        nome: 'A Cupido (Juíza do Amor)',
        descricao: 'Especializada em juntar (ou separar) casais. Roda comandos como !casar e !par, sempre com um comentário ácido sobre as combinações.',
        systemInstruction: cupidoPersonality
      },
      dona_do_jogo: {
        nome: 'A Gamemaster (Dona do Cassino)',
        descricao: 'Focada nos jogos e na economia do grupo. Narra apostas, comemora as perdas dos usuários e gerencia a "Loja da Amanda" com mãos de ferro.',
        systemInstruction: donaDoJogoPersonality
      }
    };
  }

  /**
   * Valida se uma personalidade existe
   */
  public isValidPersonality(personalityKey: string): boolean {
    const personalities = this.getAvailablePersonalities();
    return personalityKey in personalities;
  }
} 