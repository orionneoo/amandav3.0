# 🔐 Comandos Exclusivos do Dono

Este documento descreve os comandos exclusivos disponíveis apenas para o **DONO** do bot (número: +55 21 96723-3931).

## 🔑 Autenticação

Todos os comandos do dono requerem autenticação prévia:

```
!dono senha We1802!
```

Após a autenticação bem-sucedida, você terá acesso total aos comandos do dono.

## 📊 Comandos de Informação

### Status do Bot
```
!dono status
```
Mostra o status atual do bot:
- Uptime (tempo online)
- Uso de memória e CPU
- Número de grupos e usuários
- Mensagens, IA e comandos do dia
- Status de performance

### Estatísticas Gerais
```
!dono estatisticas [periodo]
```
Estatísticas detalhadas por período:
- Total de mensagens
- Requisições de IA
- Comandos executados
- Erros registrados
- Usuários únicos
- Grupos ativos
- Top comandos mais usados
- Top grupos mais ativos

**Períodos disponíveis:** `hoje`, `ontem`, `semana`, `mes`

### Logs de Erro
```
!dono erros [periodo]
```
Mostra os últimos erros registrados:
- Timestamp do erro
- Ação que causou o erro
- Usuário e grupo afetados
- Mensagem de erro detalhada

### Lista de Grupos
```
!dono grupos
```
Lista todos os grupos onde o bot está presente:
- Nome do grupo
- Número de participantes
- Mensagens do dia
- Requisições de IA do dia
- Status de atividade

## 📢 Comandos de Broadcast

### Enviar Mensagem para Todos os Grupos
```
!dono broadcast [sua_mensagem]
```
Envia uma mensagem de texto para todos os grupos onde o bot está presente.

### Enviar Foto para Todos os Grupos
```
!dono foto
```
1. Execute o comando
2. Envie a foto que deseja transmitir
3. A foto será enviada para todos os grupos automaticamente

### Alterar Foto do Bot
```
!dono alterarfoto
```
1. Execute o comando
2. Envie a nova foto de perfil
3. A foto do bot será alterada imediatamente

## 📈 Estatísticas Específicas

### Estatísticas de Comandos
```
!dono comandos [periodo]
```
- Total de comandos executados
- Taxa de sucesso
- Comandos mais usados
- Comandos mais lentos

### Estatísticas da IA (Gemini)
```
!dono gemini [periodo]
```
- Total de requisições
- Taxa de sucesso
- Tempo médio de resposta
- Uso por chave API
- Uso por modelo
- Grupos que mais usam IA

## 👥 Gerenciamento de Usuários

### Listar Usuários
```
!usuarios listar [quantidade]
```
Lista os usuários mais recentes do bot.

### Buscar Usuário Específico
```
!usuarios buscar [numero]
```
Busca informações detalhadas de um usuário específico.

### Estatísticas de Usuários
```
!usuarios estatisticas [periodo]
```
- Total de usuários
- Usuários ativos
- Novos usuários
- Usuários mais ativos

## 🛠️ Comandos de Manutenção

### Limpar Dados
```
!dono limpar [tipo]
```
**Tipos disponíveis:**
- `cache` - Limpa o cache do sistema
- `logs` - Limpa todos os logs
- `tudo` - Limpa cache e logs

### Reiniciar Bot
```
!dono reiniciar
```
Reinicia o bot automaticamente após 5 segundos.

### Logout
```
!dono logout
```
Desconecta da sessão do dono (requer nova autenticação).

## 💡 Exemplos de Uso

### Broadcast de Manutenção
```
!dono broadcast 🔧 Manutenção programada às 2h da manhã. O bot ficará offline por alguns minutos.
```

### Verificar Performance
```
!dono status
!dono estatisticas hoje
!dono erros hoje
```

### Análise Semanal
```
!dono estatisticas semana
!dono comandos semana
!dono gemini semana
```

### Gerenciar Usuários
```
!usuarios listar 50
!usuarios buscar 21999999999
!usuarios estatisticas mes
```

## 🔒 Segurança

- **Acesso exclusivo:** Apenas o número +55 21 96723-3931 pode usar estes comandos
- **Autenticação obrigatória:** Senha requerida para cada sessão
- **Comandos privados:** Só funcionam em conversa privada com o bot
- **Logs de auditoria:** Todas as ações são registradas

## ⚠️ Importante

- Use estes comandos com responsabilidade
- O broadcast afeta todos os grupos simultaneamente
- A reinicialização interrompe temporariamente o serviço
- Mantenha a senha segura e não a compartilhe

## 🆘 Suporte

Em caso de problemas com os comandos do dono, entre em contato com o desenvolvedor através do número oficial do bot. 