import mongoose, { Document, Schema } from 'mongoose';

export interface IQuotedMessage extends Document {
  _id: string; // ID único da mensagem citada
  originalMessageId: string; // ID da mensagem original
  quotedMessageId: string; // ID da mensagem citada
  quotedText?: string; // Texto da mensagem citada
  quotedFrom: string; // Quem enviou a mensagem citada
  quotedTimestamp: number; // Timestamp da mensagem citada
  quotedJid: string; // JID do grupo/usuário da mensagem citada
  quotedType?: string; // Tipo da mensagem citada
  quotedMedia?: {
    type: string;
    url?: string;
    mimetype?: string;
    size?: number;
  };
  // NOVOS CAMPOS
  context?: {
    isForwarded: boolean;
    originalSender?: string;
    originalJid?: string;
  };
  schemaVersion: number; // versão do schema
  createdAt: Date;
  updatedAt: Date;
}

const QuotedMessageSchema: Schema = new Schema({
  _id: { type: String, required: true }, // ID único da mensagem citada
  originalMessageId: { type: String, required: true, index: true }, // ID da mensagem original
  quotedMessageId: { type: String, required: true, index: true }, // ID da mensagem citada
  quotedText: { type: String },
  quotedFrom: { type: String, required: true, index: true },
  quotedTimestamp: { type: Number, required: true, index: true },
  quotedJid: { type: String, required: true, index: true },
  quotedType: { type: String },
  quotedMedia: {
    type: { type: String },
    url: { type: String },
    mimetype: { type: String },
    size: { type: Number }
  },
  // NOVOS CAMPOS
  context: {
    isForwarded: { type: Boolean, default: false },
    originalSender: { type: String },
    originalJid: { type: String }
  },
  schemaVersion: { type: Number, default: 1 }, // Versão atual do schema
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para otimizar consultas
QuotedMessageSchema.index({ originalMessageId: 1 }); // Mensagens citadas por mensagem original
QuotedMessageSchema.index({ quotedMessageId: 1 }); // Busca por mensagem citada
QuotedMessageSchema.index({ quotedFrom: 1, quotedTimestamp: -1 }); // Mensagens citadas por usuário
QuotedMessageSchema.index({ quotedJid: 1, quotedTimestamp: -1 }); // Mensagens citadas por grupo
QuotedMessageSchema.index({ quotedTimestamp: 1 }); // Por timestamp da mensagem citada
QuotedMessageSchema.index({ 'context.isForwarded': 1 }); // Mensagens encaminhadas

// TTL de 60 dias para mensagens citadas antigas
QuotedMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

export const QuotedMessage = mongoose.model<IQuotedMessage>('QuotedMessage', QuotedMessageSchema); 