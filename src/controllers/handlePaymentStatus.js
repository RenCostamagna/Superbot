const Shipping = require('../models/shipping.js');

const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const handlePaymentStatus = async (status, phoneNumber, deliveryStatus) => {
    let messageBody;

    const shipping = await Shipping.findOne({
        phoneNumber: phoneNumber, 
        estado: deliveryStatus,
    });

    console.log(shipping);
    // Determinar el mensaje basado en el estado del pago
    switch (status) {
        case 'approved':
            messageBody = `¡Tu pago ha sido acreditado! Gracias por confiar en nuestro servicio. La entrega fue programada para el ${shipping.diaYHoraEntrega}. Direccion: ${shipping.direccionCompleta}`;
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