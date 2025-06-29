require('dotenv').config();
const mongoose = require('mongoose');
const { Group } = require('./dist/database/models/GroupSchema');

async function fixGroupName() {
  try {
    // Usar a mesma string de conexão do bot
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://euquefiz:euquefiz123@cluster0.mongodb.net/euquefiz?retryWrites=true&w=majority';
    const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'euquefiz';
    
    console.log('Conectando ao MongoDB Atlas...');
    
    // Conectar ao MongoDB
    await mongoose.connect(MONGODB_URI, { 
      dbName: MONGODB_DATABASE 
    });

    console.log('Conectado ao MongoDB Atlas');

    // Buscar grupos com name undefined ou null
    const groupsWithInvalidName = await Group.find({
      $or: [
        { name: { $exists: false } },
        { name: null },
        { name: undefined },
        { name: '' }
      ]
    });

    console.log(`Encontrados ${groupsWithInvalidName.length} grupos com nome inválido`);

    // Corrigir cada grupo
    for (const group of groupsWithInvalidName) {
      console.log(`Corrigindo grupo: ${group.groupJid}`);
      
      // Atualizar com nome padrão
      await Group.updateOne(
        { _id: group._id },
        { 
          $set: { 
            name: 'Grupo',
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`Grupo ${group.groupJid} corrigido`);
    }

    console.log('Correção concluída!');
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

fixGroupName(); 