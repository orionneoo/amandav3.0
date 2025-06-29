import mongoose, { Document, Schema } from 'mongoose';

export interface IBlacklist extends Document {
  groupJid?: string;
  userJid: string;
  number: string;
  name: string;
  bannedAt: Date;
  bannedBy: string;
  reason?: string;
  active: boolean;
}

const BlacklistSchema: Schema = new Schema({
  groupJid: { type: String, required: false },
  userJid: { type: String, required: true, index: true },
  number: { type: String, required: true, index: true },
  name: { type: String, required: true },
  bannedAt: { type: Date, default: Date.now },
  bannedBy: { type: String, required: true },
  reason: { type: String, default: 'Banido pelo admin' },
  active: { type: Boolean, default: true, index: true }
});

// Índices para consultas eficientes
BlacklistSchema.index({ userJid: 1, active: 1 });
BlacklistSchema.index({ number: 1, active: 1 });
BlacklistSchema.index({ groupJid: 1, userJid: 1 }, { unique: true, sparse: true });

// Middleware para filtrar apenas bans ativos
BlacklistSchema.pre('find', function() {
  this.where({ active: true });
});

export const Blacklist = mongoose.model<IBlacklist>('Blacklist', BlacklistSchema); 