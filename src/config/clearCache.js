const mongoose = require('mongoose');
const User = require('../models/User.js'); // Asegúrate de que la ruta al modelo User sea correcta
const Shipping = require('../models/shipping.js');

// Función para limpiar el caché del usuario
async function clearUserCache(phoneNumber) {
    try {
        // Busca el usuario en la base de datos
        const user = await User.findOne({ phoneNumber: phoneNumber });
        const enviosPendientes = await Shipping.find({ phoneNumber: phoneNumber, estado: 'pending' });

        if (enviosPendientes.length > 0) {
            await Shipping.deleteMany({ phoneNumber: phoneNumber, estado: 'pending' });
        }
        

        if (!user) {
            console.error(`Usuario con número de teléfono ${phoneNumber} no encontrado.`);
            return null;
        }
        user.conversation = [];
        user.stage = 'welcome'; 
        user.lastOrder = { items: []},
        user.lastOrderToLink = {    
            items: [],
            paymentId: null,
            paymentStatus: null,
            paymentLinkSent: false,
        };
        user.deliveryDetails = '';
        await user.save();

        const userId = user._id
        
        console.log(`Caché del usuario con ID ${userId} ha sido limpiado.`);
    } catch (error) {
        console.error('Error al limpiar el caché del usuario:', error);
    }
}

module.exports = clearUserCache;