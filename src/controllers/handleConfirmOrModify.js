const { sendMessage } = require('../utils/twilioHelper');
const { getChatGPTResponse } = require("../config/openaiClient.js");
//const deliveryDetails = require("./handleDeliberyDetails.js");

async function handleConfirmOrModify(user, phoneNumber, Body) {
  try {
    // Agregar el mensaje del usuario al principio para evitar duplicados
    user.conversation.push({ role: "user", content: Body });
    await user.save();
    // Prompt para clasificar la intención del mensaje
    const modifyOrConfirmPrompt = `
      Clasifica la intención de este mensaje en una de las siguientes categorías:
      1. Modificar
      2. Confirmar
      3. Cancelar
      4. No_confirmar

      El mensaje puede ser una oración completa o una sola palabra.
      
      - Responde 'confirmar' solo si el mensaje es una confirmación del pedido completo. En este caso tene en cuenta la pregunta que se puede haber hecho antes.
      - Si el mensaje es una confirmación de un producto específico, responde con 'modificar'.
      - Si el mensaje contiene una pregunta sobre cómo realizar modificaciones o respuestas a preguntas anteriores, responde con 'modificar'.
      - Si el mensaje menciona explícitamente la palabra 'cancelar', responde con 'cancelar'.
      - Si el mensaje no es una confirmación, una modificación, una cancelación o una pregunta sobre cómo realizar modificaciones, responde con 'no_confirmar'.
      - Tene en cuenta el contexto de la conversación para hacer una clasificación precisa, ya que el usuario puede responder preguntas anteriores.
      - La persona responde "si", a preguntas de tipo: "Queres agregar algo mas?" o "Queres agregarlo a tu pedido?" responde con 'modificar'.
      - La confirmacion tiene que ser lo mas clara posible. 
      - Si el mensaje contiene el cuit/cuil, tomalo como confirmacion y responde con 'confirmar'.

      **Ejemplos de confirmación del pedido:**
      - Mensaje anterior: "Queres confirmar el pedido?", Mensaje: "Si dale"
      - "Así está bien"
      - "Sí, así está bien"
      - "Confirmo"
      - "Confirmar"

      **Ejemplos de modificar:**
      - "Quisiera cambiar el producto a otro modelo."
      - "¿Cómo puedo modificar mi pedido?"
      
      **Ejemplos de cancelar:**
      - "Quiero cancelar mi pedido."
      - "Cancelar."
      
      **Ejemplos de no_confirmar:**
      - "No estoy seguro."
      - "Necesito más información."

      Responde solo con una de las palabras: 'modificar', 'confirmar', 'cancelar' o 'no_confirmar'.`;
    
    const conversation = user.conversation;

    // Crear el prompt para OpenAI con el historial de la conversación
    const conversationMessagesPrompt = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })).filter((msg) => msg.role !== "system");
    
    const responseMessagePrompt = await getChatGPTResponse([
      ...conversationMessagesPrompt,
      { role: "system", content: modifyOrConfirmPrompt },
    ]);

    // Manejar la respuesta de clasificación
    const intencion = responseMessagePrompt.toLowerCase().trim();
    console.log("Intención clasificada:", intencion);

    if (intencion === "confirmar") {
      await manejarConfirmacion(user, phoneNumber, Body, conversation);
    } else if (intencion === "modificar") {
      await manejarModificacion(user, phoneNumber, Body, conversation);
    } else if (intencion === "cancelar") {
      await manejarCancelacion(user, phoneNumber, Body, conversation);
    } else if (intencion === "no_confirmar") {
      await manejarNoConfirmar(user, phoneNumber, Body, conversation);
    } else {
      console.log("Opción no reconocida:", Body);
      // Opcional: Manejar otras opciones no reconocidas
      await sendMessage("No entendí tu solicitud. Por favor, responde con 'confirmar', 'modificar' o 'cancelar'.", phoneNumber);
    }
  } catch (error) {
    console.error("Error en handleConfirmOrModify:", error.message);
    await sendMessage("Hubo un error en el sistema. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
  }
}

// Funciones auxiliares para manejar cada intención
async function manejarConfirmacion(user, phoneNumber, Body, conversation) {
  try {
    //await deliveryDetails(user, phoneNumber, Body);
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const responseMessage = await getChatGPTResponse([
      ...conversationMessages,
    ]);
    console.log("Respuesta de modificación:", responseMessage);

    // Actualizar la conversación y el estado del usuario
    conversation.push(
      { role: "user", content: Body },
      { role: "assistant", content: responseMessage }
    );
    user.stage = 'confirmation'; 
    await user.save();
    await sendMessage(responseMessage, phoneNumber);
    
  } catch (error) {
    console.error("Error en el proceso de confirmación:", error);
    await sendMessage("Hubo un error al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
  }
}

async function manejarModificacion(user, phoneNumber, Body, conversation) {
  try {
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const responseMessage = await getChatGPTResponse([
      ...conversationMessages,
    ]);
    console.log("Respuesta de modificación:", responseMessage);

    // Actualizar la conversación y el estado del usuario
    conversation.push(
      { role: "assistant", content: responseMessage }
    );
    user.stage = 'confirm_or_modify';
    await user.save();

    await sendMessage(responseMessage, phoneNumber);
  } catch (error) {
    console.error("Error en el proceso de modificación:", error);
    await sendMessage("Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
  }
}

async function manejarCancelacion(user, phoneNumber, Body, conversation) {
  try {
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const responseMessage = await getChatGPTResponse([
      ...conversationMessages,
    ]);
    console.log("Respuesta a cancelación:", responseMessage);

    try {
      await sendMessage(responseMessage, phoneNumber);
    } catch (error) {
      console.error("Error al enviar el mensaje con Twilio:", error);
      await sendMessage("Hubo un error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
    }

    // Actualizar la conversación y el estado del usuario
    user.conversation.push({ role: "assistant", content: responseMessage });
    user.stage = "cancel";
    await user.save();
  } catch (error) {
    console.error("Error en el proceso de cancelación:", error);
    await sendMessage("Hubo un error al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
  }
}

async function manejarNoConfirmar(user, phoneNumber, Body, conversation) {
  try {
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const responseMessage = await getChatGPTResponse([
      ...conversationMessages,
    ]);
    console.log("Respuesta a no_confirmar:", responseMessage);

    try {
      await sendMessage(responseMessage, phoneNumber);
    } catch (error) {
      console.error("Error al enviar el mensaje con Twilio:", error);
      await sendMessage("Hubo un error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
    }

    // Actualizar la conversación y el estado del usuario
    user.conversation.push({ role: "assistant", content: responseMessage });
    user.stage = "confirm_or_modify";
    await user.save();
  } catch (error) {
    console.error("Error en el proceso de no_confirmar:", error);
    await sendMessage("Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
  }
}

module.exports = handleConfirmOrModify;