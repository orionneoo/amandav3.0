// src/services/BioExtractorService.ts
import { injectable, inject } from 'inversify';
import { DatabaseService } from './DatabaseService';
import { UserProfile, IUserProfile } from '@/database/models/UserProfileSchema';
import { TYPES } from '@/config/container';

export interface ExtractedBioData {
  userJid: string;
  groupJid: string;
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
}

@injectable()
export class BioExtractorService {
  constructor(
    @inject(TYPES.DatabaseService) private databaseService: DatabaseService
  ) {}

  /**
   * Extrai dados de bio de uma mensagem de texto
   */
  public extractBioData(text: string, userJid: string, groupJid: string): ExtractedBioData | null {
    try {
      // Verificar se é um comando .bio
      if (!text.toLowerCase().includes('.bio')) {
        return null;
      }

      console.log(`[BioExtractor] Processando bio para ${userJid} no grupo ${groupJid}`);

      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const extractedData: ExtractedBioData = {
        userJid,
        groupJid
      };

      // Processar cada linha
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cleanedLine = this.cleanLine(line);
        if (!cleanedLine) continue;

        console.log(`[BioExtractor] Processando linha: "${cleanedLine}"`);

        // Extrair campos usando regex mais flexível e variações
        this.extractField(cleanedLine, 'nome', /(?:nome|me\s+chamo|sou\s+(?:o|a)|meu\s+nome\s+é)\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'idade', /(\d+)\s*anos?/i, extractedData);
        this.extractField(cleanedLine, 'dataNascimento', /(\d{2}\/\d{2}\/\d{4})/, extractedData);
        this.extractField(cleanedLine, 'bairro', /bairro\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'ondeMora', /(?:onde\s+mora|moro\s+(?:em|ali|perto|no))\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'estadoCivil', /estado\s*civil\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'relacionamento', /(?:relacionamento|solteiro|casado|namorando)\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'sexualidade', /(?:orientação\s*sexual|sou\s+(?:hétero|gay|bi|pan|ace)|sexualidade)\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'pronome', /(?:pronome|me\s+chamam\s+de)\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'signo', /(?:signo|sou\s+signo\s+de)\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'altura', /(?:altura|tenho|sou)\s*:?\s*(\d+[,.]?\d*\s*m)/i, extractedData);
        this.extractField(cleanedLine, 'time', /(?:time|torço\s+para|sou\s+do)\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'pvLiberado', /(?:pv\s*liberado|não\s+curto\s+pv|pv\s+só\s+com)\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'monogamico', /(?:mono|não\s*mono|não-mono|monogâmico)\s*:?\s*(.+)/i, extractedData);
        this.extractField(cleanedLine, 'instagram', /(?:insta|instagram)\s*:?\s*@?([a-zA-Z0-9_.]+)/i, extractedData);

        // Extrair curiosidades quando encontrar a seção
        if (cleanedLine.toLowerCase().includes('curiosidade')) {
          this.extractCuriosidades(lines, i, extractedData);
        }
      }

      // Validar se pelo menos um campo foi extraído
      const hasData = Object.keys(extractedData).some(key => 
        key !== 'userJid' && key !== 'groupJid' && extractedData[key as keyof ExtractedBioData]
      );

      if (!hasData) {
        console.log(`[BioExtractor] Nenhum dado válido extraído para ${userJid}`);
        return null;
      }

      console.log(`[BioExtractor] Dados extraídos:`, extractedData);
      return extractedData;

    } catch (error) {
      console.error(`[BioExtractor] Erro ao extrair bio:`, error);
      return null;
    }
  }

  /**
   * Salva os dados extraídos no banco
   */
  public async saveBioData(data: ExtractedBioData): Promise<boolean> {
    try {
      const existingProfile = await UserProfile.findOne({
        userJid: data.userJid,
        groupJid: data.groupJid
      });

      if (existingProfile) {
        // Atualizar perfil existente
        Object.assign(existingProfile, data, { updatedAt: new Date() });
        await existingProfile.save();
        console.log(`[BioExtractor] ✅ Perfil atualizado para ${data.userJid}`);
      } else {
        // Criar novo perfil
        const newProfile = new UserProfile({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await newProfile.save();
        console.log(`[BioExtractor] ✅ Novo perfil criado para ${data.userJid}`);
      }

      return true;
    } catch (error) {
      console.error(`[BioExtractor] ❌ Erro ao salvar bio:`, error);
      return false;
    }
  }

  /**
   * Busca perfil de um usuário em um grupo específico
   */
  public async getUserProfile(userJid: string, groupJid: string): Promise<IUserProfile | null> {
    try {
      const profile = await UserProfile.findOne({ userJid, groupJid });
      return profile;
    } catch (error) {
      console.error(`[BioExtractor] Erro ao buscar perfil:`, error);
      return null;
    }
  }

  /**
   * Formata perfil para envio à IA
   */
  public formatProfileForAI(profile: IUserProfile): string {
    if (!profile) return '';

    const fields: string[] = [];
    
    if (profile.nome) fields.push(`Nome: ${profile.nome}`);
    if (profile.idade) fields.push(`Idade: ${profile.idade} anos`);
    if (profile.dataNascimento) fields.push(`Data de nascimento: ${profile.dataNascimento}`);
    if (profile.pronome) fields.push(`Pronome: ${profile.pronome}`);
    if (profile.bairro) fields.push(`Bairro: ${profile.bairro}`);
    if (profile.ondeMora) fields.push(`Onde mora: ${profile.ondeMora}`);
    if (profile.estadoCivil) fields.push(`Estado civil: ${profile.estadoCivil}`);
    if (profile.relacionamento) fields.push(`Relacionamento: ${profile.relacionamento}`);
    if (profile.sexualidade) fields.push(`Sexualidade: ${profile.sexualidade}`);
    if (profile.signo) fields.push(`Signo: ${profile.signo}`);
    if (profile.altura) fields.push(`Altura: ${profile.altura}`);
    if (profile.time) fields.push(`Time: ${profile.time}`);
    if (profile.pvLiberado) fields.push(`PV liberado: ${profile.pvLiberado}`);
    if (profile.monogamico) fields.push(`Monogâmico: ${profile.monogamico}`);
    if (profile.instagram) fields.push(`Instagram: @${profile.instagram}`);
    
    if (profile.curiosidades && profile.curiosidades.length > 0) {
      fields.push(`Curiosidades: ${profile.curiosidades.join(', ')}`);
    }

    return fields.length > 0 ? fields.join(' | ') : '';
  }

  /**
   * Limpa uma linha removendo emojis e símbolos desnecessários
   */
  private cleanLine(line: string): string {
    return line
      .replace(/[*✓❓❤‍🔥🏚🔥📥⚽♒📏📸📝✨🎂🏳️‍🌈🏠💍💬📅📷🚇🐟🤷‍♂️😎]/g, '') // Remove emojis específicos
      .replace(/^\s*[-*•]\s*/, '') // Remove marcadores de lista
      .trim();
  }

  /**
   * Extrai um campo específico usando regex
   */
  private extractField(
    line: string, 
    fieldName: keyof ExtractedBioData, 
    regex: RegExp, 
    data: ExtractedBioData
  ): void {
    const match = line.match(regex);
    if (match && match[1]) {
      let value = match[1].trim();
      
      // Limpar valor de emojis e caracteres especiais
      value = this.cleanValue(value);
      
      if (value && value !== '') {
        if (fieldName === 'idade') {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0 && numValue <= 150) {
            (data as any)[fieldName] = numValue;
            console.log(`[BioExtractor] ✅ ${fieldName}: ${numValue}`);
          }
        } else if (fieldName === 'altura') {
          // Limpar altura para formato padrão
          const alturaMatch = value.match(/(\d+[,.]?\d*)\s*m/);
          if (alturaMatch) {
            const altura = alturaMatch[1].replace(',', '.');
            (data as any)[fieldName] = `${altura}m`;
            console.log(`[BioExtractor] ✅ ${fieldName}: ${altura}m`);
          }
        } else if (fieldName !== 'curiosidades') {
          (data as any)[fieldName] = value;
          console.log(`[BioExtractor] ✅ ${fieldName}: ${value}`);
        }
      }
    }
  }

  /**
   * Limpa o valor extraído removendo emojis e caracteres desnecessários
   */
  private cleanValue(value: string): string {
    return value
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Remove emojis de expressões
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Remove emojis de símbolos
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Remove emojis de transporte
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Remove emojis de bandeiras
      .replace(/[\u{2600}-\u{26FF}]/gu, '') // Remove emojis de símbolos diversos
      .replace(/[\u{2700}-\u{27BF}]/gu, '') // Remove emojis de símbolos decorativos
      .replace(/[^\w\s\-\/\.@,()]/g, '') // Remove caracteres especiais exceto alguns úteis
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  }

  /**
   * Extrai curiosidades das linhas a partir de uma posição específica
   */
  private extractCuriosidades(lines: string[], startIndex: number, data: ExtractedBioData): void {
    const curiosidades: string[] = [];
    
    // Começar a partir da linha seguinte à que contém "curiosidade"
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const cleanedLine = this.cleanLine(line);
      if (!cleanedLine) continue;

      // Parar se encontrar outro campo conhecido
      if (this.isOtherField(cleanedLine)) {
        break;
      }

      // Se a linha contém número (1., 2., 3.) ou é uma curiosidade válida
      if (cleanedLine.match(/^\d+\.?\s*/) || 
          (curiosidades.length < 3 && cleanedLine.length > 3 && !this.isOtherField(cleanedLine))) {
        
        // Remover prefixos de curiosidade
        const curiosity = cleanedLine
          .replace(/^\d+\.?\s*/, '')
          .trim();

        if (curiosity && curiosity.length > 0) {
          const cleanCuriosity = this.cleanValue(curiosity);
          if (cleanCuriosity) {
            curiosidades.push(cleanCuriosity);
            console.log(`[BioExtractor] ✅ Curiosidade ${curiosidades.length}: ${cleanCuriosity}`);
          }
        }
      }
    }

    if (curiosidades.length > 0) {
      data.curiosidades = curiosidades.slice(0, 3); // Máximo 3 curiosidades
    }
  }

  /**
   * Verifica se uma linha é outro campo conhecido
   */
  private isOtherField(line: string): boolean {
    const knownFields = [
      'nome', 'idade', 'data de nascimento', 'bairro', 'onde mora', 'moro', 'estado civil', 
      'relacionamento', 'solteiro', 'casado', 'namorando', 'sexualidade', 'orientação sexual', 
      'hétero', 'gay', 'bi', 'pan', 'ace', 'pronome', 'me chamam', 'signo', 'sou signo',
      'altura', 'tenho', 'time', 'torço', 'pv liberado', 'não curto pv', 'pv só com',
      'monogâmico', 'mono', 'não mono', 'não-mono', 'insta', 'instagram'
    ];

    return knownFields.some(field => 
      line.toLowerCase().includes(field.toLowerCase())
    );
  }
} 