const { MercadoPagoConfig, Preference } = require('mercadopago');
require('dotenv').config();
const { transformOrder } = require('../config/orderConfig.js')

const client = new MercadoPagoConfig({ accessToken: 'TEST-6235347846124389-091109-7d711dac37e885b86ab061148167e17f-435553967'  } );


const createPaymentLink = async (order) => {
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
			success: 'https://7e49-2803-9800-98ca-851e-85e2-22f4-e9d8-4903.ngrok-free.app/success',
			failure: 'https://7e49-2803-9800-98ca-851e-85e2-22f4-e9d8-4903.ngrok-free.app/failure',
			pending: 'https://7e49-2803-9800-98ca-851e-85e2-22f4-e9d8-4903.ngrok-free.app/pending',
		},
		
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

module.exports = { createPaymentLink };