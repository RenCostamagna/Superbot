const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const handleModifying = require('../controllers/handleModifying.js');

async function handleConfirmOrModify(user, phoneNumber, Body) {
    try {
        const modifyOrConfirmPrompt = `Clasifica la intencion de este mensaje, reconociendo si es\n1. Modificar\n2. Confirmar.\n\n Responde solamente con la palabra 'modificar' o con 'confirmar'.`;

        // Asegúrate de esperar el resultado de OpenAI con await
        const modifyOrConfirmResponse = await getChatGPTResponse([{ role: 'user', content: `${modifyOrConfirmPrompt}, El mensaje es: ${Body}`}]);
        console.log(modifyOrConfirmResponse);

        if (modifyOrConfirmResponse.toLowerCase().trim() === 'confirmar') {
            try {
                // Actualiza el estado del usuario
                user.stage = 'delivery_details';
                await user.save();

                // Genera el mensaje de detalle de entrega
                const deliveryDetailsMessage = `
                    ¡Gracias por confirmar tu pedido! Por favor, proporciona la siguiente información para organizar la entrega:
                    \n- Dirección completa de entrega (Calle, número, piso/departamento, ciudad, código postal)
                    \n- Nombre del destinatario
                    \n- DNI
                    \n- Día y hora de entrega preferido (Lun a Vie 9 a 18hs)
                    \n\n Nota: Actualmente solo realizamos entregas en Rosario y localidades aledañas.
                `;

                try {
                    // Envía el mensaje de confirmación de pedido
                    await client.messages.create({
                        body: deliveryDetailsMessage,
                        from: process.env.TWILIO_WHATSAPP_NUMBER,
                        to: phoneNumber
                    });
                } catch (error) {
                    console.error('Error al enviar el mensaje con Twilio:', error);
                    await client.messages.create({
                        body: 'Hubo un error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde.',
                        from: process.env.TWILIO_WHATSAPP_NUMBER,
                        to: phoneNumber
                    });
                }

            } catch (error) {
                console.error('Error en el proceso de confirmación:', error);
                await client.messages.create({
                    body: 'Hubo un error al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.',
                    from: process.env.TWILIO_WHATSAPP_NUMBER,
                    to: phoneNumber
                });
            }

        } else if (modifyOrConfirmResponse.trim().toLowerCase() === 'modificar') {

            await handleModifying(user, phoneNumber, Body)

        } else {
            console.log('Opción no reconocida:', Body);
        }

    } catch (error) {
        console.error('Error en handleConfirmOrModify:', error.message);
        await client.messages.create({
            body: 'Hubo un error en el sistema. Por favor, inténtalo de nuevo más tarde.',
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
    }
}

module.exports = handleConfirmOrModify;
