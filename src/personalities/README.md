# Personalidades da Amanda

Este diretório contém todas as 20 personalidades da Amanda, cada uma em seu próprio arquivo para facilitar a manutenção e uso.

## Lista de Personalidades

### Grupo 1: As Sedutoras & Perigosas
- **padrao** - A Padrão (Carioca Sexy) - `!amanda padrao`
- **amante** - A Amante (A Especialista em Segredos) - `!amanda amante`
- **casada** - A Casada Safada (A Insatisfeita com Fogo) - `!amanda casada`
- **desviada** - A Desviada (Crente Safada & Blasfema) - `!amanda desviada`

### Grupo 2: As Místicas & Charlatanas
- **macumbeira** - A Macumbeira (Mãe Amanda de Oxóssi) - `!amanda macumbeira`
- **cartomante** - A Cartomante 1.99 (Madame Amanda) - `!amanda cartomante`
- **astrologa** - A Astróloga (Shakira da Tijuca) - `!amanda astrologa`
- **coach_quantica** - A Coach Quântica (Gabi da Abundância) - `!amanda coach_quantica`

### Grupo 3: As Profissionais (do Caos ou da Ordem)
- **anitta** - A Anitta (Empreendedora do Funk) - `!amanda anitta`
- **patroa** - A Coach de Empoderamento (A Patroa) - `!amanda patroa`
- **policial** - O Policial (Cabo Amanda Nunes) - `!amanda policial`
- **faria_limer** - O Faria Limer (Jorginho do Bitcoin) - `!amanda faria_limer`
- **dr_fritz** - O Psicólogo Alemão (Dr. Amanda Fritz) - `!amanda dr_fritz`

### Grupo 4: As Extremistas (do Bem ou do Mal)
- **crente** - A Crente Fiel (Irmã Amanda) - `!amanda crente`
- **nerd** - A Nerd (Doutora Amanda) - `!amanda nerd`
- **tia** - A Tiazona do Zap (Tia Amanda) - `!amanda tia`
- **morty** - O Ajudante Ansioso (Morty) - `!amanda morty`

### Grupo 5: As Clássicas Divertidas
- **fofoqueira** - A Intrigante (Fofoqueira Nata) - `!amanda fofoqueira`
- **cupido** - A Cupido (Juíza do Amor) - `!amanda cupido`
- **dona_do_jogo** - A Gamemaster (Dona do Cassino) - `!amanda dona_do_jogo`

## Como Usar

### Importação Individual
```typescript
import { padraoPersonality } from './personalities/padrao';
import { amantePersonality } from './personalities/amante';
// ... etc
```

### Importação Múltipla
```typescript
import { 
  padraoPersonality, 
  amantePersonality, 
  casadaPersonality 
} from './personalities';
```

### Acesso via Mapa
```typescript
import { PERSONALIDADES_MAP, PERSONALIDADES_DISPONIVEIS } from './personalities';

// Verificar se uma personalidade existe
if (PERSONALIDADES_DISPONIVEIS.includes('padrao')) {
  // Personalidade existe
}

// Obter o nome da variável da personalidade
const personalidadeVar = PERSONALIDADES_MAP.padrao; // 'padraoPersonality'
```

## Estrutura dos Arquivos

Cada arquivo de personalidade segue o padrão:
- Nome do arquivo: `nome_da_personalidade.ts`
- Exportação: `export const nomeDaPersonalidadePersonality = \`...\`;`
- Conteúdo: Instruções do sistema para a IA

## Comandos de Ativação

Para ativar uma personalidade, use o comando:
```
!amanda [nome_da_personalidade]
```

Exemplos:
- `!amanda padrao` - Ativa a personalidade padrão
- `!amanda amante` - Ativa a personalidade amante
- `!amanda macumbeira` - Ativa a personalidade macumbeira

## Manutenção

Para adicionar uma nova personalidade:
1. Crie um novo arquivo `nome_da_personalidade.ts`
2. Siga o padrão de nomenclatura
3. Adicione a exportação no `index.ts`
4. Atualize o `PERSONALIDADES_MAP`
5. Documente aqui no README 