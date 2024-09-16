const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber: String,
    conversation: Array,
    stage: String,
    deliveryDetails: String,
    lastOrder: {
        items: [
            {
                name: String,
                quantity: Number,
                itemWeightOrVolume: String,
                price: Number,
                brand: String
            }
        ],
        totalAmount: Number,
        paymentId: String,
        paymentStatus: String,
        deliveryStatus: String
    },
    orderHistory: [
        {
            orderId: String,
            items: [
                {
                    name: String,
                    quantity: Number,
                    itemWeightOrVolume: String,
                    price: Number,
                }
            ],
            totalAmount: Number,
            orderDate: { type: Date, default: Date.now },
            deliveryDetails: String,
            paymentStatus: String,
            shippingStatus: String
        }
    ]
});

const User = mongoose.model('User', userSchema);

module.exports = User;