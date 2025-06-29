import { WASocket, proto } from '@whiskeysockets/baileys';
import { ICommand } from '@/interfaces/ICommand';
import { MessageContext } from '@/handlers/message.handler';

// FIX: Comando de teste para demonstrar mensagens de erro personalizadas
const testeCommand: ICommand = {
  name: 'teste',
  aliases: ['test', 'debug'],
  description: 'Comando de teste para demonstrar mensagens de erro personalizadas',
  category: 'utils',
  usage: '!teste [tipo_erro] [mensagem]',
  handle: async (context: MessageContext) => {
    const { sock, messageInfo: message, args } = context;
    try {
      const groupJid = message.key.remoteJid!;
      
      if (args.length === 0) {
        // FIX: Demonstrar comando funcionando
        await sock.sendMessage(groupJid, { 
          text: `🎉 *Teste funcionando!*\n\nOlá, baby! O comando !teste está funcionando perfeitamente! 💋\n\n_Use !teste timeout para testar mensagens de erro personalizadas._` 
        });
        return;
      }
      
      const errorType = args[0].toLowerCase();
      
      // FIX: Simular diferentes tipos de erro para demonstrar as mensagens
      switch (errorType) {
        case 'timeout':
          throw new Error('Timeout: Comando demorou mais de 30 segundos');
          
        case 'permission':
          throw new Error('Permission denied: Você não tem permissão para usar este comando');
          
        case 'notfound':
          throw new Error('Resource not found: Usuário não encontrado');
          
        case 'network':
          throw new Error('Network error: Falha na conexão com o servidor');
          
        case 'database':
          throw new Error('Database error: Erro ao acessar o banco de dados');
          
        case 'api':
          throw new Error('API error: Erro na API do Gemini');
          
        case 'rate':
          throw new Error('Rate limit exceeded: Too many requests');
          
        case 'unknown':
          throw new Error('Erro desconhecido e inesperado');
          
        default:
          await sock.sendMessage(groupJid, { 
            text: `🧪 *Tipos de erro disponíveis:*\n\n• timeout - Simula timeout\n• permission - Simula erro de permissão\n• notfound - Simula recurso não encontrado\n• network - Simula erro de rede\n• database - Simula erro de banco\n• api - Simula erro de API\n• rate - Simula rate limit\n• unknown - Simula erro desconhecido\n\n*Exemplo:* !teste timeout` 
          });
      }
      
    } catch (error) {
      // FIX: Este erro será capturado pelo wrapper e mostrará a mensagem personalizada da Amanda
      throw error;
    }
  },
};

// FIX: Exportar comando com validação
export default testeCommand; 