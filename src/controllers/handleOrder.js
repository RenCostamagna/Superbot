const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js'); 
const { convertPrice } = require('../utils/converPrice.js')
const Item = require('../models/item.js')


async function handleOrder(user, phoneNumber, Body) {
    const modifyPrompt = `
                    A continuación te doy una lista de productos de supermercado que el usuario quiere comprar. 
                    Cada producto puede estar compuesto por una o más palabras (por ejemplo, 'Aceite Natura', 'Pan Bimbo' o 'Fideos largos').
                    Por favor, interpreta la lista y responde con el nombre completo de cada producto seguido de la cantidad solicitada, separado por comas.
                    No incluyas más información, solo los productos y las cantidades. 
                    Ejemplo de respuesta esperada: "manzanas 3, Aceite Natura 2, Pan Bimbo 1"

                    Lista del usuario:
                    ${Body}

                    Responde solo con los productos y las cantidades en este formato, no agregues explicaciones adicionales.`;
    console.log(modifyPrompt)

    // Obtener respuesta de OpenAI
    const openAIResponse = await getChatGPTResponse(modifyPrompt);
    const interpretedItems = openAIResponse.trim().split(',').map(item => item.trim());
    console.log(openAIResponse)

    let total = 0;
    const itemDetails = [];
    const order = [];
                
    for (const itemData of interpretedItems) {
        // Buscar cada producto en la base de datos
        const matches = itemData.match(/(.+)\s(\d+)$/);
        if (!matches) {
            itemDetails.push(`${itemData}: Formato no válido o cantidad no especificada`);
            continue;
        }

        const itemName = matches[1].trim().toLowerCase();
        const quantity = parseInt(matches[2]); 
                
        try {
            const item = await Item.findOne({ product_name: { $regex: new RegExp('^' + itemName + '$', 'i') } });
            if (!item) {
                itemDetails.push(`${itemName}: No disponible`);
                continue;
            }

            const itemPrice = convertPrice(item.price);
            const itemTotal = itemPrice * quantity;
            itemDetails.push(`Cant: ${quantity}, ${item.product_name}: $${itemPrice.toFixed(2)} c/u, Total: $${itemTotal.toFixed(2)}`);
            total += itemTotal;
            order.push({ name: item.product_name, quantity, price: itemPrice });
        } catch (error) {
            itemDetails.push(`${itemName}: Error al procesar el producto`);
        }
    }
                
    user.lastOrder.items = order;
    await user.save();

    let responseMessage = `\nAquí tienes tu lista con los productos, cantidad y precio:\n`;
    responseMessage += itemDetails.join('\n');
    responseMessage += `\nTotal: $${total.toFixed(2)}\n`;
        
    // Mensaje de confirmación, modificación o cancelación del pedido
    let answerResponse = 'Gracias por tu pedido. ¿Deseas modificar algo?'; 

    user.stage = 'confirm_or_modify';  // Cambiar el estado
    await user.save();

    // Enviar el mensaje de respuesta con la lista, la cantidad y el total
    await client.messages.create({
        body: responseMessage,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });
                
    // Enviar mensaje de continuación
    await client.messages.create({
        body: answerResponse,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });
}


module.exports = handleOrder;