const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const { convertPrice } = require('../utils/converPrice.js');
const Item = require('../models/item.js');
const User = require('../models/User.js');


async function handleOrder(user, phoneNumber, openAIResponse, Body) {
    // Divide la respuesta en ítems individuales y limpia los espacios
    const interpretedItems = openAIResponse.trim().split(',').map(item => item.trim());
    console.log('Interpreted Items:', interpretedItems);
    
    const conversation = user.conversation
    const itemList = [];
    
    for (const itemData of interpretedItems) {
        // Ajusta la expresión regular para capturar solo el nombre del producto
        // Esta expresión regular captura hasta el primer número o espacio después del nombre
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
                // Formatear la respuesta con el formato especificado
                const itemPrice = convertPrice(item.price);
                itemList.push({
                    name: item.product_name,
                    price: itemPrice.toFixed(2),
                    stock: item.stock,
                    brand: item.brand,
                    description: item.description,
                    quantity: item.quantity
                });
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

    /*const orderPrompt = `Identifica estos productos y búscalos en la inventory table.\n 
                        En caso de encontrarlos guárdalos en la lista Pedido, y respóndeme con ella incluyendo la cantiadad que se indica en el pedido y la cantidad de unidad de medida. Agrega la marca del producto dentro de la lista.\n
                        Si el stock no alcanza, no lo sumes a la lista.\n
                        Por favor no muestres el stock.\n
                        Muestra tambien el total del pedido y el total de cada item.\n
                        Agrega un mensaje preguntando si desea modificar o confirmar el pedido.\n\n
                        Iventory table: ${formattedList}\n\n
                        Pedido: ${openAIResponse}`;*/

    conversation.push({ role: 'system', content: `Esta es la Inventrory table: ${formattedList}` });
    
    const conversationMessages = conversation.map(msg => ({ role: msg.role, content: msg.content }));
    responseMessage = await getChatGPTResponse([...conversationMessages, { role: 'user', content: Body }]);
    console.log('Respuesta de saludo o pregunta:', responseMessage);
    
    user.conversation.push({ role: "assistant", content: responseMessage });
    await user.save();

    await client.messages.create({
        body: responseMessage,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });

    user.stage = 'confirm_or_modify'
}

module.exports = handleOrder;
