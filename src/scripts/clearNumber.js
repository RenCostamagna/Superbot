require("dotenv").config();
const mongoose = require('mongoose');
const Client = require('../models/clients'); // Asegúrate de que la ruta es correcta
const {getChatGPTResponse} = require('../config/openaiClient');

// Asegúrate de que la variable de entorno esté definida o usa una cadena directamente
const mongoDB = '' ;

mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conexión exitosa a MongoDB'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

/*async function cleanPhoneNumbers() {
    try {
        // Obtener todos los clientes
        const clients = await Client.find();

        // Procesar cada cliente
        for (let client of clients) {
            const cleanedPhone = client.Teléfonos.replace(/[\s\-.,()]/g, '');
            await Client.findByIdAndUpdate(client._id, { Teléfonos: cleanedPhone });
        }

        console.log('Todos los números de teléfono han sido limpiados.');
    } catch (error) {
        console.error('Error al limpiar los números de teléfono:', error);
    } finally {
        // Desconectar de MongoDB
        mongoose.disconnect();
    }
}

cleanPhoneNumbers();*/

async function cleanPhoneNumbers() {
    const clients = await Client.find();
    for (let client of clients) {
        const clientData = {
            phone: client.Teléfonos,
            location: client.Localidad
        };
        const formattedData = await getChatGPTResponse([
            { role: "user", content: JSON.stringify(clientData) },
            { role: "system", content: "Formatea el número de teléfono. Colocando el prefijo +549 y el codigo de area correspondiente a la localidad que se te indica. Tene en cuenta que hay numero que estan dados en formato 155 o 1534 y otros que ya estan correctamente dados en 5493416123456. No des informacion adicional." }
        ]);
        console.log(formattedData);
    }
}

cleanPhoneNumbers()

