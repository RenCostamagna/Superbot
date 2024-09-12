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

        const deliveryDetailsMessage = `¡Gracias por confirmar tu pedido! Por favor, proporciona la siguiente información para organizar la entrega:
                                        \n- Dirección completa de entrega (Calle, número, piso/departamento, ciudad, código postal)
                                        \n- Nombre del destinatario
                                        \n- DNI
                                        \n- Día y hora de entrega preferido (Lun a Vie 9 a 18hs)
                                        \n\n Nota: Actualmente solo realizamos entregas en Rosario y localidades aledañas.`;
                                                                      
        await client.messages.create({
            body: deliveryDetailsMessage,
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