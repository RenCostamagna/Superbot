const { MercadoPagoConfig, Preference } = require("mercadopago");
const { transformOrder } = require("../config/orderConfig.js");
const nodemailer = require("nodemailer"); 
const mongoose = require("mongoose");

require("dotenv").config();

const client = new MercadoPagoConfig({
  accessToken: 'TEST-6235347846124389-091109-7d711dac37e885b86ab061148167e17f-435553967',
});

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
    autoreturn: "approved",
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


// Función para enviar el correo de notificación de nuevo pedido
const sendNewOrderEmail = async (user, order) => {
  let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let productList = order.items.map(item => {
    const title = item.title || 'Título no disponible';
    const quantity = item.quantity || 'Cantidad no disponible';
    const unit_price = item.unit_price || 'Precio no disponible';
    return `${title} - Cantidad: ${quantity} - Precio unitario: $${unit_price}`;
  }).join('\n');

  let mailOptions = {
    from: '"Sistema de Pedidos" <noreply@tutienda.com>',
    to: process.env.COMPANY_EMAIL,
    subject: "Nuevo pedido registrado",
    text: `
      Se ha registrado un nuevo pedido:

      Teléfono: ${user.phoneNumber}

      Detalles del pedido:
      ${productList}

      Total: $${order.total}

      Por favor, procesa este pedido lo antes posible.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Correo de notificación enviado a la empresa");
  } catch (error) {
    console.error("Error al enviar el correo de notificación:", error);
  }
};

module.exports = { createPaymentLink, sendNewOrderEmail};
