const { getChatGPTResponse } = require("../config/openaiClient.js");
const { sendMessage } = require('../utils/twilioHelper');
const User = require('../models/User.js');

const cancelPrompt = `
Clasifica la intencion de este mensaje, teniendo en cuenta esta clasificacion.
1. Afirmativa: La intencion del usuario es confirmar una accion.
2. Negativa: La intenccion del usuario es de arrepentimiento o una indicacion de que se equivoco y no quiero realizar la accion.

En caso 1 responde solo con la palabra 'afirmativa', y de lo contrario con 'negativa'`;

async function handleCancel(user, phoneNumber, Body) {
  const openAIResponse = await getChatGPTResponse([
    { role: "system", content: cancelPrompt },
    { role: "user", content: Body },
  ]);

  const conversation = user.conversation;

  if (openAIResponse.trim().toLowerCase() === "afirmativa") {
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    responseMessage = await getChatGPTResponse([
      ...conversationMessages,
      { role: "user", content: Body },
    ]);
    console.log("Respuesta a confirmacion:", responseMessage);

    await sendMessage(responseMessage, phoneNumber);

    conversation.push({ role: "assistant", content: responseMessage });
    
    try {
      const result = await User.updateOne(
        { phoneNumber: phoneNumber },
        { $set: { lastOrderToLink: {}, conversation: [] } }
      );
      console.log("LastOrder limpiado:", result);
    } catch (error) {
      console.error("Error al limpiar lastOrder:", error);
    }
    user.stage = 'welcome';
    await user.save();
  } else {
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    responseMessage = await getChatGPTResponse([
      ...conversationMessages,
      { role: "user", content: Body },
    ]);
    console.log("Respuesta a confirmacion:", responseMessage);

    await sendMessage(responseMessage, phoneNumber);

    conversation.push({ role: "assistant", content: responseMessage });
    user.stage = "confirm_or_modify";
    await user.save();
  }
}

module.exports = { handleCancel };