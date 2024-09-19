const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { getChatGPTResponse } = require("../config/openaiClient.js");
const handleModifying = require("../controllers/handleModifying.js");

async function handleConfirmOrModify(user, phoneNumber, Body) {
  try {
    const modifyOrConfirmPrompt = `
        Clasifica la intencion de este mensaje, teniendo en cuenta esta clasificacion.
         1. Modificar.
         2. Confirmar.
         3. Cancelar.
        El mensaje que vas a tener que identificar, puede ser una oracion o simplemente la palabra.
        Se lo mas criterioso posible porque depende de tu interpretacion la continuacion de un flujo de programacion.
        En el caso de que el mensaje contenga alguna pregunto acerca de como realizar modificaciones o algo por el estilo, responde 'modificar' de igual manera.
        Responde solamente con la palabra 'modificar', con 'confirmar', o con 'cancelar'.`;

    const conversation = user.conversation;
    // Asegúrate de esperar el resultado de OpenAI con await
    const modifyOrConfirmResponse = await getChatGPTResponse([
      { role: "system", content: modifyOrConfirmPrompt },
      { role: "user", content: Body },
    ]);
    console.log(modifyOrConfirmResponse);

    if (modifyOrConfirmResponse.toLowerCase().trim() === "confirmar") {
      try {
        const conversationMessages = conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
        responseMessage = await getChatGPTResponse([
          ...conversationMessages,
          { role: "user", content: Body },
        ]);
        console.log("Respuesta a confirmacion:", responseMessage);
        console.log(conversation);

        try {
          // Envía el mensaje de confirmación de pedido
          await client.messages.create({
            body: responseMessage,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber,
          });
        } catch (error) {
          console.error("Error al enviar el mensaje con Twilio:", error);
          await client.messages.create({
            body: "Hubo un error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde.",
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber,
          });
        }

        conversation.push({ role: "user", content: Body });
        user.stage = "delivery_details";
        user.conversation.push({ role: "assistant", content: responseMessage });
        await user.save();

      } catch (error) {
        console.error("Error en el proceso de confirmación:", error);
        await client.messages.create({
          body: "Hubo un error al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.",
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: phoneNumber,
        });
      }
    } else if (modifyOrConfirmResponse.trim().toLowerCase() === "modificar") {
      await handleModifying(user, phoneNumber, Body);
      return;
    } else if (modifyOrConfirmResponse.trim().toLowerCase() === "cancelar") {
      try {
        const conversationMessages = conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
        responseMessage = await getChatGPTResponse([
          ...conversationMessages,
          { role: "user", content: Body },
        ]);
        console.log("Respuesta a confirmacion:", responseMessage);

        conversation.push({ role: "user", content: Body });

        try {
          await client.messages.create({
            body: responseMessage,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber,
          });
        } catch (error) {
          console.error("Error al enviar el mensaje con Twilio:", error);
          await client.messages.create({
            body: "Hubo un error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde.",
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber,
          });
        }

        user.conversation.push({ role: "assistant", content: responseMessage });
        user.stage = "cancel";
        await user.save();
      } catch (error) {
        console.error("Error en el proceso de confirmación:", error);
        await client.messages.create({
          body: "Hubo un error al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.",
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: phoneNumber,
        });
      }
    } else {
      console.log("Opción no reconocida:", Body);
    }
  } catch (error) {
    console.error("Error en handleConfirmOrModify:", error.message);
    await client.messages.create({
      body: "Hubo un error en el sistema. Por favor, inténtalo de nuevo más tarde.",
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: phoneNumber,
    });
  }
}

module.exports = handleConfirmOrModify;
