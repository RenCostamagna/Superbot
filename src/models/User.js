const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phoneNumber: String,
  conversation: Array,
  stage: String,
  status: String,
  cuit: String,
  paymentMethodAsked: Boolean,
  lastOrderToLink: {
    items: [
      {
        productName: String,
        weightOrVolume: String,
        quantity: Number,
        pricePerUnit: Number,
      },
    ],
    total: Number,
    paymentStatus: String,
    paymentId: String,
    paymentLinkSent: Boolean
  },
  
  orderHistory: [
    {
      orderId: String,
      conversation: Array,
      items: [
        {
          name: String,
          quantity: Number,
          itemWeightOrVolume: String,
          price: Number,
        },
      ],
      totalAmount: Number,
      orderDate: { type: Date, default: Date.now },
      paymentStatus: String,
      shippingStatus: String,
      paymentID: String
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
