const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const handleOrder = require('./handleOrder.js');

async function welcomeFLow(user, phoneNumber, Body) {
    const welcomePrompt = `
        A continuación te proporciono un mensaje del usuario. Tu tarea es identificar si el mensaje es una lista de supermercado, una oración de compra, o un mensaje de compra.

        - Una lista de supermercado puede estar en formato de lista directa (por ejemplo, "1 harina 1kg, dos azucar 500g") o en forma de oración completa (por ejemplo, "Hola! quiero un paquete de harina de 1kg y uno de azucar de 500g").
        - En una oración de compra, el usuario puede pedir productos en términos generales (por ejemplo, "quiero comprar 2 paquetes de harina y 1 de azucar").
        - Si el mensaje no parece ser una lista de supermercado o una oración de compra que mencione productos, responde con "no" sin información adicional.

        Para los productos que identifiques, responde con:
        1. El nombre completo del producto con la primera letra en mayúscula y deben estar separados por comas entre si.
        2. La cantidad total solicitada.
        3. La unidad de medida, si está presente, y debe ir acompañada de la cantidad total (por ejemplo, "kg", "g", "L", "ml").

        El formato de respuesta debe ser: "NombreProducto CantidadTotal CantidadUnidadDeMedida".

        Si el mensaje no es una lista u oración de compra de supermercado, responde simplemente con "no".

        Mensaje del usuario:
        ${Body}

        Responde solo con los productos y las cantidades en el formato especificado, o con "no" si el mensaje no corresponde a una lista o oración de compra. No incluyas explicaciones adicionales.
    `;

    console.log(welcomePrompt);
    const openAIResponse = await getChatGPTResponse(welcomePrompt);
    console.log('Respuesta de OpenAI:', openAIResponse);

    // Validar que la respuesta no esté vacía o sea inválida
    const response = openAIResponse ? openAIResponse.trim() : '';
    
    if (response === 'no') {
        user.stage = 'welcome';
        await user.save();

        const welcomeMessagePrompt = `El mensaje es este: ${Body}
            Sos el encargado de responder los mensajes de WhatsApp de una aplicacion que se encarga de realizar pedidos por este medio. 
            Quiero que des una respuesta al mensaje siendo breve y amistoso.  
            Por ejemplo: "¡Hola! Bienvenido al Superbot. Por favor, envía tu lista de productos especificando la marca, cantidad y tamaño. Estoy aquí para ayudarte con tu compra ."
        `;
        const openAIWelcomeResponse = await getChatGPTResponse(welcomeMessagePrompt);
        console.log('Respuesta de bienvenida:', openAIWelcomeResponse);

        if (openAIWelcomeResponse && openAIWelcomeResponse.trim()) {
            try {
                await client.messages.create({
                    body: openAIWelcomeResponse.trim(),
                    from: process.env.TWILIO_WHATSAPP_NUMBER,
                    to: phoneNumber
                });
            } catch (error) {
                console.error("Error al enviar el mensaje:", error.message);
            }
        } else {
            console.error("No hay respuesta válida para enviar");
        }
    } else {
        user.stage = 'order';
        await user.save();
        await handleOrder(user, phoneNumber, openAIResponse);
    }
}

module.exports = welcomeFLow;
