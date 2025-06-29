import { ICommand } from '@/interfaces/ICommand';

// FIX: Interface para tipos de erro
export interface ErrorContext {
  commandName: string;
  error: Error;
  args: string[];
  userJid: string;
  groupJid?: string;
  command?: ICommand;
}

// FIX: Tipos de erro identificáveis
export enum ErrorType {
  INVALID_ARGS = 'invalid_args',
  MISSING_ARGS = 'missing_args',
  PERMISSION_DENIED = 'permission_denied',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  DATABASE_ERROR = 'database_error',
  API_ERROR = 'api_error',
  UNKNOWN = 'unknown'
}

// FIX: Sistema de mensagens de erro personalizadas da Amanda
export class AmandaErrorMessages {
  
  // FIX: Detectar tipo de erro baseado na mensagem e contexto
  static detectErrorType(error: Error, context: ErrorContext): ErrorType {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('timeout') || errorMessage.includes('demorou muito')) {
      return ErrorType.TIMEOUT;
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized') || errorMessage.includes('admin')) {
      return ErrorType.PERMISSION_DENIED;
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('404') || errorMessage.includes('não encontrado')) {
      return ErrorType.RESOURCE_NOT_FOUND;
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('fetch')) {
      return ErrorType.NETWORK_ERROR;
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return ErrorType.RATE_LIMIT;
    }
    
    if (errorMessage.includes('database') || errorMessage.includes('mongodb') || errorMessage.includes('atlas')) {
      return ErrorType.DATABASE_ERROR;
    }
    
    if (errorMessage.includes('api') || errorMessage.includes('gemini')) {
      return ErrorType.API_ERROR;
    }
    
    return ErrorType.UNKNOWN;
  }
  
  // FIX: Gerar mensagem de erro personalizada da Amanda
  static generateErrorMessage(errorType: ErrorType, context: ErrorContext): string {
    const { commandName, error, args } = context;
    
    switch (errorType) {
      case ErrorType.TIMEOUT:
        return `⏰ Ops! O comando \`!${commandName}\` demorou demais para responder. Tenta de novo! Se continuar lento, chama o meu criador: +55 21 96723-3931 - ele vai acelerar as coisas! 🚀`;
        
      case ErrorType.MISSING_ARGS:
        return `❌ Faltam argumentos para o comando \`!${commandName}\`. Verifica a sintaxe e tenta de novo! Se não souber como usar, chama o meu criador: +55 21 96723-3931 - ele vai te ajudar! 💪`;
        
      case ErrorType.INVALID_ARGS:
        return `❌ Argumentos inválidos para o comando \`!${commandName}\`. Verifica a sintaxe e tenta de novo! Se não souber como usar, chama o meu criador: +55 21 96723-3931 - ele vai te ajudar! 💪`;
        
      case ErrorType.PERMISSION_DENIED:
        return `🚫 Você não tem permissão para usar o comando \`!${commandName}\`. Se acha que isso é um erro, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
        
      case ErrorType.RATE_LIMIT:
        return `⏳ Calma! Você está usando o comando \`!${commandName}\` muito rápido. Espera um pouco e tenta de novo! Se continuar assim, chama o meu criador: +55 21 96723-3931 - ele vai ajustar! ⚡`;
        
      case ErrorType.DATABASE_ERROR:
        return `💾 Tive um problema com o banco de dados no comando \`!${commandName}\`. Tenta de novo em alguns segundos! Se não funcionar, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
        
      case ErrorType.API_ERROR:
        return `🌐 Tive um problema com um serviço externo no comando \`!${commandName}\`. Tenta de novo em alguns segundos! Se não funcionar, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
        
      case ErrorType.UNKNOWN:
      default:
        return `❌ Ops! Tive um problema inesperado com o comando \`!${commandName}\`. Tenta de novo em alguns segundos! Se não funcionar, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
    }
  }
  
  // FIX: Gerar mensagens específicas para argumentos inválidos
  private static getInvalidArgsMessage(commandName: string, args: string[], command?: ICommand): string {
    const messages = [
      `Eita, gracinha! 🫣 O comando !${commandName} não entendeu o que você quis dizer.`,
      `Ops, baby! 😅 Parece que você digitou algo que eu não consegui processar no !${commandName}.`,
      `Hmm, deu uma confusão aqui! 🤔 O !${commandName} não conseguiu entender os parâmetros.`
    ];
    
    const baseMessage = messages[Math.floor(Math.random() * messages.length)];
    const usage = command?.usage || `!${commandName}`;
    
    return `${baseMessage}\n\n💡 *Como usar:* ${usage}\n\n_Tenta de novo, amor!_ 💋`;
  }
  
  // FIX: Mensagens para argumentos faltando
  private static getMissingArgsMessage(commandName: string, args: string[], command?: ICommand): string {
    const messages = [
      `Ei, gracinha! 🫣 Pra usar o !${commandName} você precisa marcar alguém.`,
      `Baby, faltou algo aí! 😏 O !${commandName} precisa de mais informações.`,
      `Ops, faltou o ingrediente principal! 🥺 O !${commandName} não funciona sem os parâmetros certos.`
    ];
    
    const baseMessage = messages[Math.floor(Math.random() * messages.length)];
    const usage = command?.usage || `!${commandName}`;
    
    return `${baseMessage}\n\n💡 *Exemplo:* ${usage}\n\n_Tenta de novo, meu bem!_ ✨`;
  }
  
  // FIX: Mensagens para permissão negada
  private static getPermissionDeniedMessage(commandName: string): string {
    const messages = [
      `Eita, amor! 🚫 Esse comando !${commandName} é só pra admins. Você não tem essa permissão ainda.`,
      `Ops, baby! 😅 O !${commandName} é exclusivo pra quem manda aqui. Você não tem essa autorização.`,
      `Hmm, gracinha! 🫣 O !${commandName} é só pra quem tem poder aqui. Você ainda não chegou nesse nível.`
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  // FIX: Mensagens para recurso não encontrado
  private static getResourceNotFoundMessage(commandName: string, args: string[]): string {
    const messages = [
      `Eita, baby! 🔍 Não encontrei o que você tá procurando no !${commandName}.`,
      `Ops, gracinha! 🤔 O !${commandName} não achou o que você pediu.`,
      `Hmm, amor! 🫣 Parece que o que você quer no !${commandName} não existe aqui.`
    ];
    
    const baseMessage = messages[Math.floor(Math.random() * messages.length)];
    
    if (args.length > 0) {
      return `${baseMessage}\n\n💡 *Dica:* Verifica se "${args.join(' ')}" está correto e tenta de novo!`;
    }
    
    return `${baseMessage}\n\n_Tenta de novo, meu bem!_ 💋`;
  }
  
  // FIX: Mensagens para erro de rede
  private static getNetworkErrorMessage(commandName: string): string {
    const messages = [
      `Eita, deu um tilt na conexão! 🌐 O !${commandName} não conseguiu falar com os servidores.`,
      `Ops, baby! 📡 Parece que a internet tá com preguiça. O !${commandName} não conseguiu se conectar.`,
      `Hmm, gracinha! 🔌 Deu uma falha na rede. O !${commandName} não conseguiu acessar o que precisava.`
    ];
    
    const baseMessage = messages[Math.floor(Math.random() * messages.length)];
    
    return `${baseMessage}\n\n💡 *Dica:* Verifica sua conexão e tenta de novo em alguns segundos!\n\n_Se persistir, pode ser problema dos servidores!_ 🌐`;
  }
  
  // FIX: Gerar sugestões de comandos similares
  static generateCommandSuggestions(input: string, availableCommands: string[]): string[] {
    const suggestions: string[] = [];
    const inputLower = input.toLowerCase();
    
    for (const command of availableCommands) {
      if (command.toLowerCase().includes(inputLower) || 
          command.toLowerCase().startsWith(inputLower)) {
        suggestions.push(`!${command}`);
        if (suggestions.length >= 3) break; // Máximo 3 sugestões
      }
    }
    
    return suggestions;
  }
  
  // FIX: Mensagem personalizada para comando não encontrado
  static getCommandNotFoundMessage(commandName: string, suggestions: string[]): string {
    const messages = [
      `❌ Opa, baby! Não conheço o comando \`!${commandName}\`. Será que você digitou certo?`,
      `❌ Hmm, gracinha! O comando \`!${commandName}\` não existe aqui. Verifica a escrita!`,
      `❌ Eita, amor! O comando \`!${commandName}\` não faz parte do meu repertório.`
    ];
    
    const baseMessage = messages[Math.floor(Math.random() * messages.length)];
    
    let suggestionText = '';
    if (suggestions.length > 0) {
      suggestionText = `\n\n💡 *Talvez você quis dizer:*\n${suggestions.map(cmd => `• \`!${cmd}\``).join('\n')}`;
    }
    
    return `${baseMessage}${suggestionText}\n\n🔍 Use \`!comandos\` para ver todos os comandos disponíveis!\n\nSe não encontrar o que procura, chama o meu criador: +55 21 96723-3931 - ele vai te ajudar! 💪`;
  }

  // NOVO: Método para obter mensagem de erro de comando
  static getCommandErrorMessage(commandName: string, error: any): string {
    const context: ErrorContext = {
      commandName,
      error: error instanceof Error ? error : new Error(String(error)),
      args: [],
      userJid: 'unknown',
      groupJid: undefined
    };

    const errorType = this.detectErrorType(context.error, context);
    return this.generateErrorMessage(errorType, context);
  }

  static getTimeoutError(): string {
    return `⏰ *Timeout - Muito Lento*\n\nOpa, demorei demais para responder! 😅\n\n💡 *Dicas:*\n• Tenta de novo em alguns segundos\n• Se continuar lento, chama o meu criador: +55 21 96723-3931 - ele vai acelerar as coisas! 🚀`;
  }

  static getCommandNotFoundError(command: string): string {
    return `❌ *Comando não encontrado*\n\nO comando \`${command}\` não existe! 😅\n\n💡 *Dicas:*\n• Digite \`!menu\` para ver todos os comandos\n• Verifique se digitou corretamente\n• Se não souber como usar, chama o meu criador: +55 21 96723-3931 - ele vai te ajudar! 💪`;
  }

  static getInvalidUsageError(command: string, usage: string): string {
    return `❌ *Uso incorreto*\n\nO comando \`${command}\` foi usado de forma errada! 😅\n\n📋 *Como usar:*\n\`${usage}\`\n\n💡 *Dicas:*\n• Verifique a sintaxe correta\n• Se não souber como usar, chama o meu criador: +55 21 96723-3931 - ele vai te ajudar! 💪`;
  }

  static getGenericError(): string {
    return `❌ *Erro inesperado*\n\nOpa, algo deu errado! 😅\n\n💡 *Dicas:*\n• Tenta de novo em alguns segundos\n• Se for um erro, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
  }

  static getRateLimitError(): string {
    return `⏳ *Muito rápido*\n\nCalma, baby! Você tá mandando comandos muito rápido! 😅\n\n💡 *Dicas:*\n• Espera alguns segundos antes de mandar outro comando\n• Se continuar assim, chama o meu criador: +55 21 96723-3931 - ele vai ajustar! ⚡`;
  }

  static getPermissionError(): string {
    return `🚫 *Sem permissão*\n\nVocê não tem permissão para usar este comando! 😅\n\n💡 *Dicas:*\n• Este comando é só para admins\n• Peça para um admin te ajudar\n• Se não funcionar, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
  }

  static getGroupOnlyError(): string {
    return `🚫 *Só em grupos*\n\nEste comando só funciona em grupos! 😅\n\n💡 *Dicas:*\n• Use este comando em um grupo\n• Se não funcionar, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
  }

  static getPrivateOnlyError(): string {
    return `🚫 *Só em privado*\n\nEste comando só funciona em chat privado! 😅\n\n💡 *Dicas:*\n• Use este comando em privado\n• Se não funcionar, chama o meu criador: +55 21 96723-3931 - ele vai resolver! 🔧`;
  }

  static getHelpNotFoundError(): string {
    return `❓ *Ajuda não encontrada*\n\nOpa, não consegui encontrar ajuda para isso! 😅\n\n💡 *Dicas:*\n• Digite \`!menu\` para ver todos os comandos\n• Seja mais específico na pergunta\n• Se não encontrar o que procura, chama o meu criador: +55 21 96723-3931 - ele vai te ajudar! 💪`;
  }
} 