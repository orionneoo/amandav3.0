import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { Group } from '@/database/models/GroupSchema';
import { MessageContext } from '@/handlers/message.handler';

const personalidadeCommand: ICommand = {
  name: 'personalidade',
  description: '🎭 Mostra a personalidade ativa da Amanda no grupo',
  aliases: ['mood', 'persona'],
  category: 'utils',
  usage: '!personalidade',
  cooldown: 10,
  handle: async (context: MessageContext): Promise<void> => {
    const { sock, messageInfo: message } = context;
    const groupJid = message.key.remoteJid;
    
    try {
      if (!groupJid?.endsWith('@g.us')) {
        await sock.sendMessage(message.key.remoteJid!, {
          text: '❌ Este comando só funciona em grupos!'
        });
        return;
      }

      // FIX: Usar Group.findOne com fallback para personalidade padrão
      const group = await Group.findOne({ groupJid });
      const activePersonality = group?.activePersonality || 'padrao';
      
      // Mapa de personalidades para nomes amigáveis
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

      const nomePersonalidade = personalidades[activePersonality as keyof typeof personalidades] || 'Desconhecida';
      
      // Informações adicionais
      let infoAdicional = '';
      
      if (group?.lastPersonalityChange) {
        const data = new Date(group.lastPersonalityChange);
        const dataFormatada = data.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        infoAdicional += `\n🕐 *Alterada em:* ${dataFormatada}`;
      }
      
      if (group?.changedBy) {
        const adminNumber = group.changedBy.split('@')[0];
        infoAdicional += `\n👤 *Por:* ${adminNumber}`;
      }
      
      const mensagem = `🎭 *PERSONALIDADE ATIVA*\n\n` +
        `*${nomePersonalidade}*\n` +
        `🔑 Código: \`${activePersonality}\`` +
        infoAdicional +
        `\n\n💡 Use *!person* para alterar a personalidade!`;
      
      await sock.sendMessage(groupJid, { text: mensagem });
      
    } catch (error) {
      console.error('Erro ao executar comando personalidade:', error);
      await sock.sendMessage(message.key.remoteJid!, {
        text: '❌ Ops! Deu ruim na hora de verificar a personalidade. Tenta de novo mais tarde!'
      });
    }
  }
};

export default personalidadeCommand; 