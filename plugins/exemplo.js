
// Exemplo de plugin para Amanda Bot
module.exports = {
  name: 'exemplo',
  version: '1.0.0',
  description: 'Plugin de exemplo para demonstração',
  author: 'Desenvolvedor',
  dependencies: [],
  commands: ['exemplo'],
  hooks: ['onMessage'],

  async initialize() {
    console.log('Plugin de exemplo inicializado!');
  },

  async destroy() {
    console.log('Plugin de exemplo destruído!');
  },

  // Comandos do plugin
  commands: {
    exemplo: {
      name: 'exemplo',
      description: 'Comando de exemplo',
      execute: async (sock, message, args) => {
        await sock.sendMessage(message.key.remoteJid, {
          text: 'Este é um comando de exemplo do plugin!'
        });
      }
    }
  },

  // Hooks do plugin
  hooks: {
    onMessage: {
      name: 'exemplo_message_hook',
      priority: 1,
      execute: async (message) => {
        console.log('Mensagem processada pelo plugin de exemplo:', message.text);
      }
    }
  }
};
