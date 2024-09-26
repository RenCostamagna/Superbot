const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { getChatGPTResponse } = require("../config/openaiClient.js");
const handleModifying = require("../controllers/handleModifying.js");

async function handleConfirmOrModify(user, phoneNumber, Body) {
  try {

    let responseMessage;

    const modifyOrConfirmPrompt = `
        Clasifica la intencion de este mensaje, teniendo en cuenta esta clasificacion y el contexto de la conversacion.
         1. Modificar.
         2. Confirmar.
         3. Cancelar.
        El mensaje que vas a tener que identificar, puede ser una oracion o simplemente la palabra.
        Identifica bien las oraciones que se encargan de confirmar la seleccion de un producto en particular, con las de confirmacion del pedido.
        Tene en cuenta que la persona puede querer confirmar una seleccion de un producto en particular que se le brindo anteriormente, no confirmes el pedido si se da eso.
        Se lo mas criterioso posible porque depende de tu interpretacion la continuacion de un flujo de programacion.
        En el caso de que el mensaje contenga alguna pregunto acerca de como realizar modificaciones o algo por el estilo, responde 'modificar' de igual manera.
        Tene en cuenta que la persona puede escribir con respecto a mensajes anteriores. Analiza muy bien al conversacion para tener en cuenta eso. No confirmes el pedido si el mensaje es una respuesta a pregunta anterior.
        Asegurate de responder con cancelar solo cuando la intecion sea muy clara y se mencione la palabra cancelar.
        Tene en cuenta que para confirmar el pedido, puede usar expresiones u oraciones. Por ejemplo: "Asi esta bien" o "Si, asi esta bien".
        Responde solamente con la palabra 'modificar', con 'confirmar', o con 'cancelar'. El mensaaje es este: ${Body}`;

    const conversation = user.conversation;

    const conversationMessagesPrompt = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const responseMessagePrompt = await getChatGPTResponse([
      ...conversationMessagesPrompt,
      { role: "system", content: modifyOrConfirmPrompt },
    ]);
    console.log("Respuesta:", responseMessagePrompt);
    // Asegúrate de esperar el resultado de OpenAI con await

    if (responseMessagePrompt.toLowerCase().trim() === "confirmar") {
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
    } else if (responseMessagePrompt.trim().toLowerCase() === "modificar") {

      const conversationMessages = conversation.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      responseMessage = await getChatGPTResponse([
        ...conversationMessages,
        { role: "user", content: Body },
      ]);
      console.log("Respuesta de saludo o pregunta:", responseMessage);

      conversation.push(
        { role: "user", content: Body },
        { role: "assistant", content: responseMessage }
      );
      user.stage = 'confirm_or_modify';
      await user.save();

      await client.messages.create({
        body: responseMessage,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber,
      });
    } else if (responseMessagePrompt.trim().toLowerCase() === "cancelar") {
      try {
        console.log(responseMessagePrompt);
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
