/*const client = require("twilio")(
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
Eres el encargado de los envíos de un supermercado.
Tienes que identificar una de las siguientes opciones:

**1. Datos de envío:**
    1. Dirección de envío y ciudad.
    2. Nombre de la persona que realiza el pedido.
    3. DNI de la persona.
    4. Día y hora favorita que eligió para el mismo.
Ten en cuenta que hay calles que tienen nombres de personas.
Tu respuesta tiene que estar dada en este formato: Dirección (incluyendo ciudad), nombre de la persona, DNI, día y hora. Por ejemplo: "Av. Siempre Viva 123 Rosario, Pedro Gomez, 34567890, martes 15:00".
Si el día y hora está dado como oración, devuelve solo el día y la hora. Por ejemplo: "lunes a las 15hs", tu respuesta: "lunes 15:00".
Si el día es miércoles, asegúrate de devolverlo con el acento correspondiente.
Elimina el "hs" al final de la hora y no agregues puntos al final ni información adicional.
Solo responde con la información solicitada y en ningún caso agregues información adicional.

**2. Mensajes de confirmación:**
Si no hay ningún dato de envio, responde manteniendo el contexto de la conversación.
`;

async function deliveryDetails(user, phoneNumber, Body) {
  const conversation = user.conversation;
  console.log('Delivery conversation: ', conversation);
  
  // Declarar camposFaltantes fuera del bloque try
  let camposFaltantes = [];

  try {
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Obtener respuesta de OpenAI
    const openAIResponse = await getChatGPTResponse([
      ...conversationMessages,
      { role: "user", content: Body },
      { role: "system", content: `${deliveryPrompt}` },
    ]);

    console.log("Respuesta de OpenAI:", openAIResponse);

    // Validar que openAIResponse no sea undefined ni vacío
    if (!openAIResponse) {
      throw new Error("No se recibió una respuesta válida de OpenAI.");
    }

    // Validar que la respuesta de OpenAI contenga suficientes datos separados por comas
    const responseParts = openAIResponse.split(",");
    if (responseParts.length < 4) {
      throw new Error("La respuesta de OpenAI no contiene el formato esperado.");
    }

    // Extraer y validar los datos de la respuesta
    const [direccionCompleta, nombrePersona, dni, diaYHora] = responseParts.map(
      (part) => part.trim()
    );

    console.log([direccionCompleta, nombrePersona, dni, diaYHora]);

    // Validar específicamente día y hora
    let dia = null;
    let hora = null;

    if (diaYHora) {
      const diaHoraParts = diaYHora.split(" ");
      dia = diaHoraParts[0];
      hora = diaHoraParts[1] || null;
    }

    // Identificar campos faltantes
    if (!direccionCompleta) camposFaltantes.push("dirección completa");
    if (!nombrePersona) camposFaltantes.push("nombre de la persona");
    if (!dni) camposFaltantes.push("DNI");
    if (!dia || !hora) {
      if (!dia) camposFaltantes.push("día de entrega");
      if (!hora) camposFaltantes.push("hora de entrega");
    }

    if (camposFaltantes.length > 0) {
      // Generar mensaje específico con la IA
      const promptFaltantes = `El usuario ha proporcionado información de envío incompleta. Los siguientes campos faltan: ${camposFaltantes.join(", ")}. Por favor, genera un mensaje claro y amigable para solicitar estos datos faltantes teniendo en cuenta el contexto de la conversación. Asegurate de solicitar solo la informacion faltante.`;
      
      const mensajeFaltante = await getChatGPTResponse([
        ...conversationMessages,
        { role: "system", content: promptFaltantes },
      ]);

      conversation.push(
        { role: "user", content: Body },
        { role: "assistant", content: mensajeFaltante }
      );
      await user.save();

      throw new Error(mensajeFaltante);
    }

    // Validar formato del DNI
    const regexDNI = /^\d{7,8}$/;
    if (!regexDNI.test(dni)) {
      throw new Error("El DNI proporcionado no es válido. Debe contener 7 u 8 dígitos.");
    }

    // Obtener la fecha de entrega
    const diaYHoraEntrega = obtenerProximaSemana(`${dia} ${hora}`);
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

    // Validar el código de área antes de proceder
    if (verifyAreaCode(phoneNumber)) {
      // Asegurarse de que todos los datos de envío estén completos antes de proceder al pago
      if (direccionCompleta && nombrePersona && dni && diaYHoraEntrega) {
        const conversationMessagesUpdated = conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
        const responseMessage = await getChatGPTResponse([
          ...conversationMessagesUpdated,
          { role: "user", content: Body },
        ]);
        console.log("Respuesta a confirmación:", responseMessage);

        // Actualizar la conversación y el estado del usuario
        user.stage = "payment";
        user.deliveryDetails = {
          direccionCompleta,
          nombrePersona,
          dni,
          diaYHoraEntrega
        };
        await user.save();

        await sendMessage(responseMessage, phoneNumber);
      } else {
        throw new Error("Información de envío incompleta.");
      }
    } else {
      // Mensaje si el código de área no es válido
      const incorrectAreaCode = `Lo siento, actualmente solo realizamos entregas en Rosario y localidades aledañas. Parece que tu dirección está fuera de nuestra área de servicio, por lo que no podemos procesar tu pedido.`;
      await sendMessage(incorrectAreaCode, phoneNumber);
    }
  } catch (error) {
    console.error(`Error procesando el mensaje: ${error.message}`);
    // Enviar mensaje específico si hay un error de datos faltantes
    if (camposFaltantes.length > 0) {
      await sendMessage(error.message, phoneNumber);
    } else {
      // Pedir nuevamente los datos si hay un error genérico
      const conversationMessages = conversation.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    
      // Obtener respuesta de OpenAI
      const openAIResponse = await getChatGPTResponse([
        ...conversationMessages,
        { role: "user", content: Body },
      ]);
      conversation.push({ role: "user", content: Body });
      conversation.push({ role: "assistant", content: openAIResponse });
      await user.save();
      const retryMessage = openAIResponse;
      await sendMessage(retryMessage, phoneNumber);
    }
  }
}

module.exports = deliveryDetails;*/