const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const { convertPrice } = require('../utils/converPrice.js');
const Item = require('../models/item.js');

async function handleOrder(user, phoneNumber, openAIResponse) {
    const interpretedItems = openAIResponse.trim().split(',').map(item => item.trim());
    console.log('Interpreted Items:', interpretedItems);

    let total = 0;
    const itemDetails = [];
    const order = [];

    for (const itemData of interpretedItems) {
        const matches = itemData.match(/(.+)\s(\d+)(?:\s(.+))?$/);
        if (!matches) {
            itemDetails.push(`${itemData}: Formato no válido o datos no especificados`);
            continue;
        }

        const itemName = matches[1].trim();
        const quantity = parseInt(matches[2]);
        let itemWeightOrVolume = matches[3] ? matches[3].trim() : null;

        try {
            let item = await Item.findOne({
                product_name: { $regex: new RegExp('^' + itemName + '$', 'i') },
                weight_or_volume: itemWeightOrVolume
            });

            if (!item) {
                item = await Item.findOne({
                    product_name: { $regex: new RegExp('^' + itemName + '$', 'i') }
                });

                if (item) {
                    itemWeightOrVolume = item.weight_or_volume; // Asigna el peso/volumen predeterminado
                }
            }

            if (!item || item.stock < quantity) {
                itemDetails.push(`${itemName} ${itemWeightOrVolume ? itemWeightOrVolume : ''}: No disponible`);
                continue;
            }

            const itemPrice = convertPrice(item.price);
            const itemTotal = itemPrice * quantity;

            itemDetails.push(`Cant: ${quantity}, ${item.product_name} ${itemWeightOrVolume}, Precio: $${itemPrice.toFixed(2)} c/u, Total: $${itemTotal.toFixed(2)}`);
            total += itemTotal;
            order.push({ name: item.product_name, quantity, itemWeightOrVolume, price: itemPrice });
        } catch (error) {
            itemDetails.push(`${itemName} ${itemWeightOrVolume}: Error al procesar el producto: ${error.message}`);
            console.error(`Error al procesar el producto ${itemName} ${itemWeightOrVolume}:`, error);
        }
    }

    user.lastOrder.items = order;
    user.lastOrder.totalAmount = total;
    await user.save();

    let responseMessage = `\nAquí tienes tu lista con los productos, cantidad y precio:\n`;
    responseMessage += itemDetails.join('\n');
    responseMessage += `\nTotal: $${total.toFixed(2)}\n`;

    const thanksPrompt = `Sos el encargado de responder los mensajes de WhatsApp de una aplicación que gestiona pedidos de supermercado. 
                        Genera un breve mensaje para continuar con el proceso de pedido. 
                        El mensaje debe incluir un agradecimiento por el pedido, y debe preguntar al usuario si quiere modificar o confirmar el pedido. 
                        La respuesta debe ser clara y debe incluir las instrucciones para confirmar o modificar el pedido.
                        Ejemplo de respuesta: "Gracias por tu pedido! Para confirmar este pedido, escribe 'confirmar'. Si deseas hacer alguna modificación, escribe 'modificar'."`;

    let openAIThanksResponse;
    try {
        openAIThanksResponse = await getChatGPTResponse(thanksPrompt);
        if (!openAIThanksResponse || typeof openAIThanksResponse !== 'string') {
            throw new Error('Respuesta de OpenAI no válida');
        }
    } catch (error) {
        openAIThanksResponse = "Gracias por tu pedido. Para confirmar este pedido, escribe 'confirmar'. Si deseas hacer alguna modificación, escribe 'modificar'.";
        console.error('Error al obtener respuesta de OpenAI:', error);
    }

    user.stage = 'confirm_or_modify';  // Cambiar el estado
    await user.save();

    try {
        await client.messages.create({
            body: responseMessage,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
        await client.messages.create({
            body: openAIThanksResponse,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
    } catch (error) {
        console.error('Error al enviar el mensaje con Twilio:', error.message);
    }
}

module.exports = handleOrder;
