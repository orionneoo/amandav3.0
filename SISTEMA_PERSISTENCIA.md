# 🗄️ SISTEMA DE PERSISTÊNCIA - AMANDA BOT

## 📋 Visão Geral

O sistema de persistência da Amanda foi completamente reformulado para garantir:
- **Persistência completa** de todas as mensagens do WhatsApp
- **Resumos diários automáticos** com estatísticas detalhadas
- **Fallback local** em JSON quando o MongoDB estiver indisponível
- **Backup automático** e sincronização de dados
- **Índices otimizados** para consultas rápidas
- **TTL automático** para limpeza de dados antigos

---

## 🏗️ Arquitetura do Sistema

### **Camadas de Persistência**

```
┌─────────────────────────────────────┐
│           MESSAGE MANAGER           │ ← Recebe mensagens do WhatsApp
├─────────────────────────────────────┤
│         DATABASE SERVICE            │ ← Orquestra persistência
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │      MONGODB ATLAS          │    │ ← Banco principal
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │   LOCAL HISTORY SERVICE     │    │ ← Fallback local
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### **Fluxo de Dados**

1. **Mensagem recebida** → MessageManager
2. **Processamento** → Extração de dados e contexto
3. **Persistência** → DatabaseService decide onde salvar
4. **Fallback** → Se MongoDB falhar, salva localmente
5. **Sincronização** → Dados locais sincronizados quando possível

---

## 📊 Modelos do MongoDB

### **Message (Mensagens)**
```typescript
{
  _id: string,              // message.key.id
  jid: string,              // grupo ou usuário
  from: string,             // quem enviou
  to: string,               // para quem foi enviado
  participant?: string,     // participante em grupos
  timestamp: number,        // timestamp da mensagem
  type: string,             // tipo da mensagem
  text?: string,            // texto da mensagem
  media?: {                 // informações de mídia
    type: string,
    url?: string,
    mimetype?: string,
    size?: number
  },
  quotedMessage?: {         // mensagem citada
    id: string,
    text?: string,
    from?: string
  },
  isFromMe: boolean,        // se foi enviada pelo bot
  isGroup: boolean,         // se é mensagem de grupo
  mentions?: string[],      // usuários mencionados
  commandUsed?: {           // comando usado
    name: string,
    args: string[]
  },
  personality?: string,     // personalidade ativa
  createdAt: Date
}
```

### **DailySummary (Resumos Diários)**
```typescript
{
  groupJid: string,
  date: string,             // formato YYYY-MM-DD
  personality: string,
  totalMessages: number,
  totalMembers: number,
  totalAdmins: number,
  topUsers: [{              // top 5 usuários mais ativos
    jid: string,
    name: string,
    messageCount: number
  }],
  topCommands: [{           // top 5 comandos mais usados
    name: string,
    count: number
  }],
  popularPhrases: [{        // frases populares
    text: string,
    count: number,
    engagement: number
  }],
  aiInteractions: number,
  mediaCount: {             // contagem de mídia
    images: number,
    videos: number,
    audios: number,
    documents: number,
    stickers: number
  },
  peakActivityHour: number, // hora de pico
  createdAt: Date
}
```

### **CommandUsage (Uso de Comandos)**
```typescript
{
  groupJid: string,
  command: string,
  user: string,             // quem usou
  count: number,
  lastUsed: Date,
  totalUsage: number,
  createdAt: Date
}
```

### **ErrorLogs (Logs de Erro)**
```typescript
{
  error: string,
  stack?: string,
  user?: string,
  group?: string,
  command?: string,
  timestamp: Date,
  location: string,         // arquivo/função
  severity: 'low' | 'medium' | 'high' | 'critical',
  context?: Record<string, any>
}
```

---

## 🔧 Índices e Performance

### **Índices Principais**

#### **Message Collection**
```javascript
// Índices compostos para otimização
{ jid: 1, timestamp: -1 }                    // Buscar mensagens por grupo e período
{ jid: 1, from: 1, timestamp: -1 }           // Buscar mensagens de usuário específico
{ jid: 1, type: 1, timestamp: -1 }           // Buscar por tipo de mensagem
{ 'commandUsed.name': 1, timestamp: -1 }     // Estatísticas de comandos
{ personality: 1, timestamp: -1 }            // Análise por personalidade
```

#### **DailySummary Collection**
```javascript
{ groupJid: 1, date: 1 }                     // Índice único para evitar duplicatas
{ date: 1, totalMessages: -1 }               // Ranking de grupos por atividade
{ personality: 1, date: 1 }                  // Análise por personalidade
{ createdAt: 1 }                             // Consultas por período
```

#### **CommandUsage Collection**
```javascript
{ groupJid: 1, command: 1, user: 1 }         // Índice único
{ command: 1, count: -1 }                    // Ranking de comandos
{ groupJid: 1, count: -1 }                   // Comandos por grupo
{ user: 1, count: -1 }                       // Comandos por usuário
{ lastUsed: 1 }                              // Comandos recentes
```

### **TTL (Time To Live)**

```javascript
// ErrorLogs: 7 dias
{ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }

// CommandUsage: 30 dias
{ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }

// DailySummary: 90 dias
{ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }
```

---

## 📁 Sistema de Fallback Local

### **Estrutura de Arquivos**
```
local_history/
├── 2025-06-22/
│   ├── 120363025123456789@g.us.json
│   ├── 120363025987654321@g.us.json
│   └── ...
├── 2025-06-23/
│   ├── 120363025123456789@g.us.json
│   └── ...
└── ...
```

### **Formato dos Arquivos JSON**
```json
{
  "groupId": "120363025123456789@g.us",
  "date": "2025-06-22",
  "messages": [
    {
      "id": "ABC123",
      "from": "5521967233931@s.whatsapp.net",
      "timestamp": 1719420000,
      "text": "Olá, pessoal!",
      "type": "textMessage",
      "commandUsed": {
        "name": "resumo",
        "args": []
      },
      "personality": "padrao"
    }
  ],
  "stats": {
    "totalMessages": 85,
    "topUsers": [
      {
        "jid": "5521967233931@s.whatsapp.net",
        "name": "5521967233931",
        "messageCount": 15
      }
    ],
    "topCommands": [
      {
        "name": "resumo",
        "count": 5
      }
    ]
  },
  "dailySummary": {
    "groupJid": "120363025123456789@g.us",
    "date": "2025-06-22",
    "personality": "padrao",
    "totalMessages": 85,
    "totalMembers": 45,
    "totalAdmins": 3,
    "topUsers": [...],
    "topCommands": [...],
    "popularPhrases": [...],
    "aiInteractions": 12,
    "mediaCount": {
      "images": 8,
      "videos": 3,
      "audios": 2,
      "documents": 1,
      "stickers": 5
    },
    "peakActivityHour": 14
  }
}
```

---

## ⚙️ Serviços Implementados

### **DatabaseService**
- **saveMessage()**: Salva mensagem no MongoDB ou local
- **getMessagesOfDay()**: Busca mensagens de um dia específico
- **generateSummary()**: Gera resumo diário
- **saveCommandUsage()**: Registra uso de comando
- **saveErrorLog()**: Salva log de erro
- **syncLocalData()**: Sincroniza dados locais
- **createBackup()**: Cria backup dos dados locais
- **isMongoConnected()**: Verifica status da conexão

### **LocalHistoryService**
- **saveMessage()**: Salva mensagem em arquivo JSON
- **saveDailySummary()**: Salva resumo diário local
- **getMessagesOfDay()**: Busca mensagens locais
- **getDailySummary()**: Busca resumo local
- **syncWithMongoDB()**: Sincroniza com MongoDB
- **getAllLocalFiles()**: Lista arquivos locais
- **createBackup()**: Cria backup dos arquivos

### **DailySummaryService**
- **generateDailySummaries()**: Gera resumos para todos os grupos
- **generateSummaryForGroup()**: Gera resumo para grupo específico
- **getDailySummary()**: Busca resumo (MongoDB ou local)
- **getSummariesForPeriod()**: Busca resumos de período

### **SchedulerService**
- **start()**: Inicia todos os agendadores
- **stop()**: Para todos os agendadores
- **runDailySummaryNow()**: Executa resumo manualmente
- **runSyncNow()**: Executa sincronização manualmente

---

## 🎯 Comandos Implementados

### **!resumo [data]**
- Mostra resumo detalhado do grupo
- Gera resumo automaticamente se não existir
- Suporta data específica (YYYY-MM-DD)

### **!historico [data] [usuario]**
- Busca histórico de mensagens
- Filtra por data e/ou usuário
- Exclusivo para administradores

### **!backup**
- Cria backup dos dados locais
- Sincroniza com MongoDB
- Exclusivo para o dono

---

## 🔄 Agendadores Automáticos

### **Resumos Diários**
- **Frequência**: Diária às 00:00
- **Ação**: Gera resumos para todos os grupos ativos
- **Fallback**: Se falhar, tenta novamente na próxima execução

### **Sincronização de Dados**
- **Frequência**: A cada 6 horas
- **Ação**: Sincroniza dados locais com MongoDB
- **Fallback**: Continua funcionando mesmo se falhar

---

## 📈 Monitoramento e Logs

### **Logs Automáticos**
- Persistência de mensagens
- Geração de resumos
- Sincronização de dados
- Erros de conexão
- Performance de consultas

### **Métricas Coletadas**
- Total de mensagens por dia
- Usuários mais ativos
- Comandos mais usados
- Interações com IA
- Tipos de mídia enviados
- Hora de pico de atividade

---

## 🛡️ Segurança e Privacidade

### **Proteções Implementadas**
- **Fallback local**: Dados não se perdem se MongoDB falhar
- **Backup automático**: Cópias de segurança regulares
- **TTL automático**: Limpeza de dados antigos
- **Logs de erro**: Rastreamento de problemas
- **Validação de dados**: Prevenção de dados corrompidos

### **Dados Sensíveis**
- Mensagens são salvas com contexto completo
- Informações de usuários são preservadas
- Comandos e interações são registrados
- Personalidades ativas são mantidas

---

## 🚀 Como Usar

### **Inicialização**
O sistema é inicializado automaticamente quando o bot inicia:
```typescript
// No Bot.ts
this.schedulerService.start();
```

### **Comandos Disponíveis**
```bash
# Resumo do dia atual
!resumo

# Resumo de data específica
!resumo 2025-06-22

# Histórico de hoje
!historico

# Histórico de data específica
!historico 2025-06-22

# Histórico de usuário específico
!historico 2025-06-22 @usuario

# Backup dos dados (apenas dono)
!backup
```

### **Monitoramento**
```bash
# Verificar logs
tail -f logs/bot.log

# Verificar arquivos locais
ls -la local_history/

# Verificar backup
ls -la backup_*/
```

---

## 🔧 Configuração

### **Variáveis de Ambiente**
```bash
# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=amanda_bot

# Configurações de persistência
CACHE_ENABLED=true
CACHE_TTL=3600
CACHE_MAX_SIZE=1000

# Logs
LOG_LEVEL=info
LOG_FILE=bot.log
```

### **Configurações de TTL**
```typescript
// Em src/config.ts
export const config = {
  persistence: {
    messageTTL: 30 * 24 * 60 * 60,    // 30 dias
    errorTTL: 7 * 24 * 60 * 60,       // 7 dias
    summaryTTL: 90 * 24 * 60 * 60,    // 90 dias
    commandTTL: 30 * 24 * 60 * 60     // 30 dias
  }
};
```

---

## 📊 Benefícios do Sistema

### **Para Usuários**
- **Resumos detalhados**: Estatísticas completas dos grupos
- **Histórico acessível**: Busca de mensagens antigas
- **Comandos funcionais**: !resumo e !historico sempre disponíveis

### **Para Administradores**
- **Monitoramento completo**: Visão geral da atividade
- **Backup seguro**: Dados sempre preservados
- **Análise de tendências**: Padrões de uso identificados

### **Para Desenvolvedores**
- **Arquitetura robusta**: Fallback automático
- **Performance otimizada**: Índices e TTL
- **Manutenibilidade**: Código modular e bem estruturado

---

## 🎯 Próximos Passos

### **Melhorias Planejadas**
- [ ] Dashboard web para visualização de dados
- [ ] Exportação de relatórios em PDF/Excel
- [ ] Alertas automáticos para eventos importantes
- [ ] Análise de sentimento das mensagens
- [ ] Integração com APIs externas para enriquecimento de dados

### **Otimizações Técnicas**
- [ ] Compressão de dados antigos
- [ ] Sharding para grandes volumes
- [ ] Cache distribuído com Redis
- [ ] Backup em nuvem automático

---

*Sistema implementado em: 22/06/2025*  
*Versão: 1.0.0*  
*Desenvolvedor: Wellington (Orion)* 