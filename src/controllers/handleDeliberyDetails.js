const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
//const { getChatGPTResponse } = require('../config/openaiClient.js');
const verifyAreaCode = require('../controllers/areaCodeModifyier.js');

async function deliveryDetails (user, phoneNumber, Body) {
    /*const deliveryPrompt = `
                El usuario proporcionará una dirección, un día y un rango de horario en el mismop mensaje para la entrega de un pedido. 
                Tu tarea es interpretar la direccion, de manera de que te asegures de que esta forma parte de la ciudad de Rosario, Santa Fe, Argentina. Con codigo postal 2000.
                En caso de pertenecer a dicha ciudad devuelveme un pedido de confr
                Tu respuesta debe contener siempre la dirección, el día y el rango horario en este formato claro y estándar. No agregues información adicional.
                La informacion es esta: ${Body}
                `
    const openAIResponse = await getChatGPTResponse(deliveryPrompt);
    console.log(openAIResponse)*/

    // Enviar mensaje de continuación

    if (verifyAreaCode(phoneNumber)) {
        const correctAreaCode = '¡Perfecto! Hemos registrado tu dirección de entrega en Rosario. Ahora procederemos con el pago para completar tu pedido.';
        user.deliveryDetails = Body;  // Guardar los detalles de entrega
        user.stage = 'payment';  // Marcar el pedido como completado
        await user.save();

        await client.messages.create({
            body: correctAreaCode,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });

    } else {
        
        const incorrectAreaCode = `Lo siento, actualmente solo realizamos entregas en Rosario y localidades aledañas. Parece que tu dirección está fuera de nuestra área de servicio, por lo que no podemos procesar tu pedido.`;
        await client.messages.create({
            body: incorrectAreaCode,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });

    }

}

module.exports = deliveryDetails;