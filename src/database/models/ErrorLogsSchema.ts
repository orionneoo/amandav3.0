import mongoose, { Document, Schema } from 'mongoose';

export interface IErrorLog extends Document {
  error: string;
  stack?: string;
  user?: string;
  group?: string;
  command?: string;
  timestamp: Date;
  location: string; // arquivo/função onde ocorreu
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>; // dados adicionais do contexto
  traceId?: string; // ID único para rastreamento
  botVersion?: string; // versão do bot
  environment?: string; // ambiente (dev, prod, etc.)
  ipAddress?: string; // IP do usuário se disponível
  userAgent?: string; // User agent se disponível
  schemaVersion: number; // versão do schema
  createdAt: Date;
  updatedAt: Date;
}

const ErrorLogsSchema: Schema = new Schema({
  error: { type: String, required: true },
  stack: { type: String },
  user: { type: String, index: true },
  group: { type: String, index: true },
  command: { type: String, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  location: { type: String, required: true },
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'], 
    default: 'medium',
    index: true 
  },
  context: { type: Schema.Types.Mixed },
  traceId: { type: String, index: true },
  botVersion: { type: String },
  environment: { type: String, default: 'production', index: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  schemaVersion: { type: Number, default: 2 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para consultas rápidas
ErrorLogsSchema.index({ severity: 1, timestamp: -1 }); // Para erros críticos
ErrorLogsSchema.index({ group: 1, timestamp: -1 }); // Para erros por grupo
ErrorLogsSchema.index({ command: 1, timestamp: -1 }); // Para erros por comando
ErrorLogsSchema.index({ user: 1, timestamp: -1 }); // Para erros por usuário

// NOVOS ÍNDICES DE PERFORMANCE CRÍTICOS
ErrorLogsSchema.index({ timestamp: 1, severity: 1 }); // Erros por severidade e tempo
ErrorLogsSchema.index({ environment: 1, severity: 1, timestamp: -1 }); // Erros por ambiente
ErrorLogsSchema.index({ traceId: 1 }); // Rastreamento por traceId
ErrorLogsSchema.index({ location: 1, timestamp: -1 }); // Erros por localização
ErrorLogsSchema.index({ botVersion: 1, timestamp: -1 }); // Erros por versão do bot
ErrorLogsSchema.index({ severity: 1, group: 1, timestamp: -1 }); // Erros críticos por grupo

// TTL de 7 dias para logs de erro
ErrorLogsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const ErrorLogs = mongoose.model<IErrorLog>('ErrorLogs', ErrorLogsSchema); 