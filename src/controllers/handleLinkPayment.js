const { MercadoPagoConfig, Payment } = require('mercadopago');
require('dotenv').config();

const client = new MercadoPagoConfig({ accessToken: 'TEST-6235347846124389-091109-7d711dac37e885b86ab061148167e17f-435553967' });
const merchantOrderClient = new Payment(client);

merchantOrderClient.create({ body: {
	collector: {
		id: 1234
	},
	items: [
		{
			id: '1',
		}
	],
	
} }).then(console.log).catch(console.log);