const { MercadoPagoConfig, Preference } = require("mercadopago");
const { transformOrder } = require("../config/orderConfig.js");
//const nodemailer = require("nodemailer"); 
const mongoose = require("mongoose");

require("dotenv").config();

// Configuración del cliente de MercadoPago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

// Función para crear un enlace de pago
const createPaymentLink = async (order, userId) => {
  if (!order || !order.lastOrderToLink) {
    throw new Error(
      "El objeto de orden no es válido o no contiene la propiedad lastOrder."
    );
  }
  console.log("order: ", order);
  const transformedOrder = transformOrder(order);

  if (!transformedOrder.items || transformedOrder.items.length === 0) {
    throw new Error("No se han proporcionado artículos para la compra.");
  }
  const body = {
    items: transformedOrder.items,

    back_urls: {
      failure:
        process.env.MERCADOPAGO_STATUS_URL,
      success:
        process.env.MERCADOPAGO_STATUS_URL,
      pending:
        process.env.MERCADOPAGO_STATUS_URL,
    },
    auto_return: 'all',
    notification_url: process.env.MERCADOPAGO_WEBHOOK_URL,
    metadata: { userId: userId },
  };

  try {
    const payment = new Preference(client);
    const result = await payment.create({ body });
    const link = result.sandbox_init_point;
    if (link) {
      console.log("Link de pago generado:", link);
      return link;
    } else {
      throw new Error("El enlace de pago no se generó correctamente");
    }
  } catch (error) {
    console.error("Error al crear el enlace de pago:", error);
    throw error;
  }
};

module.exports = { createPaymentLink };
