# SISTEMA DE CAPTURA DE VISUALIZAÇÃO ÚNICA

## Visão Geral

Este sistema foi criado para **capturar, baixar e salvar TODAS as mensagens de visualização única** que chegam ao bot, independente de serem processadas ou ignoradas pelo sistema principal. Isso garante que nenhuma mensagem de visualização única seja perdida.

## Arquitetura

### 1. ViewOnceCaptureService
**Arquivo:** `src/core/ViewOnceCaptureService.ts`

**Responsabilidades:**
- ✅ Captura automática de todas as mensagens de visualização única
- ✅ Download e salvamento de mídia (imagens e vídeos)
- ✅ Sistema de backup duplo (diretório principal + backup local)
- ✅ Estatísticas detalhadas de captura
- ✅ Logs detalhados para troubleshooting
- ✅ Limpeza automática de arquivos antigos

### 2. ViewOnceCommand
**Arquivo:** `src/commands/admin/viewonce.ts`

**Responsabilidades:**
- ✅ Comando `!viewonce` para gerenciar o sistema
- ✅ Visualização de estatísticas
- ✅ Listagem de arquivos capturados
- ✅ Reset de estatísticas
- ✅ Limpeza de arquivos antigos

### 3. Integração no Bot
**Arquivo:** `src/core/Bot.ts`

**Responsabilidades:**
- ✅ Captura automática de TODAS as mensagens
- ✅ Execução antes do processamento normal
- ✅ Tratamento de erros sem interromper o fluxo

## Funcionalidades

### 🎯 Captura Automática
- **Intercepta TODAS as mensagens** que chegam ao bot
- **Verifica automaticamente** se são de visualização única
- **Executa antes** do processamento normal do sistema
- **Não interfere** no fluxo de mensagens

### 📁 Sistema de Arquivos
- **Diretório Principal:** `G:\Meu Drive\ia`
- **Diretório de Backup:** `./viewonce_backup`
- **Nomenclatura:** `YYYY-MM-DD_HH-MM-SS_grupo_numero_tipo_messageId.extensao`
- **Exemplo:** `2025-06-28_14-46-21_120363388685888838_5521967233931_img_3EB09F251692D3B19F011F.jpeg`

### 📊 Estatísticas
- Total de mensagens capturadas
- Contagem de imagens vs vídeos
- Número de erros
- Timestamp da última captura
- Persistência em arquivo JSON

### 🧹 Limpeza Automática
- Remove arquivos com mais de 30 dias
- Limpa tanto diretório principal quanto backup
- Relatório detalhado de limpeza

## Comandos Disponíveis

### `!viewonce stats`
Mostra estatísticas de captura:
```
📊 ESTATÍSTICAS DE CAPTURA DE VISUALIZAÇÃO ÚNICA

🎯 Total Capturado: 15
📸 Imagens: 12
🎥 Vídeos: 3
❌ Erros: 0
🕐 Última Captura: 28/06/2025 14:46:21

Sistema captura automaticamente todas as mensagens de visualização única
```

### `!viewonce list [filtro]`
Lista arquivos capturados:
```
📁 ARQUIVOS CAPTURADOS

📂 Diretório Principal: 15 arquivos
💾 Backup: 15 arquivos

📂 Últimos 5 principais:
• 2025-06-28_14-46-21_120363388685888838_5521967233931_img_3EB09F251692D3B19F011F.jpeg
• 2025-06-28_14-45-30_120363388685888838_5521971200821_vid_52B97F999D612D12E213A3E1434B1BFB.mp4
```

**Filtros disponíveis:**
- `!viewonce list 2025-06` - Arquivos de junho/2025
- `!viewonce list img` - Apenas imagens
- `!viewonce list vid` - Apenas vídeos
- `!viewonce list 5521967233931` - Arquivos de um usuário específico

### `!viewonce reset`
Reseta todas as estatísticas:
```
🔄 ESTATÍSTICAS RESETADAS

✅ Todas as estatísticas foram zeradas
📊 Contadores reiniciados

Resetado por @5521967233931
```

### `!viewonce cleanup`
Remove arquivos antigos (30+ dias):
```
🧹 LIMPEZA CONCLUÍDA

🗑️ Arquivos principais removidos: 5
🗑️ Backups removidos: 5
📅 Critério: Arquivos com mais de 30 dias

Limpeza executada por @5521967233931
```

### `!viewonce help`
Mostra ajuda completa do comando.

## Logs e Debug

### Logs de Captura
```
[VIEW_ONCE] 🎯 CAPTURA INICIADA - ID: 3EB09F251692D3B19F011F
[VIEW_ONCE] Informações extraídas: { messageId: "3EB09F251692D3B19F011F", senderJid: "5521967233931@s.whatsapp.net", ... }
[VIEW_ONCE] Baixando imagem...
[VIEW_ONCE] Buffer obtido: 245760 bytes
[VIEW_ONCE] Arquivo salvo no diretório principal: G:\Meu Drive\ia\2025-06-28_14-46-21_120363388685888838_5521967233931_img_3EB09F251692D3B19F011F.jpeg
[VIEW_ONCE] Backup salvo: ./viewonce_backup/2025-06-28_14-46-21_120363388685888838_5521967233931_img_3EB09F251692D3B19F011F.jpeg
[VIEW_ONCE] ✅ CAPTURA CONCLUÍDA - image salvo em: G:\Meu Drive\ia\...
```

### Logs de Erro
```
[VIEW_ONCE] ❌ ERRO NA CAPTURA: Conteúdo da visualização única não encontrado
[VIEW_ONCE] ❌ ERRO CRÍTICO NA CAPTURA: Error: No SenderKeyRecord found for decryption
```

## Estrutura de Arquivos

```
📁 viewonce_backup/
├── 📄 stats.json                    # Estatísticas persistentes
├── 📄 capture_log.json             # Log detalhado de capturas
├── 🖼️ 2025-06-28_14-46-21_...jpeg  # Backup de imagens
└── 🎥 2025-06-28_14-45-30_...mp4   # Backup de vídeos

📁 G:\Meu Drive\ia\
├── 🖼️ 2025-06-28_14-46-21_...jpeg  # Imagens capturadas
└── 🎥 2025-06-28_14-45-30_...mp4   # Vídeos capturados
```

## Vantagens do Sistema

### ✅ Garantia de Captura
- **Captura TODAS** as mensagens de visualização única
- **Independente** de filtros do sistema principal
- **Executa antes** do processamento normal
- **Não perde** nenhuma mensagem

### ✅ Sistema Robusto
- **Backup duplo** (principal + local)
- **Tratamento de erros** sem interromper fluxo
- **Logs detalhados** para troubleshooting
- **Estatísticas persistentes**

### ✅ Fácil Gerenciamento
- **Comandos intuitivos** para administração
- **Filtros flexíveis** para busca de arquivos
- **Limpeza automática** de arquivos antigos
- **Relatórios detalhados**

### ✅ Compatibilidade
- **Não interfere** no sistema existente
- **Mantém** funcionalidades antigas
- **Adiciona** novas funcionalidades
- **Integração** transparente

## Como Funciona

1. **Mensagem chega** ao bot via `messages.upsert`
2. **ViewOnceCaptureService** intercepta a mensagem
3. **Verifica** se é visualização única
4. **Se sim**, baixa e salva automaticamente
5. **Continua** o processamento normal da mensagem
6. **Se não**, ignora e continua normalmente

## Monitoramento

### Logs Importantes
- `[VIEW_ONCE] 🎯 CAPTURA INICIADA` - Nova captura
- `[VIEW_ONCE] ✅ CAPTURA CONCLUÍDA` - Captura bem-sucedida
- `[VIEW_ONCE] ❌ ERRO NA CAPTURA` - Erro na captura
- `[VIEW_ONCE] 🧹 LIMPEZA CONCLUÍDA` - Limpeza executada

### Métricas
- **Taxa de sucesso** = (total - erros) / total
- **Volume diário** = arquivos por dia
- **Distribuição** = imagens vs vídeos
- **Performance** = tempo de captura

## Troubleshooting

### Problema: Arquivos não estão sendo salvos
**Solução:**
1. Verificar permissões do diretório `G:\Meu Drive\ia`
2. Verificar logs de erro no console
3. Usar `!viewonce stats` para verificar estatísticas

### Problema: Erros de captura
**Solução:**
1. Verificar logs detalhados
2. Verificar conectividade com WhatsApp
3. Verificar espaço em disco

### Problema: Comando não funciona
**Solução:**
1. Verificar se é admin do grupo
2. Verificar sintaxe do comando
3. Usar `!viewonce help` para ver opções

## Status

✅ **IMPLEMENTADO E FUNCIONAL**
- Sistema de captura automática
- Comandos de administração
- Sistema de backup
- Logs e estatísticas
- Limpeza automática

## Próximos Passos

1. **Monitorar** logs em produção
2. **Ajustar** configurações conforme necessário
3. **Otimizar** performance se necessário
4. **Adicionar** suporte para outros tipos de mídia se necessário 