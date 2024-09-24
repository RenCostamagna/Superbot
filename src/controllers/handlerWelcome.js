// welcomeFlow.js
const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { getChatGPTResponse } = require("../config/openaiClient.js");
const handleOrder = require("./handleOrder.js");
const User = require("../models/User.js");

const promptPedido = `Captura solo los nombres de los productos que se mencionan en el mensaje. 
No incluyas cantidades, descripciones, unidades de medida o marcas. 
Solo proporciona los nombres de los productos en singular, y separados por comas, con la primera letra de cada nombre en mayúsculas. No agregues información adicional.
Corrigelos ortograficamente, agregando acentos y tildes correspondientes.

Ejemplos de cómo debes responder:
- Para el mensaje "quiero saber que leche tenes disponible", tu respuesta debe ser: Leche.
- Para el mensaje "quiero comprar un aceite, dos coca colas y 1kg de chorizo", tu respuesta debe ser: Aceite, Coca Cola, Chorizo.
- Para el mensaje "aceite natura de 1L", tu respuesta debe ser: Aceite.
- Para el mensaje "dos vino tinto navarro correas de 750ml", tu respuesta debe ser: Vino tinto.
- Para el mensaje "una botella de leche entera de 1L y dos paquetes de galletas oreo", tu respuesta debe ser: Leche, Galletas Oreo.
- Para el mensaje "dos harina pureza", tu respuesta debe ser: Harina.
- Para el mensaje "leche, azucar, harina", tu respuesta debe ser: Leche, Azucar, Harina.`;

async function welcomeFlow(user, phoneNumber, Body) {
  // Define el prompt para clasificar la intención
  const welcomePrompt = `Clasifica la intención del siguiente mensaje en una de las dos categorías. Ten en cuenta las siguientes pautas:

  Si el mensaje menciona productos específicos o consultas relacionadas con productos, como en "Quiero saber el precio de la leche" o "Me gustaría saber qué tipos de harina tienes", se considera un pedido.
  Si el mensaje expresa una intención de compra mencionando un producto específico, como en "Quiero comprar yogurt", se considera un pedido.
  Si el mensaje es un saludo general o una pregunta sobre cómo usar la aplicación, como en "Hola, quiero hacer un pedido" o "¿Cómo compro?", se considera un saludo o pregunta sobre cómo usar la aplicación.
  Responde solo con "pedido" si es un pedido o con "saludo o pregunta" en los demás casos.
  
  Mensaje: ${Body};`

  // Recupera la conversación del usuario
  let users = await User.findOne({ phoneNumber });
  if (!users) {
    console.error("Usuario no encontrado");
    return;
  }

  const conversation = users.conversation || [];
  console.log("Conversación actual:", conversation);

  // Prepara el mensaje para OpenAI
  const messages = [{ role: "user", content: welcomePrompt }];

  // Obtiene la respuesta de OpenAI
  let openAIResponse = await getChatGPTResponse(messages);
  console.log("Respuesta de OpenAI:", openAIResponse);

  let responseMessage;
  if (openAIResponse.toLowerCase() === "pedido") {
    // Si es un pedido, maneja el pedido y obtén la respuesta
    responseMessage = await getChatGPTResponse([
      { role: "user", content: `${promptPedido}, El mensaje es: ${Body}` },
    ]);
    console.log("Respuesta de pedido:", responseMessage);
    await handleOrder(users, phoneNumber, responseMessage, Body);
  } else if (openAIResponse.toLowerCase() === "saludo o pregunta") {
    // Si es un saludo o pregunta, cambia el estado y obtén la respuesta
    conversation.push({ role: "user", content: Body });
    await user.save();
    console.log(user.conversation);

    user.stage = "welcome";
    await user.save();

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
    user.conversation.push({ role: "assistant", content: responseMessage });
    await user.save();
  } else {
    console.error("No se pudo clasificar el mensaje.");
    return;
  }
}

module.exports = welcomeFlow;
