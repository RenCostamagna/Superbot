const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');

async function deliveryDetails (user, phoneNumber, Body) {
    const deliveryPrompt = `
                El usuario proporcionará una dirección, un día y un rango de horario en el mismop mensaje para la entrega de un pedido. Tu tarea es interpretar esta información siempre de la misma manera, sin importar el formato en que el usuario la haya ingresado.

                A continuación te doy las instrucciones para interpretar cada parte:

                1. **Dirección**: Interpreta la dirección como una cadena de texto que incluye el nombre de la calle, el número de la casa o edificio, y cualquier otra información adicional como el nombre del barrio o referencia. Si hay varias formas de escribirla, opta por la versión completa y sin abreviaciones.

                2. **Día**: El día puede ser mencionado de varias formas, como un día específico de la semana (por ejemplo, "lunes", "martes") o una fecha (por ejemplo, "15 de septiembre"). Interpreta cualquier día de la semana o fecha y conviértelo en un formato claro como "Día de la semana, DD de Mes" (por ejemplo, "Lunes, 15 de septiembre").

                3. **Rango de horario**: El rango horario puede estar dado en distintos formatos como "de 10 a 12", "entre 15:00 y 17:00", o "por la tarde". Convierte cualquier rango de tiempo en un formato estándar, que sea claro y fácil de entender, como "HH:MM - HH:MM". Si el usuario usa términos vagos como "por la mañana" o "por la tarde", interpreta el rango de tiempo de la siguiente manera:
                    - Mañana: 08:00 - 12:00
                    - Tarde: 12:00 - 18:00
                    - Noche: 18:00 - 21:00

                Tu respuesta debe contener siempre la dirección, el día y el rango horario en este formato claro y estándar. No agregues información adicional.
                La informacion es esta: ${Body}
                `
    const openAIResponse = await getChatGPTResponse(deliveryPrompt);
    console.log(openAIResponse)

    // Enviar mensaje de continuación
    await client.messages.create({
        body: openAIResponse,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });

    user.deliveryDetails = Body;  // Guardar los detalles de entrega
    user.stage = 'completed';  // Marcar el pedido como completado
    await user.save();

}

module.exports = deliveryDetails;