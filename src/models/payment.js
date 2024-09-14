const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    orderId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], required: true },
    transactionDate: { type: Date, default: Date.now },
    payerEmail: String ,
    description: String ,
    paymentGatewayResponse: mongoose.Schema.Types.Mixed
  });
  
const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment