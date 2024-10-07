/*const mongoose = require("mongoose");
const { getChatGPTResponse } = require("../config/openaiClient.js");
const { updateOrderHistory } = require("../config/updateUserOrderHistory.js");
const Shipping = require("../models/shipping.js");
const User = require("../models/User.js");
const { sendMessage } = require('../utils/twilioHelper');

async function handleHomeDelivery(user, phoneNumber, Body) {
  try {
    const promptDelivery = `Sos el encargado de los envios de un supermercado, el usuario te consultura sobre el estado de su pedido o confirmara que el pedido le llego correctamete
                                Tu tarea es reconocer la intencion.
                                - En caso de que sea una pregunta sobre el estado del pedido, responde "estado", sin mas aclaraciones ni informacion.
                                - En caso de ser la confirmacion de recepcion del pedido, responde con "completado", sin mas aclaraciones ni informacion.
                                
                                No agregues informacion adicional ni puntos al final
                                El mensaje es este: ${Body}`;

    const deliveryResponse = await getChatGPTResponse([
      { role: "system", content: promptDelivery },
    ]);
    console.log("Respuesta de GPT:", deliveryResponse);

    // Buscar el estado de envío
    let shippingStatus = await Shipping.findOne({
      phoneNumber: phoneNumber,
      estado: user.lastOrderToLink.deliveryStatus,
    });

    let userStatus = await User.findOne({
      phoneNumber: phoneNumber,
    });

    if (!shippingStatus) {
      throw new Error(
        "No se encontró el estado del envío para el número de teléfono proporcionado."
      );
    }

    if (deliveryResponse === "estado") {
      const conversation = user.conversation;
      const conversationMessages = conversation.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const responseMessage = await getChatGPTResponse([
        ...conversationMessages,
        { role: "user", content: Body },
      ]);

      console.log("Prompt para estado de entrega:", responseMessage);
      conversation.push(
        { role: "user", content: Body },
        { role: "assistant", content: responseMessage }
      );

      await sendMessage(responseMessage, phoneNumber);
    } else if (deliveryResponse === "completado") {
      const conversation = user.conversation;
      const conversationMessages = conversation.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const responseMessage = await getChatGPTResponse([
        ...conversationMessages,
        { role: "user", content: Body },
      ]);

      console.log("Prompt para estado de entrega:", responseMessage);
      conversation.push(
        { role: "user", content: Body },
        { role: "assistant", content: responseMessage }
      );
      await userStatus.save();

      await sendMessage(responseMessage, phoneNumber);

      shippingStatus.estado = "entregado";
      await shippingStatus.save();

      userStatus.lastOrderToLink.deliveryStatus = "completado";
      userStatus.stage = "welcome";
      await userStatus.save();

      await updateOrderHistory(userStatus);

      try {
        const result = await User.updateOne(
          { phoneNumber: phoneNumber },
          { $set: { lastOrderToLink: {}, conversation: [] } }
        );
        console.log("LastOrder limpiado:", result);
      } catch (error) {
        console.error("Error al limpiar lastOrder:", error);
      }
    } else {
      throw new Error("Respuesta de GPT no reconocida.");
    }
  } catch (error) {
    console.error("Error en el proceso de entrega:", error);
    // Aquí puedes manejar el error, por ejemplo, enviando un mensaje de error al usuario o registrando el error.
  }
}

module.exports =  handleHomeDelivery ;*/