import { ICommand } from '@/interfaces/ICommand';
import { proto } from '@whiskeysockets/baileys';
import { MessageContext } from '@/handlers/message.handler';

const menusimplesCommand: ICommand = {
  name: 'menusimples',
  description: 'Lista todos os comandos de forma simples e organizada.',
  category: 'utils',
  usage: '!menusimples',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message } = context;
    const menuText = `* COMANDOS DA AMANDA v4.0.0 - MENU SIMPLES* 🤖

*🛠️ UTILITÁRIOS*
!menu | !menusimples | !ping | !status | !sticker | !coinflip | !resumo | !tempo | !weather | !teste

*🎉 DIVERSÃO & MEDIDORES*
!ppp | !fodeousome | !bafometro | !gaydometro | !cornometro | !sexyometro | !sorte | !crushometro | !nojoometro | !nerdometro | !velhaometro

*💕 RELACIONAMENTOS*
!par | !casal | !menage | !suruba

*🤖 IA & INTELIGÊNCIA*
!fofoca | !intriga

*👮 ADMINISTRAÇÃO*
!banir | !remover | !promover | !rebaixar | !silenciar | !liberar | !apagar | !desbanir | !admins | !todos | !boasvindas | !brincadeira

*📊 RANKING & ESTATÍSTICAS*
!topativos | !inativos | !novatos

*🎭 PERSONALIDADES*
!person | !personalidade

*⚙️ GERENCIAMENTO DE GRUPO*
!grupo | !comandos | !ia | !erros

*🔧 SISTEMA & CONFIGURAÇÕES*
!cache | !logs | !time | !feedback

*👑 COMANDOS DO DONO*
!dono | !usuarios | !sync

*💡 DICAS:*
• Use !menu para menu completo com submenus
• Use !person para ver todas as personalidades
• Comandos admin só funcionam para admins
• Alguns comandos têm cooldown de 30s
• Comandos do dono só para o proprietário

*Total: 50+ comandos disponíveis!* ✨`;

    await sock.sendMessage(message.key.remoteJid!, { text: menuText });
  },
};

export default menusimplesCommand; 