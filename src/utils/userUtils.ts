import { WASocket, proto } from '@whiskeysockets/baileys';

type WAMessage = proto.IWebMessageInfo;

/**
 * Obtém o nome correto do usuário para marcação
 * Prioriza o nome do WhatsApp no grupo, depois o pushName, por último o número
 */
export async function getUserDisplayName(
  sock: WASocket, 
  userJid: string, 
  groupJid?: string,
  fallbackName?: string | null
): Promise<string> {
  try {
    // Se temos um nome de fallback válido, use-o primeiro
    if (fallbackName && fallbackName.trim() && fallbackName.trim().length > 0) {
      return fallbackName.trim();
    }

    // Se é um grupo, tenta obter o nome do participante
    if (groupJid && groupJid.endsWith('@g.us')) {
      try {
        const groupMetadata = await sock.groupMetadata(groupJid);
        const participant = groupMetadata.participants.find(p => p.id === userJid);
        
        // FIX: Prioriza o nome do participante no grupo
        if (participant?.name && participant.name.trim() && participant.name.trim().length > 0) {
          return participant.name.trim();
        }
      } catch (error) {
        console.log('[DEBUG] Erro ao obter metadata do grupo:', error);
        // Ignora erro e continua
      }
    }

    // Se não conseguiu, retorna o número sem o código do país
    const number = userJid.split('@')[0];
    // Remove o código do país se presente (assume que começa com 55)
    if (number.startsWith('55') && number.length > 10) {
      return number.substring(2); // Remove o 55
    }
    return number;
  } catch (error) {
    console.log('[DEBUG] Erro geral em getUserDisplayName:', error);
    // Em caso de erro, retorna o número sem código do país
    const number = userJid.split('@')[0];
    if (number.startsWith('55') && number.length > 10) {
      return number.substring(2);
    }
    return number;
  }
}

/**
 * Cria uma mensagem com marcação correta do usuário
 */
export async function createMentionMessage(
  sock: WASocket,
  message: WAMessage,
  text: string,
  userJid?: string
): Promise<{ text: string; mentions: string[] }> {
  const targetJid = userJid || message.key.participant || message.key.remoteJid!;
  const groupJid = message.key.remoteJid!;
  const isGroup = groupJid.endsWith('@g.us');
  
  if (!isGroup) {
    return { text, mentions: [] };
  }

  const displayName = await getUserDisplayName(sock, targetJid, groupJid, message.pushName || undefined);
  
  return {
    text: `@${displayName} ${text}`,
    mentions: [targetJid]
  };
}

/**
 * Obtém informações completas do usuário
 */
export async function getUserInfo(
  sock: WASocket,
  userJid: string,
  groupJid?: string,
  fallbackName?: string | null
): Promise<{
  jid: string;
  number: string;
  name: string;
  displayName: string;
}> {
  const number = userJid.split('@')[0];
  const name = fallbackName || number;
  const displayName = await getUserDisplayName(sock, userJid, groupJid, fallbackName);
  
  return {
    jid: userJid,
    number,
    name,
    displayName
  };
} 