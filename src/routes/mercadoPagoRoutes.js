require("dotenv").config();
const express = require("express");
const router = express.Router();
const { sendNewOrderEmail } = require("../controllers/businessRegistrationController");
const User = require("../models/User");
const Payment = require("../models/Payment");
const handlePaymentStatus = require("../controllers/handlePaymentStatus");

router.post("/mercadopago-webhook", async (req, res) => {
    const { type, data } = req.body;

    // Verificar que el tipo de evento es "payment" y que data y data.id existen
    if (type === "payment" && data && data.id) {
        const paymentId = data.id;
        console.log("Payment ID recibido:", paymentId);

        try {
            // Verificar si el pago ya ha sido procesado
            const existingPayment = await Payment.findOne({ paymentId });
            if (existingPayment) {
                console.log("Pago ya procesado:", paymentId);
                return res.sendStatus(200);
            }

            // Obtener detalles del pago desde la API de MercadoPago
            const response = await fetch(
                `https://api.mercadopago.com/v1/payments/${paymentId}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer TEST-6235347846124389-091109-7d711dac37e885b86ab061148167e17f-435553967`,
                    },
                }
            );

            if (response.ok) {
                const payment = await response.json();
                const status = payment.status;

                // Verificar si el pago está aprobado
                if (status !== "approved") {
                    console.log("Pago no confirmado:", status);
                    return res.sendStatus(200); // Pago no confirmado
                }

                const userId = payment.metadata.user_id;
                console.log("Detalles del pago:", payment);

                // Actualizar el estado del pago en el usuario
                await User.updateOne(
                    { _id: userId },
                    {
                        $set: {
                            "lastOrderToLink.paymentStatus": status,
                            "lastOrderToLink.paymentId": paymentId,
                            "lastOrderToLink.deliveryStatus": "pending",
                        },
                    }
                );

                // Guardar la información del pago en la base de datos
                const newPayment = new Payment({
                    paymentId,
                    userId: userId, 
                    orderId: payment.order.id, 
                    amount: payment.transaction_amount,
                    currency: payment.currency_id,
                    paymentMethod: payment.payment_method.type,
                    paymentStatus: status,
                    transactionDate: payment.date_created || payment.date_approved,
                    payerEmail: payment.payer.email,
                    paymentGatewayResponse: payment,
                });

                await newPayment.save();

                // Obtener el número de teléfono del usuario
                const user = await User.findById(userId);
                if (!user) {
                    throw new Error(`Usuario no encontrado para el ID: ${userId}`);
                }
                const phoneNumber = user.phoneNumber;
                const deliveryStatus = user.lastOrderToLink.deliveryStatus;
                const diaYHoraEntrega = user.lastOrderToLink.diaYHoraEntrega || "No especificado"; // Asegúrate de que no sea null

                // Llamar a la función handlePaymentStatus para gestionar el envío automático del mensaje
                await handlePaymentStatus(
                    status,
                    phoneNumber,
                    deliveryStatus,
                    diaYHoraEntrega // Asegúrate de pasar este valor
                );

                // Enviar correo de notificación a la empresa
                await sendNewOrderEmail(user, user.lastOrderToLink);

                // Responder que la petición fue procesada correctamente
                return res.sendStatus(200);
            } else {
                console.error(
                    "Error al obtener los detalles del pago:",
                    response.status,
                    await response.text()
                );
                return res.sendStatus(500);
            }
        } catch (error) {
            console.error("Error en el webhook de MercadoPago:", error);
            return res.sendStatus(500);
        }
    } else {
        console.warn("Tipo de evento no manejado o datos incompletos:", req.body);
        return res.sendStatus(400);
    }
});

module.exports = router;