const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const  { createPaymentLink } = require('../controllers/handleLinkPayment.js');

async function handlePayment ( user, phoneNumber ) {
    const paymentLink = await createPaymentLink(user); 
    console.log(paymentLink);

    await client.messages.create({
        body: `Para completar tu compra, por favor realiza el pago haciendo clic en el siguiente enlace:\n ${paymentLink}`,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber
    });
}

module.exports = handlePayment;