import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const frasesBafometro = [
  // 0.0 - 0.5% (Sóbrio)
  {
    min: 0.0,
    max: 0.5,
    frases: [
      '🍃 Totalmente sóbrio! Nem uma gota de álcool detectada.',
      '💧 Água pura! Seu sangue está mais limpo que filtro de barro.',
      '🧊 Zero álcool! Você é a definição de responsabilidade.',
      '🌱 Sóbrio como um monge! Nem cheiro de álcool.',
      '💎 Cristalino! Seu nível de álcool é praticamente inexistente.'
    ]
  },
  // 0.6 - 1.5% (Levemente alterado)
  {
    min: 0.6,
    max: 1.5,
    frases: [
      '🍺 Levemente alterado! Uma cervejinha não faz mal a ninguém.',
      '🥤 Um pouquinho alegre! Mas ainda consegue andar em linha reta.',
      '🍷 Sabor de vinho na boca! Mas nada que comprometa.',
      '🥃 Um shot de coragem! Mas ainda está no controle.',
      '🍹 Coquetel leve! Ainda dá pra conversar normalmente.'
    ]
  },
  // 1.6 - 3.0% (Alterado)
  {
    min: 1.6,
    max: 3.0,
    frases: [
      '🍻 Bebeu um pouco! Já está mais solto e desinibido.',
      '🥴 Levemente bêbado! As piadas estão mais engraçadas.',
      '😄 Alegre! O álcool já está fazendo efeito.',
      '🎉 Festa começando! Já está mais extrovertido.',
      '🍾 Desinibido! O álcool está soltando a língua.'
    ]
  },
  // 3.1 - 5.0% (Bêbado)
  {
    min: 3.1,
    max: 5.0,
    frases: [
      '🤪 Bêbado! Já está falando besteira e rindo de tudo.',
      '😵‍💫 Alterado! O mundo está girando um pouquinho.',
      '🎭 Personagem novo! O álcool mudou sua personalidade.',
      '🤡 Palhaço da festa! Está fazendo todos rirem.',
      '💃 Dançando sozinho! O álcool liberou o dançarino interior.'
    ]
  },
  // 5.1 - 7.0% (Muito bêbado)
  {
    min: 5.1,
    max: 7.0,
    frases: [
      '🥴 Muito bêbado! Já está falando sozinho e abraçando estranhos.',
      '🤯 Alterado demais! Nem lembra mais o próprio nome.',
      '🎪 Circo na cabeça! Está fazendo acrobacias perigosas.',
      '🚀 Foguete! Já está no espaço, literalmente.',
      '🌪️ Tornado humano! Destruindo tudo por onde passa.'
    ]
  },
  // 7.1 - 10.0% (Perigosamente bêbado)
  {
    min: 7.1,
    max: 10.0,
    frases: [
      '🚨 PERIGO! Nível crítico de álcool detectado!',
      '💀 Quase morto! Ou pelo menos parece que está.',
      '🏥 Ambulância! Precisa de ajuda médica urgente.',
      '⚰️ RIP! Já pode preparar o caixão.',
      '🆘 SOS! Está em estado vegetativo alcoólico.'
    ]
  },
  // 10.1%+ (Coma alcoólico)
  {
    min: 10.1,
    max: 15.0,
    frases: [
      '💀 COMA ALCOÓLICO! Ligue 192 imediatamente!',
      '🏥 HOSPITAL AGORA! Nível mortal de álcool!',
      '⚰️ R.I.P. em paz! Já era, amigo.',
      '🚑 UTI! Precisa de ressuscitação.',
      '💊 Overdose alcoólica! Estado crítico!'
    ]
  }
];

const bafometroCommand: ICommand = {
  name: 'bafometro',
  aliases: ['bafômetro', 'bafometro'],
  description: '🍻 Mede seu nível de álcool com frases divertidas.',
  category: 'utils',
  usage: '!bafometro',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    
    // Gerar nível mais realista (maior chance de níveis baixos)
    const random = Math.random();
    let nivel: number;
    
    if (random < 0.4) {
      // 40% chance de estar sóbrio (0.0 - 0.5)
      nivel = Math.random() * 0.5;
    } else if (random < 0.7) {
      // 30% chance de leve alteração (0.6 - 1.5)
      nivel = 0.6 + Math.random() * 0.9;
    } else if (random < 0.85) {
      // 15% chance de alterado (1.6 - 3.0)
      nivel = 1.6 + Math.random() * 1.4;
    } else if (random < 0.95) {
      // 10% chance de bêbado (3.1 - 5.0)
      nivel = 3.1 + Math.random() * 1.9;
    } else if (random < 0.98) {
      // 3% chance de muito bêbado (5.1 - 7.0)
      nivel = 5.1 + Math.random() * 1.9;
    } else {
      // 2% chance de perigosamente bêbado (7.1 - 10.0)
      nivel = 7.1 + Math.random() * 2.9;
    }
    
    const nivelFormatado = nivel.toFixed(1);
    const numero = message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid?.split('@')[0];
    const jid = message.key.participant || message.key.remoteJid;
    
    // Encontrar frase apropriada
    const categoria = frasesBafometro.find(cat => nivel >= cat.min && nivel <= cat.max);
    const frase = categoria ? categoria.frases[Math.floor(Math.random() * categoria.frases.length)] : 'Erro no bafômetro!';
    
    let resposta = `🍻 *Bafômetro Resultado*\n\n👤 @${numero}\n📊 Nível de álcool: *${nivelFormatado}%*\n\n${frase}`;
    
    // Adicionar avisos para níveis altos
    if (nivel > 5.0) {
      resposta += '\n\n🚨 *ATENÇÃO:* Não dirija! Chame um Uber ou peça carona!';
    }
    if (nivel > 7.0) {
      resposta += '\n\n🏥 *URGENTE:* Procure ajuda médica imediatamente!';
    }
    
    await sock.sendMessage(message.key.remoteJid!, { text: resposta, mentions: [jid!] });
  },
};

export default bafometroCommand; 