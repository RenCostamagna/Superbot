const express = require('express');
const handleOrder = require('../controllers/handleOrder');
const handleConfirmOrModify = require('../controllers/handleConfirmOrModify');
const handleModifying = require('../controllers/handleModifying');
const router = express.Router();
const handleDeliveryDetails = require('../controllers/handleDeliberyDetails.js');
const User = require('../models/User');

// Ruta para el webhook
router.post('/', async (req, res) => {
    const { Body, From } = req.body;
    const phoneNumber = From.trim();

    try {
        let user = await User.findOne({ phoneNumber });

        if (!user) {
            user = new User({ phoneNumber, conversation: [], stage: 'order' });
            await user.save();
        }

        user.conversation.push({ message: Body, direction: 'incoming' });
        await user.save();

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
            default:
                // Si el estado no es reconocido
                await client.messages.create({
                    body: 'No pude entender tu mensaje. Por favor, intenta nuevamente.',
                    from: process.env.TWILIO_WHATSAPP_NUMBER,
                    to: phoneNumber
                });
        }

        res.status(200).send('Mensaje procesado');
    } catch (error) {
        console.error('Error procesando el mensaje:', error);
        res.status(500).send('Error procesando el mensaje');
    }
});

module.exports = router;