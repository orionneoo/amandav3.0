// Exportações das personalidades individuais
export { padraoPersonality } from './padrao';
export { amantePersonality } from './amante';
export { casadaPersonality } from './casada';
export { desviadaPersonality } from './desviada';
export { macumbeiraPersonality } from './macumbeira';
export { cartomantePersonality } from './cartomante';
export { astrologaPersonality } from './astrologa';
export { coachQuanticaPersonality } from './coach_quantica';
export { anittaPersonality } from './anitta';
export { patroaPersonality } from './patroa';
export { policialPersonality } from './policial';
export { fariaLimerPersonality } from './faria_limer';
export { drFritzPersonality } from './dr_fritz';
export { crentePersonality } from './crente';
export { nerdPersonality } from './nerd';
export { tiaPersonality } from './tia';
export { mortyPersonality } from './morty';
export { fofoqueiraPersonality } from './fofoqueira';
export { cupidoPersonality } from './cupido';
export { donaDoJogoPersonality } from './dona_do_jogo';

// Exportações dos arquivos existentes
export { groupPersonality } from './group';
export { defaultPersonality } from './default';
export { sysLightPersonality } from './sys_light';
export { privatePersonality } from './private';

// Mapa de todas as personalidades para fácil acesso
export const PERSONALIDADES_MAP = {
  padrao: 'padraoPersonality',
  amante: 'amantePersonality',
  casada: 'casadaPersonality',
  desviada: 'desviadaPersonality',
  macumbeira: 'macumbeiraPersonality',
  cartomante: 'cartomantePersonality',
  astrologa: 'astrologaPersonality',
  coach_quantica: 'coachQuanticaPersonality',
  anitta: 'anittaPersonality',
  patroa: 'patroaPersonality',
  policial: 'policialPersonality',
  faria_limer: 'fariaLimerPersonality',
  dr_fritz: 'drFritzPersonality',
  crente: 'crentePersonality',
  nerd: 'nerdPersonality',
  tia: 'tiaPersonality',
  morty: 'mortyPersonality',
  fofoqueira: 'fofoqueiraPersonality',
  cupido: 'cupidoPersonality',
  dona_do_jogo: 'donaDoJogoPersonality',
  group: 'groupPersonality',
  default: 'defaultPersonality',
  sys_light: 'sysLightPersonality',
  private: 'privatePersonality'
} as const;

// Lista de todas as personalidades disponíveis
export const PERSONALIDADES_DISPONIVEIS = Object.keys(PERSONALIDADES_MAP); 
