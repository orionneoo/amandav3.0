const fs = require('fs');
const path = require('path');

function testCommands() {
  try {
    console.log('🔍 Verificando arquivo do comando todos...');
    
    const todosPath = path.join(__dirname, 'dist', 'commands', 'admin', 'todos.js');
    if (fs.existsSync(todosPath)) {
      console.log('✅ Arquivo do comando !todos existe');
      
      const content = fs.readFileSync(todosPath, 'utf8');
      if (content.includes('TodosCommand')) {
        console.log('✅ Classe TodosCommand encontrada no arquivo');
      } else {
        console.log('❌ Classe TodosCommand NÃO encontrada no arquivo');
      }
      
      if (content.includes('name = \'todos\'')) {
        console.log('✅ Nome do comando configurado corretamente');
      } else {
        console.log('❌ Nome do comando NÃO configurado corretamente');
      }
      
      if (content.includes('aliases = [')) {
        console.log('✅ Aliases configurados');
      } else {
        console.log('❌ Aliases NÃO configurados');
      }
      
    } else {
      console.log('❌ Arquivo do comando !todos NÃO existe');
    }
    
    console.log('\n📋 Verificando container.ts...');
    const containerPath = path.join(__dirname, 'dist', 'core', 'container.js');
    if (fs.existsSync(containerPath)) {
      const containerContent = fs.readFileSync(containerPath, 'utf8');
      if (containerContent.includes('TodosCommand')) {
        console.log('✅ TodosCommand importado no container');
      } else {
        console.log('❌ TodosCommand NÃO importado no container');
      }
      
      if (containerContent.includes('TodosCommand')) {
        console.log('✅ TodosCommand registrado no container');
      } else {
        console.log('❌ TodosCommand NÃO registrado no container');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar comandos:', error);
  }
}

testCommands();

// Teste para verificar comandos de confissão
const { ConfessionGame } = require('./dist/commands/brincadeiras/confissao');

console.log('=== TESTE DE COMANDOS DE CONFISSÃO ===');

// Teste 1: Validação de texto de confissão
console.log('\n1. Testando validação de texto:');
const testCases = [
  { text: 'Eu nunca colei em uma prova', expected: true },
  { text: 'Eu já comi pizza com ketchup', expected: true },
  { text: 'Uma vez, chamei a sogra pelo nome da ex', expected: true },
  { text: 'Eu gosto de sorvete', expected: false },
  { text: 'Ontem fui ao cinema', expected: false }
];

testCases.forEach((testCase, index) => {
  const result = ConfessionGame.validateConfessionText(testCase.text);
  console.log(`   Teste ${index + 1}: "${testCase.text}" -> ${result} (esperado: ${testCase.expected})`);
});

// Teste 2: Verificar se o módulo está sendo exportado corretamente
console.log('\n2. Verificando estrutura do módulo:');
console.log('   ConfessionGame.activate:', typeof ConfessionGame.activate);
console.log('   ConfessionGame.reveal:', typeof ConfessionGame.reveal);
console.log('   ConfessionGame.getStatus:', typeof ConfessionGame.getStatus);
console.log('   ConfessionGame.cancel:', typeof ConfessionGame.cancel);
console.log('   ConfessionGame.finalize:', typeof ConfessionGame.finalize);
console.log('   ConfessionGame.showHelp:', typeof ConfessionGame.showHelp);
console.log('   ConfessionGame.validateConfessionText:', typeof ConfessionGame.validateConfessionText);

console.log('\n=== FIM DO TESTE ==='); 