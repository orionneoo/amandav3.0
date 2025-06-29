import { WASocket } from '@whiskeysockets/baileys';
import { injectable } from 'inversify';
import { ErrorLogger } from '@/utils/errorLogger';
import { onboardingDebug } from '@/utils/Logger';

@injectable()
export class OnboardingService {
  private readonly ownerNumber = '5521967233931@s.whatsapp.net';
  // NOVO: Cache para evitar envios duplicados
  private sentPromotions = new Map<string, number>();
  private readonly PROMOTION_CACHE_TIME = 24 * 60 * 60 * 1000; // 24 horas
  // NOVO: Cache para onboarding de grupo
  private sentGroupOnboarding = new Map<string, number>(); // groupJid -> timestamp
  private readonly GROUP_ONBOARDING_CACHE_TIME = 24 * 60 * 60 * 1000; // 24 horas

  /**
   * Envia mensagem de onboarding para novos admins
   */
  public async sendAdminOnboarding(sock: WASocket, adminJid: string, groupJid: string): Promise<void> {
    return; // Desativado temporariamente a pedido do usuário
    /*
    try {
      const groupMetadata = await sock.groupMetadata(groupJid);
      const groupName = groupMetadata.subject;
      const adminName = groupMetadata.participants.find(p => p.id === adminJid)?.name || adminJid.split('@')[0];

      const onboardingMessage = `🎉 *Parabéns! Você foi promovido a Admin!*\n\n` +
        `👑 *Grupo:* ${groupName}\n` +
        `👤 *Seu nome:* ${adminName}\n\n` +
        `📋 *COMANDOS PRINCIPAIS:*\n` +
        `• \`!menu\` - Menu principal com todos os comandos\n` +
        `• \`!menu [1-8]\` - Submenus específicos (admin, diversão, etc.)\n` +
        `• \`!menusimples\` - Lista simples de todos os comandos\n\n` +
        `🔧 *COMANDOS DE ADMINISTRAÇÃO:*\n\n` +
        `👥 *Gerenciamento de Membros:*\n` +
        `• \`!promover @usuario\` - Promove a admin\n` +
        `• \`!rebaixar @usuario\` - Remove admin\n` +
        `• \`!banir @usuario\` - Bane usuário (adiciona à blacklist)\n` +
        `• \`!desbanir @usuario\` - Remove do ban\n` +
        `• \`!remover @usuario\` - Remove do grupo (sem blacklist)\n` +
        `• \`!admins\` - Lista todos os admins\n\n` +
        `🔒 *Controle do Grupo:*\n` +
        `• \`!silenciar\` - Só admins podem falar\n` +
        `• \`!liberar\` - Todos podem falar\n` +
        `• \`!apagar\` - Apaga todas as mensagens do grupo\n\n` +
        `📊 *Estatísticas e Ranking:*\n` +
        `• \`!topativos [dias]\` - Membros mais ativos (padrão 7, máximo 30)\n` +
        `• \`!inativos [dias]\` - Membros inativos (padrão 7, máximo 30)\n` +
        `• \`!novatos [dias]\` - Membros novos (padrão 7, máximo 30)\n` +
        `• \`!resumo\` - Resumo das últimas 24h do grupo\n\n` +
        `🤖 *Controle da IA:*\n` +
        `• \`!ia\` - Mostra status da IA\n` +
        `• \`!ia on\` - Ativa a IA no grupo\n` +
        `• \`!ia off\` - Desativa a IA no grupo\n\n` +
        `🎭 *Personalidades da IA:*\n` +
        `• \`!person\` - Lista todas as personalidades\n` +
        `• \`!person [número/nome]\` - Muda a personalidade\n\n` +
        `📋 *Gerenciamento de Comandos:*\n` +
        `• \`!comandos\` - Lista todos os comandos e status\n` +
        `• \`!comandos ativar [comando]\` - Ativa um comando\n` +
        `• \`!comandos desativar [comando]\` - Desativa um comando\n` +
        `• \`!comandos ativar todos\` - Ativa todos os comandos\n` +
        `• \`!comandos desativar todos\` - Desativa todos os comandos\n\n` +
        `👋 *Mensagens de Boas-vindas:*\n` +
        `• \`!boasvindas\` - Mostra status das mensagens\n` +
        `• \`!boasvindas on\` - Ativa mensagens de boas-vindas\n` +
        `• \`!boasvindas off\` - Desativa mensagens de boas-vindas\n\n` +
        `🛠️ *Ferramentas Avançadas:*\n` +
        `• \`!cache\` - Mostra estatísticas do cache\n` +
        `• \`!logs\` - Analisa logs do sistema\n` +
        `• \`!erros\` - Mostra últimos erros registrados\n\n` +
        `💡 *DICAS IMPORTANTES:*\n` +
        `• Use \`!menu\` para ver todos os comandos organizados\n` +
        `• A IA responde a menções @5521971200821 e respostas\n` +
        `• Personalidades mudam o comportamento da IA\n` +
        `• Use \`!feedback\` para reportar problemas\n` +
        `• Comandos de admin só funcionam se o bot for admin\n\n` +
        `🎯 *Precisa de ajuda?*\n` +
        `• Digite \`!menu\` no grupo para ver todos os comandos\n` +
        `• Use \`!feedback\` para sugestões\n` +
        `• Contato direto: *21 96723-3931*\n\n` +
        `🚀 *Boa sorte administrando o grupo!* 😉`;

      await sock.sendMessage(adminJid, { text: onboardingMessage });
      
      onboardingDebug(`[ONBOARDING] Enviado onboarding para admin ${adminName} (${adminJid}) no grupo ${groupName}`);
      
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        jid: adminJid,
        groupJid,
        action: 'send_admin_onboarding'
      });
      console.error('[ERROR] Erro ao enviar onboarding para admin:', error);
    }
    */
  }

  /**
   * Envia mensagem de onboarding quando o bot entra em um novo grupo
   */
  public async sendGroupOnboarding(sock: WASocket, groupJid: string): Promise<void> {
    const now = Date.now();
    const lastSent = this.sentGroupOnboarding.get(groupJid);
    if (typeof lastSent === 'number' && (now - lastSent) < this.GROUP_ONBOARDING_CACHE_TIME) {
      // Já enviou onboarding para este grupo nas últimas 24h
      return;
    }
    try {
      const groupMetadata = await sock.groupMetadata(groupJid);
      const groupName = groupMetadata.subject;
      const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);

      const groupOnboardingMessage = `🎉 *Olá! Sou a Amanda, sua assistente de grupo!*\n\n` +
        `👋 Acabei de entrar no grupo *${groupName}*\n\n` +
        `🤖 *O que eu posso fazer:*\n` +
        `• Responder mensagens com IA (mencione @5521971200821)\n` +
        `• Executar comandos de diversão e utilidade\n` +
        `• Gerenciar boas-vindas e despedidas\n` +
        `• Controlar comandos ativos/inativos\n` +
        `• Mudar personalidades\n` +
        `• E muito mais!\n\n` +
        `📋 *COMANDOS PRINCIPAIS:*\n` +
        `• \`!menu\` - Menu principal com todos os comandos\n` +
        `• \`!menu [1-8]\` - Submenus específicos\n` +
        `• \`!menusimples\` - Lista simples de comandos\n\n` +
        `👑 *PARA OS ADMINS:*\n` +
        `• \`!menu 1\` - Comandos de administração\n` +
        `• \`!ia on/off\` - Controla a IA no grupo\n` +
        `• \`!person\` - Muda minha personalidade\n` +
        `• \`!boasvindas on/off\` - Mensagens automáticas\n` +
        `• \`!comandos\` - Gerencia comandos ativos\n` +
        `• \`!promover @user\` - Promove outros\n` +
        `• \`!banir @user\` - Bane usuários\n` +
        `• \`!topativos\` - Ranking de atividade\n\n` +
        `💡 *PARA TODOS:*\n` +
        `• Mencione @5521971200821 para falar comigo\n` +
        `• Ou responda a uma das minhas mensagens\n` +
        `• Use \`!menu\` para ver todos os comandos\n` +
        `• Use \`!feedback\` para sugestões\n\n` +
        `🎯 *Precisa de ajuda?*\n` +
        `• Contato: *21 96723-3931*\n` +
        `• Digite \`!menu\` no grupo\n\n` +
        `🚀 *Vamos fazer esse grupo bombar!* 🔥`;

      // Enviar para o grupo
      await sock.sendMessage(groupJid, { text: groupOnboardingMessage });

      // Enviar onboarding individual para cada admin
      for (const adminJid of admins) {
        if (adminJid !== sock.user?.id) { // Não enviar para o próprio bot
          await this.sendAdminOnboarding(sock, adminJid, groupJid);
        }
      }

      onboardingDebug(`[ONBOARDING] Enviado onboarding para grupo ${groupName} (${groupJid})`);
      // Registrar envio
      this.sentGroupOnboarding.set(groupJid, now);
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        groupJid,
        action: 'send_group_onboarding'
      });
      console.error('[ERROR] Erro ao enviar onboarding para grupo:', error);
    }
  }

  /**
   * Verifica no cache se uma mensagem de promoção já foi enviada recentemente.
   * @param userJid JID do usuário
   * @param groupJid JID do grupo
   * @returns `true` se a promoção já foi enviada, `false` caso contrário.
   */
  public hasPromotionBeenSent(userJid: string, groupJid: string): boolean {
    const cacheKey = `${userJid}-${groupJid}`;
    const now = Date.now();
    const lastSent = this.sentPromotions.get(cacheKey);

    if (typeof lastSent === 'number' && (now - lastSent) < this.PROMOTION_CACHE_TIME) {
      const hoursSince = Math.floor((now - lastSent) / (60 * 60 * 1000));
      onboardingDebug(`Mensagem de promoção já enviada há ${hoursSince}h para ${userJid} no grupo ${groupJid}. Ignorando.`);
      return true;
    }
    return false;
  }

  /**
   * Envia onboarding para um admin específico quando promovido
   */
  public async sendPromotionOnboarding(sock: WASocket, adminJid: string, groupJid: string): Promise<void> {
    return; // Desativado temporariamente a pedido do usuário
    try {
      // NOVO: Verificar cache antes de enviar
      if (this.hasPromotionBeenSent(adminJid, groupJid)) {
        return;
      }

      const now = Date.now();
      const groupMetadata = await sock.groupMetadata(groupJid);
      const groupName = groupMetadata.subject;
      const adminName = groupMetadata.participants.find(p => p.id === adminJid)?.name || adminJid.split('@')[0];

      // NOVO: Verificar se o usuário ainda é admin antes de enviar
      const isStillAdmin = groupMetadata.participants.some(p => p.id === adminJid && p.admin);
      if (!isStillAdmin) {
        onboardingDebug(`Usuário ${adminJid} não é mais admin no grupo ${groupJid}. Não enviando mensagem.`);
        return;
      }

      const promotionMessage = `🎉 *Parabéns! Você foi promovido a Admin!*\n\n` +
        `👑 *Grupo:* ${groupName}\n` +
        `👤 *Seu nome:* ${adminName}\n\n` +
        `🔧 *Agora você tem acesso aos comandos de administração!*\n\n` +
        `📋 *COMANDOS PRINCIPAIS:*\n` +
        `• \`!menu\` - Menu principal com todos os comandos\n` +
        `• \`!menu 1\` - Comandos de administração\n` +
        `• \`!menusimples\` - Lista simples de comandos\n\n` +
        `👥 *COMANDOS DE ADMIN:*\n` +
        `• \`!promover @user\` - Promove outros\n` +
        `• \`!rebaixar @user\` - Remove admin\n` +
        `• \`!banir @user\` - Bane usuários\n` +
        `• \`!remover @user\` - Remove do grupo\n` +
        `• \`!silenciar\` - Só admins podem falar\n` +
        `• \`!liberar\` - Todos podem falar\n` +
        `• \`!admins\` - Lista todos os admins\n\n` +
        `🤖 *CONTROLE DA IA:*\n` +
        `• \`!ia on/off\` - Ativa/desativa a IA\n` +
        `• \`!person\` - Muda minha personalidade\n` +
        `• \`!boasvindas on/off\` - Mensagens automáticas\n` +
        `• \`!comandos\` - Gerencia comandos ativos\n` +
        `• \`!promover @user\` - Promove outros\n` +
        `• \`!banir @user\` - Bane usuários\n` +
        `• \`!topativos\` - Ranking de atividade\n\n` +
        `💡 *DICAS IMPORTANTES:*\n` +
        `• Use \`!menu\` para ver todos os comandos organizados\n` +
        `• A IA responde a menções @5521971200821 e respostas\n` +
        `• Personalidades mudam o comportamento da IA\n` +
        `• Use \`!feedback\` para reportar problemas\n` +
        `• Comandos de admin só funcionam se o bot for admin\n\n` +
        `🎯 *Precisa de ajuda?*\n` +
        `• Contato: *21 96723-3931*\n` +
        `• Use \`!feedback\` para sugestões\n\n` +
        `🚀 *Boa sorte administrando o grupo!* 😉`;

      // NOVO: Atualizar cache após enviar
      const cacheKey = `${adminJid}-${groupJid}`;
      this.sentPromotions.set(cacheKey, now);

      await sock.sendMessage(adminJid, { text: promotionMessage });
      
      onboardingDebug(`[ONBOARDING] Enviado onboarding de promoção para ${adminName} (${adminJid}) no grupo ${groupName}`);
      
    } catch (error) {
      await ErrorLogger.logError(error as Error, {
        jid: adminJid,
        groupJid,
        action: 'send_promotion_onboarding'
      });
      console.error('[ERROR] Erro ao enviar onboarding de promoção para admin:', error);
    }
  }
}