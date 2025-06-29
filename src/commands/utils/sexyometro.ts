import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { getUserDisplayName } from '@/utils/userUtils';
import { MessageContext } from '@/handlers/message.handler';

const frasesSexometro = [
  '🔥 Incendiário! Você está queimando os olhos de todos!',
  '💋 Sensual demais! Até as pedras estão se derretendo!',
  '😍 De tirar o fôlego! Ninguém consegue te ignorar!',
  '💃 Dançando na linha entre sexy e perigoso!',
  '🌟 Brilhando como uma estrela! Todo mundo te admira!',
  '💎 Precioso! Você é uma joia rara!',
  '🎭 Personagem principal! Todos os olhos estão em você!',
  '✨ Mágico! Você tem um poder de sedução único!',
  '💫 Hipnotizante! Ninguém consegue desviar o olhar!',
  '🌹 Romântico e sensual! A combinação perfeita!',
  '💕 Fofo e sexy! A dupla dinâmica!',
  '🎪 Show de talentos! Você é o centro das atenções!',
  '💃 Bailarina sensual! Movimentos que hipnotizam!',
  '🎭 Ator/atriz nato! Você nasceu para brilhar!',
  '🌟 Celebridade! Você tem presença de estrela!',
  '💎 Diamante bruto! Brilho natural e irresistível!',
  '🔥 Fogo no palco! Você é pura energia!',
  '💋 Beijo mortal! Quem te beija nunca esquece!',
  '😍 Olhar assassino! Mata com os olhos!',
  '✨ Mágico! Você tem poderes sobrenaturais de sedução!'
];

const sexyometroCommand: ICommand = {
  name: 'sexometro',
  aliases: ['sexyometro', 'sexymetro'],
  description: '💋 Mede seu nível de sensualidade e charme.',
  category: 'utils',
  usage: '!sexometro',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const pct = Math.floor(Math.random() * 101);
    const jid = message.key.participant || message.key.remoteJid!;
    const groupJid = message.key.remoteJid!;
    
    const displayName = await getUserDisplayName(sock, jid, groupJid, message.pushName);
    const frase = frasesSexometro[Math.floor(Math.random() * frasesSexometro.length)];
    
    let resposta = `💋 *Sexômetro Resultado*\n\n👤 @${displayName}\n📊 Nível de sexy: *${pct}%*\n\n${frase}`;
    
    // Adicionar emojis baseados na porcentagem
    if (pct >= 90) {
      resposta += '\n\n🔥 *NÍVEL MÁXIMO:* Você é puro fogo! 🔥';
    } else if (pct >= 70) {
      resposta += '\n\n💎 *MUITO SEXY:* Você é uma joia rara! 💎';
    } else if (pct >= 50) {
      resposta += '\n\n✨ *SEXY:* Você tem seu charme! ✨';
    } else if (pct >= 30) {
      resposta += '\n\n😊 *BONITO:* Tem potencial! 😊';
    } else {
      resposta += '\n\n🤗 *FOFINHO:* Carisma é o que importa! 🤗';
    }
    
    await sock.sendMessage(message.key.remoteJid!, { text: resposta, mentions: [jid] });
  },
};

export default sexyometroCommand; 