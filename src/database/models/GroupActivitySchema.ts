import mongoose, { Document, Schema } from 'mongoose';

export interface IGroupActivity extends Document {
  groupJid: string;
  userJid: string;
  timestamp: Date;
  type: 'message' | 'join' | 'leave';
}

const GroupActivitySchema: Schema = new Schema({
  groupJid: { type: String, required: true },
  userJid: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['message', 'join', 'leave'], required: true },
});

export const GroupActivity = mongoose.model<IGroupActivity>('GroupActivity', GroupActivitySchema); 