import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';

type WAMessage = proto.IWebMessageInfo;

const sortes = [
  'Hoje é um bom dia para tentar algo novo!',
  'Evite prometer o que não pode cumprir.',
  'Sorte de hoje: alguém vai te surpreender.',
  'Cuidado com gente falsa, mas não perca a fé.',
  'Seu esforço será recompensado em breve.',
  'A sorte sorri para quem não desiste.',
  'Seja ousado, mas não imprudente.',
  'O universo está conspirando a seu favor.',
  'Aproveite as pequenas alegrias do dia.',
  'Confie mais em você mesmo.'
];

const sorteCommand: ICommand = {
  name: 'sorte',
  description: 'Dá um conselho ou sorte do dia.',
  category: 'utils',
  usage: '!sorte',
  execute: async (sock: WASocket, message: WAMessage) => {
    const frase = sortes[Math.floor(Math.random() * sortes.length)];
    await sock.sendMessage(message.key.remoteJid!, { text: `🔮 ${frase} ✨` });
  },
};

export default sorteCommand; 