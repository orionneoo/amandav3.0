const mongoose = require('mongoose');
require('dotenv').config(); // Carrega o .env

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error("Erro: MONGODB_URI não encontrada no arquivo .env");
    process.exit(1);
}

console.log("Tentando conectar ao MongoDB Atlas...");
console.log("URI:", uri.replace(/:([^:]+)@/, ':*****@'));

mongoose.connect(uri, {
    // useNewUrlParser: true, // Opções legadas, não são mais necessárias
    // useUnifiedTopology: true
}).then(() => {
    console.log("✅ SUCESSO! Conectado ao MongoDB Atlas.");
    mongoose.connection.close();
}).catch(err => {
    console.error("❌ FALHA! Não foi possível conectar.");
    console.error(err);
}); 