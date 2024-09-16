const mongoose = require('mongoose');
const { getChatGPTResponse } = require('../config/openaiClient.js');
const {updateOrderHistory} = require('../config/updateUserOrderHistory.js')
const Shipping = require('../models/shipping.js');
const User = require('../models/User.js');
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function handleHomeDelivery(user, phoneNumber, Body) {

    try {
        const promptDelivery = `Sos el encargado de los envios de un supermercado, el usuario te consultura sobre el estado de su pedido o confirmara que el pedido le llego correctamete
                                Tu tarea es reconocer la intencion.
                                - En caso de que sea una pregunta sobre el estado del pedido, responde "estado", sin mas aclaraciones ni informacion.
                                - En caso de ser la confirmacion de recepcion del pedido, responde con "completado", sin mas aclaraciones ni informacion.
                                
                                No agregues informacion adicional ni puntos al final
                                El mensaje es este: ${Body}`;

        const deliveryResponse = await getChatGPTResponse(promptDelivery);
        console.log('Respuesta de GPT:', deliveryResponse);

        // Buscar el estado de envío
        let shippingStatus = await Shipping.findOne({
            phoneNumber: phoneNumber,
            estado: user.lastOrder.deliveryStatus,
        });

        let userStatus = await User.findOne({
            phoneNumber: phoneNumber,
        })

        if (!shippingStatus) {
            throw new Error('No se encontró el estado del envío para el número de teléfono proporcionado.');
        }

        if (deliveryResponse === 'estado') {
            const propmtStatusDelivery = `Sos el encargado de los envios de un supermercado, el usuario te consultura sobre el estado de su pedido o confirmara que el pedido le llego correctamete
                                        Tu tarea es reponder de forma calida y amistosa incluyendo la informacion que te proporciono a continuacion.
                                        Estado del pedido: "La entrega esta programada para el ${shippingStatus.diaYHoraEntrega}, direccion ${shippingStatus.direccionCompleta}".

                                        La respuesta debe estar basada tambien en el mensaje que recibes del usuario, respondiendo con coherencia pero incluyendo la informacion que te brinde anteriormente.
                                            Por ejemplo: mensaje del usuario: "Hola quiero consultar acerca de mi pedido", repuesta: Hola! **Estado del pedido**. Le informaremos el dia de la entrega cuando estemos en camino!.
                                        El mensaje del usuario es este: ${Body}`;
            
            console.log('Prompt para estado de entrega:', propmtStatusDelivery);
            const statusDeliveryResponse = await getChatGPTResponse(propmtStatusDelivery);

            await client.messages.create({
                body: statusDeliveryResponse,
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: phoneNumber
            });

        } else if (deliveryResponse === 'completado') {
            const promptDeliveryFinal = `Sos el encargado de un supermercado. Tu tarea es mandar un mensaje de agradecimiento al usuario por haber usado el chatbot.
                                        El usuario mandara un mensaje de confirmacion tras recibir tu pedido, y tu tarea es responderlo de forma calida y carinosa, agradeciendo e invitando a realizar otro pedido
                                        La respuesta tiene que ser en base al mensaje del usuario, pero manteniendo lo que se te indico anteriormente
                                        Por ejemplo: mensaje del usuario: "El pedido llego correctamente", tu respuesta: Me alegro que haya sido asi! Cuenta con nostros cuando lo necesites!
                                        El mensaje es el siguiente: ${Body}`;

            const deliveryFinalResponse = await getChatGPTResponse(promptDeliveryFinal);

            await client.messages.create({
                body: deliveryFinalResponse,
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: phoneNumber
            });

            shippingStatus.estado = 'entregado';
            await shippingStatus.save();

            userStatus.lastOrder.deliveryStatus = "completado";
            userStatus.stage = "welcome";
            await userStatus.save();

            await updateOrderHistory(userStatus);

            try {
                const result = await User.updateOne(
                    { phoneNumber: phoneNumber },
                    { $set: { 'lastOrder': {} } }
                );
                console.log('LastOrder limpiado:', result);

            } catch (error) {
                console.error('Error al limpiar lastOrder:', error);
            }

        } else {
            throw new Error('Respuesta de GPT no reconocida.');
        }

    } catch (error) {
        console.error('Error en el proceso de entrega:', error);
        // Aquí puedes manejar el error, por ejemplo, enviando un mensaje de error al usuario o registrando el error.
    }
}

module.exports = handleHomeDelivery;
