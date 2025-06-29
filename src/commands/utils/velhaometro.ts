import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const frasesIdadeMental = [
  '🧠 Mente brilhante! Você pensa como um gênio!',
  '🎓 Sábio! Conhecimento de uma vida inteira!',
  '👴 Experiente! Já viveu muito e aprendeu tudo!',
  '🧙‍♂️ Mago! Sabedoria ancestral!',
  '📚 Bibliotecário! Conhece todos os livros!',
  '🔬 Cientista! Mente analítica e precisa!',
  '🎭 Ator veterano! Já viveu mil vidas!',
  '🏛️ Filósofo! Pensa como os antigos sábios!',
  '⚖️ Juiz! Experiência e discernimento!',
  '👨‍⚕️ Médico! Conhece todos os males!',
  '🎨 Artista maduro! Criatividade sem limites!',
  '🏆 Campeão! Experiência de um vencedor!',
  '🌳 Árvore antiga! Raízes profundas de sabedoria!',
  '🗿 Monumento! Sólido como uma rocha!',
  '🏰 Castelo! Fortaleza de conhecimento!',
  '📖 Livro antigo! Páginas cheias de história!',
  '🎪 Circo veterano! Já viu de tudo!',
  '🚢 Navio antigo! Navegou por todos os mares!',
  '🏔️ Montanha! Altura de pensamento!',
  '🌅 Sol poente! Beleza da maturidade!'
];

const velhaometroCommand: ICommand = {
  name: 'idademental',
  aliases: ['velhaometro', 'idade-mental'],
  description: '🧠 Mede sua idade mental e maturidade.',
  category: 'utils',
  usage: '!idademental',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const idade = Math.floor(Math.random() * 71) + 10; // 10 a 80 anos
    const numero = message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid?.split('@')[0];
    const jid = message.key.participant || message.key.remoteJid;
    const frase = frasesIdadeMental[Math.floor(Math.random() * frasesIdadeMental.length)];
    
    let resposta = `🧠 *Idade Mental Resultado*\n\n👤 @${numero}\n📊 Idade mental: *${idade} anos*\n\n${frase}`;
    
    // Adicionar emojis baseados na idade
    if (idade >= 70) {
      resposta += '\n\n👴 *SÁBIO:* Você é um ancião da sabedoria! 👴';
    } else if (idade >= 50) {
      resposta += '\n\n🧙‍♂️ *EXPERIENTE:* Muita sabedoria acumulada! 🧙‍♂️';
    } else if (idade >= 30) {
      resposta += '\n\n🎓 *MADURO:* Boa maturidade mental! 🎓';
    } else if (idade >= 20) {
      resposta += '\n\n🧑 *JOVEM:* Mente em desenvolvimento! 🧑';
    } else {
      resposta += '\n\n👶 *INFANTIL:* Mente ainda em crescimento! 👶';
    }
    
    await sock.sendMessage(message.key.remoteJid!, { text: resposta, mentions: [jid!] });
  },
};

export default velhaometroCommand; 