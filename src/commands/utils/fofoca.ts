import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

const fofocaCommand: ICommand = {
  name: 'fofoca',
  description: '🤫 Gera uma fofoca aleatória e maliciosa',
  aliases: ['fofoca', 'gossip', 'chisme'],
  category: 'utils',
  usage: '!fofoca',
  cooldown: 30,
  handle: async (context: MessageContext): Promise<void> => {
    const { sock, messageInfo: message } = context;
    const groupJid = message.key.remoteJid;
    
    const fofocasFallback = [
      "🤫 *Fofoca do dia:* Aquele cara do grupo tá dando em cima de 3 pessoas ao mesmo tempo! 😱",
      "💭 *Fofoca quente:* Tem gente que só fica online pra stalkear ex! 👀",
      "😏 *Fofoca bombástica:* Alguém do grupo tá usando filtro em todas as fotos! 📸",
      "🤭 *Fofoca secreta:* Tem gente que só responde mensagem depois de 2 horas de propósito! ⏰",
      "🔥 *Fofoca explosiva:* Alguém do grupo tá namorando escondido há 6 meses! 💔",
      "😈 *Fofoca maligna:* Tem gente que só fica online pra ver stories dos outros! 📱",
      "🎭 *Fofoca teatral:* Alguém do grupo tá fingindo que tá rico nas redes sociais! 💸",
      "🤡 *Fofoca cômica:* Tem gente que só responde mensagem quando tá bêbado! 🍺"
    ];
    
    const fofocaFallback = fofocasFallback[Math.floor(Math.random() * fofocasFallback.length)];
    
    await sock.sendMessage(groupJid!, {
      text: `${fofocaFallback}\n\n💡 *Dica:* Este comando tem cooldown de 30s para evitar spam! ⏱️`
    });
  },
};

export default fofocaCommand; 