# 🤖 Amanda Bot - WhatsApp AI Assistant

Um bot inteligente para WhatsApp desenvolvido em TypeScript, com integração com Gemini AI, MongoDB Atlas e sistema avançado de captura de visualizações únicas.

## 🚀 Características Principais

### 🤖 **Inteligência Artificial**
- **Gemini AI Integration**: Respostas inteligentes e contextualizadas
- **Sistema de Fallback**: Múltiplas chaves API para alta disponibilidade
- **Personalidades Dinâmicas**: Diferentes personalidades por grupo
- **Contexto Completo**: Entende conversas e respostas a mensagens

### 🕵️ **Sistema de Visualizações Únicas (24h Automático)**
- **Captura Automática**: Monitora todas as mensagens 24h por dia
- **Detecção Inteligente**: Suporta múltiplos formatos de visualização única
- **Nomenclatura Organizada**: `{grupo}_{numero}_{timestamp}.{extensão}`
- **Localização**: `G:\Meu Drive\ia\vu\`
- **Logs Detalhados**: Acompanhamento completo das capturas

### 📱 **Funcionalidades Avançadas**
- **Comandos Administrativos**: Gerenciamento completo de grupos
- **Sistema de Jogos**: Jogos interativos em chat privado
- **Extração de Perfis**: Comando `.bio` para capturar dados de usuários
- **Captura de Mídia**: Sistema automático de backup de mídias
- **Function Calling**: Comandos via linguagem natural

## 🛠️ Tecnologias Utilizadas

- **TypeScript**: Linguagem principal
- **Baileys**: Biblioteca WhatsApp Web
- **Gemini AI**: Inteligência artificial do Google
- **MongoDB Atlas**: Banco de dados em nuvem
- **Inversify**: Injeção de dependências
- **Node.js**: Runtime JavaScript

## 📋 Pré-requisitos

- Node.js v18+
- MongoDB Atlas (conta gratuita)
- Gemini AI API Key
- WhatsApp Web conectado

## ⚙️ Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd euquefiz
```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   ```bash
cp .env.example .env
```

Edite o arquivo `.env`:
```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/database
GEMINI_API_KEY_1=sua_chave_api_1
GEMINI_API_KEY_2=sua_chave_api_2
# ... adicione mais chaves conforme necessário
```

4. **Execute o bot**
```bash
npm run dev
```
## 🎮 Comandos Disponíveis

### **Administrativos**
- `!admins` - Lista todos os admins do grupo
- `!banir @usuario` - Remove usuário e adiciona à blacklist
- `!promover @usuario` - Promove usuário a admin
- `!silenciar` - Restringe mensagens (só admins)
- `!liberar` - Libera mensagens para todos
- `!apagar` - Apaga mensagens do grupo

### **Informativos**
- `!topativos` - Mostra membros mais ativos
- `!inativos` - Mostra membros inativos
- `!novatos` - Mostra novos membros
- `!status` - Status do bot
- `!person` - Mostra personalidade ativa

### **Diversão**
- `!fofoca` - Gera fofoca aleatória
- `!intriga` - Gera intriga provocativa
- `!casal` - Marca casal aleatório
- `!menage` - Marca 3 pessoas para ménage
- `!suruba` - Marca 5 pessoas
- `!bafometro` - Mede nível de álcool
- `!cornometro` - Mede nível de corno
- `!gaydometro` - Mede porcentagem gay

### **Utilitários**
- `!sticker` - Converte imagem em sticker
- `!tempo cidade` - Mostra clima
- `!ping` - Teste de conectividade
- `!menu` - Menu de comandos
- `.bio` - Extrai dados de perfil

### **Sistema**
- `!midia` - Estatísticas de mídia capturada
- `!logs` - Análise de logs do sistema
- `!cache` - Estatísticas do cache
- `!performance` - Métricas de performance

## 🎭 Sistema de Personalidades

O bot possui diferentes personalidades que podem ser ativadas por grupo:

- **Padrão**: Personalidade geral e amigável
- **Grupo**: Personalidade para grupos sociais
- **Cartomante**: Personalidade mística e misteriosa
- **Privado**: Personalidade para conversas individuais

### **Comando de Personalidade**
```bash
!person [nome_da_personalidade]
```

## 📊 Sistema de Captura de Mídia

### **Mídias Normais**
- **Localização**: `G:\Meu Drive\ia\`
- **Formato**: `{grupo}_{numero}_{timestamp}.{extensão}`
- **Tipos**: Imagens, vídeos, áudios, documentos, stickers

### **Visualizações Únicas**
- **Localização**: `G:\Meu Drive\ia\vu\`
- **Formato**: `{grupo}_{numero}_{timestamp}.{extensão}`
- **Captura**: Automática 24h por dia

## 🔧 Configuração Avançada

### **Estrutura de Diretórios**
```
src/
├── commands/          # Comandos do bot
├── services/          # Serviços principais
├── core/             # Núcleo do sistema
├── handlers/         # Handlers de eventos
├── config/           # Configurações
└── interfaces/       # Interfaces TypeScript
```

### **Serviços Principais**
- `AIService`: Integração com Gemini AI
- `ViewOnceWatcherService`: Sistema de visualizações únicas
- `MediaCaptureService`: Captura de mídias normais
- `BioExtractorService`: Extração de dados de perfil
- `PersonalityService`: Gerenciamento de personalidades

## 📈 Monitoramento e Logs

### **Logs Disponíveis**
- **Sistema**: Logs de inicialização e saúde
- **Mensagens**: Processamento de mensagens
- **IA**: Interações com Gemini AI
- **Visualizações Únicas**: Capturas automáticas
- **Mídia**: Capturas de mídias normais

### **Comandos de Monitoramento**
- `!logs` - Análise detalhada de logs
- `!performance` - Métricas de performance
- `!status` - Status geral do sistema

## 🚨 Troubleshooting

### **Problemas Comuns**

1. **Bot não conecta**
   - Verifique a conexão com internet
   - Confirme se o WhatsApp Web está ativo
   - Verifique as variáveis de ambiente

2. **Visualizações únicas não capturam**
   - Verifique se a pasta `G:\Meu Drive\ia\vu\` existe
   - Confirme se o sistema está ativo nos logs
   - Teste enviando uma visualização única

3. **IA não responde**
   - Verifique as chaves da API Gemini
   - Confirme se há créditos disponíveis
   - Verifique os logs de erro

### **Logs de Debug**
```bash
npm run dev
```
Os logs detalhados aparecem no console, incluindo:
- Processamento de mensagens
- Detecção de visualizações únicas
- Interações com IA
- Erros e warnings

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte e dúvidas:
- Abra uma issue no GitHub
- Verifique a documentação
- Consulte os logs do sistema

---

**Desenvolvido com ❤️ para capturar todas as visualizações únicas do WhatsApp! 🕵️** 