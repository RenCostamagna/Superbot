const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const  { createPaymentLink } = require('../controllers/handleLinkPayment.js');
const User = require('../models/User')

async function handlePayment(phoneNumber) {
    // Obtén el usuario usando el número de teléfono
    const user = await User.findOne({ phoneNumber: phoneNumber });
    
    if (!user) {
        throw new Error('Usuario no encontrado.');
    }

    const userId = user._id;
    const paymentLink = await createPaymentLink(user, userId); 
    console.log(paymentLink);

    await client.messages.create({
        body: `Para completar tu compra, por favor realiza el pago haciendo clic en el siguiente enlace:\n ${paymentLink}`,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });
}

module.exports = handlePayment;