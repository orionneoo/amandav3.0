import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const oraculos = [
  // Amor e Relacionamentos
  '💕 O amor está próximo! Alguém especial vai aparecer em sua vida em breve.',
  '💔 Cuidado com corações partidos. O passado não define seu futuro amoroso.',
  '💘 Uma paixão antiga pode reacender. Esteja preparado para surpresas.',
  '💖 Seu coração está aberto para novas experiências. Aproveite!',
  
  // Carreira e Dinheiro
  '💰 Uma oportunidade financeira está chegando. Fique atento aos sinais.',
  '💼 Seu trabalho será reconhecido. Uma promoção pode estar próxima.',
  '📈 Invista em seus sonhos. O retorno será maior que o esperado.',
  '💎 Sua criatividade será sua maior aliada nos próximos dias.',
  
  // Saúde e Bem-estar
  '🌿 Cuide de sua saúde mental. Meditação pode trazer clareza.',
  '💪 Seu corpo está pedindo movimento. Exercícios trarão energia renovada.',
  '🧘‍♀️ Encontre seu equilíbrio interior. A paz está dentro de você.',
  '🌟 Sua aura está brilhante. Pessoas positivas serão atraídas.',
  
  // Viagens e Aventuras
  '✈️ Uma viagem inesperada pode mudar sua perspectiva de vida.',
  '🗺️ Novos caminhos se abrirão. Não tenha medo de explorar.',
  '🌍 O mundo tem muito a oferecer. Sua próxima aventura está chegando.',
  '🏔️ Desafios trarão crescimento. Encare-os com coragem.',
  
  // Amizades e Social
  '👥 Velhos amigos podem reaparecer. Reconecte-se com quem importa.',
  '🤝 Uma nova amizade vai enriquecer sua vida de forma inesperada.',
  '🎉 Festas e celebrações trarão alegria. Aproveite os momentos.',
  '💬 Comunicação será sua ferramenta mais poderosa esta semana.',
  
  // Espiritual e Intuição
  '🔮 Sua intuição está aguçada. Confie nos seus instintos.',
  '✨ Sinais do universo estão por toda parte. Observe com atenção.',
  '🌙 A lua está influenciando suas emoções. Use essa energia a seu favor.',
  '🙏 Fé e esperança trarão respostas que você procura.',
  
  // Desafios e Crescimento
  '⚡ Mudanças bruscas podem assustar, mas trarão evolução.',
  '🎯 Foque em seus objetivos. Distrações podem atrasar seu progresso.',
  '🔥 Sua determinação será testada. Persista e vencerá.',
  '🌱 Crescimento pessoal requer paciência. Cada dia é um novo começo.',
  
  // Sorte e Oportunidades
  '🍀 A sorte está do seu lado! Aproveite as oportunidades que surgirem.',
  '🎰 Jogos de azar podem trazer pequenas vitórias, mas não abuse.',
  '🎁 Uma surpresa agradável está a caminho. Mantenha-se otimista.',
  '⭐ Seus desejos mais secretos podem se realizar. Acredite!',
  
  // Conselhos Gerais
  '📚 Conhecimento é poder. Aprenda algo novo hoje.',
  '🎨 Sua criatividade está em alta. Expresse-se sem medo.',
  '🌅 Cada amanhecer é uma nova chance. Aproveite ao máximo.',
  '🕊️ Paz interior trará clareza para suas decisões.'
];

const tiposOraculo = [
  '🔮 *Oráculo do Amor*',
  '💰 *Oráculo da Fortuna*',
  '🌿 *Oráculo da Saúde*',
  '✈️ *Oráculo das Viagens*',
  '👥 *Oráculo das Amizades*',
  '✨ *Oráculo Espiritual*',
  '⚡ *Oráculo dos Desafios*',
  '🍀 *Oráculo da Sorte*',
  '📚 *Oráculo da Sabedoria*',
  '🌅 *Oráculo da Vida*'
];

const sorteCommand: ICommand = {
  name: 'sorte',
  aliases: ['oraculo', 'oráculo'],
  description: '🔮 Consulta o oráculo para conselhos e previsões.',
  category: 'utils',
  usage: '!sorte',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    
    const tipo = tiposOraculo[Math.floor(Math.random() * tiposOraculo.length)];
    const oraculo = oraculos[Math.floor(Math.random() * oraculos.length)];
    const emoji = ['✨', '🌟', '💫', '⭐', '🔮', '🌙', '💎', '🌈'][Math.floor(Math.random() * 8)];
    
    const resposta = `${tipo}\n\n${oraculo}\n\n${emoji} *Que os astros te guiem!* ${emoji}`;
    
    await sock.sendMessage(message.key.remoteJid!, { text: resposta });
  },
};

export default sorteCommand; 