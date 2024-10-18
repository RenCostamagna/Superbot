const nodemailer = require('nodemailer');
require('dotenv').config();

const sendNewBusinessRegistrationEmail = async (cuit, phoneNumber) => {
  let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let formattedCuit = `
    CUIT/CUIL: ${cuit || 'No proporcionado'}
  `;

  let mailOptions = {
    from: '"Sistema de Registro de Clientes" <noreply@tuempresa.com>',
    to: process.env.COMPANY_EMAIL,
    subject: "Nuevo cliente solicitando registro",
    text: `
      Se ha recibido una nueva solicitud de registro de cliente, verifica si es un consumidor final o un negocio con su cuit/cuil en AFIP:

      ${formattedCuit}
      Teléfono: ${phoneNumber}

      Por favor, revisa esta información y procesa la solicitud lo antes posible.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Correo de notificación de nuevo negocio enviado a la empresa");
  } catch (error) {
    console.error("Error al enviar el correo de notificación de nuevo negocio:", error);
  }
};



// Función para enviar el correo de notificación de nuevo pedido
const sendNewOrderEmail = async (user, order, estado) => {
    let transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  
    let productList = user.lastOrderToLink.items.map(item => {
      console.log("Item:", item); // Registro de depuración
      const title = item.productName || 'Título no disponible';
      const quantity = item.quantity || 'Cantidad no disponible';
      const unit_price = item.pricePerUnit || 'Precio no disponible';
      return `${title} - Cantidad: ${quantity} - Precio unitario: $${unit_price}`;
    }).join('\n');
  
    let mailOptions = {
      from: '"Sistema de Pedidos" <noreply@tutienda.com>',
      to: process.env.COMPANY_EMAIL,
      subject: "Nuevo pedido registrado",
      text: `
        Se ha registrado un nuevo pedido:
  
        Teléfono: ${user.phoneNumber}
  
        Detalles del pedido:\n
        ${productList}
  
        Total: $${order.total}

        Estado del pago: ${estado}
        Estado del cliente: ${user.status}
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

module.exports = { sendNewBusinessRegistrationEmail, sendNewOrderEmail };