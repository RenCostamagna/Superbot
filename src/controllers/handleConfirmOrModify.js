const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const handleModifying = require('../controllers/handleModifying.js');

async function handleConfirmOrModify(user, phoneNumber, Body) {
    try {
        const modifyOrConfirmPrompt = `
            Sos el encargado de responder los mensajes de WhatsApp de una aplicación que gestiona pedidos de supermercado. 
            Te mandare un breve mensaje para continuar con el proceso de pedido en el cual tienes que identificar si la persona desea confirmar o realizar una modificación en el mismo.
            En caso de ser un mensaje de confirmación, devolve la palabra "confirmar".
            Tene en cuenta que la persona puede responder de la siguiente manera, hacindo referencia a que no quiere realizar modificaciones: Por ejemplo: "No", "No quiero realizar modificaciones", "Asi esta bien",
            Si el mensaje parece una modificación de un pedido, que integra productos y cantidades, responde "modificar".
            En este caso la persona demostrara intencion de modificar o proporcionara productos cons sus descripciones directamente: Por ejemplo: "Quiero agregar una leche y un azucar", "leche, azucar, aceite","Quiero hacer modificaciones","Si, quiero hacer modificaciones" o "Si".
            El mensaje es el siguiente: ${Body}.
            Por favor, no hagas aclaraciones adicionales, solo responde con las palabras indicadas sin puntos al final.
        `;

        // Asegúrate de esperar el resultado de OpenAI con await
        const modifyOrConfirmResponse = await getChatGPTResponse(modifyOrConfirmPrompt);

        // Verifica si modifyOrConfirmResponse es una cadena de texto
        if (!modifyOrConfirmResponse || typeof modifyOrConfirmResponse !== 'string') {
            throw new Error('Respuesta de OpenAI no válida: no es una cadena de texto.');
        }

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
