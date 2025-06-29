// src/database/UserSessionSchema.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  role: 'user' | 'model';
  parts: string;
}

export interface IPersonalityChange {
  from: string;
  to: string;
  changedBy: string;
  timestamp: Date;
  reason: string;
}

export interface IUserSession extends Document {
  jid: string; // WhatsApp JID (e.g., 5511999999999@s.whatsapp.net)
  chatHistory: IMessage[];
  lastInteraction: Date;
  personalityChanges?: IPersonalityChange[];
}

const UserSessionSchema: Schema = new Schema({
  jid: {
    type: String,
    required: true,
    unique: true,
  },
  chatHistory: [
    {
      role: { type: String, required: true },
      parts: { type: String, required: true },
    },
  ],
  lastInteraction: {
    type: Date,
    default: Date.now,
  },
  personalityChanges: [
    {
      from: { type: String, required: true },
      to: { type: String, required: true },
      changedBy: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      reason: { type: String, default: 'manual_change' }
    }
  ]
});

export const UserSession = mongoose.model<IUserSession>('UserSession', UserSessionSchema); 