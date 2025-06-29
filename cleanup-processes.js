#!/usr/bin/env node

/**
 * Script para limpar processos órfãos do Amanda Bot
 * Uso: node cleanup-processes.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class ProcessCleaner {
  constructor() {
    this.lockFile = 'bot.lock';
    this.processName = 'node';
    this.botScript = 'dist/index.js';
  }

  async run() {
    console.log('🧹 AMANDA BOT - LIMPEZA DE PROCESSOS');
    console.log('=====================================\n');

    try {
      // 1. Verificar arquivo de lock
      await this.checkLockFile();

      // 2. Verificar processos Node.js
      await this.checkNodeProcesses();

      // 3. Verificar processos específicos do bot
      await this.checkBotProcesses();

      // 4. Limpar processos órfãos
      await this.cleanupOrphanProcesses();

      // 5. Verificar se é seguro iniciar o bot
      await this.checkSafeToStart();

      console.log('\n✅ Limpeza concluída!');
      console.log('💡 Agora você pode iniciar o bot com: npm start');

    } catch (error) {
      console.error('\n❌ Erro durante a limpeza:', error.message);
      process.exit(1);
    }
  }

  async checkLockFile() {
    console.log('📋 1. VERIFICANDO ARQUIVO DE LOCK...');
    
    if (fs.existsSync(this.lockFile)) {
      try {
        const lockData = fs.readFileSync(this.lockFile, 'utf8');
        const lockInfo = JSON.parse(lockData);
        const now = Date.now();
        const ageInSeconds = Math.round((now - lockInfo.timestamp) / 1000);
        
        console.log(`   📄 Arquivo de lock encontrado:`);
        console.log(`      PID: ${lockInfo.pid}`);
        console.log(`      Iniciado em: ${lockInfo.startTime}`);
        console.log(`      Idade: ${ageInSeconds} segundos`);
        
        // Verificar se o processo ainda existe
        try {
          process.kill(lockInfo.pid, 0);
          console.log(`   ⚠️  Processo ${lockInfo.pid} ainda está rodando`);
          
          if (ageInSeconds > 300) { // 5 minutos
            console.log(`   🔄 Lock obsoleto (${ageInSeconds}s), removendo...`);
            fs.unlinkSync(this.lockFile);
            console.log(`   ✅ Lock removido`);
          } else {
            console.log(`   ⏳ Lock ainda válido, aguardando timeout...`);
          }
        } catch (error) {
          console.log(`   💀 Processo ${lockInfo.pid} não existe mais`);
          console.log(`   🗑️  Removendo lock órfão...`);
          fs.unlinkSync(this.lockFile);
          console.log(`   ✅ Lock removido`);
        }
      } catch (error) {
        console.log(`   ❌ Erro ao ler lock: ${error.message}`);
        console.log(`   🗑️  Removendo arquivo corrompido...`);
        fs.unlinkSync(this.lockFile);
        console.log(`   ✅ Arquivo removido`);
      }
    } else {
      console.log(`   ✅ Nenhum arquivo de lock encontrado`);
    }
    console.log();
  }

  async checkNodeProcesses() {
    console.log('🔍 2. VERIFICANDO PROCESSOS NODE.JS...');
    
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
      const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('IMAGENAME'));
      
      if (lines.length === 0) {
        console.log(`   ✅ Nenhum processo Node.js encontrado`);
      } else {
        console.log(`   📊 ${lines.length} processo(s) Node.js encontrado(s):`);
        
        lines.forEach((line, index) => {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const pid = parts[1].replace(/"/g, '');
            const memory = parts[4] ? parts[4].replace(/"/g, '') : 'N/A';
            console.log(`      ${index + 1}. PID: ${pid}, Memória: ${memory}`);
          }
        });
      }
    } catch (error) {
      console.log(`   ⚠️  Erro ao verificar processos: ${error.message}`);
    }
    console.log();
  }

  async checkBotProcesses() {
    console.log('🤖 3. VERIFICANDO PROCESSOS DO BOT...');
    
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
      const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('IMAGENAME'));
      
      let botProcesses = [];
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const pid = parts[1].replace(/"/g, '');
          
          try {
            // Verificar se o processo está executando o script do bot
            const { stdout: cmdline } = await execAsync(`wmic process where "ProcessId=${pid}" get CommandLine /format:csv`);
            if (cmdline.includes(this.botScript)) {
              botProcesses.push({ pid, cmdline: cmdline.trim() });
            }
          } catch (error) {
            // Ignorar erros ao verificar linha de comando
          }
        }
      }
      
      if (botProcesses.length === 0) {
        console.log(`   ✅ Nenhum processo do bot encontrado`);
      } else {
        console.log(`   📊 ${botProcesses.length} processo(s) do bot encontrado(s):`);
        botProcesses.forEach((proc, index) => {
          console.log(`      ${index + 1}. PID: ${proc.pid}`);
        });
      }
    } catch (error) {
      console.log(`   ⚠️  Erro ao verificar processos do bot: ${error.message}`);
    }
    console.log();
  }

  async cleanupOrphanProcesses() {
    console.log('🧹 4. LIMPANDO PROCESSOS ÓRFÃOS...');
    
    try {
      // Verificar se há processos Node.js órfãos
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
      const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('IMAGENAME'));
      
      if (lines.length > 0) {
        console.log(`   ⚠️  ${lines.length} processo(s) Node.js encontrado(s)`);
        
        // Perguntar se deve matar todos os processos
        console.log(`   💡 Para matar todos os processos Node.js, execute:`);
        console.log(`      taskkill /F /IM node.exe`);
        console.log(`   💡 Para matar apenas processos específicos, use:`);
        console.log(`      taskkill /F /PID <PID>`);
      } else {
        console.log(`   ✅ Nenhum processo órfão encontrado`);
      }
    } catch (error) {
      console.log(`   ⚠️  Erro ao verificar processos órfãos: ${error.message}`);
    }
    console.log();
  }

  async checkSafeToStart() {
    console.log('✅ 5. VERIFICANDO SE É SEGURO INICIAR...');
    
    const issues = [];
    
    // Verificar se existe arquivo de lock
    if (fs.existsSync(this.lockFile)) {
      issues.push('Arquivo de lock ainda existe');
    }
    
    // Verificar se há processos Node.js
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
      const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('IMAGENAME'));
      
      if (lines.length > 0) {
        issues.push(`${lines.length} processo(s) Node.js ainda rodando`);
      }
    } catch (error) {
      // Ignorar erro
    }
    
    if (issues.length === 0) {
      console.log(`   ✅ Sistema limpo, seguro para iniciar`);
    } else {
      console.log(`   ⚠️  Problemas encontrados:`);
      issues.forEach(issue => console.log(`      - ${issue}`));
      console.log(`   💡 Execute manualmente: taskkill /F /IM node.exe`);
    }
    console.log();
  }
}

// Executar limpeza
if (require.main === module) {
  const cleaner = new ProcessCleaner();
  cleaner.run().catch(console.error);
}

module.exports = ProcessCleaner; 