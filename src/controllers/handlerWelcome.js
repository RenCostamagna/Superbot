// welcomeFlow.js
const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { getChatGPTResponse } = require("../config/openaiClient.js");
const User = require("../models/User.js");
const { sendMessage } = require('../utils/twilioHelper');

async function welcomeFlow(user, phoneNumber, Body) {
  // Define el prompt para clasificar la intención
  const welcomePrompt = `Clasifica la intención del siguiente mensaje en una de las dos categorías. Ten en cuenta las siguientes pautas:

  Si el mensaje menciona productos específicos o consultas relacionadas con productos, como en "Quiero saber el precio del alimento para perro Pedigree" o "Me gustaría saber qué tipos de antipulgas tenes", se considera un pedido.
  Si el mensaje expresa una intención de compra mencionando un producto específico, como en "Quiero comprar alimento para gato", se considera un pedido.
  Si el mensaje es un saludo general o una pregunta sobre cómo usar la aplicación, como en "Hola, quiero hacer un pedido" o "¿Cómo compro?", se considera un saludo o pregunta sobre cómo usar la aplicación.
  Responde solo con "pedido" si es un pedido o con "saludo o pregunta" en los demás casos.
  Tene en cuenta el contexto de la conversación para hacer una clasificación precisa, ya que el usuario puede responder preguntas anteriores.
  `
  let responseMessage;

  // Recupera la conversación del usuario
  let users = await User.findOne({ phoneNumber });
  if (!users) {
    console.error("Usuario no encontrado");
    return;
  }

  let conversation = users.conversation || [];
  console.log("Conversación actual:", conversation);

  const conversationMessages = conversation.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Obtiene la respuesta de OpenAI
  let openAIResponse = await getChatGPTResponse([
    ...conversationMessages,
    { role: "user", content: Body },
    { role: "system", content: welcomePrompt }
  ]);

  console.log("Respuesta de OpenAI:", openAIResponse);

  
  if (openAIResponse.toLowerCase() === "pedido") {
    // Si es un pedido, maneja el pedido y obtén la respuesta
    console.log("Respuesta de pedido:", responseMessage);
    
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    responseMessage = await getChatGPTResponse([
      ...conversationMessages,
      { role: "user", content: Body },
    ]);
    console.log("Respuesta de saludo o pregunta:", responseMessage);

    conversation.push({ role: "user", content: Body });
    conversation.push({role: 'assistant', content: responseMessage});
    users.stage = 'confirm_or_modify';
    await users.save();

    await sendMessage(responseMessage, phoneNumber);

    
  } else if (openAIResponse.toLowerCase() === "saludo o pregunta") {
    // Si es un saludo o pregunta, cambia el estado y obtén la respuesta
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    responseMessage = await getChatGPTResponse([
      ...conversationMessages,
      { role: "user", content: Body },
    ]);
    console.log("Respuesta de saludo o pregunta:", responseMessage);

    await client.messages.create({
      body: responseMessage,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: phoneNumber,
    });

    // Actualiza la conversación del usuario con la respuesta del asistente
    conversation.push({ role: "user", content: Body });
    conversation.push({ role: "assistant", content: responseMessage });
    users.stage = "welcome";
    await users.save();
  } else {
    console.error("No se pudo clasificar el mensaje.");
    return;
  }
}

module.exports = welcomeFlow;
