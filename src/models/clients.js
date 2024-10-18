const mongoose = require('mongoose');

const clientsSchema = new mongoose.Schema({
    Codigo: { type: String, required: true },
    Nombre: { type: String, required: true },
    Dirección: { type: String, required: true },
    Localidad: { type: String, required: true },
    Teléfonos: { type: String, required: true },
    Email: { type: String, required: true },
    Zona: { type: String, required: true },
  });
  
const Client = mongoose.model('Client', clientsSchema);
module.exports = Client