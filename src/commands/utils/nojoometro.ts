import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { getUserDisplayName } from '@/utils/userUtils';
import { MessageContext } from '@/handlers/message.handler';

const frasesNojometro = [
  '🤢 Nojento demais! Até as baratas estão com vergonha!',
  '🤮 Repulsivo! Nem os urubus te aguentam!',
  '💩 Fedido! O cheiro é insuportável!',
  '🦠 Contaminado! Precisa de isolamento!',
  '🧟 Zumbi! Você parece ter saído do túmulo!',
  '👹 Monstro! Assusta até os demônios!',
  '💀 Morto-vivo! Cheiro de cemitério!',
  '🦨 Gambá! O fedor é inconfundível!',
  '🐷 Porco! Vive na sujeira!',
  '🦠 Bactéria ambulante! Precisa de antibiótico!',
  '🧪 Experimento químico! Tudo que toca apodrece!',
  '🗑️ Lixeira humana! Acumula sujeira!',
  '🕷️ Aranha venenosa! Tóxico demais!',
  '🐍 Serpente! Veneno puro!',
  '🦂 Escorpião! Perigoso e nojento!',
  '🦠 Vírus mutante! Contamina tudo!',
  '🧫 Cultura de bactérias! Laboratório de nojo!',
  '💊 Overdose de nojo! Overdose de repulsa!',
  '🦠 Pandemia de nojo! Precisa de vacina!',
  '🧟‍♂️ Apocalipse zumbi! Você é o paciente zero!'
];

const nojoometroCommand: ICommand = {
  name: 'nojometro',
  aliases: ['nojoometro'],
  description: '🤢 Mede seu nível de nojo e repulsa.',
  category: 'utils',
  usage: '!nojometro',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const pct = Math.floor(Math.random() * 101);
    const jid = message.key.participant || message.key.remoteJid!;
    const groupJid = message.key.remoteJid!;
    
    const displayName = await getUserDisplayName(sock, jid, groupJid, message.pushName);
    const frase = frasesNojometro[Math.floor(Math.random() * frasesNojometro.length)];
    
    let resposta = `🤢 *Nojômetro Resultado*\n\n👤 @${displayName}\n📊 Nível de nojo: *${pct}%*\n\n${frase}`;
    
    // Adicionar emojis baseados na porcentagem
    if (pct >= 90) {
      resposta += '\n\n💀 *NÍVEL MÁXIMO:* Você é puro nojo! 💀';
    } else if (pct >= 70) {
      resposta += '\n\n🤮 *MUITO NOJENTO:* Precisa de banho urgente! 🤮';
    } else if (pct >= 50) {
      resposta += '\n\n🤢 *NOJENTO:* Tem que melhorar! 🤢';
    } else if (pct >= 30) {
      resposta += '\n\n😷 *FEDIDO:* Precisa de higiene! 😷';
    } else {
      resposta += '\n\n😊 *ACEITÁVEL:* Até que não é tão ruim! 😊';
    }
    
    await sock.sendMessage(message.key.remoteJid!, { text: resposta, mentions: [jid] });
  },
};

export default nojoometroCommand; 