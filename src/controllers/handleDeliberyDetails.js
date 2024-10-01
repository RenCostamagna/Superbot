const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { getChatGPTResponse } = require("../config/openaiClient.js");
const verifyAreaCode = require("../controllers/areaCodeModifyier.js");
const obtenerProximaSemana = require("../config/deliveryDateConfig.js");
const Shipping = require("../models/shipping.js");
const { sendMessage } = require('../utils/twilioHelper');

// Prompt para obtener detalles de entrega
const deliveryPrompt = `
Eres el encargado de los envios de un supermercado.
Tienes que identificar lo siguiente:
    1. Direccion de envio y ciudad.
    2. Nombre de la persona que realiza el pedido.
    3. DNI de la persona.
    4. Dia y hora favorita que eligio para el mismo.
Tene en cuenta que hay calles que tienen nombres de personas.
Tu respuesta tiene que estar dad en este formato: Direccion (incluyendo ciudad), nombre de la persona, DNI, dia y hora. Por ejemplo: "Av. Siempre Viva 123 Rosario, Pedro Gomez, 34567890, martes 15:00".
Si el dia y hora esta dado como oracion, devolve solo el dia y la hora. Por ejemplo: "lunes a las 15hs", tu respuesta: "lunes 15:00".
Si el dia es miercoles, asegurate de devolverlo con el acento correspondiente. 
Elimina el "hs" al final de la hora y no agregues puntos al final ni informacion adicional. 
`;

async function deliveryDetails(user, phoneNumber, Body) {
  const conversation = user.conversation;
  console.log('Delivery conversation: ', conversation);
  try {
    // Obtener respuesta de OpenAI
    const openAIResponse = await getChatGPTResponse([
      { role: "system", content: `${deliveryPrompt}, El mensaje es este: ${Body}` },
    ]);
    console.log(openAIResponse);

    // Validar que la respuesta de OpenAI contenga suficientes datos separados por comas
    const responseParts = openAIResponse.split(",");
    if (responseParts.length < 4) {
      throw new Error(
        "La respuesta de OpenAI no contiene el formato esperado."
      );
    }

    // Extraer y validar los datos de la respuesta
    const [direccionCompleta, nombrePersona, dni, diaYHora] = responseParts.map(
      (part) => part.trim()
    );
    console.log([direccionCompleta, nombrePersona, dni, diaYHora]);
    if (!direccionCompleta || !nombrePersona || !dni || !diaYHora) {
      throw new Error("Faltan datos importantes para el envío.");
    }

    // Obtener la fecha de entrega
    const diaYHoraEntrega = obtenerProximaSemana(diaYHora.trim());
    const number = phoneNumber;

    // Guardar la información en el esquema de MongoDB
    const newShipping = new Shipping({
      direccionCompleta: direccionCompleta,
      nombrePersona: nombrePersona.trim(),
      dni: dni.trim(),
      phoneNumber: number,
      diaYHoraEntrega: diaYHoraEntrega,
      estado: "pending",
    });
    await newShipping.save();
    console.log("Información del envío guardada correctamente");

    // Enviar mensaje de continuación solo si los datos de envío son correctos
    if (verifyAreaCode(phoneNumber)) {
      const conversationMessages = conversation.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      const responseMessage = await getChatGPTResponse([
        ...conversationMessages,
        { role: "user", content: Body },
      ]);
      console.log("Respuesta a confirmacion:", responseMessage);

      // Actualizar la conversación y el estado del usuario
      conversation.push(
        { role: "user", content: Body },
        { role: "assistant", content: responseMessage }
      );
      user.stage = "payment";
      user.deliveryDetails = Body;
      await user.save();

      await sendMessage(responseMessage, phoneNumber);
    } else {
      // Mensaje si el código de área no es válido
      const incorrectAreaCode = `Lo siento, actualmente solo realizamos entregas en Rosario y localidades aledañas. Parece que tu dirección está fuera de nuestra área de servicio, por lo que no podemos procesar tu pedido.`;
      await sendMessage(incorrectAreaCode, phoneNumber);
    }
  } catch (error) {
    console.error(`Error procesando el mensaje: ${error.message}`);
    // Pedir nuevamente los datos si hay un error
    const retryMessage = `Hubo un problema con los datos proporcionados. Por favor, asegúrate de enviar la dirección completa, nombre, DNI, y día y hora de entrega en el formato correcto.`;
    await sendMessage(retryMessage, phoneNumber);
  }
}

module.exports = deliveryDetails;