const { sendMessage } = require('../utils/twilioHelper');
const { getChatGPTResponse } = require("../config/openaiClient.js");
const deliveryDetails = require("./handleDeliberyDetails.js");

async function handleConfirmOrModify(user, phoneNumber, Body) {
  try {
    let responseMessage;

    // Prompt para clasificar la intención del mensaje
    const modifyOrConfirmPrompt = `
      Clasifica la intención de este mensaje en una de las siguientes categorías:
      1. Modificar
      2. Confirmar
      3. Cancelar

      El mensaje puede ser una oración completa o una sola palabra. Ten en cuenta el contexto de la conversación para hacer una clasificación precisa.
      
      - Asegurate de responder confirmar solo si el mensaje es una confirmación del pedido completo y no de un producto específico.
      - Si el mensaje es una confirmación de un producto específico, responde con 'modificar'.
      - Si el mensaje es una confirmación del pedido completo, responde con 'confirmar'.
      - Si el mensaje contiene una pregunta sobre cómo realizar modificaciones, responde con 'modificar'.
      - Si el mensaje menciona explícitamente la palabra 'cancelar', responde con 'cancelar'.
      - Si el mensaje es una respuesta a una pregunta anterior o no está claro, responde con 'no_confirmar'.
      
      Ejemplos de confirmación del pedido: "Así está bien", "Sí, así está bien", "Confirmo", "Confirmar".

      Responde solo con una de las palabras: 'modificar', 'confirmar', 'cancelar' o 'no_confirmar'.

      El mensaje es: ${Body}`;
    
    const conversation = user.conversation;

    // Crear el prompt para OpenAI con el historial de la conversación
    const conversationMessagesPrompt = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const responseMessagePrompt = await getChatGPTResponse([
      ...conversationMessagesPrompt,
      { role: "system", content: modifyOrConfirmPrompt },
    ]);
    console.log("Respuesta de clasificación:", responseMessagePrompt);

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
  const promptDatosEnvios = `
  Si el mensaje contiene informacion de envio, responde con "datos_envio".
  Si el mesaje es de confirmacion sin los datos de envio, responde con "confirmacion".
  Tene en cuenta que la informacion contiene el nombre de la persona, la direccion, el dni y el dia y hora.
  Solo responde con "datos_envio" o "confirmacion". No agregues informacion extra.
  Mensaje: ${Body}
  `
  try {
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const responseMessage = await getChatGPTResponse([
      ...conversationMessages,
      { role: "system", content: promptDatosEnvios },
    ]);
    console.log("Respuesta a clasificacion deconfirmación:", responseMessage);

    if (responseMessage === "datos_envio") {
      await deliveryDetails(user, phoneNumber, Body);
      return;
    } else if (responseMessage === "confirmacion") {

      try {
        const conversationMessages = conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
        const responseMessage = await getChatGPTResponse([
          ...conversationMessages,
          { role: "user", content: Body },
        ]);
        console.log("Respuesta a confirmacion dentro de confirmacion:", responseMessage);

        // Envía el mensaje de confirmación de pedido
        await sendMessage(responseMessage, phoneNumber);
      } catch (error) {
        console.error("Error al enviar el mensaje con Twilio:", error);
        await sendMessage("Hubo un error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
      }
  
      // Actualizar la conversación y el estado del usuario
      conversation.push({ role: "user", content: Body });
      user.stage = "delivery_details";
      user.conversation.push({ role: "assistant", content: responseMessage });
      await user.save();
    } else {
      console.log("No se pudo clasificar la intención de confirmación:", Body);
      await sendMessage("Hubo un error al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.", phoneNumber);
    }

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
      { role: "user", content: Body },
    ]);
    console.log("Respuesta de modificación:", responseMessage);

    // Actualizar la conversación y el estado del usuario
    conversation.push(
      { role: "user", content: Body },
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
      { role: "user", content: Body },
    ]);
    console.log("Respuesta a cancelación:", responseMessage);

    conversation.push({ role: "user", content: Body });

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
      { role: "user", content: Body },
    ]);
    console.log("Respuesta a no_confirmar:", responseMessage);

    conversation.push({ role: "user", content: Body });

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