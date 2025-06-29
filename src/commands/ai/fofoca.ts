import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { AIService } from '@/services/AIService';
import { injectable, inject } from 'inversify';
import { TYPES } from '@/config/container';

type WAMessage = proto.IWebMessageInfo;

@injectable()
export class FofocaCommand implements IInjectableCommand {
    public name = 'fofoca';
    public description = '🤫 Gera uma fofoca aleatória com IA (com cooldown de 30s)';
    public aliases = ['fofoca', 'gossip', 'chisme'];
    public category = 'ai' as const;
    public usage = '!fofoca';
    public cooldown = 30; // 30 segundos de cooldown

    constructor(
        @inject(TYPES.AIService) private aiService: AIService
    ) {}

    public async execute(sock: WASocket, message: WAMessage, args: string[]): Promise<void> {
        const userJid = message.key.participant || message.key.remoteJid!;
        const groupJid = message.key.remoteJid;
        
        // Usar o AIService injetado para gerar fofoca
        const prompt = `Crie uma fofoca engraçada e maliciosa sobre o grupo, usando linguagem carioca e sendo debochada. A fofoca deve ser obviamente uma mentira absurda e engraçada.`;
        
        try {
            const senderInfo = {
                jid: userJid,
                number: userJid.split('@')[0],
                name: message.pushName || 'Usuário',
                isGroup: groupJid?.endsWith('@g.us') || false,
                groupJid: groupJid?.endsWith('@g.us') ? groupJid : undefined,
                groupName: 'Grupo',
                timestamp: Date.now(),
                messageType: 'textMessage'
            };

            const fofoca = await this.aiService.getChatResponse({
                jid: groupJid || userJid,
                text: prompt,
                senderInfo
            });

            if (fofoca) {
                await sock.sendMessage(message.key.remoteJid!, {
                    text: `${fofoca}\n\n💡 *Dica:* Este comando tem cooldown de 30s para evitar spam! ⏱️`
                });
            } else {
                // Fallback se a IA falhar
                const fofocasFallback = [
                    "🤫 *Fofoca do dia:* Aquele cara do grupo tá dando em cima de 3 pessoas ao mesmo tempo! 😱",
                    "💭 *Fofoca quente:* Tem gente que só fica online pra stalkear ex! 👀",
                    "😏 *Fofoca bombástica:* Alguém do grupo tá usando filtro em todas as fotos! 📸",
                    "🤭 *Fofoca secreta:* Tem gente que só responde mensagem depois de 2 horas de propósito! ⏰"
                ];
                
                const fofocaFallback = fofocasFallback[Math.floor(Math.random() * fofocasFallback.length)];
                
                await sock.sendMessage(message.key.remoteJid!, {
                    text: `${fofocaFallback}\n\n💡 *Dica:* Este comando tem cooldown de 30s para evitar spam! ⏱️`
                });
            }
        } catch (error) {
            console.error('Erro ao gerar fofoca:', error);
            await sock.sendMessage(message.key.remoteJid!, {
                text: '❌ *Erro ao gerar fofoca*\n\nOpa, deu ruim na hora de criar a fofoca! Tenta de novo mais tarde! 😅 Se não funcionar, chama o meu criador: +55 21 6723-3931 - ele vai resolver! 🔧'
            });
        }
    }
} 