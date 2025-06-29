export interface ISenderInfo {
  jid: string;
  number: string;
  name: string;
  isGroup: boolean;
  groupJid?: string;
  groupName?: string;
  timestamp: number | Long;
  messageType: string;
} 