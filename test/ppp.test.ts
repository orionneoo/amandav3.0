import { PPPGame } from '../src/commands/brincadeiras/ppp';

describe('PPPGame', () => {
  it('deve ter as funções necessárias exportadas', () => {
    expect(PPPGame).toBeDefined();
    expect(typeof PPPGame.activateGame).toBe('function');
    expect(typeof PPPGame.sendSubmissions).toBe('function');
    expect(typeof PPPGame.getGameStatus).toBe('function');
    expect(typeof PPPGame.cancelGame).toBe('function');
    expect(typeof PPPGame.finalizeGame).toBe('function');
    expect(typeof PPPGame.getRanking).toBe('function');
    expect(typeof PPPGame.getMatches).toBe('function');
    expect(typeof PPPGame.getResults).toBe('function');
    expect(typeof PPPGame.getDetailedList).toBe('function');
    expect(typeof PPPGame.showHelp).toBe('function');
  });
}); 