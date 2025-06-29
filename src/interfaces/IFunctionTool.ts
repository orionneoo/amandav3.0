export interface IFunctionParameter {
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface IFunctionTool {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, IFunctionParameter>;
  examples: string[];
  synonyms: string[];
  requiresAdmin?: boolean;
  requiresGroup?: boolean;
}

export interface IFunctionCall {
  name: string;
  args: Record<string, any>;
  confidence?: number;
} 