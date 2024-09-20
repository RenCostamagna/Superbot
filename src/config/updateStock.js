const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/item.js');
console.log('Ingreseo')

const updateStock = async (userId) => {
    try {
        // Obtener el usuario con el último pedido
        console.log(userId)
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('Usuario no encontrado.');
        }

        console.log(user);

        // Verificar que el pedido exista y tenga ítems
        if (!user.lastOrderToLink || !user.lastOrderToLink.items || user.lastOrderToLink.items.length === 0) {
            throw new Error('No hay ítems en el último pedido.');
        }

        // Iterar sobre los ítems del pedido y actualizar el stock
        for (const item of user.lastOrderToLink.items) {
            const { productName, quantity } = item;

            // Encontrar el ítem en la colección de stock
            const stockItem = await Item.findOne({ product_name: productName });
            if (!stockItem) {
                throw new Error(`El ítem ${productName} no se encuentra en el stock.`);
            }

            // Descontar la cantidad del stock
            await Item.updateOne(
                { _id: stockItem._id },
                { $inc: { stock: -quantity } }
            );
        }

        console.log('Stock actualizado correctamente.');
    } catch (error) {
        console.error('Error al actualizar el stock:', error.message);
    }
};

module.exports = updateStock;

