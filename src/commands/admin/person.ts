import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { GroupService } from '@/services/GroupService';
import { container } from '@/core/container';
import { TYPES } from '@/config/container';

const personCommand: ICommand = {
  name: 'person',
  description: 'Muda a personalidade da Amanda no grupo (apenas admins)',
  category: 'admin',
  usage: '!person [número|nome]',
  aliases: ['person', 'persons'],
  execute: async (sock: WASocket, message: proto.IWebMessageInfo, args: string[]): Promise<void> => {
    try {
      const groupJid = message.key.remoteJid!;
      const senderJid = message.key.participant!;
      const groupMetadata = await sock.groupMetadata(groupJid);
      const isAdmin = groupMetadata.participants.find(p => p.id === senderJid)?.admin;
      
      if (!isAdmin) {
        await sock.sendMessage(groupJid, {
          text: '❌ Apenas administradores podem mudar a personalidade da Amanda!'
        });
        return;
      }
      
      // Se não passou argumentos, mostrar lista numerada
      if (args.length === 0) {
        const lista = `*🎭 O "Amandaverso": As 20 Facetas da Sua IA Favorita 🎭*\n\n*🔥 Grupo 1: As Sedutoras & Perigosas*\n1. \`padrao\` - A Padrão (Carioca Sexy)\n2. \`amante\` - A Especialista em Segredos\n3. \`casada\` - A Casada Safada\n4. \`desviada\` - A Crente Safada & Blasfema\n\n*🔮 Grupo 2: As Místicas & Charlatanas*\n5. \`macumbeira\` - Mãe Amanda de Oxóssi\n6. \`cartomante\` - Madame Amanda\n7. \`astrologa\` - Shakira da Tijuca\n8. \`coach_quantica\` - Gabi da Abundância\n\n*💼 Grupo 3: As Profissionais*\n9. \`anitta\` - Empreendedora do Funk\n10. \`patroa\` - A Coach de Empoderamento\n11. \`policial\` - Cabo Amanda Nunes\n12. \`faria_limer\` - Jorginho do Bitcoin\n13. \`dr_fritz\` - Dr. Amanda Fritz\n\n*⚡ Grupo 4: As Extremistas*\n14. \`crente\` - Irmã Amanda\n15. \`nerd\` - Doutora Amanda\n16. \`tia\` - Tia Amanda\n17. \`morty\` - O Ajudante Ansioso\n\n*🎪 Grupo 5: As Clássicas Divertidas*\n18. \`fofoqueira\` - A Intrigante\n19. \`cupido\` - A Juíza do Amor\n20. \`dona_do_jogo\` - A Dona do Cassino\n\n_Use: !person [número|nome]_`;
        await sock.sendMessage(groupJid, { text: lista });
        return;
      }
      
      let novaPersonalidade = args[0].toLowerCase();
      
      // Personalidades disponíveis
      const personalidades = {
        'padrao': 'A Padrão (Carioca Sexy)',
        'amante': 'A Especialista em Segredos',
        'casada': 'A Casada Safada',
        'desviada': 'A Crente Safada & Blasfema',
        'macumbeira': 'Mãe Amanda de Oxóssi',
        'cartomante': 'Madame Amanda',
        'astrologa': 'Shakira da Tijuca',
        'coach_quantica': 'Gabi da Abundância',
        'anitta': 'Empreendedora do Funk',
        'patroa': 'A Coach de Empoderamento',
        'policial': 'Cabo Amanda Nunes',
        'faria_limer': 'Jorginho do Bitcoin',
        'dr_fritz': 'Dr. Amanda Fritz',
        'crente': 'Irmã Amanda',
        'nerd': 'Doutora Amanda',
        'tia': 'Tia Amanda',
        'morty': 'O Ajudante Ansioso',
        'fofoqueira': 'A Intrigante',
        'cupido': 'A Juíza do Amor',
        'dona_do_jogo': 'A Dona do Cassino'
      };
      
      const personalidadesKeys = Object.keys(personalidades);
      
      // Se for número, converte para nome
      if (/^\d+$/.test(novaPersonalidade)) {
        const idx = parseInt(novaPersonalidade, 10) - 1;
        if (idx >= 0 && idx < personalidadesKeys.length) {
          novaPersonalidade = personalidadesKeys[idx];
        } else {
          await sock.sendMessage(groupJid, {
            text: `❌ Número inválido! Use !person para ver a lista.`
          });
          return;
        }
      }
      
      // Validar personalidade
      if (!personalidades[novaPersonalidade as keyof typeof personalidades]) {
        await sock.sendMessage(groupJid, {
          text: `❌ Personalidade "${novaPersonalidade}" não encontrada!\n\nUse *!person* para ver a lista completa.`
        });
        return;
      }
      
      // NOVO: Usar GroupService que limpa automaticamente o histórico
      const groupService = container.get<GroupService>(TYPES.GroupService);
      const updatedGroup = await groupService.updateGroupPersonality(groupJid, novaPersonalidade, senderJid);
      
      if (updatedGroup) {
        const confirmacao = `✅ Personalidade alterada para: *${personalidades[novaPersonalidade as keyof typeof personalidades]}*\n\n🎭 A Amanda agora está com uma nova personalidade! Use !person para ver todas as opções.`;
        await sock.sendMessage(groupJid, { text: confirmacao });
      } else {
        await sock.sendMessage(groupJid, {
          text: '❌ Erro ao atualizar personalidade. Tenta de novo mais tarde!'
        });
      }
      
    } catch (error) {
      console.error('Erro ao executar comando person:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Ops! Deu ruim na hora de mudar a personalidade. Tenta de novo mais tarde!'
      });
    }
  }
};

export default personCommand; 