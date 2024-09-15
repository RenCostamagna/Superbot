const mongoose = require('mongoose');
const User = require('../models/User.js'); // Asegúrate de que la ruta al modelo User sea correcta

// Función para limpiar el caché del usuario
async function clearUserCache(phoneNumber) {
    try {
        // Busca el usuario en la base de datos
        const user = await User.findOne({ phoneNumber: phoneNumber });

        if (!user) {
            console.error(`Usuario con número de teléfono ${phoneNumber} no encontrado.`);
            return null;
        }
        
        user.stage = 'welcome'; 
        user.lastOrder = {
            items: [],
            paymentId: null,
            paymentStatus: null
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