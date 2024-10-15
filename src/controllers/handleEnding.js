const mongoose = require("mongoose");
const { getChatGPTResponse } = require("../config/openaiClient.js");
const { updateOrderHistory } = require("../config/updateUserOrderHistory.js");
const { sendMessage } = require('../utils/twilioHelper.js');
const clearUserCache = require('../config/clearCache.js');

async function handleEnding(user, phoneNumber, Body) {
try {
  const promptPostPedido = `Si el usuario desea realizar alguna pregunta mas sobre su pedido, respondele con la informacion que tenes y manteniendo el contexto de la conversacion.`;
  const promptIntencionPedido = `Es el paso final del programa, verifica si el usuario quiere realizar alguna prgunta o no.
  Si quiere realizar alguna pregunta, responde con "pregunta", caso contrario responde con "completado".`;

  const conversationMessages = conversation.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  let responseMessage = await getChatGPTResponse([
    ...conversationMessages,
    { role: "user", content: Body },
    { role: "system", content: promptIntencionPedido }
  ]);

  if (responseMessage === "completado") {
    const conversation = user.conversation;
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    responseMessage = await getChatGPTResponse([
      ...conversationMessages,
      { role: "user", content: Body },
      { role: "system", content: promptPostPedido }
    ]);

    conversation.push({ role: "user", content: Body }, { role: "assistant", content: responseMessage });
    await updateOrderHistory(user);
    await clearUserCache(phoneNumber);
    await sendMessage(responseMessage, phoneNumber);
    await user.save();

  } else if (responseMessage === "pregunta") {
    const conversation = user.conversation;
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    responseMessage = await getChatGPTResponse([
      ...conversationMessages,
      { role: "user", content: Body },
      { role: "system", content: promptPostPedido }
    ]);   
    conversation.push({ role: "user", content: Body }, { role: "assistant", content: responseMessage });
    await sendMessage(responseMessage, phoneNumber);
    await user.save();
  }

} catch (error) {
  console.error("Error en el proceso de entrega:", error);
}

}

module.exports =  handleEnding ;