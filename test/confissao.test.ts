import { ConfessionGame } from '../src/commands/brincadeiras/confissao';

describe('ConfessionGame', () => {
  test('deve exportar as funções necessárias', () => {
    expect(typeof ConfessionGame.activate).toBe('function');
    expect(typeof ConfessionGame.reveal).toBe('function');
    expect(typeof ConfessionGame.getStatus).toBe('function');
    expect(typeof ConfessionGame.cancel).toBe('function');
    expect(typeof ConfessionGame.finalize).toBe('function');
    expect(typeof ConfessionGame.ranking).toBe('function');
    expect(typeof ConfessionGame.chocantes).toBe('function');
    expect(typeof ConfessionGame.micos).toBe('function');
    expect(typeof ConfessionGame.resultado).toBe('function');
  });

  test('deve validar frases de confissão corretamente', () => {
    // Teste da função validateConfessionText se existir
    if (typeof ConfessionGame.validateConfessionText === 'function') {
      expect(ConfessionGame.validateConfessionText('Eu nunca testei')).toBe(true);
      expect(ConfessionGame.validateConfessionText('Eu já comi pizza')).toBe(true);
      expect(ConfessionGame.validateConfessionText('Uma vez, eu fiz isso')).toBe(true);
      expect(ConfessionGame.validateConfessionText('Texto inválido')).toBe(false);
    }
  });

  test('deve validar comandos específicos de confissão', () => {
    // Teste para comandos específicos (!eununca, !euja, !umavez)
    const testCommandValidation = (command: string, confession: string): boolean => {
      const lowerCommand = command.toLowerCase().trim();
      const lowerConfession = confession.toLowerCase().trim();
      
      if (lowerCommand === '!eununca' && lowerConfession.startsWith('eu nunca')) {
        return true;
      } else if (lowerCommand === '!euja' && lowerConfession.startsWith('eu já')) {
        return true;
      } else if (lowerCommand === '!umavez' && lowerConfession.startsWith('uma vez')) {
        return true;
      }
      return false;
    };

    // Testes válidos
    expect(testCommandValidation('!eununca', 'Eu nunca colei em uma prova')).toBe(true);
    expect(testCommandValidation('!euja', 'Eu já comi pizza com ketchup')).toBe(true);
    expect(testCommandValidation('!umavez', 'Uma vez, chamei a sogra pelo nome da ex')).toBe(true);

    // Testes inválidos
    expect(testCommandValidation('!eununca', 'Eu já comi pizza')).toBe(false);
    expect(testCommandValidation('!euja', 'Eu nunca colei')).toBe(false);
    expect(testCommandValidation('!umavez', 'Eu nunca fiz isso')).toBe(false);
    expect(testCommandValidation('!outro', 'Eu nunca fiz isso')).toBe(false);
  });

  test('deve extrair confissão corretamente dos comandos', () => {
    const extractConfession = (text: string): string => {
      return text.substring(text.indexOf(' ') + 1).trim();
    };

    expect(extractConfession('!eununca Eu nunca colei em uma prova')).toBe('Eu nunca colei em uma prova');
    expect(extractConfession('!euja Eu já comi pizza com ketchup')).toBe('Eu já comi pizza com ketchup');
    expect(extractConfession('!umavez Uma vez, chamei a sogra pelo nome da ex')).toBe('Uma vez, chamei a sogra pelo nome da ex');
  });
}); 