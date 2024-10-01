const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Envía un mensaje de WhatsApp utilizando Twilio.
 *
 * @param {string} body - El contenido del mensaje.
 * @param {string} to - El número de teléfono de destino (en formato internacional).
 * @returns {Promise<void>}
 */
const sendMessage = async (body, to) => {
  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
    });
    console.log(`Mensaje enviado a ${to}: ${body}`);
  } catch (error) {
    console.error(`Error al enviar mensaje a ${to}:`, error);
    throw error; // Opcional: maneja el error según tus necesidades
  }
};

module.exports = { sendMessage };
