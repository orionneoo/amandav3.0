import { WASocket } from '@whiskeysockets/baileys';

/**
 * Tipos de comando para controle de permissão
 */
export type CommandCategory = 'admin' | 'utils' | 'fun' | 'ranking';

/**
 * Verifica se o usuário pode usar o comando, baseado na categoria e se é admin.
 * Futuramente pode ser expandido para permissões customizadas por grupo.
 */
export async function canUseCommand(
  sock: WASocket,
  groupJid: string,
  userJid: string,
  commandCategory: CommandCategory
): Promise<boolean> {
  if (!groupJid.endsWith('@g.us')) return true; // Em privado, libera tudo
  if (commandCategory === 'admin') {
    // Só admins podem usar comandos de admin
    const meta = await sock.groupMetadata(groupJid);
    const isAdmin = meta.participants.some(p => p.id === userJid && (p.admin === 'admin' || p.admin === 'superadmin'));
    return isAdmin;
  }
  // Outros comandos: todos podem usar
  return true;
} 