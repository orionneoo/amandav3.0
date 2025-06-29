import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  groupJid: string;
  name: string;
  description?: string;
  admins: string[];
  members: string[];
  totalMembers: number;
  totalAdmins: number;
  isAnnouncement: boolean;
  isRestricted: boolean;
  isEphemeral: boolean;
  ephemeralDuration: number;
  inviteCode: string;
  inviteCodeExp: number;
  activePersonality?: string;
  lastPersonalityChange?: Date;
  changedBy?: string;
  settings: {
    welcomeEnabled: boolean;
    goodbyeEnabled: boolean;
    disabledCommands: string[];
    aiEnabled: boolean;
  };
  lastActivity?: Date;
  messageCount?: number;
  createdBy?: string;
  rules?: string;
  welcomeMessage?: string;
  goodbyeMessage?: string;
  maxMembers?: number;
  isActive?: boolean;
  timezone?: string;
  language?: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema: Schema = new Schema({
  groupJid: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  admins: [{ type: String }],
  members: [{ type: String }],
  totalMembers: { type: Number, default: 0 },
  totalAdmins: { type: Number, default: 0 },
  isAnnouncement: { type: Boolean, default: false },
  isRestricted: { type: Boolean, default: false },
  isEphemeral: { type: Boolean, default: false },
  ephemeralDuration: { type: Number, default: 0 },
  inviteCode: { type: String, default: '' },
  inviteCodeExp: { type: Number, default: 0 },
  activePersonality: { type: String, default: 'padrao' },
  lastPersonalityChange: { type: Date },
  changedBy: { type: String },
  settings: {
    welcomeEnabled: { type: Boolean, default: true },
    goodbyeEnabled: { type: Boolean, default: true },
    disabledCommands: [{ type: String, default: [] }],
    aiEnabled: { type: Boolean, default: true, index: true }
  },
  lastActivity: { type: Date, default: Date.now, index: true },
  messageCount: { type: Number, default: 0 },
  createdBy: { type: String },
  rules: { type: String },
  welcomeMessage: { type: String },
  goodbyeMessage: { type: String },
  maxMembers: { type: Number },
  isActive: { type: Boolean, default: true, index: true },
  timezone: { type: String, default: 'America/Sao_Paulo' },
  language: { type: String, default: 'pt-BR' },
  schemaVersion: { type: Number, default: 2 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now, index: true },
});

GroupSchema.index({ updatedAt: 1 });
GroupSchema.index({ 'settings.aiEnabled': 1 });
GroupSchema.index({ lastActivity: 1 });
GroupSchema.index({ isActive: 1, lastActivity: 1 });
GroupSchema.index({ totalMembers: 1 });
GroupSchema.index({ activePersonality: 1 });
GroupSchema.index({ timezone: 1 });
GroupSchema.index({ language: 1 });
GroupSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const Group = mongoose.model<IGroup>('Group', GroupSchema); 