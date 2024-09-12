const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const Item = require('../models/item.js')

async function handleModifying(user, phoneNumber, Body){
    const prompt = `
                El usuario está en una conversación sobre un pedido de supermercado. A continuación te doy los detalles del pedido actual y la respuesta del usuario. 
                Por favor, interpreta la modificacion que el usuario esta haciendo y responde con el nombre completo de cada producto seguido de la cantidad solicitada, separado por comas.
                A los productos que no modifico, dejalos en la lista como estaban.
                No incluyas más información, solo los productos y las cantidades. 
                
                Ejemplo de respuesta esperada: "manzanas 3, Aceite Natura 2, Pan Bimbo 1"
                Pedido actual: ${user.lastOrder.map(item => `${item.name} ${item.quantity}`).join(', ')}
                Respuesta del usuario: ${Body}`;
    console.log(prompt);

    const openAIResponse = await getChatGPTResponse(prompt);
    const interpretedItems = openAIResponse.trim().split(',').map(item => item.trim());
    console.log(openAIResponse)
                
    let total = 0;
    const itemDetails = [];
    const order = [];
            
    for (const itemData of interpretedItems) {
        // Buscar cada producto en la base de datos MongoDB
        const matches = itemData.match(/(.+)\s(\d+)$/);
        if (!matches) {
            itemDetails.push(`${itemData}: Formato no válido o cantidad no especificada`);
            continue;
        }

        const itemName = matches[1].trim().toLowerCase();
        const quantity = parseInt(matches[2]); 
                
        const item = await Item.findOne({ name: { $regex: new RegExp('^' + itemName + '$', 'i') } });
        if (item) {
            const itemTotal = item.price * quantity;
            itemDetails.push(`Cant: ${quantity}, ${item.name}: $${item.price.toFixed(2)} c/u, Total: $${itemTotal.toFixed(2)}`);
            total += itemTotal; // Sumar el total de los productos
            order.push({ name: item.name, quantity, price: item.price });
        } else {
            itemDetails.push(`${itemName}: No disponible`);
        }
    }
                
    user.lastOrder = order;
    await user.save();

    let responseMessage = `\nAquí tienes tu lista con los productos, cantidad y precio:\n`;
    responseMessage += itemDetails.join('\n');
    responseMessage += `\nTotal: $${total.toFixed(2)}\n`;

    // Enviar el mensaje de respuesta con la lista, la cantidad y el total
    await client.messages.create({
        body: `${responseMessage}\n ¿Deseas confirmar este pedido? `,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });

    user.stage = 'confirm_or_modify';  // Volver al estado de confirmación o modificación
    await user.save();
            
};

module.exports = handleModifying;