const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const verifyAreaCode = require('../controllers/areaCodeModifyier.js');
const obtenerProximaSemana = require('../config/deliveryDateConfig.js')
const Shipping = require('../models/shipping.js')

async function deliveryDetails (user, phoneNumber, Body) {
    const deliveryPrompt = `
                Eres el encargado de los envios de un supermercado.
                Tienes que identificar lo siguiente:
                    1. Direccion de envio, ciudad y codigo postal.
                    2. Nombre de la persona que realiza el pedido.
                    3. DNI de la persona.
                    4. Dia y hora favorita que eligio para el mismo.
                Tu respuesta tiene que estar dad en este formato: Direccion (incluyendo ciudad y codigo postal), nombre de la persona, DNI, dia y hora. 
                Si el dia y hora esta dado como oracion, devolve solo el dia y la hora. Por ejemplo: "lunes a las 15hs", tu respuesta: "lunes 15:00".
                Si el dia es miercoles, asegurate de devolverlo con el acento correspondiente. 
                Elimina el "hs" al final de la hora y no agregues puntos al final ni informacion adicional. 
                La informacion es esta: ${Body}
                ` 
                try {
                    const openAIResponse = await getChatGPTResponse(deliveryPrompt);
                    console.log(openAIResponse);
                
                    // Validar que la respuesta de OpenAI contenga suficientes datos separados por comas
                    const responseParts = openAIResponse.split(',');
                    
                    if (responseParts.length < 4) {
                        throw new Error('La respuesta de OpenAI no contiene el formato esperado.');
                    }
                
                    const [direccionCompleta, nombrePersona, dni, diaYHora] = responseParts.map(part => part.trim());
                    console.log([direccionCompleta, nombrePersona, dni, diaYHora]);
                    // Validar si todos los campos están presentes
                    if (!direccionCompleta || !nombrePersona || !dni || !diaYHora) {
                        throw new Error('Faltan datos importantes para el envío.');
                    }
                    
                    const diaYHoraEntrega = obtenerProximaSemana(diaYHora.trim())
                    const number = phoneNumber;
                    // Guardar la información en el esquema de MongoDB
                    const newShipping = new Shipping({
                        direccionCompleta: direccionCompleta,
                        nombrePersona: nombrePersona.trim(),
                        dni: dni.trim(),
                        phoneNumber: number,
                        diaYHoraEntrega: diaYHoraEntrega,
                        estado: 'pending'
                    });
                
                    await newShipping.save();
                    console.log('Información del envío guardada correctamente');
                
                } catch (error) {
                    console.error(`Error procesando el mensaje: ${error.message}`);
                }

    
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