const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  CodArticulo: {type: Number, required: true},
  PRODUCTO: { type: String, required: true },
  MARCA: { type: String, required: true},
  PRECIO: { type: String, required: true }, 
  CATEGORIA: {type: String, required: true},
  Formato: { type: String, required: true},
  Para_que_sirve: { type: String, required: true},
  Stock: { type: Number, required: true },
  Cuanto_trae: { type: String, required: true},
  Para_quien_es: { type: String, required: true},
  Edad_del_Animal: { type: String, required: true},
  Tamaño_del_Animal: { type: String, required: true },
  Cantidad_de_Proteina_bruta: { type: String, required: true},
  Fecha_de_Vencimiento: { type: String, required: true},
  Descuento: { type: String, required: true}
});

const Item = mongoose.model('Item', itemSchema, 'items');
module.exports = Item;


