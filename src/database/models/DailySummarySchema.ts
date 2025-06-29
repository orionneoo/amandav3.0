import mongoose, { Document, Schema } from 'mongoose';

export interface IDailySummary extends Document {
  groupJid: string;
  date: string; // formato YYYY-MM-DD
  personality: string;
  totalMessages: number;
  totalMembers: number;
  totalAdmins: number;
  topUsers: Array<{
    jid: string;
    name: string;
    messageCount: number;
  }>;
  topCommands: Array<{
    name: string;
    count: number;
  }>;
  popularPhrases: Array<{
    text: string;
    count: number;
    engagement: number; // baseado em reações/respostas
  }>;
  aiInteractions: number;
  mediaCount: {
    images: number;
    videos: number;
    audios: number;
    documents: number;
    stickers: number;
  };
  peakActivityHour: number; // hora do dia com mais atividade
  createdAt: Date;
}

const DailySummarySchema: Schema = new Schema({
  groupJid: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  personality: { type: String, required: true },
  totalMessages: { type: Number, default: 0 },
  totalMembers: { type: Number, default: 0 },
  totalAdmins: { type: Number, default: 0 },
  topUsers: [{
    jid: { type: String, required: true },
    name: { type: String, required: true },
    messageCount: { type: Number, default: 0 }
  }],
  topCommands: [{
    name: { type: String, required: true },
    count: { type: Number, default: 0 }
  }],
  popularPhrases: [{
    text: { type: String, required: true },
    count: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 }
  }],
  aiInteractions: { type: Number, default: 0 },
  mediaCount: {
    images: { type: Number, default: 0 },
    videos: { type: Number, default: 0 },
    audios: { type: Number, default: 0 },
    documents: { type: Number, default: 0 },
    stickers: { type: Number, default: 0 }
  },
  peakActivityHour: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Índice composto único para evitar duplicatas
DailySummarySchema.index({ groupJid: 1, date: 1 }, { unique: true });

// Índices para consultas rápidas
DailySummarySchema.index({ date: 1, totalMessages: -1 }); // Para ranking de grupos por atividade
DailySummarySchema.index({ personality: 1, date: 1 }); // Para análise por personalidade
DailySummarySchema.index({ createdAt: 1 }); // Para consultas por período

// TTL de 90 dias para resumos antigos
DailySummarySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const DailySummary = mongoose.model<IDailySummary>('DailySummary', DailySummarySchema); 