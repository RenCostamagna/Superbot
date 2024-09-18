const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const { convertPrice } = require('../utils/converPrice.js');
const Item = require('../models/item.js');

async function handleOrder(user, phoneNumber, openAIResponse, Body) {
    // Divide la respuesta en ítems individuales y limpia los espacios
    const interpretedItems = openAIResponse.trim().split(',').map(item => item.trim());
    console.log('Interpreted Items:', interpretedItems);
    
    const conversation = user.conversation;
    let itemList = user.lastOrder?.items || []; // Usar la lista anterior si existe
    
    for (const itemData of interpretedItems) {
        // Ajusta la expresión regular para capturar solo el nombre del producto
        const matches = itemData.match(/^(.+?)(?:\s\d+.*)?$/);
    
        if (!matches) {
            itemList.push(`${itemData}: Formato no válido o datos no especificados`);
            continue;
        }
    
        let itemName = matches[1].trim();
        itemName = itemName.replace(/\.$/, ''); // Eliminar puntos al final del nombre del producto
        console.log(`Buscando producto: ${itemName}`);
        
        try {
            // Buscar productos en la base de datos por coincidencia parcial en el nombre
            const items = await Item.find({
                product_name: { $regex: new RegExp(itemName, 'i') }
            });
    
            if (items.length === 0) {
                itemList.push(`${itemName}: No se encontraron productos`);
                continue;
            }
    
            for (const item of items) {
                // Revisar si el producto ya está en la lista
                const existingItem = itemList.find(i => i.name.toLowerCase() === item.product_name.toLowerCase());

                if (!existingItem) {
                    // Si el producto no está en la lista, añádelo
                    const itemPrice = convertPrice(item.price);
                    itemList.push({
                        name: item.product_name,
                        price: itemPrice.toFixed(2),
                        stock: item.stock,
                        brand: item.brand,
                        description: item.description,
                        quantity: item.quantity || 1 // Puedes ajustar la cantidad inicial
                    });
                }
                // Si el producto ya está en la lista, no hacer nada, solo dejarlo
            }
        } catch (error) {
            itemList.push(`${itemName}: Error al procesar el producto: ${error.message}`);
            console.error(`Error al procesar el producto ${itemName}:`, error);
        }
    }
    
    // Convertir la lista a un formato legible para la IA
    const formattedList = itemList.map(item => {
        if (typeof item === 'string') {
            return item;
        } else {
            return `Nombre: ${item.name}, Precio: $${item.price}, Stock: ${item.stock}, Marca: ${item.brand}, Descripción: ${item.description}, Cantidad: ${item.quantity}`;
        }
    }).join(', ');

    // Mostrar la lista formateada
    console.log('Lista legible para la IA:', formattedList);

    conversation.push({ role: 'system', content: `Esta es la tabla de inventario: ${formattedList}` });

    const conversationMessages = conversation.map(msg => ({ role: msg.role, content: msg.content }));
    const responseMessage = await getChatGPTResponse([...conversationMessages, { role: 'user', content: Body }]);
    console.log('Respuesta de saludo o pregunta:', responseMessage);

    conversation.push({ role: 'user', content: Body});
    
    // Actualizar la conversación con la respuesta de la IA
    user.conversation.push({ role: "assistant", content: responseMessage });
    
    // Actualizar la lista de productos en lastOrder
    user.lastOrder = { items: itemList };
    user.stage = 'confirm_or_modify';
    await user.save();

    // Enviar mensaje de confirmación al usuario
    await client.messages.create({
        body: responseMessage,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });
    
}

module.exports = handleOrder;

