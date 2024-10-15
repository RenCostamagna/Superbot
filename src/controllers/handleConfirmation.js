const { getChatGPTResponse } = require("../config/openaiClient.js");
const { sendMessage } = require("../utils/twilioHelper.js");
const { sendNewBusinessRegistrationEmail } = require("./businessRegistrationController.js");

const cuitPrompt = `Extrae del mensaje el CUIT o CUIL del cliente y responde solo con esa informacion. No propones ninguna opcion, solo extraes la informacion.`;             

async function handleConfirmation(user, phoneNumber, Body) {
  try {
    // Mapeo de la conversacion.  
    let conversation = user.conversation;
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    // Extrae el CUIT o CUIL del mensaje del cliente
    const cuit = await getChatGPTResponse([
      ...conversationMessages,
      { role: "user", content: Body },
      { role: "system", content: cuitPrompt },
    ]);
    console.log("Inicio de handleConfirmation con usuario:", user._id);
    console.log("CUIT extraído:", cuit);
    user.cuit = cuit;
    await user.save();
    conversation.push({ role: "user", content: Body });

    // Verificar si el CUIT está registrado y asignar estado al usuario
    let isRegistered;
    if (user.status === 'registrado' || user.status === 'no_registrado') {
      isRegistered = user.status === 'registrado';
    } else {
      isRegistered = await isCUITRegistered(cuit);
      user.status = isRegistered ? 'registrado' : 'no_registrado';
      await user.save();
    }
    
    if (isRegistered) {
      // Si el CUIT está registrado, se continua con el pedido para consumidor final preguntando por el medio de pago.
      const paymentPrompt = `Pregunta a la persona si desea pagar con mercado pago o con otro medio de pago. Hazle saber que en caso de pagar con otro medio de pago o no querer pagar, se comunicaran con el a la brevedad.`;
      const tipoDePagoPrompt = `Analiza la respuesta del usuario y determina si desea pagar, de ser asi, si es con mercado pago o con otro medio de pago. Responde con "mercado pago" o "otro medio de pago". Si la respuesta es que no quiere pagar, responde de igual manera con "otro medio de pago".`;
      const paymentResponse = await getChatGPTResponse([
        ...conversationMessages,
        { role: "user", content: Body },
        { role: "system", content: paymentPrompt },
      ]);
      user.conversation.push({ role: "assistant", content: paymentResponse });
      await user.save();
      console.log("paymentResponse", paymentResponse);
      await sendMessage(paymentResponse, phoneNumber);
      const tipoDePagoResponse = await getChatGPTResponse([
        ...conversationMessages,
        { role: "user", content: Body },
        { role: "system", content: tipoDePagoPrompt },
      ]);
      console.log("tipoDePagoResponse", tipoDePagoResponse);
      if (tipoDePagoResponse === "mercado pago") {
        console.log("El usuario desea pagar con mercado pago");
        user.status = "registrado_y_pago";
        user.stage = "payment";
        await user.save();
      } else if (tipoDePagoResponse === "otro medio de pago") {
        console.log("El usuario desea pagar con otro medio de pago");
        user.stage = "payment";
        await user.save();
      } else {
        console.log("El usuario no desea pagar");
      }
    } else {
      // Si el CUIT no está registrado, se continua con el pedido para consumidor final preguntando por el medio de pago.
      const avisoPrompt = `El cliente no esta registrado en el sistema. Envia un mensaje al usuario informandole que su pedido se va a enviar a los administradores para su aprobacion y que se contactaran con el a la brevedad.`;
      const avisoResponse = await getChatGPTResponse([
        ...conversationMessages,
        { role: "user", content: Body },
        { role: "system", content: avisoPrompt },
      ]);
      user.conversation.push({ role: "assistant", content: avisoResponse });
      await user.save();
      console.log("avisoResponse", avisoResponse);
      await sendMessage(avisoResponse, phoneNumber);
      await sendNewBusinessRegistrationEmail(cuit);
      user.stage = "payment";
      await user.save();
    }
  } catch (error) {
    console.error("Error en handleConfirmation:", error);
    // Considera reenviar el error o manejarlo según el flujo de tu aplicación
  }
}

module.exports = { handleConfirmation };


// Simulación de la función para verificar el CUIT en la API
async function isCUITRegistered(cuit) {
  try {
    // Aquí iría la lógica de llamada a la API
    // Por ahora, devolvemos false como simulación
    return false; // Cambiar esto por la llamada a la API real cuando esté disponible
  } catch (error) {
    console.error("Error al verificar CUIT:", error);
    throw error; // Re-lanzar el error si es necesario o manejarlo adecuadamente
  }
}



