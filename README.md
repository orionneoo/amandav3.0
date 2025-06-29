# Amanda - Bot de WhatsApp com IA, Comandos, Onboarding e Feedback

Amanda é um bot de WhatsApp em Node.js/TypeScript, com integração Gemini AI, MongoDB Atlas, arquitetura plug-and-play para comandos, foco em grupos, diversão, utilidade e administração. Ela tem onboarding inteligente para admins, comando de feedback direto para o dono, contexto persistente e respostas naturais, sempre com um toque carioca e provocador.

---

## ✨ Principais Funcionalidades

- **Responde com personalidade definida (Amanda, sexy working, criada por Orion)**
- **Onboarding automático para novos admins e grupos**
- **Comando de feedback direto para o dono**
- **Integração com Gemini AI** (contexto, histórico, system prompt detalhado)
- **Comandos dinâmicos** (administração, utilidade, diversão, ranking, stickers)
- **Arquitetura expansível** (plug-and-play, barrel exports, path aliases)
- **Persistência de contexto e ranking** (MongoDB Atlas)
- **Controle de menções e respostas em grupo (menções azuis)**
- **Logs detalhados para depuração (apenas para dev, não aparecem para usuário)**
- **Blacklist automática**
- **Simulação de digitação e delay realista nas respostas da IA**

---

## 🚀 Como rodar

1. **Clone o repositório**
2. **Configure o `.env`** com as chaves do WhatsApp, Gemini e MongoDB
3. **Instale as dependências**
   ```bash
   npm install
   ```
4. **Rode o bot**
   ```bash
   npm run build && npm start
   ```
5. **Escaneie o QR code no WhatsApp**

---

## 🛠️ Estrutura de Comandos

### Utilitários e Diversão

- `!menu` — Exibe o menu de comandos e informações do bot
- `!ping` — Responde com Pong!
- `!sticker` — Converte imagem em figurinha (responda a uma imagem)
- `!coinflip` — Cara ou coroa
- `!bafometro` — Mede seu nível de álcool 🍻
- `!gaydometro` — Mede quanto por cento gay você é 🌈
- `!cornometro` — Mede nível de corno 🫣
- `!sexyometro` — Mede nível de sexy 😏
- `!sorte` — Dá um conselho ou sorte do dia 🔮
- `!crushometro @user` — Mede chance com crush 💘
- `!nojoometro` — Mede nível de nojo 🤢
- `!nerdometro` — Mede nível de nerd 🤓
- `!velhaometro` — Mede idade mental 🧓
- `!par` — Marca 2 pessoas aleatórias do grupo para formar um par 💘
- `!menage` — Marca 3 pessoas aleatórias do grupo para um ménage 🔥

### Administração e Moderação

- `!banir @user` — Bane e adiciona à blacklist
- `!remover @user` — Remove membro do grupo
- `!promover @user` — Promove a admin (com onboarding automático)
- `!rebaixar @user` — Remove admin
- `!silenciar` — Só admins podem falar
- `!liberar` — Libera o grupo para todos
- `!boasvindas` — Configura mensagens de boas-vindas e despedida
- `!comandos` — Gerencia comandos ativos/inativos
- `!apagar @user` — Apaga mensagens de um usuário
- `!desbanir @user` — Remove da blacklist
- `!admins` — Lista os admins do grupo
- `!grupo` — Mostra informações do grupo
- `!limpar` — Limpa mensagens do grupo

### Ranking e Atividade

- `!topativos [dias]` — Top usuários mais ativos
- `!inativos [dias]` — Lista inativos
- `!novatos [dias]` — Lista novatos

### Inteligência Artificial

- Amanda responde com personalidade, contexto e histórico.
- Só responde em grupo se for mencionada (@5521971200821) ou se for reply a uma mensagem dela.
- Mensagens de boas-vindas e despedida são geradas via IA, marcando o usuário.
- Delay e simulação de digitação para respostas mais humanas.

### Feedback e Sugestões

- `!feedback <mensagem>` — Envia feedback, sugestão ou bug diretamente para o dono do bot (número: +55 21 96723-3931)
- O feedback é enviado em privado para o desenvolvedor, com contexto do grupo e usuário.
- Usuário recebe confirmação automática de envio.

---

## 🆕 Onboarding Inteligente para Admins

- **Quando um novo admin é promovido:**
  - Ele recebe uma mensagem privada com um guia rápido dos comandos de administração, dicas e contato do dono.
- **Quando o bot entra em um novo grupo:**
  - Todos os admins recebem onboarding automático no privado.
- **O onboarding inclui:**
  - Como usar `!boasvindas`, `!comandos`, `!ia`, `!person`, e outros comandos de administração.
  - Dicas de uso, contato para suporte e exemplos.

---

## 🛡️ Blacklist

- Quem for banido com `!banir` é adicionado à blacklist e expulso automaticamente se tentar voltar.

---

## 📦 Organização do Projeto

- **TypeScript, Node.js, Baileys, MongoDB Atlas**
- **Arquitetura modular** (comandos em `src/commands/`)
- **Singleton para serviços**
- **Aliases e barrel exports**
- **Foco em clareza, expansibilidade e personalização**

---

## 👤 Personalidade da Amanda

Amanda é uma IA com personalidade sexy, provocadora, carioca, profissional do prazer, criada para entreter, moderar e vender. Ela segue um system prompt detalhado, com arquétipos, regras de comunicação, monetização e respostas sempre contextualizadas.

---

## 🧑‍💻 Robustez e Experiência do Usuário

- **Bot não responde mensagens antigas** (enviadas enquanto estava offline)
- **Menções funcionam corretamente e ficam azuis**
- **Onboarding automático para admins e grupos**
- **Feedback fácil e direto para o dono**
- **Logs de debug não aparecem para o usuário**
- **Código validado, robusto e sem erros de compilação**

---

## 📄 Licença

MIT

---

## 📚 Exemplos de Uso

- Promova um usuário a admin e veja se ele recebe o onboarding no privado.
- Adicione o bot a um novo grupo e confira se os admins recebem o guia.
- Use `!feedback <mensagem>` em grupo ou privado e confira se o dono recebe.
- Envie mensagens enquanto o bot está offline e veja se ele ignora ao voltar.
- Teste menções para garantir que ficam azuis.
- Compile com `npm run build` para garantir ausência de erros.

---

Se quiser adicionar exemplos de uso, prints ou mais detalhes técnicos, só pedir! 