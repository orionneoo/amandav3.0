import mongoose, { Document, Schema } from 'mongoose';

export interface IMessageReaction extends Document {
  _id: string; // ID único da reação
  messageId: string; // ID da mensagem
  user: string; // Quem reagiu
  emoji: string; // Emoji da reação
  reactionType?: 'pego' | 'penso' | 'passo' | 'custom'; // Tipo da reação (para jogos)
  timestamp: Date; // Quando reagiu
  // NOVOS CAMPOS
  context?: {
    isGameReaction: boolean; // Se é reação de jogo
    gameId?: string; // ID do jogo se aplicável
    isAIResponse: boolean; // Se é reação a resposta de IA
  };
  schemaVersion: number; // versão do schema
  createdAt: Date;
  updatedAt: Date;
}

const MessageReactionSchema: Schema = new Schema({
  _id: { type: String, required: true }, // ID único da reação
  messageId: { type: String, required: true, index: true }, // ID da mensagem
  user: { type: String, required: true, index: true }, // Quem reagiu
  emoji: { type: String, required: true },
  reactionType: { 
    type: String, 
    enum: ['pego', 'penso', 'passo', 'custom'], 
    default: 'custom' 
  },
  timestamp: { type: Date, default: Date.now, index: true },
  // NOVOS CAMPOS
  context: {
    isGameReaction: { type: Boolean, default: false },
    gameId: { type: String },
    isAIResponse: { type: Boolean, default: false }
  },
  schemaVersion: { type: Number, default: 1 }, // Versão atual do schema
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para otimizar consultas
MessageReactionSchema.index({ messageId: 1 }); // Reações por mensagem
MessageReactionSchema.index({ user: 1, timestamp: -1 }); // Reações por usuário
MessageReactionSchema.index({ emoji: 1, timestamp: -1 }); // Reações por emoji
MessageReactionSchema.index({ reactionType: 1, timestamp: -1 }); // Reações por tipo
MessageReactionSchema.index({ timestamp: 1 }); // Por timestamp

// NOVOS ÍNDICES DE PERFORMANCE CRÍTICOS
MessageReactionSchema.index({ 'context.isGameReaction': 1, timestamp: -1 }); // Reações de jogo
MessageReactionSchema.index({ 'context.gameId': 1, timestamp: -1 }); // Reações por jogo
MessageReactionSchema.index({ 'context.isAIResponse': 1, timestamp: -1 }); // Reações a IA
MessageReactionSchema.index({ messageId: 1, user: 1 }, { unique: true }); // Uma reação por usuário por mensagem
MessageReactionSchema.index({ reactionType: 1, 'context.isGameReaction': 1 }); // Reações de jogo por tipo

// TTL de 30 dias para reações antigas
MessageReactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const MessageReaction = mongoose.model<IMessageReaction>('MessageReaction', MessageReactionSchema); 