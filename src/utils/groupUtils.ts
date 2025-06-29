import { WASocket } from '@whiskeysockets/baileys';
import { Group } from '@/database/models/GroupSchema';

function normalizeJid(jid: string): string {
  // Remove sufixos como :[alguma coisa] e força @s.whatsapp.net
  return jid.replace(/:[0-9]+/g, '').replace(/\s/g, '').replace('c.us', 's.whatsapp.net');
}

export async function isAdmin(sock: WASocket, groupJid: string, userJid: string): Promise<boolean> {
  const metadata = await sock.groupMetadata(groupJid);
  const participant = metadata.participants.find(p => normalizeJid(p.id) === normalizeJid(userJid));
  return participant?.admin === 'admin' || participant?.admin === 'superadmin';
}

export async function isBotAdmin(sock: WASocket, groupJid: string): Promise<boolean> {
  const metadata = await sock.groupMetadata(groupJid);
  const botJid = sock.user?.id || '';
  const participant = metadata.participants.find(p => normalizeJid(p.id) === normalizeJid(botJid));
  return participant?.admin === 'admin' || participant?.admin === 'superadmin';
}

export async function saveOrUpdateGroup(sock: WASocket, groupJid: string) {
  const metadata = await sock.groupMetadata(groupJid);
  const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
  const members = metadata.participants.map(p => p.id);
  const groupData = {
    groupJid,
    name: metadata.subject,
    description: metadata.desc || '',
    admins,
    members,
    updatedAt: new Date(),
  };
  await Group.findOneAndUpdate(
    { groupJid },
    { $set: groupData, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
} 