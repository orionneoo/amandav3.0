import mongoose, { Document, Schema } from 'mongoose';

export interface ISubmission extends Document {
  senderJid: string;
  messageId: string;
  photoUrl: string;
  caption?: string;
  submittedAt: Date;
}

export interface IConfession extends Document {
  senderJid: string;
  messageId: string;
  confession: string;
  submittedAt: Date;
}

export interface IReaction extends Document {
  reactorJid: string; // Quem reagiu
  reactionType: 'pego' | 'penso' | 'passo'; // Tipo da reação
  reactedAt: Date;
}

export interface IConfessionReaction extends Document {
  reactorJid: string; // Quem reagiu
  reactionType: 'euTambem' | 'chocado' | 'mico'; // Tipo da reação
  reactedAt: Date;
}

export interface IGame extends Document {
  gameName: string;
  groupId: string;
  groupName?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  submissions: ISubmission[];
  reactions: IReaction[]; // Reações coletadas durante o jogo
  confessions: IConfession[]; // Confissões do jogo de confissão
  confessionReactions: IConfessionReaction[]; // Reações das confissões
  endedAt?: Date; // Quando o jogo terminou
  winner?: string; // Vencedor do jogo
  totalSubmissions: number; // Total de submissões
  totalReactions: number; // Total de reações
  settings?: {
    maxSubmissions?: number;
    timeLimit?: number; // em minutos
    allowMultipleSubmissions?: boolean;
  };
  schemaVersion: number; // versão do schema
  updatedAt: Date;
}

const SubmissionSchema: Schema = new Schema({
  senderJid: { type: String, required: true },
  messageId: { type: String, required: true },
  photoUrl: { type: String, required: true },
  caption: { type: String },
  submittedAt: { type: Date, default: Date.now }
});

const ConfessionSchema: Schema = new Schema({
  senderJid: { type: String, required: true },
  messageId: { type: String, required: true },
  confession: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now }
});

const ReactionSchema: Schema = new Schema({
  reactorJid: { type: String, required: true },
  reactionType: { type: String, enum: ['pego', 'penso', 'passo'], required: true },
  reactedAt: { type: Date, default: Date.now }
});

const ConfessionReactionSchema: Schema = new Schema({
  reactorJid: { type: String, required: true },
  reactionType: { type: String, enum: ['euTambem', 'chocado', 'mico'], required: true },
  reactedAt: { type: Date, default: Date.now }
});

const GameSchema: Schema = new Schema({
  gameName: { type: String, required: true, default: 'ppp' },
  groupId: { type: String, required: true },
  groupName: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  submissions: [SubmissionSchema],
  reactions: [ReactionSchema],
  confessions: [ConfessionSchema],
  confessionReactions: [ConfessionReactionSchema],
  endedAt: { type: Date },
  winner: { type: String },
  totalSubmissions: { type: Number, default: 0 },
  totalReactions: { type: Number, default: 0 },
  settings: {
    maxSubmissions: { type: Number, default: 50 },
    timeLimit: { type: Number, default: 60 }, // 60 minutos
    allowMultipleSubmissions: { type: Boolean, default: false }
  },
  schemaVersion: { type: Number, default: 3 }, // Versão atual do schema
  updatedAt: { type: Date, default: Date.now }
});

// Índices para otimizar consultas
GameSchema.index({ groupId: 1, isActive: 1 });
GameSchema.index({ gameName: 1, isActive: 1 });
GameSchema.index({ 'reactions.reactorJid': 1 });
GameSchema.index({ 'reactions.reactionType': 1 });
GameSchema.index({ 'confessions.senderJid': 1 });
GameSchema.index({ 'confessionReactions.reactorJid': 1 });
GameSchema.index({ 'confessionReactions.reactionType': 1 });

// NOVOS ÍNDICES DE PERFORMANCE CRÍTICOS
GameSchema.index({ createdAt: 1 }); // Jogos por data de criação
GameSchema.index({ endedAt: 1 }); // Jogos por data de término
GameSchema.index({ isActive: 1, createdAt: -1 }); // Jogos ativos recentes
GameSchema.index({ createdBy: 1, createdAt: -1 }); // Jogos por criador
GameSchema.index({ groupId: 1, createdAt: -1 }); // Jogos por grupo
GameSchema.index({ winner: 1 }); // Jogos por vencedor
GameSchema.index({ totalSubmissions: 1 }); // Por número de submissões
GameSchema.index({ totalReactions: 1 }); // Por número de reações

// TTL de 30 dias para jogos antigos (NOVO)
GameSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Game = mongoose.model<IGame>('Game', GameSchema); 