# SISTEMA DE CAPTURA EM SIGILO - VISUALIZAÇÃO ÚNICA

## Visão Geral

Este sistema funciona em **sigilo total** - captura, baixa e salva automaticamente todas as mensagens de visualização única que chegam ao bot, **sem enviar nenhuma mensagem** para grupos ou privado, **sem comandos**, e **apenas com logs essenciais** no terminal.

## Características do Sigilo

### 🔒 Sigilo Total
- ✅ **Nenhuma mensagem** enviada para grupos ou privado
- ✅ **Nenhum comando** disponível
- ✅ **Logs mínimos** apenas no terminal
- ✅ **Funcionamento invisível** para usuários
- ✅ **Captura automática** de todas as mensagens

### 📁 Salvamento Automático
- **Diretório Principal:** `G:\Meu Drive\ia`
- **Diretório de Backup:** `./viewonce_backup`
- **Nomenclatura:** `YYYY-MM-DD_HH-MM-SS_grupo_numero_tipo_messageId.extensao`
- **Exemplo:** `2025-06-28_14-46-21_120363388685888838_5521967233931_img_3EB09F251692D3B19F011F.jpeg`

### 📊 Estatísticas Silenciosas
- Total de mensagens capturadas
- Contagem de imagens vs vídeos
- Número de erros
- Timestamp da última captura
- Persistência em arquivo JSON (sem logs)

## Como Funciona

1. **Mensagem chega** ao bot via `messages.upsert`
2. **ViewOnceCaptureService** intercepta a mensagem silenciosamente
3. **Verifica** se é visualização única
4. **Se sim**, baixa e salva automaticamente sem notificar
5. **Continua** o processamento normal da mensagem
6. **Se não**, ignora e continua normalmente

## Logs do Terminal

### Logs Normais
- **Nenhum log** de captura bem-sucedida
- **Nenhum log** de salvamento
- **Nenhum log** de estatísticas

### Logs de Erro (Apenas Críticos)
```
[VIEW_ONCE] Erro crítico: Error: No SenderKeyRecord found for decryption
[VIEW_ONCE] Erro na captura automática: Error: Connection timeout
```

## Estrutura de Arquivos

```
📁 viewonce_backup/
├── 📄 stats.json                    # Estatísticas (sem logs)
├── 📄 capture_log.json             # Log detalhado (sem logs)
├── 🖼️ 2025-06-28_14-46-21_...jpeg  # Backup de imagens
└── 🎥 2025-06-28_14-45-30_...mp4   # Backup de vídeos

📁 G:\Meu Drive\ia\
├── 🖼️ 2025-06-28_14-46-21_...jpeg  # Imagens capturadas
└── 🎥 2025-06-28_14-45-30_...mp4   # Vídeos capturados
```

## Vantagens do Sigilo

### ✅ Invisibilidade Total
- **Usuários não sabem** que o sistema existe
- **Nenhuma notificação** de captura
- **Nenhum comando** visível
- **Funcionamento transparente**

### ✅ Sistema Robusto
- **Backup duplo** automático
- **Tratamento de erros** silencioso
- **Estatísticas persistentes** (sem logs)
- **Limpeza automática** de arquivos antigos

### ✅ Compatibilidade
- **Não interfere** no sistema existente
- **Mantém** funcionalidades antigas
- **Adiciona** novas funcionalidades
- **Integração** transparente

## Monitoramento Silencioso

### Verificação Manual
Para verificar se o sistema está funcionando:

1. **Verificar diretório:** `G:\Meu Drive\ia`
2. **Verificar backup:** `./viewonce_backup`
3. **Verificar estatísticas:** `./viewonce_backup/stats.json`
4. **Verificar logs:** `./viewonce_backup/capture_log.json`

### Exemplo de Verificação
```bash
# Verificar arquivos salvos
ls "G:\Meu Drive\ia" | grep "_img_\|_vid_"

# Verificar estatísticas
cat ./viewonce_backup/stats.json

# Verificar logs de captura
cat ./viewonce_backup/capture_log.json
```

## Troubleshooting Silencioso

### Problema: Arquivos não estão sendo salvos
**Verificação:**
1. Verificar permissões do diretório `G:\Meu Drive\ia`
2. Verificar logs de erro no terminal
3. Verificar arquivo `./viewonce_backup/stats.json`

### Problema: Erros de captura
**Verificação:**
1. Verificar logs de erro no terminal
2. Verificar conectividade com WhatsApp
3. Verificar espaço em disco

### Problema: Sistema não funciona
**Verificação:**
1. Verificar se o serviço está registrado no container
2. Verificar se o Bot.ts está integrado
3. Verificar logs de inicialização

## Status

✅ **IMPLEMENTADO E FUNCIONAL EM SIGILO**
- Sistema de captura automática silenciosa
- Nenhum comando visível
- Nenhuma mensagem enviada
- Logs mínimos apenas no terminal
- Backup automático
- Estatísticas persistentes

## Arquivos do Sistema

### Core
- `src/core/ViewOnceCaptureService.ts` - Serviço principal de captura
- `src/core/Bot.ts` - Integração no bot (modificado)
- `src/core/container.ts` - Registro do serviço (modificado)

### Configuração
- `src/config/container.ts` - Tipo do serviço (modificado)

### Documentação
- `SISTEMA_SIGILO_VISUALIZAÇÃO_ÚNICA.md` - Esta documentação

## Próximos Passos

1. **Monitorar** arquivos salvos manualmente
2. **Verificar** estatísticas periodicamente
3. **Ajustar** configurações se necessário
4. **Manter** sigilo total

## Notas Importantes

- **Nenhum usuário saberá** que o sistema existe
- **Nenhuma mensagem será enviada** sobre capturas
- **Apenas logs de erro crítico** aparecerão no terminal
- **Sistema funciona em background** completamente
- **Compatível com sistema existente** sem interferência 