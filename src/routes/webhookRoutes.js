const express = require('express');
const handleOrder = require('../controllers/handleOrder');
const handleConfirmOrModify = require('../controllers/handleConfirmOrModify');
const handleModifying = require('../controllers/handleModifying');
const welcomeFLow = require('../controllers/handlerWelcome.js')
const handlePayment = require('../controllers/handlePayment.js')
//const createPaymentLink = require('../controllers/handleLinkPayment.js');
const handleDeliveryDetails = require('../controllers/handleDeliberyDetails.js');

const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const router = express.Router();

const User = require('../models/User');


// Ruta para el webhook
router.post('/', async (req, res) => {
    const { Body, From } = req.body;
    const phoneNumber = From.trim();

    try {
        let user = await User.findOne({ phoneNumber });

        if (!user) {
            user = new User({ phoneNumber, conversation: [], stage: 'welcome' });
            await user.save();
        }

        user.conversation.push({ message: Body, direction: 'incoming' });
        await user.save();
        if (user.stage === 'welcome'){
            await welcomeFLow(user, phoneNumber, Body)
        };

        if (user.stage !== 'welcome'){
        // Redirigir a la función correspondiente según el estado del usuario
            switch (user.stage) {
                case 'order':
                    await handleOrder(user, phoneNumber, Body);
                    break;
                case 'confirm_or_modify':
                    await handleConfirmOrModify(user, phoneNumber, Body);
                    break;
                case 'modifying':
                    await handleModifying(user, phoneNumber, Body);
                    break;
                case 'delivery_details':
                    await handleDeliveryDetails(user, phoneNumber, Body);
                    break;
                case 'payment':
                    await handlePayment ( phoneNumber);                    
                    break;
                default:
                    // Si el estado no es reconocido
                    await client.messages.create({
                        body: 'No pude entender tu mensaje. Por favor, intenta nuevamente.',
                        from: process.env.TWILIO_WHATSAPP_NUMBER,
                        to: phoneNumber
                    });
            }
            console.log(user.paymentStatus)
        }



        res.status(200).send('Mensaje procesado');
    } catch (error) {
        console.error('Error procesando el mensaje:', error);
        res.status(500).send('Error procesando el mensaje');
    }
});

module.exports = router;