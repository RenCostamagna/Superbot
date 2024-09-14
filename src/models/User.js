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
                price: Number
            }
        ],
        paymentId: String,
        paymentStatus: String
    },
});

const User = mongoose.model('User', userSchema);

module.exports = User;