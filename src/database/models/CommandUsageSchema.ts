import mongoose, { Document, Schema } from 'mongoose';

export interface ICommandUsage extends Document {
  groupJid: string;
  command: string;
  user: string; // quem usou o comando
  count: number;
  lastUsed: Date;
  totalUsage: number; // total de vezes que o comando foi usado
  // NOVOS CAMPOS
  success?: boolean; // se o comando foi executado com sucesso
  error?: string; // erro se houver
  executionTime?: number; // tempo de execução em ms
  args?: string[]; // argumentos usados
  context?: {
    isAIResponse: boolean;
    aiModel?: string;
    processingTime?: number;
  };
  botVersion?: string; // versão do bot
  schemaVersion: number; // versão do schema
  createdAt: Date;
  updatedAt: Date;
}

const CommandUsageSchema: Schema = new Schema({
  groupJid: { type: String, required: true, index: true },
  command: { type: String, required: true, index: true },
  user: { type: String, required: true, index: true },
  count: { type: Number, default: 1 },
  lastUsed: { type: Date, default: Date.now },
  totalUsage: { type: Number, default: 1 },
  // NOVOS CAMPOS
  success: { type: Boolean, default: true, index: true },
  error: { type: String },
  executionTime: { type: Number, index: true },
  args: [{ type: String }],
  context: {
    isAIResponse: { type: Boolean, default: false },
    aiModel: { type: String },
    processingTime: { type: Number }
  },
  botVersion: { type: String },
  schemaVersion: { type: Number, default: 2 }, // Versão atual do schema
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Índice composto único para evitar duplicatas
CommandUsageSchema.index({ groupJid: 1, command: 1, user: 1 }, { unique: true });

// Índices para consultas rápidas
CommandUsageSchema.index({ command: 1, count: -1 }); // Para ranking de comandos
CommandUsageSchema.index({ groupJid: 1, count: -1 }); // Para comandos por grupo
CommandUsageSchema.index({ user: 1, count: -1 }); // Para comandos por usuário
CommandUsageSchema.index({ lastUsed: 1 }); // Para comandos recentes

// NOVOS ÍNDICES DE PERFORMANCE CRÍTICOS
CommandUsageSchema.index({ success: 1, timestamp: -1 }); // Comandos bem-sucedidos
CommandUsageSchema.index({ executionTime: 1 }); // Tempo de execução
CommandUsageSchema.index({ 'context.isAIResponse': 1, timestamp: -1 }); // Comandos de IA
CommandUsageSchema.index({ error: 1, timestamp: -1 }); // Comandos com erro
CommandUsageSchema.index({ command: 1, success: 1, timestamp: -1 }); // Comandos por sucesso
CommandUsageSchema.index({ groupJid: 1, success: 1, timestamp: -1 }); // Comandos por grupo e sucesso

// TTL de 30 dias para estatísticas antigas
CommandUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const CommandUsage = mongoose.model<ICommandUsage>('CommandUsage', CommandUsageSchema); 