import { WASocket, proto } from '@whiskeysockets/baileys';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { getRandomInt } from '../../utils/random';
import { AIService } from '@/services/AIService';
import { injectable, inject } from 'inversify';
import { getUserDisplayName } from '@/utils/userUtils';
import { TYPES } from '@/config/container';
import { MessageContext } from '@/handlers/message.handler';

type WAMessage = proto.IWebMessageInfo;

// Tipos
interface GroupParticipant {
    id: string;
    admin?: "admin" | "superadmin" | null | undefined;
}

// Funções auxiliares
function selecionarParticipantesAleatorios(participants: any[], quantidade: number): string[] {
    const selecionados: string[] = [];
    const participantesDisponiveis = [...participants];
    
    while (selecionados.length < quantidade && participantesDisponiveis.length > 0) {
        const randomIndex = Math.floor(Math.random() * participantesDisponiveis.length);
        const participante = participantesDisponiveis.splice(randomIndex, 1)[0];
        selecionados.push(participante.id);
    }
    
    return selecionados;
}

function formatarNomesParaMencao(participants: string[]): string {
    return participants.map(p => '@' + p.split('@')[0]).join(', ');
}

function gerarPromptIntriga(participants: string[]): string {
    const nomes = formatarNomesParaMencao(participants);
    
    return `Atenção, Amanda! Acabou de chegar uma intriga quentíssima na sua mesa. Crie uma história bem sensual e provocativa, com muito fogo e putaria, envolvendo as seguintes pessoas do grupo: ${nomes}.

REGRAS PARA A INTRIGA SEXUAL:
1. Seja Criativa e Exagerada: A história tem que ser obviamente uma mentira absurda e muito sensual. Pense em cenários picantes e provocativos.
2. Use Linguajar Carioca e Provocador: Use gírias como 'caô', 'parada', 'mermão', 'papo reto', mas também termos sensuais e provocativos.
3. Marque os Envolvidos: Sempre mencione os nomes das pessoas com '@'.
4. Cenários Sugeridos (use sua criatividade para misturá-los):
    - Algo que aconteceu numa festa e ninguém lembra direito (mas foi bem quente)
    - Um encontro secreto em local inusitado
    - Um plano para dominar o grupo de forma sensual
    - Um triângulo amoroso bem quente e cômico
    - Uma competição de sedução entre eles
    - Um desafio sexual bizarro
    - Uma aposta que saiu do controle
5. Seja Provocativa: Use linguagem sensual, mas mantenha o humor. Seja debochada e provocante.
6. Finalize com um Tom de "não sei de nada": Termine a intriga com uma frase que tira o seu da reta, como 'Só sei que foi assim', 'Me contaram, só repasso', ou 'Contei e saí correndo'.

PESSOAS DESTA INTRIGA: ${nomes}

Agora, solta o fogo! 🔥💋`;
}

@injectable()
export class IntrigaCommand implements IInjectableCommand {
    public name = 'intriga';
    public description = 'Gera uma intriga sexual e provocativa envolvendo membros do grupo';
    public category = 'ai' as const;
    public usage = '!intriga';
    public cooldown = 30;
    public aliases = ['intriga'];

    constructor(
        @inject(TYPES.AIService) private aiService: AIService
    ) {}

    public async handle(context: MessageContext): Promise<void> {
        const { sock, messageInfo: message, from: groupJid, isGroup } = context;
        try {
            if (!isGroup) {
                await sock.sendMessage(groupJid, { text: 'Este comando só funciona em grupos.' });
                return;
            }
            
            // 1. Obter metadados do grupo
            const groupMetadata = await sock.groupMetadata(groupJid);
            const participants = groupMetadata.participants;
            
            // 2. Selecionar participantes aleatórios
            const numParticipants = getRandomInt(1, 4);
            const selectedParticipants = selecionarParticipantesAleatorios(participants, numParticipants);
            
            // 3. Gerar prompt para a IA
            const prompt = gerarPromptIntriga(selectedParticipants);
            
            // 4. Criar senderInfo para a IA
            const senderInfo = {
                name: message.pushName || 'Usuário',
                number: message.key.participant?.split('@')[0] || 'unknown',
                jid: message.key.participant || 'unknown@whatsapp.net',
                isGroup: true,
                groupJid: groupJid,
                groupName: groupMetadata.subject,
                timestamp: Date.now(),
                messageType: 'textMessage'
            };
            
            // 5. Gerar intriga com IA
            const aiContext = {
                jid: groupJid,
                text: prompt,
                senderInfo
            };
            const resposta = await this.aiService.getChatResponse(aiContext);
            const intriga = resposta ||
                `🔥 BOMBA! INTRIGA SEXUAL EXCLUSIVA DA CENTRAL AMANDA! 🔥\n\nMermão, cês não tão ligados no caô que chegou aqui pra mim! [Intriga sexual gerada pela IA aqui]\n\nMe contaram, só repasso, tá, meus anjos? Não me metam nisso! 💋`;
            
            // FIX: Marcar corretamente os usuários no texto
            let intrigaComMencao = intriga;
            for (const participantJid of selectedParticipants) {
                const displayName = await getUserDisplayName(sock, participantJid, groupJid);
                const numberOnly = participantJid.split('@')[0];
                // Substitui o número pela marcação correta
                intrigaComMencao = intrigaComMencao.replace(
                    new RegExp(`@${numberOnly}`, 'g'), 
                    `@${displayName}`
                );
            }
            
            // 6. Enviar mensagem
            await sock.sendMessage(groupJid, {
                text: intrigaComMencao,
                mentions: selectedParticipants
            });
            
        } catch (error) {
            console.error('Erro ao executar comando intriga:', error);
            
            await sock.sendMessage(groupJid, {
                text: '❌ Ops! Deu ruim na hora de gerar a intriga. Tenta de novo mais tarde!'
            });
        }
    }
} 