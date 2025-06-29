import { ICommand } from '@/interfaces/ICommand';
import { WASocket, proto } from '@whiskeysockets/baileys';
import { MessageContext } from '@/handlers/message.handler';

const menuTextBase = `🌸 *Amanda v4.0.0* 🌸\n_Sua sexy sex worker favorita no WhatsApp_\n\n*Criada por:* Orion\n\n💡 *Para falar comigo:*\n• Mencione @5521971200821\n• Ou responda a uma das minhas mensagens\n\n`;

const subMenus = `\n*📋 Submenus Disponíveis:*\n• *!menu 1* — 👮‍♀️ Administração/Moderação\n• *!menu 2* — 🎭 Personalidades da Amanda\n• *!menu 3* — 🛠️ Utilitários\n• *!menu 4* — 🎉 Diversão e Brincadeiras\n• *!menu 5* — 💕 Relacionamentos\n• *!menu 6* — 🤖 Inteligência Artificial\n• *!menu 7* — 📊 Atividade e Ranking\n• *!menu 8* — ⚙️ Gerenciamento de Grupo\n• *!menu 9* — 🔧 Sistema e Configurações\n• *!menu 10* — 📝 Todos os comandos\n\n_Digite o número do submenu para ver os comandos dessa categoria!_`;

const brincadeiras = `\n*🎉 Brincadeiras:*\n• *!coinflip* — Cara ou coroa\n• *!bafometro* — Mede seu nível de álcool\n• *!gaydometro* — Mede quanto por cento gay você é\n• *!cornometro* — Mede nível de corno\n• *!sexometro* — Mede nível de sensualidade\n• *!sorte* — Consulta o oráculo para conselhos\n• *!crushometro @user* — Mede chance com crush\n• *!nojometro* — Mede nível de nojo\n• *!nerdometro* — Mede nível de nerd\n• *!idademental* — Mede idade mental`;

// Função para obter submenu específico
function getSubMenu(subMenuNumber: string): string {
  switch (subMenuNumber) {
    case '1':
      return `${menuTextBase}👮‍♀️ *Administração/Moderação*\n\n• *!banir @user* — 🚫 Bane um usuário do grupo\n• *!remover @user* — 👋 Remove um usuário do grupo\n• *!promover @user* — ⬆️ Promove um usuário a admin\n• *!rebaixar @user* — ⬇️ Remove admin de um usuário\n• *!silenciar* — 🔇 Restringe mensagens (só admins)\n• *!liberar* — 🔊 Libera mensagens (todos podem falar)\n• *!apagar* — 🗑️ Apaga todas as mensagens do grupo\n• *!desbanir @user* — ✅ Remove ban de um usuário\n• *!admins* — 👥 Lista todos os admins do grupo\n• *!todos [mensagem]* — 📢 Marca todos os membros do grupo\n• *!boasvindas* — 🎉 Gerencia mensagens de boas-vindas\n• *!brincadeira* — 🎮 Sistema de brincadeiras e jogos\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '2':
      return `${menuTextBase}🎭 *Personalidades da Amanda*\n\n• *!person* — 📋 Lista todas as personalidades disponíveis\n• *!person [número]* — 🔄 Muda a personalidade da Amanda\n• *!personalidade* — 👀 Mostra a personalidade ativa\n\n*🎪 Personalidades disponíveis:*\n1. 🥵 Padrão (Carioca Sexy)\n2. 💋 Amante (Especialista em Segredos)\n3. 💍 Casada Safada\n4. 🙏 Desviada (Crente Safada)\n5. 🔮 Macumbeira\n6. 🃏 Cartomante\n7. ⭐ Astróloga\n8. 🌟 Coach Quântica\n9. 🎤 Anitta\n10. 👑 Patroa\n11. 👮 Policial\n12. 💰 Faria Limer\n13. 🧠 Dr. Fritz\n14. ✝️ Crente\n15. 🤓 Nerd\n16. 🧪 Morty\n17. 🗣️ Fofoqueira\n18. 💘 Cupido\n19. 🎮 Dona do Jogo\n20. 🤖 Amanda\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '3':
      return `${menuTextBase}🛠️ *Utilitários*\n\n• *!menu* — 📋 Exibe este menu de comandos\n• *!menusimples* — 📝 Lista todos os comandos de forma simples\n• *!ping* — 🏓 Testa a latência do bot\n• *!status* — 📊 Mostra o status do bot\n• *!sticker* — 🖼️ Cria um sticker de uma imagem\n• *!coinflip* — 🪙 Cara ou coroa\n• *!resumo* — 📈 Resumo das últimas 24h do grupo\n• *!tempo* — 🌤️ Previsão do tempo\n• *!weather* — 🌦️ Clima (em inglês)\n• *!teste* — 🧪 Testa funcionalidades do bot\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '4':
      return `${menuTextBase}🎉 *Diversão e Brincadeiras*\n\n• *!ppp* — 🎯 Pega, pensa e passa (sorteia 3 pessoas para o clássico)\n• *!fodeousome* — 🔥 Modo hardcore: pergunta quente para um alvo aleatório ou marcado\n• *!bafometro* — 🍺 Mede seu nível de álcool com frases divertidas\n• *!gaydometro* — 🌈 Mede quanto por cento gay você é (aleatório)\n• *!cornometro* — 🦌 Mede nível de corno aleatório\n• *!sexometro* — 💋 Mede nível de sensualidade e charme\n• *!sorte* — 🔮 Consulta o oráculo para conselhos e previsões\n• *!crushometro @user* — 💘 Mede chance com crush (usuário marcado)\n• *!nojometro* — 🤢 Mede nível de nojo e repulsa\n• *!nerdometro* — 🤓 Mede nível de nerd aleatório\n• *!idademental* — 🧠 Mede idade mental e maturidade\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '5':
      return `${menuTextBase}💕 *Relacionamentos*\n\n• *!par* — 👫 Marca 2 pessoas aleatórias do grupo para formar um par\n• *!casal* — 💑 Marca 2 pessoas aleatórias do grupo para formar um casal\n• *!menage* — 🔥 Marca 3 pessoas aleatórias do grupo para um ménage\n• *!suruba* — 🎉 Marca 5 pessoas aleatórias do grupo para transar com você\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '6':
      return `${menuTextBase}🤖 *Inteligência Artificial*\n\n• *!fofoca* — 🗣️ Gera uma fofoca aleatória e maliciosa envolvendo membros do grupo\n• *!intriga* — 🔥 Alias para o comando fofoca\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '7':
      return `${menuTextBase}📊 *Atividade e Ranking*\n\n• *!topativos [dias]* — 🏆 Mostra os membros mais ativos do grupo nos últimos X dias (padrão 7, máximo 30)\n• *!inativos [dias]* — 😴 Mostra membros que não enviaram mensagem nos últimos X dias (padrão 7, máximo 30)\n• *!novatos [dias]* — 🆕 Mostra membros que entraram no grupo nos últimos X dias (padrão 7, máximo 30)\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '8':
      return `${menuTextBase}⚙️ *Gerenciamento de Grupo*\n\n• *!grupo* — 📊 Mostra estatísticas detalhadas do grupo\n• *!comandos* — ⚙️ Gerencia comandos ativos/desabilitados no grupo\n• *!ia* — 🤖 Gerencia configurações da IA no grupo\n• *!erros* — 🚨 Mostra erros recentes do grupo\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '9':
      return `${menuTextBase}🔧 *Sistema e Configurações*\n\n• *!cache* — 💾 Gerencia cache do sistema\n• *!logs* — 📋 Mostra logs do sistema\n• *!time* — ⏰ Sistema de tempo e agendamento\n• *!feedback* — 💬 Envia feedback sobre o bot\n\n*👑 Comandos do Dono:*\n• *!dono* — 👑 Painel de controle do dono\n• *!usuarios* — 👥 Gerencia usuários do sistema\n• *!sync* — 🔄 Sincroniza todos os grupos\n\n_Use: !menu para voltar ao menu principal_`;
    
    case '10':
      return `${menuTextBase}📝 *Todos os Comandos*\n\n🛠️ *Utilitários:* !menu, !menusimples, !ping, !status, !sticker, !coinflip, !resumo, !tempo, !weather, !teste\n\n🎉 *Diversão:* !ppp, !fodeousome, !bafometro, !gaydometro, !cornometro, !sexometro, !sorte, !crushometro, !nojometro, !nerdometro, !idademental\n\n💕 *Relacionamentos:* !par, !casal, !menage, !suruba\n\n🤖 *IA:* !fofoca, !intriga\n\n👮‍♀️ *Admin:* !banir, !remover, !promover, !rebaixar, !silenciar, !liberar, !apagar, !desbanir, !admins, !boasvindas, !brincadeira\n\n📊 *Ranking:* !topativos, !inativos, !novatos\n\n🎭 *Personalidades:* !person, !personalidade\n\n⚙️ *Gerenciamento:* !grupo, !comandos, !ia, !erros\n\n🔧 *Sistema:* !cache, !logs, !time, !feedback\n\n👑 *Dono:* !dono, !usuarios, !sync\n\n_Use: !menu para voltar ao menu principal_`;
    
    default:
      return `${menuTextBase}❌ *Submenu não encontrado!*\n\n${subMenus}`;
  }
}

const menuCommand: ICommand = {
  name: 'menu',
  aliases: ['help', 'ajuda'],
  description: 'Exibe o menu de comandos e informações do bot.',
  category: 'utils',
  usage: '!menu [número_do_submenu]',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message, args } = context;
    const groupJid = message.key.remoteJid!;
    
    // Se passou argumento, mostrar submenu específico
    if (args.length > 0) {
      const subMenuText = getSubMenu(args[0]);
      await sock.sendMessage(groupJid, { text: subMenuText });
      return;
    }
    
    // Menu principal (sem top 5 comandos)
    const menuText = `${menuTextBase}${subMenus}\n\n_Sempre pronta pra te ajudar, cria!_ 😏✨`;
    await sock.sendMessage(groupJid, { text: menuText });
  },
};

export default menuCommand; 