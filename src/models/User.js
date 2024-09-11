const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber: String,
    conversation: Array,
    stage: String,
    deliveryDetails: String,
    lastOrder: Array
});

const User = mongoose.model('User', userSchema);

module.exports = User;