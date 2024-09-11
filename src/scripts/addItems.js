require('dotenv').config();
require('dotenv').config({ path: '../../.env' });
console.log(process.env.MONGODB_URI);
const mongoose = require('mongoose');
const Item = require('../models/item'); 

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('Conectado a MongoDB');

        // Limpiar la colección antes de agregar nuevos datos
        await Item.deleteMany({});

        // Agregar artículos
        await Item.insertMany([
            { name: 'Aceite natura', price: 1.5, stock: 10 },
            { name: 'Fideos largos', price: 0.8, stock: 10 },
            { name: 'Cocacola', price: 1.9, stock: 10 }
        ]);

        console.log('Artículos agregados');

        // Desconectar de la base de datos
        mongoose.disconnect();
    })
    .catch(err => {
        console.error('Error conectando a MongoDB:', err);
        mongoose.disconnect();
    });
