const Shipping = require("../models/shipping.js");
const User = require("../models/User.js");
const updateStock = require('../config/updateStock.js');
const { getChatGPTResponse } = require("../config/openaiClient.js");
const { sendMessage } = require('../utils/twilioHelper');

const handlePaymentStatus = async (status, phoneNumber, deliveryStatus) => {
  let messageBody;
  const user = await User.findOne({ phoneNumber });

  if (!user) {
    console.error(`No se encontró un usuario con el número de teléfono: ${phoneNumber}`);
    return;
  }

  const shipping = await Shipping.findOne({
    phoneNumber: phoneNumber,
    estado: deliveryStatus,
  });

  if (!shipping) {
    console.error(`No se encontró información de envío para el usuario con el número de teléfono: ${phoneNumber} y estado de entrega: ${deliveryStatus}`);
    return;
  }

  const diaYHoraEntrega = shipping.diaYHoraEntrega || "No especificado"; // Asegúrate de que no sea null
  const conversation = user.conversation;

  console.log(shipping);
  // Determinar el mensaje basado en el estado del pago
  switch (status) {
    case "approved":
      responseMessage = `El pago del usuario se acreditó. La entrega fue programada para el ${diaYHoraEntrega}. Dirección: ${shipping.direccionCompleta}. Genera un mensaje para esto. No agregues un saludo.`;
      const conversationMessages = conversation.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      messageBody = await getChatGPTResponse([
        ...conversationMessages,
        { role: "system", content: responseMessage },
      ]);

      conversation.push({ role: "assistant", content: messageBody });
      await user.save();
      console.log(user.conversation);

      try {
          // Manejar el estado del pago
          user.lastOrderToLink.deliveryStatus = "pending";
  
          console.log("Estado del pago: ", user.lastOrderToLink.deliveryStatus)
          // Verificar el estado del pago y tomar acciones correspondientes
          if (user.lastOrderToLink.paymentStatus === "approved") {
            console.log(`Payment Status: ${user.lastOrderToLink.paymentStatus}`);
            await updateStock(user._id);
            // Cambiar el estado del usuario
            user.stage = "home_delivery";
            user.lastOrderToLink.paymentStatus = "accredited";
            await user.save();
          }
      } catch (error) {
        console.error("Error en el proceso de finalización del pedido:", error);
      }

      await sendMessage(messageBody, phoneNumber);
      break;
    case "pending":
      messageBody = `El pago está pendiente, continúa tu transacción para confirmar el pedido.`;
      await sendMessage(messageBody, phoneNumber);
      break;
    case "rejected":
      messageBody = `ALGO SALIÓ MAL.\n Tu pago fue rechazado.`;
      await sendMessage(messageBody, phoneNumber);
      break;
    case "cancelled":
      messageBody = `El pago fue cancelado.`;
      await sendMessage(messageBody, phoneNumber);
      break;
    default:
      messageBody = `Una vez realizado, envíe el mensaje: "pago"`;
      await sendMessage(messageBody, phoneNumber);
      break;
  }
};

module.exports = handlePaymentStatus;