import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  _id: string; // message.key.id
  jid: string; // grupo ou usuário
  from: string; // quem enviou
  to: string; // para quem foi enviado
  participant?: string; // participante em grupos
  timestamp: number; // timestamp da mensagem
  type: string; // tipo da mensagem (text, image, video, etc.)
  text?: string; // texto da mensagem
  media?: {
    type: string;
    url?: string;
    mimetype?: string;
    size?: number;
  };
  quotedMessage?: {
    id: string;
    text?: string;
    from?: string;
  };
  isFromMe: boolean; // se foi enviada pelo bot
  isGroup: boolean; // se é mensagem de grupo
  mentions?: string[]; // usuários mencionados
  commandUsed?: {
    name: string;
    args: string[];
  };
  personality?: string; // personalidade ativa no momento
  // NOVOS CAMPOS
  messageId?: string; // ID único da mensagem (separado do _id)
  mediaType?: string; // Tipo específico de mídia
  context?: {
    isAIResponse: boolean;
    aiModel?: string;
    processingTime?: number;
  };
  reactions?: Array<{
    user: string;
    emoji: string;
    timestamp: Date;
  }>;
  forwardedFrom?: {
    originalJid: string;
    originalMessageId: string;
    originalSender: string;
  };
  editedAt?: Date; // Se foi editada
  deletedAt?: Date; // Se foi deletada
  readBy?: string[]; // Quem leu
  botVersion?: string; // Versão do bot
  userAgent?: string; // Dispositivo do usuário
  schemaVersion: number; // Versão do schema
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema({
  _id: { type: String, required: true }, // message.key.id
  jid: { type: String, required: true, index: true },
  from: { type: String, required: true, index: true },
  to: { type: String, required: true },
  participant: { type: String },
  timestamp: { type: Number, required: true, index: true },
  type: { type: String, required: true },
  text: { type: String },
  media: {
    type: { type: String },
    url: { type: String },
    mimetype: { type: String },
    size: { type: Number }
  },
  quotedMessage: {
    id: { type: String },
    text: { type: String },
    from: { type: String }
  },
  isFromMe: { type: Boolean, default: false, index: true },
  isGroup: { type: Boolean, default: false },
  mentions: [{ type: String, index: true }],
  commandUsed: {
    name: { type: String },
    args: [{ type: String }]
  },
  personality: { type: String },
  // NOVOS CAMPOS
  messageId: { type: String },
  mediaType: { type: String },
  context: {
    isAIResponse: { type: Boolean, default: false },
    aiModel: { type: String },
    processingTime: { type: Number }
  },
  reactions: [{
    user: { type: String, required: true },
    emoji: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  forwardedFrom: {
    originalJid: { type: String },
    originalMessageId: { type: String },
    originalSender: { type: String }
  },
  editedAt: { type: Date },
  deletedAt: { type: Date },
  readBy: [{ type: String }],
  botVersion: { type: String },
  userAgent: { type: String },
  schemaVersion: { type: Number, default: 2 }, // Versão atual do schema
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Índices compostos para otimização
MessageSchema.index({ jid: 1, timestamp: -1 }); // Para buscar mensagens por grupo e período
MessageSchema.index({ jid: 1, from: 1, timestamp: -1 }); // Para buscar mensagens de usuário específico
MessageSchema.index({ jid: 1, type: 1, timestamp: -1 }); // Para buscar por tipo de mensagem
MessageSchema.index({ 'commandUsed.name': 1, timestamp: -1 }); // Para estatísticas de comandos
MessageSchema.index({ personality: 1, timestamp: -1 }); // Para análise por personalidade

// NOVOS ÍNDICES DE PERFORMANCE CRÍTICOS
MessageSchema.index({ isFromMe: 1, timestamp: -1 }); // Mensagens do bot
MessageSchema.index({ 'media.type': 1, timestamp: -1 }); // Mídia por tipo
MessageSchema.index({ mentions: 1, timestamp: -1 }); // Menções
MessageSchema.index({ 'context.isAIResponse': 1, timestamp: -1 }); // Respostas de IA
MessageSchema.index({ 'context.isAIResponse': 1, jid: 1, timestamp: -1 }); // Respostas de IA por grupo
MessageSchema.index({ mediaType: 1, timestamp: -1 }); // Tipo específico de mídia
MessageSchema.index({ deletedAt: 1 }); // Mensagens deletadas
MessageSchema.index({ editedAt: 1 }); // Mensagens editadas

// TTL de 60 dias para mensagens antigas (HABILITADO)
MessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema); 