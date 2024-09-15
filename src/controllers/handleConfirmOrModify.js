const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');

async function handleConfirmOrModify(user, phoneNumber, Body) {
    try {
        if (Body.toLowerCase() === 'confirmar') {
            user.stage = 'delivery_details';
            await user.save();

            const deliveryDetailsMessage = `Sos el encargado de responder los mensajes de WhatsApp de una aplicación que gestiona pedidos de supermercado. 
            Genera un breve mensaje para continuar con el proceso de pedido. 
            El mensaje debe solicitarle al usuario su dirección (incluyendo todos los campos), su nombre y apellido, documento nacional de identidad y un día y hora de preferencia para la entrega. 
            La respuesta debe ser clara y debe incluir las instrucciones para confirmar o modificar el pedido.
            Ejemplo de respuesta: 
            " ¡Gracias por confirmar tu pedido! Por favor, proporciona la siguiente información para organizar la entrega:
            \n- Dirección completa de entrega (Calle, número, piso/departamento, ciudad, código postal)
            \n- Nombre del destinatario
            \n- DNI
            \n- Día y hora de entrega preferido (Lun a Vie 9 a 18hs)
            \n\n Nota: Actualmente solo realizamos entregas en Rosario y localidades aledañas."`;

            // Enviar mensaje de confirmación de pedido
            await client.messages.create({
                body: deliveryDetailsMessage,
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: phoneNumber
            });
        } else if (Body.toLowerCase() === "modificar") {
            user.stage = 'modifying';
            await user.save();

            const modifyingPrompt = `Sos el encargado de responder los mensajes de WhatsApp de una aplicación que gestiona pedidos de supermercado. 
            Genera un breve mensaje para continuar con el proceso de modificación del pedido. 
            El mensaje debe preguntar al usuario qué productos quiere modificar. 
            La respuesta debe ser clara y debe incluir las instrucciones para modificar el pedido.
            Ejemplo de respuesta: "Genial! Ahora procederemos con la modificación. Indique qué quiere modificar y lo ayudaremos!".`;

            let modifyingAIResponse;
            try {
                modifyingAIResponse = await getChatGPTResponse(modifyingPrompt);
                if (!modifyingAIResponse || typeof modifyingAIResponse !== 'string') {
                    throw new Error('Respuesta de OpenAI no válida para la modificación');
                }
            } catch (error) {
                modifyingAIResponse = "Genial! Ahora procederemos con la modificación. Indique qué quiere modificar y lo ayudaremos.";
                console.error('Error al obtener respuesta de OpenAI para la modificación:', error);
            }

            // Enviar mensaje de modificación de pedido
            try {
                await client.messages.create({
                    body: modifyingAIResponse,
                    from: process.env.TWILIO_WHATSAPP_NUMBER,
                    to: phoneNumber
                });
            } catch (error) {
                console.error('Error al enviar el mensaje con Twilio:', error.message);
            }
        } else {
            console.log('Opción no reconocida:', Body);
        }
    } catch (error) {
        console.error('Error en handleConfirmOrModify:', error.message);
    }
}

module.exports = handleConfirmOrModify;