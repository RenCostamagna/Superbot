const mongoose = require('mongoose');

const shippingSchema = new mongoose.Schema({
    direccionCompleta: String,
    nombrePersona: String,
    dni: String,
    phoneNumber: String,
    diaYHoraEntrega: String,
    createdAt: { type: Date, default: Date.now },
    estado: String,
});

const Shipping = mongoose.model('Shipping', shippingSchema);
module.exports = Shipping;