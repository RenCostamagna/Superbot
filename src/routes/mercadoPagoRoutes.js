const express = require('express')
const router = express.Router();
const { MercadoPagoConfig } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: 'TEST-6235347846124389-091109-7d711dac37e885b86ab061148167e17f-435553967'  } );


router.post('/mercadopago-webhook', async (req, res) => {
    const { id: paymentId } = req.body;
    console.log('Payment ID:', paymentId);

    try {
        // Importar dinámicamente node-fetch
        const fetch = (await import('node-fetch')).default;

        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer TEST-6235347846124389-091109-7d711dac37e885b86ab061148167e17f-435553967`
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Detalles del pago:', data);
            res.sendStatus(200); // Notificamos que la petición se procesó correctamente
        } else {
            console.error('Error al obtener los detalles del pago:', response.status);
            res.sendStatus(500);
        }
    } catch (error) {
        console.error('Error en el webhook de MercadoPago:', error);
        res.sendStatus(500);
    }
});

module.exports = router;