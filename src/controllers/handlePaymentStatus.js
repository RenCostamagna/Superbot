const Shipping = require('../models/shipping.js');
const User = require('../models/User.js');
const { getChatGPTResponse } = require('../config/openaiClient.js');

const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const handlePaymentStatus = async (status, phoneNumber, deliveryStatus) => {
    let messageBody;

    const user = await User.findOne({phoneNumber})

    const shipping = await Shipping.findOne({
        phoneNumber: phoneNumber, 
        estado: deliveryStatus,
    });
    console.log(shipping)
    const conversation = user.conversation;

    console.log(shipping);
    // Determinar el mensaje basado en el estado del pago
    switch (status) {
        case 'approved':
            responseMessage = `El pago del usuario se acredito. La entrega fue programada para el ${shipping.diaYHoraEntrega}. Direccion: ${shipping.direccionCompleta}. Genera un mensaje para esto.`;
            const conversationMessages = conversation.map((msg) => ({
                role: msg.role,
                content: msg.content,
              }));
            
                messageBody = await getChatGPTResponse([
                ...conversationMessages,
                {role: 'system', content: responseMessage},
              ]);

              conversation.push({ role: "assistant", content: messageBody });
              await user.save();
              console.log(user.conversation);

            ;
            break;
        case 'pending':
            messageBody = `El pago está pendiente, continúa tu transacción para confirmar el pedido.`;
            break;
        case 'rejected':
            messageBody = `ALGO SALIÓ MAL.\n Tu pago fue rechazado.`;
            break;
        case 'cancelled':
            messageBody = `El pago fue cancelado.`;
            break;
        default:
            messageBody = `Una vez realizado, envie el mensaje: "pago"`;
            break;
    }
    
    // Enviar el mensaje
    await client.messages.create({
        body: messageBody,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });
}

module.exports = handlePaymentStatus;