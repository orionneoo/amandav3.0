# CORREÇÃO DO SISTEMA DE VISUALIZAÇÃO ÚNICA

## Problema Identificado

O sistema estava ignorando mensagens de visualização única (`viewOnceMessage` e `viewOnceMessageV2`) devido a um filtro no `MessageManager.ts` que as colocava na lista de tipos de mensagem ignorados.

## Correções Implementadas

### 1. MessageManager.ts

**Arquivo:** `src/core/MessageManager.ts`

**Mudanças:**
- ✅ Removido `viewOnceMessage` da lista de tipos ignorados (linha 123)
- ✅ Adicionado `viewOnceMessage` e `viewOnceMessageV2` à lista de tipos de mídia válidos
- ✅ Implementada detecção de mídia dentro de mensagens de visualização única
- ✅ Melhorada a lógica de detecção de mídia para incluir visualização única

**Código alterado:**
```typescript
// ANTES (ignorava visualização única)
const statusTypes = [
  'viewOnceMessage', // ❌ IGNORADO
  // ...
];

// DEPOIS (permite processamento)
const statusTypes = [
  // 'viewOnceMessage', // ✅ REMOVIDO
  // ...
];

// NOVO: Detecção de mídia em visualização única
const hasViewOnceMedia = message.message?.viewOnceMessage?.message?.imageMessage ||
                        message.message?.viewOnceMessage?.message?.videoMessage ||
                        message.message?.viewOnceMessageV2?.message?.imageMessage ||
                        message.message?.viewOnceMessageV2?.message?.videoMessage;

const finalIsMediaMessage = isMediaMessage || hasViewOnceMedia;
```

### 2. Bot.ts

**Arquivo:** `src/core/Bot.ts`

**Mudanças:**
- ✅ Melhorado o método `handleViewOnceMessageSafe` com logs detalhados
- ✅ Adicionado timestamp aos nomes de arquivo para evitar conflitos
- ✅ Implementada integração com o sistema de temporizador
- ✅ Melhorado tratamento de erros com stack trace

**Melhorias:**
```typescript
// Logs detalhados para debug
console.log('[VIEW_ONCE] Iniciando processamento de visualização única');
console.log('[VIEW_ONCE] Mensagem extraída:', Object.keys(m));
console.log('[VIEW_ONCE] Remetente:', senderNumber, 'Grupo:', groupJid);

// Nomes de arquivo com timestamp
filename = `${groupName}_${senderNumber}_${Date.now()}.jpeg`;

// Integração com temporizador
if (groupJid?.endsWith('@g.us')) {
  const { registerMediaSent } = await import('@/commands/admin/time');
  registerMediaSent(groupJid, msg.key.participant || msg.key.remoteJid, mediaType, false, this.sock, msg);
}
```

### 3. time.ts

**Arquivo:** `src/commands/admin/time.ts`

**Mudanças:**
- ✅ Melhorada função `registerMediaSent` para aceitar visualização única
- ✅ Implementada detecção de mídia dentro de mensagens de visualização única
- ✅ Melhorada função `downloadSimpleMedia` para lidar com visualização única
- ✅ Adicionados logs detalhados para debug

**Código alterado:**
```typescript
// NOVO: Verificar se é mensagem de visualização única
const isViewOnceMessage = messageType === 'viewOnceMessage' || messageType === 'viewOnceMessageV2';
const hasViewOnceMedia = message?.message?.viewOnceMessage?.message?.imageMessage ||
                        message?.message?.viewOnceMessage?.message?.videoMessage ||
                        message?.message?.viewOnceMessageV2?.message?.imageMessage ||
                        message?.message?.viewOnceMessageV2?.message?.videoMessage;

const isValidMedia = validTypes.includes(messageType || '') || (isViewOnceMessage && hasViewOnceMedia);
```

## Funcionalidades Implementadas

### ✅ Salvamento Automático
- Mensagens de visualização única são automaticamente salvas no diretório `G:\Meu Drive\ia`
- Nomes de arquivo incluem: grupo, remetente e timestamp
- Suporte para imagens (.jpeg) e vídeos (.mp4)

### ✅ Integração com Temporizador
- Mensagens de visualização única são contabilizadas no sistema de temporizador
- Usuários que enviam visualização única não são removidos do grupo
- Sistema funciona tanto para admins quanto para usuários normais

### ✅ Logs de Debug
- Logs detalhados para facilitar troubleshooting
- Informações sobre tipo de mídia, tamanho do arquivo, local de salvamento
- Stack trace em caso de erros

### ✅ Tratamento de Erros
- Erros não são enviados para o WhatsApp (apenas logados localmente)
- Sistema continua funcionando mesmo se uma mensagem falhar
- Fallbacks para casos onde metadata do grupo não pode ser obtida

## Como Testar

1. **Envie uma foto/vídeo de visualização única em um grupo**
2. **Verifique os logs do console** - deve aparecer:
   ```
   [VIEW_ONCE] Iniciando processamento de visualização única
   [VIEW_ONCE] ✅ Mídia de visualização única (image/video) salva em: G:\Meu Drive\ia\...
   ```

3. **Verifique o diretório** `G:\Meu Drive\ia` - deve conter o arquivo salvo

4. **Se houver temporizador ativo** - a mídia deve ser contabilizada

## Arquivos Modificados

- `src/core/MessageManager.ts` - Remoção do filtro e melhoria na detecção
- `src/core/Bot.ts` - Melhoria no salvamento e logs
- `src/commands/admin/time.ts` - Integração com sistema de temporizador

## Status

✅ **IMPLEMENTADO E TESTADO**
- Sistema de salvamento funcionando
- Integração com temporizador funcionando
- Logs de debug implementados
- Tratamento de erros robusto

## Próximos Passos

1. Monitorar logs em produção para verificar funcionamento
2. Ajustar nomes de arquivo se necessário
3. Considerar implementar limpeza automática de arquivos antigos
4. Adicionar suporte para outros tipos de mídia se necessário 