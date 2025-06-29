# 🤖 AMANDA - BOT DE WHATSAPP COMPLETO
## Documentação Completa do Sistema

---

## 📋 RESUMO EXECUTIVO

A **Amanda** é um bot de WhatsApp avançado desenvolvido em TypeScript/Node.js, que combina inteligência artificial (Gemini AI), sistema de personalidades dinâmicas, gerenciamento completo de grupos e uma arquitetura robusta e escalável. O bot é projetado para ser uma assistente virtual completa, com foco em entretenimento, moderação de grupos e interação inteligente.

---

## 🛠️ TECNOLOGIAS PRINCIPAIS

### **Baileys (Biblioteca WhatsApp)**
- **O que é:** Biblioteca não oficial para WhatsApp Web que permite criar bots e aplicações
- **Função no projeto:** Conecta o bot ao WhatsApp, gerencia mensagens, grupos, participantes e todas as interações
- **Vantagens:** Estável, suporta todas as funcionalidades do WhatsApp, incluindo mídia, stickers, grupos, etc.
- **Como usamos:** Para receber/enviar mensagens, gerenciar grupos, detectar menções, controlar admins

### **MongoDB Atlas (Banco de Dados)**
- **O que é:** Serviço de banco de dados na nuvem da MongoDB
- **Função no projeto:** Armazena todos os dados persistentes do bot
- **O que guardamos:**
  - Informações de grupos (membros, admins, configurações)
  - Personalidades ativas por grupo
  - Histórico de comandos e uso
  - Estatísticas de atividade
  - Configurações de cada grupo
  - Logs de erros e eventos

### **Gemini AI (Inteligência Artificial)**
- **O que é:** Modelo de IA da Google para geração de texto
- **Função no projeto:** Gera respostas inteligentes e contextualizadas
- **Como funciona:** Recebe o contexto da conversa e gera respostas naturais
- **Personalidades:** Cada grupo pode ter uma personalidade diferente da Amanda

### **TypeScript/Node.js**
- **Arquitetura:** Código tipado e organizado
- **Injeção de Dependências:** Usa Inversify para gerenciar serviços
- **Modular:** Cada funcionalidade em módulos separados

---

## 🎭 SISTEMA DE PERSONALIDADES

### **Conceito**
A Amanda tem 20 personalidades diferentes, cada uma com características únicas:
- **Padrão:** Carioca sexy e provocadora
- **Amante:** Especialista em segredos e conselhos íntimos
- **Casada:** Safada e cansada da rotina
- **Desviada:** Mistura sagrado com profano
- **Macumbeira:** Fala com força dos guias espirituais
- **Cartomante:** Charlatã que lê o futuro
- **Astróloga:** Culpa tudo em Mercúrio Retrógrado
- **Coach Quântica:** Só fala em "cocriar realidade"
- **Anitta:** Focada em business e marketing
- **Patroa:** Coach de empoderamento feminino
- **Policial:** Linha dura, fala em jargão policial
- **Faria Limer:** Usa "bróder", fala inglês de negócios
- **Dr. Fritz:** Sotaque alemão, super freudiano
- **Crente:** Recatada, chama todos de "varão"
- **Nerd:** Pedante e intelectual
- **Tia:** Manda "Bom dia" com glitter
- **Morty:** Gagueja, pessimista
- **Fofoqueira:** Cria e espalha boatos
- **Cupido:** Especialista em relacionamentos
- **Dona do Jogo:** Focada em jogos e economia

### **Como Funciona**
- Cada grupo pode ter uma personalidade diferente
- Admins podem mudar a personalidade com `!person [número]`
- A IA responde seguindo o estilo da personalidade ativa
- Personalidades afetam tom, vocabulário e temas de conversa

---

## 🏗️ ARQUITETURA DO SISTEMA

### **Estrutura de Pastas**
```
src/
├── commands/          # Comandos organizados por categoria
│   ├── admin/        # Comandos de administração
│   ├── ai/           # Comandos de IA
│   ├── owner/        # Comandos exclusivos do dono
│   ├── user/         # Comandos para usuários
│   └── utils/        # Comandos utilitários
├── services/         # Serviços principais
├── core/             # Núcleo do sistema
├── database/         # Modelos do banco de dados
├── personalities/    # Definições das personalidades
└── utils/            # Utilitários gerais
```

### **Serviços Principais**
- **AIService:** Gerencia interações com a Gemini AI
- **GroupService:** Controla dados e configurações dos grupos
- **DatabaseService:** Interface com o MongoDB
- **CacheService:** Cache para melhorar performance
- **OnboardingService:** Mensagens de boas-vindas para admins
- **OwnerService:** Funcionalidades exclusivas do dono

---

## 📱 FUNCIONALIDADES PRINCIPAIS

### **Comandos de Administração**
- **Gerenciamento de Membros:** Banir, promover, remover, desbanir
- **Controle do Grupo:** Silenciar, liberar, apagar mensagens
- **Estatísticas:** Top ativos, inativos, novatos
- **Configurações:** IA on/off, boas-vindas, comandos ativos/inativos

### **Comandos de Diversão**
- **Medidores:** Bafômetro, gaydômetro, cornômetro, sexyômetro
- **Relacionamentos:** Par, casal, ménage, suruba
- **Jogos:** PPP (Pega, Pensa, Passa), sorte, coinflip
- **IA:** Fofoca, intriga (geram histórias maliciosas)

### **Comandos Utilitários**
- **Menu:** Sistema completo de ajuda com submenus
- **Status:** Informações do bot
- **Sticker:** Converte imagens em figurinhas
- **Tempo:** Previsão do tempo
- **Resumo:** Estatísticas do grupo

### **Comandos do Dono**
- **Broadcast:** Envia mensagens para todos os grupos
- **Estatísticas:** Relatórios detalhados de uso
- **Manutenção:** Limpar cache, logs, reiniciar
- **Sincronização:** Atualizar dados de todos os grupos

---

## 🗄️ BANCO DE DADOS (MongoDB Atlas)

### **Coleções Principais**

#### **Groups (Grupos)**
Armazena informações completas de cada grupo:
- Nome, descrição, participantes
- Admins e configurações
- Personalidade ativa
- Configurações de comandos
- Timestamps de criação/atualização

#### **CommandUsage (Uso de Comandos)**
Estatísticas de uso dos comandos:
- Qual comando foi usado
- Quem usou
- Quando foi usado
- Quantas vezes por período

#### **GroupActivity (Atividade do Grupo)**
Log de atividades:
- Mensagens enviadas
- Participantes que entraram/saíram
- Mudanças de admin
- Eventos importantes

#### **ErrorLogs (Logs de Erro)**
Registro de erros para debug:
- Tipo de erro
- Contexto (grupo, usuário, comando)
- Stack trace
- Timestamp

### **Vantagens do MongoDB Atlas**
- **Escalabilidade:** Cresce automaticamente
- **Backup:** Backups automáticos
- **Segurança:** Criptografia e autenticação
- **Performance:** Índices otimizados
- **Monitoramento:** Métricas em tempo real

---

## 🤖 INTELIGÊNCIA ARTIFICIAL (Gemini)

### **Como Funciona**
1. **Contexto:** Bot envia histórico da conversa + personalidade ativa
2. **System Prompt:** Define comportamento e regras da Amanda
3. **Geração:** Gemini gera resposta seguindo a personalidade
4. **Processamento:** Bot formata e envia a resposta

### **Personalização**
- **Contexto Persistente:** Lembra de conversas anteriores
- **Personalidades Dinâmicas:** Cada grupo tem personalidade diferente
- **Tom Consistente:** Mantém o estilo da personalidade ativa
- **Respostas Contextuais:** Entende o contexto da conversa

### **Limitações e Tratamento**
- **Rate Limiting:** Controle de velocidade de requisições
- **Fallbacks:** Respostas padrão quando IA falha
- **Cache:** Evita requisições repetidas
- **Múltiplas Chaves:** Usa várias chaves API para redundância

---

## 🔧 SISTEMA DE COMANDOS

### **Arquitetura Plug-and-Play**
- **Injeção de Dependências:** Cada comando é independente
- **Categorização:** Comandos organizados por tipo
- **Aliases:** Múltiplos nomes para o mesmo comando
- **Cooldown:** Controle de velocidade de uso
- **Permissões:** Verificação de admin/dono

### **Tipos de Comando**
1. **Admin:** Só para administradores
2. **Owner:** Só para o dono do bot
3. **User:** Para todos os usuários
4. **Utils:** Comandos utilitários
5. **AI:** Comandos que usam inteligência artificial

### **Sistema de Menções**
- **Detecção:** Identifica quando o bot é mencionado
- **Respostas:** Só responde a menções ou respostas
- **Contexto:** Mantém contexto da conversa
- **Personalidade:** Responde seguindo a personalidade ativa

---

## 📊 MONITORAMENTO E ESTATÍSTICAS

### **Métricas Coletadas**
- **Uso de Comandos:** Quantas vezes cada comando foi usado
- **Atividade de Grupos:** Mensagens, participantes, eventos
- **Performance da IA:** Tempo de resposta, taxa de sucesso
- **Erros:** Tipos, frequência, contexto
- **Usuários:** Atividade, comandos favoritos

### **Relatórios Disponíveis**
- **Diário:** Estatísticas do dia
- **Semanal:** Resumo da semana
- **Mensal:** Análise mensal
- **Por Grupo:** Métricas específicas de cada grupo
- **Por Comando:** Uso detalhado de cada comando

---

## 🔒 SEGURANÇA E CONTROLE

### **Sistema de Permissões**
- **Dono:** Acesso total a todos os comandos
- **Admin:** Comandos de administração do grupo
- **Usuário:** Comandos básicos e diversão
- **Verificação:** Checagem automática de permissões

### **Proteções**
- **Rate Limiting:** Evita spam de comandos
- **Blacklist:** Usuários banidos não podem voltar
- **Validação:** Verificação de argumentos dos comandos
- **Logs:** Registro de todas as ações importantes

### **Backup e Recuperação**
- **MongoDB Atlas:** Backups automáticos
- **Logs:** Histórico completo de eventos
- **Configurações:** Backup de configurações importantes
- **Recuperação:** Processo de restauração em caso de problemas

---

## 🚀 DEPLOYMENT E MANUTENÇÃO

### **Ambiente de Produção**
- **Servidor:** Node.js em servidor Linux
- **Process Manager:** PM2 para gerenciar o processo
- **Logs:** Sistema de logs estruturados
- **Monitoramento:** Alertas para problemas

### **Atualizações**
- **Código:** Sistema de versionamento com Git
- **Dependências:** Atualizações regulares
- **Backup:** Backup antes de cada atualização
- **Rollback:** Capacidade de voltar versão anterior

### **Monitoramento**
- **Uptime:** Verificação de disponibilidade
- **Performance:** Métricas de resposta
- **Erros:** Alertas para erros críticos
- **Uso:** Monitoramento de recursos

---

## 💡 CASOS DE USO

### **Grupos de Entretenimento**
- Comandos de diversão e brincadeiras
- IA para conversas engraçadas
- Sistema de ranking de atividade
- Personalidades divertidas

### **Grupos de Trabalho**
- Moderação automática
- Estatísticas de participação
- Controle de comandos por necessidade
- Personalidades mais sérias

### **Grupos de Comunidade**
- Sistema de boas-vindas
- Feedback direto para administradores
- Controle granular de funcionalidades
- Personalidades adaptáveis

---

## 🔮 ROADMAP E MELHORIAS FUTURAS

### **Funcionalidades Planejadas**
- **Mais Personalidades:** Novas personalidades temáticas
- **Jogos Avançados:** Sistema de jogos mais complexos
- **Integração Externa:** APIs de terceiros
- **Analytics Avançado:** Relatórios mais detalhados
- **Multi-idioma:** Suporte a outros idiomas

### **Melhorias Técnicas**
- **Performance:** Otimização de velocidade
- **Escalabilidade:** Suporte a mais grupos
- **IA Avançada:** Modelos mais sofisticados
- **Interface Web:** Painel de controle web

---

## 📞 SUPORTE E CONTATO

### **Canais de Suporte**
- **Feedback:** Comando `!feedback` no bot
- **WhatsApp:** +55 21 96723-3931
- **Documentação:** Este arquivo e outros docs
- **Logs:** Sistema de logs para debug

### **Problemas Comuns**
- **Bot não responde:** Verificar se está online
- **Comando não funciona:** Verificar permissões
- **IA lenta:** Pode ser problema temporário
- **Erro de banco:** Verificar conexão MongoDB

---

## 🎯 CONCLUSÃO

A Amanda é um bot de WhatsApp completo e sofisticado, que combina:
- **Tecnologia Avançada:** IA, banco de dados, arquitetura robusta
- **Funcionalidades Ricas:** Comandos, personalidades, moderação
- **Experiência do Usuário:** Interface intuitiva, respostas naturais
- **Escalabilidade:** Suporte a múltiplos grupos e usuários
- **Manutenibilidade:** Código organizado, logs, monitoramento

O sistema é projetado para crescer e se adaptar às necessidades dos usuários, mantendo sempre a qualidade e confiabilidade do serviço.

---

*Documentação criada em: 22/06/2025*  
*Versão do Bot: 4.0.0*  
*Desenvolvedor: Wellington (Orion)* 