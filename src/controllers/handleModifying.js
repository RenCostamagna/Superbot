const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { convertPrice } = require("../utils/converPrice.js");
const { getChatGPTResponse } = require("../config/openaiClient.js");
const handleOrder = require("../controllers/handleOrder.js");
const Item = require("../models/item.js");

const promptPedido = `Captura solo los nombres de los productos que se mencionan en el mensaje. No incluyas cantidades, descripciones, unidades de medida o marcas. Solo proporciona los nombres de los productos en singular, corregidos ortográficamente, y separados por comas, con la primera letra de cada nombre en mayúsculas. No agregues información adicional.

Ejemplos de cómo debes responder:
- Para el mensaje "quiero comprar un aceite, dos coca colas y 1kg de chorizo", tu respuesta debe ser: Aceite, Coca Cola, Chorizo.
- Para el mensaje "aceite natura de 1L", tu respuesta debe ser: Aceite.
- Para el mensaje "dos vino tinto navarro correas de 750ml", tu respuesta debe ser: Vino tinto.
- Para el mensaje "una botella de leche entera de 1L y dos paquetes de galletas oreo", tu respuesta debe ser: Leche, Galletas Oreo.
- Para el mensaje "dos harina pureza", tu respuesta debe ser: Harina.
- Para el mensaje "leche, azucar, harina", tu respuesta debe ser: Leche, Azucar, Harina.`;

async function handleModifying(user, phoneNumber, Body) {
  // Primer paso: Identificar si el mensaje es una solicitud de modificación o ya contiene modificaciones.
  const identificationPrompt = `
            A continuación te proporciono un mensaje del usuario. Tu tarea es identificar si el mensaje es una solicitud para realizar una modificación en el pedido o si el mensaje ya contiene las modificaciones necesarias.

            - Si el mensaje es una solicitud para realizar una modificación en el pedido, como una petición general para hacer cambios, responde con "solicitud de modificación". Ejemplos: "Quiero hacer una modificación", "Necesito cambiar algo en mi pedido", "Quisiera modificar mi pedido".

            - Si el mensaje ya contiene las modificaciones específicas que se deben aplicar al pedido, como la adición, eliminación o cambio de productos, responde con "modificación". Ejemplos: "Quiero eliminar un yogurt y agregar una leche de 1L", "Añadir 2 litros de jugo y quitar 1 kilogramo de azúcar", "Reemplazar 1 litro de aceite con 1 litro de vinagre".
`;

  const conversation = user.conversation;

  console.log(identificationPrompt);
  let identificationResponse;

  try {
    identificationResponse = await getChatGPTResponse([
      { role: "system", content: identificationPrompt },
      { role: "user", content: Body },
    ]);
    if (!identificationResponse || typeof identificationResponse !== "string") {
      throw new Error("Respuesta de OpenAI no válida para la identificación");
    }
    console.log(identificationResponse);
  } catch (error) {
    console.error(
      "Error al obtener respuesta de OpenAI para la identificación:",
      error
    );
    identificationResponse = "no";
  }

  console.log(identificationResponse);

  identificationResponse = identificationResponse.replace(/\.$/, "");
  if (
    identificationResponse.trim().toLowerCase() === "solicitud de modificación"
  ) {
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

    await client.messages.create({
      body: responseMessage,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: phoneNumber,
    });

    conversation.push({ role: "assistant", content: responseMessage });
    user.stage = "confirm_or_modify";
    await user.save();
    return;
  } else if (identificationResponse.trim().toLowerCase() === "modificación") {
    // Si el mensaje ya contiene modificaciones, procesa las modificaciones.
    openAIResponse = await getChatGPTResponse([
      { role: "user", content: `${promptPedido}, El mensaje es: ${Body}` },
    ]);
    console.log("Respuesta de pedido:", openAIResponse);
    await handleOrder(user, phoneNumber, openAIResponse, Body);
    return;
  } else {
    console.log("nada");
  }
}
module.exports = handleModifying;
