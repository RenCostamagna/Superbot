const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function handleConfirmOrModify(user, phoneNumber, Body) {
    if (Body.toLowerCase().includes('modificar')) {
        user.stage = 'modifying';
        await user.save();

        await client.messages.create({
            body: 'Indica los productos que deseas modificar o eliminar.',
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
    } else if (Body.toLowerCase().includes('confirmar')) {
        user.stage = 'delivery_details';
        await user.save();

        await client.messages.create({
            body: 'Pedido confirmado. Proporcione los detalles de la entrega.',
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
    } else {
        await client.messages.create({
            body: 'No pude entender tu respuesta. ¿Deseas modificar o confirmar el pedido?',
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
    };
}

module.exports = handleConfirmOrModify;