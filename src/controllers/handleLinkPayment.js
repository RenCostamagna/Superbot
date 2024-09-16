const { MercadoPagoConfig, Preference } = require('mercadopago');
const mongoose = require('mongoose');
require('dotenv').config();
const { transformOrder } = require('../config/orderConfig.js')
const express = require('express')
const router = express.Router();
const User = require('../models/User')
const Payment = require('../models/payment')
const handlePaymentStatus = require('./handlePaymentStatus.js');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN  } );


const createPaymentLink = async (order, userId) => {
	if (!order || !order.lastOrder) {
        throw new Error('El objeto de orden no es válido o no contiene la propiedad lastOrder.');
    }

	const transformedOrder = transformOrder(order);

	if (!transformedOrder.items || transformedOrder.items.length === 0) {
        throw new Error('No se han proporcionado artículos para la compra.');
    }
	const body = {
		items: transformedOrder.items,
		
		back_urls: {
			failure: 'https://0405-2803-9800-98ca-851e-9560-adef-e7b1-f247.ngrok-free.app/webhook',
			success: 'https://0405-2803-9800-98ca-851e-9560-adef-e7b1-f247.ngrok-free.app/webhook',
			pending: 'https://0405-2803-9800-98ca-851e-9560-adef-e7b1-f247.ngrok-free.app/webhook',
		},
		autoreturn: 'approved',
		notifcation_url: 'https://0405-2803-9800-98ca-851e-9560-adef-e7b1-f247.ngrok-free.app/mercadopago/mercadopago-webhook',
        metadata: { userId: userId }
	};

	const payment = new Preference(client);
	const result = await payment.create({ body })
	const link = result.sandbox_init_point
	if (link) {
		console.log('Link de pago:', link);
		return link;
	} else {
		throw new Error('El enlace de pago no se generó correctamente');
	}	
};


router.post('/mercadopago-webhook', async (req, res) => {
	const { type, data } = req.body;
    
    if (type === 'payment') {
        const paymentId = data.id;
        console.log('Payment ID recibido:', paymentId);

        try {
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
                }
            });

            if (response.ok) {
                const payment = await response.json();
                const userId = payment.metadata.user_id;
                //const userId = mongoose.Types.ObjectId(userIdConverter)
                console.log('Detalles del pago:', payment);

                console.log('userIdConverter:', payment.metadata);
                console.log('Tipo de userIdConverter:', typeof userId);
                
				const status = payment.status;
				//const amount = payment.transaction_amount;
				//const currency = payment.currency_id;
				//const paymentMethod = payment.payment_method_id;
				//const payerEmail = payment.payer.email;
				//const transactionDate = payment.date_approved || payment.date_created;
				//const description = payment.description;

				console.log(status);
                await User.updateOne(
                    { _id: userId },
                    { 
                        $set: {
                            'lastOrder.paymentStatus': status,
                            'lastOrder.paymentId': paymentId
                        }
                    }
                );

                const newPayment = new Payment({
					paymentId,
					userId: userId, // Asumimos que tienes este dato o que puedes relacionar al usuario
					orderId: payment.order.id, // Asegúrate de pasar esta información en la transacción
					amount: payment.transaction_amount,
					currency: payment.currency_id,
					paymentMethod: payment.payment_method.type,
					paymentStatus: status,
					transactionDate: payment.date_created || payment.date_approved,
					payerEmail: payment.payer.email,
					paymentGatewayResponse: payment, // Guardar toda la respuesta por si necesitas detalles adicionales
				});

                await newPayment.save();
                try {
                    const user = await User.findOne({ 'lastOrder.paymentId': paymentId });
        
                } catch (error) {
                    console.error('Error manejando el estado del pago:', error);
                }

                res.sendStatus(200); // Notifica que la petición se procesó correctamente
            } else {
                console.error('Error al obtener los detalles del pago:', response.status, await response.text());
                res.sendStatus(500);
            }
        } catch (error) {
            console.error('Error en el webhook de MercadoPago:', error);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(400); // Tipo no manejado
    }

});


module.exports = { createPaymentLink, router };