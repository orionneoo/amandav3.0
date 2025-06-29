import mongoose, { Schema, Document } from 'mongoose';

export interface IUserProfile extends Document {
  userJid: string; // Ex: "5521988888888@s.whatsapp.net"
  groupJid: string; // Ex: "120363388206049308@g.us"
  nome?: string;
  idade?: number;
  dataNascimento?: string;
  bairro?: string;
  ondeMora?: string;
  estadoCivil?: string;
  relacionamento?: string;
  sexualidade?: string;
  pronome?: string;
  signo?: string;
  altura?: string;
  time?: string;
  pvLiberado?: string;
  monogamico?: string;
  instagram?: string;
  curiosidades?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

const UserProfileSchema: Schema = new Schema({
  userJid: {
    type: String,
    required: true,
    index: true
  },
  groupJid: {
    type: String,
    required: true,
    index: true
  },
  nome: {
    type: String,
    trim: true
  },
  idade: {
    type: Number,
    min: 0,
    max: 150
  },
  dataNascimento: {
    type: String,
    trim: true
  },
  bairro: {
    type: String,
    trim: true
  },
  ondeMora: {
    type: String,
    trim: true
  },
  estadoCivil: {
    type: String,
    trim: true
  },
  relacionamento: {
    type: String,
    trim: true
  },
  sexualidade: {
    type: String,
    trim: true
  },
  pronome: {
    type: String,
    trim: true
  },
  signo: {
    type: String,
    trim: true
  },
  altura: {
    type: String,
    trim: true
  },
  time: {
    type: String,
    trim: true
  },
  pvLiberado: {
    type: String,
    trim: true
  },
  monogamico: {
    type: String,
    trim: true
  },
  instagram: {
    type: String,
    trim: true
  },
  curiosidades: [{
    type: String,
    trim: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices compostos para consultas eficientes
UserProfileSchema.index({ userJid: 1, groupJid: 1 }, { unique: true });
UserProfileSchema.index({ groupJid: 1, createdAt: -1 });

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema); 