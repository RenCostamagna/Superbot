const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  
  product_name: { type: String, required: true },
  brand: { type: String, required: true},
  price: { type: String, required: true }, 
  category: {type: String, required: true},
  description: { type: String, required: true},
  quantity: { type: String, required: true},
  stock: { type: Number, required: true },
  vegan: { type: String, required: true},
  apto_celiac: { type: String, required: true},
  light: { type: String, required: true},
  expiratio_date: { type: String, required: true },
  discount: { type: String, required: true},
  organic: { type: String, required: true}

});

const Item = mongoose.model('Item', itemSchema, 'items');
module.exports = Item;


