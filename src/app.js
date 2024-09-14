require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhookRoutes');  // Importar las rutas
const { router } = require('./controllers/handleLinkPayment.js')

const app = express();

mongoose.connect(process.env.MONGODB_URI_ITEMS, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB conectado'))
    .catch(err => console.log(err));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Usar las rutas para el webhook
app.use('/webhook', webhookRoutes);
app.use('/mercadopago', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});