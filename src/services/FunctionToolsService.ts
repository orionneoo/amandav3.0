import { injectable, inject } from 'inversify';
import { IInjectableCommand } from '@/interfaces/ICommand';
import { IFunctionTool, IFunctionParameter } from '@/interfaces/IFunctionTool';

@injectable()
export class FunctionToolsService {
  private functionTools: IFunctionTool[] = [];

  constructor() {}

  /**
   * Atualiza o catálogo de ferramentas com os comandos injetáveis
   */
  public updateFunctionTools(commands: IInjectableCommand[]): void {
    this.functionTools = commands.map(cmd => this.mapCommandToFunctionTool(cmd));
  }

  /**
   * Retorna todas as ferramentas disponíveis
   */
  public getFunctionTools(): IFunctionTool[] {
    return this.functionTools;
  }

  /**
   * Retorna ferramentas no formato esperado pela Gemini
   */
  public getGeminiTools(): any[] {
    return this.functionTools.map(tool => ({
      function_declarations: [{
        name: tool.name,
        description: this.buildToolDescription(tool),
        parameters: {
          type: 'OBJECT',
          properties: this.mapParametersToGemini(tool.parameters),
          required: this.getRequiredParameters(tool.parameters)
        }
      }]
    }));
  }

  /**
   * Busca uma ferramenta por nome
   */
  public getFunctionTool(name: string): IFunctionTool | undefined {
    return this.functionTools.find(tool => tool.name === name);
  }

  /**
   * Valida se uma função pode ser executada
   */
  public validateFunctionCall(functionName: string, args: Record<string, any>, isAdmin: boolean, isGroup: boolean): boolean {
    const tool = this.getFunctionTool(functionName);
    if (!tool) return false;

    // Verifica se precisa ser admin
    if (tool.requiresAdmin && !isAdmin) return false;

    // Verifica se precisa ser grupo
    if (tool.requiresGroup && !isGroup) return false;

    // Valida parâmetros obrigatórios
    for (const [paramName, param] of Object.entries(tool.parameters)) {
      if (param.required && !args[paramName]) return false;
    }

    return true;
  }

  /**
   * Mapeia um comando para uma ferramenta
   */
  private mapCommandToFunctionTool(cmd: IInjectableCommand): IFunctionTool {
    const baseTool: IFunctionTool = {
      name: cmd.name,
      description: cmd.description,
      category: cmd.category,
      parameters: this.inferParametersFromCommand(cmd),
      examples: this.generateExamples(cmd),
      synonyms: this.generateSynonyms(cmd),
      requiresAdmin: cmd.category === 'admin',
      requiresGroup: true // A maioria dos comandos precisa ser em grupo
    };

    return baseTool;
  }

  /**
   * Infere parâmetros baseado no comando
   */
  private inferParametersFromCommand(cmd: IInjectableCommand): Record<string, IFunctionParameter> {
    const parameters: Record<string, IFunctionParameter> = {};

    // Parâmetros comuns baseados no nome/descrição do comando
    if (cmd.name.includes('banir') || cmd.name.includes('remover') || cmd.name.includes('promover') || cmd.name.includes('rebaixar')) {
      parameters.userJid = {
        type: 'STRING',
        description: 'JID do usuário (ex: 5521999999999@s.whatsapp.net)',
        required: true
      };
      
      if (cmd.name.includes('banir')) {
        parameters.motivo = {
          type: 'STRING',
          description: 'Motivo do banimento (opcional)',
          required: false
        };
      }
    }

    if (cmd.name.includes('menage') || cmd.name.includes('par') || cmd.name.includes('casal')) {
      parameters.quantidade = {
        type: 'NUMBER',
        description: 'Quantidade de pessoas (padrão: 2 para par/casal, 3 para ménage)',
        required: false
      };
    }

    if (cmd.name.includes('fofoca') || cmd.name.includes('intriga')) {
      parameters.tema = {
        type: 'STRING',
        description: 'Tema específico para a fofoca/intriga (opcional)',
        required: false
      };
    }

    if (cmd.name.includes('personalidade') || cmd.name.includes('person')) {
      parameters.personalidade = {
        type: 'STRING',
        description: 'Nome ou número da personalidade (1-20)',
        required: true,
        enum: ['padrao', 'macumbeira', 'fofoqueira', 'policial', 'anitta', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']
      };
    }

    return parameters;
  }

  /**
   * Gera exemplos de uso para a ferramenta
   */
  private generateExamples(cmd: IInjectableCommand): string[] {
    const examples: string[] = [];

    switch (cmd.name) {
      case 'banir':
        examples.push('banir @usuario', 'banir @usuario por spam', 'tirar @usuario do grupo');
        break;
      case 'fofoca':
        examples.push('fazer uma fofoca', 'criar intriga', 'gerar fofoca sobre o grupo');
        break;
      case 'menage':
        examples.push('fazer ménage', 'sortear 3 pessoas', 'ménage com 3 pessoas');
        break;
      case 'par':
        examples.push('fazer par', 'sortear casal', 'juntar duas pessoas');
        break;
      case 'personalidade':
        examples.push('mudar para macumbeira', 'ativar personalidade policial', 'person 5');
        break;
      default:
        examples.push(`usar ${cmd.name}`, `executar ${cmd.name}`);
    }

    return examples;
  }

  /**
   * Gera sinônimos para melhorar a detecção
   */
  private generateSynonyms(cmd: IInjectableCommand): string[] {
    const synonyms: string[] = [];

    switch (cmd.name) {
      case 'banir':
        synonyms.push('remover', 'tirar', 'expulsar', 'kick', 'ban', 'remover do grupo');
        break;
      case 'fofoca':
        synonyms.push('intriga', 'gossip', 'chisme', 'fazer fofoca', 'criar intriga');
        break;
      case 'menage':
        synonyms.push('ménage', 'trio', '3 pessoas', 'sortear 3');
        break;
      case 'par':
        synonyms.push('casal', 'dupla', '2 pessoas', 'sortear 2', 'juntar');
        break;
      case 'personalidade':
        synonyms.push('person', 'persona', 'mudar personalidade', 'trocar personalidade');
        break;
    }

    return synonyms;
  }

  /**
   * Constrói descrição rica para a Gemini
   */
  private buildToolDescription(tool: IFunctionTool): string {
    let description = tool.description;
    
    if (tool.synonyms.length > 0) {
      description += ` Sinônimos: ${tool.synonyms.join(', ')}.`;
    }
    
    if (tool.examples.length > 0) {
      description += ` Exemplos: ${tool.examples.join(', ')}.`;
    }

    if (tool.requiresAdmin) {
      description += ' Requer permissões de administrador.';
    }

    return description;
  }

  /**
   * Mapeia parâmetros para formato da Gemini
   */
  private mapParametersToGemini(parameters: Record<string, IFunctionParameter>): Record<string, any> {
    const geminiParams: Record<string, any> = {};

    for (const [paramName, param] of Object.entries(parameters)) {
      geminiParams[paramName] = {
        type: param.type,
        description: param.description
      };

      if (param.enum) {
        geminiParams[paramName].enum = param.enum;
      }
    }

    return geminiParams;
  }

  /**
   * Obtém lista de parâmetros obrigatórios
   */
  private getRequiredParameters(parameters: Record<string, IFunctionParameter>): string[] {
    return Object.entries(parameters)
      .filter(([_, param]) => param.required)
      .map(([name, _]) => name);
  }
} 