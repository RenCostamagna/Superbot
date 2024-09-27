const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/item.js');
console.log('Ingreso');

const updateStock = async (userId) => {
    try {
        // Obtener el usuario con el último pedido
        console.log(userId);
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
            const stockItem = await Item.findOne({ PRODUCTO: { $regex: productName, $options: 'i' } });
            if (!stockItem) {
                console.error(`El ítem ${productName} no se encuentra en el stock.`);
                continue; // Continuar con el siguiente ítem si no se encuentra en el stock
            }

            // Verificar que la cantidad en stock sea suficiente
            if (stockItem.Stock < quantity) {
                console.error(`Stock insuficiente para el ítem ${productName}. Stock actual: ${stockItem.Stock}, Cantidad solicitada: ${quantity}`);
                continue; // Continuar con el siguiente ítem si no hay suficiente stock
            }

            // Descontar la cantidad del stock
            const result = await Item.updateOne(
                { _id: stockItem._id },
                { $inc: { Stock: -quantity } }
            );

            // Verificar que la actualización fue exitosa
            if (result.nModified === 0) {
                console.error(`No se pudo actualizar el stock para el ítem ${productName}.`);
            } else {
                console.log(`Stock actualizado para el ítem ${productName}. Cantidad descontada: ${quantity}`);
            }
        }

        console.log('Stock actualizado correctamente.');
    } catch (error) {
        console.error('Error al actualizar el stock:', error.message);
    }
};

module.exports = updateStock;

