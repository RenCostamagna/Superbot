const { MercadoPagoConfig, Preference } = require('mercadopago');
require('dotenv').config();

const client = new MercadoPagoConfig({ accessToken: 'TEST-6235347846124389-091109-7d711dac37e885b86ab061148167e17f-435553967'  } );


const payment = new Preference(client);


const body = {
	items: [
		{
		  id: '1234',
		  title: 'Dummy Title',
		  description: 'Dummy description',
		  category_id: 'car_electronics',
		  quantity: 1,
		  currency_id: 'BRL',
		  unit_price: 10,
		},
	  ],
	
	  back_urls: {
		success: 'https://7e49-2803-9800-98ca-851e-85e2-22f4-e9d8-4903.ngrok-free.app/success',
		failure: 'https://7e49-2803-9800-98ca-851e-85e2-22f4-e9d8-4903.ngrok-free.app/failure',
		pending: 'https://7e49-2803-9800-98ca-851e-85e2-22f4-e9d8-4903.ngrok-free.app/pending',
	  },
	
};


payment.create({ body }).then(console.log).catch(console.log)