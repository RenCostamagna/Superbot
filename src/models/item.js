const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  ID: {type: Number, required: true},
  Artículo_descripcion: { type: String, required: true },
  Rubro: { type: String, required: true },
  Moneda: { type: String, required: true },
  Sin_iva: { type: String, required: true },
  Con_iva: { type: String, required: true },
});

const Item = mongoose.model('Item', itemSchema, 'items');
module.exports = Item;


