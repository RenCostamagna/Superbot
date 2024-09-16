const express = require('express');

//const handleOrder = require('../controllers/handleOrder');
const handleHomeDelivery = require('../controllers/handleHomeDelivery.js')
const handleConfirmOrModify = require('../controllers/handleConfirmOrModify');
const handleModifying = require('../controllers/handleModifying');
const welcomeFLow = require('../controllers/handlerWelcome.js')
const handlePayment = require('../controllers/handlePayment.js')
const handlePaymentStatus = require('../controllers/handlePaymentStatus.js')
const handleDeliveryDetails = require('../controllers/handleDeliberyDetails.js');
const updateStock = require('../config/updateStock.js')
const clearUserCache = require('../config/clearCache.js')

const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const router = express.Router();


const User = require('../models/User');


// Ruta para el webhook
router.post('/', async (req, res) => {

    const { Body, From } = req.body;
    const phoneNumber = From.trim();

    try {
        let user = await User.findOne({ phoneNumber });

        if (Body.toLowerCase() === "clear"){
            await clearUserCache(phoneNumber);
            await client.messages.create({
                body: 'Limpiado',
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: phoneNumber
            });
        }else{
            if (!user) {
                user = new User({ phoneNumber, conversation: [], stage: 'welcome' });
                await user.save();
            }
    
            user.conversation.push({ message: Body, direction: 'incoming' });
            await user.save();
    
            if (user.stage !== 'payment' && user.stage !== 'ending'){
            // Redirigir a la función correspondiente según el estado del usuario
                switch (user.stage) {
                    case 'welcome':
                        await welcomeFLow(user, phoneNumber, Body);
                        break;
                    case 'confirm_or_modify':
                        await handleConfirmOrModify(user, phoneNumber, Body);
                        break;
                    case 'awaiting_modification_details':
                        await handleModifying(user,phoneNumber,Body)
                        break;
                    case 'delivery_details':
                        await handleDeliveryDetails(user, phoneNumber, Body);
                        break;
                    case 'home_delivery':
                        await handleHomeDelivery(user, phoneNumber, Body);
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
    
        }
     
        try {
            if (user.stage === 'payment') {
                await handlePayment(phoneNumber);     
                // Actualizar el estado del usuario a 'ending'
                user.stage = 'ending';
                await user.save();
            }
        } catch (error) {
            console.error('Error en el proceso de pago:', error);
        }

        try {
            if (user.stage === 'ending') {
                // Manejar el estado del pago
                user.lastOrder.deliveryStatus = 'pending';
                const userStage = user.lastOrder.paymentStatus;
                const userDeliveryStage = user.lastOrder.deliveryStatus
                await handlePaymentStatus(userStage, phoneNumber, userDeliveryStage);
                
                // Verificar el estado del pago y tomar acciones correspondientes
                if (user.lastOrder.paymentStatus === "approved") {
                    console.log(`Payment Status: ${user.lastOrder.paymentStatus}`);
                    
                    // Actualizar el stock
                    await updateStock(user._id);
                    
                    // Cambiar el estado del usuario
                    user.stage = "home_delivery";
                    user.lastOrder.paymentStatus = "accredited";
                    await user.save();
                              
                }
            }
        } catch (error) {
            console.error('Error en el proceso de finalización del pedido:', error);
        }
        res.status(200).send('Mensaje procesado');


    } catch (error) {
        console.error('Error procesando el mensaje:', error);
        res.status(500).send('Error procesando el mensaje');
    }
});

module.exports = router;