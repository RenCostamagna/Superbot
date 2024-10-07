const express = require("express");

//const handleOrder = require('../controllers/handleOrder');
//Cuando se termine de implementar el envio, descomentar los siguientes imports
//const handleHomeDelivery = require("../controllers/handleHomeDelivery.js");
//const handleDeliveryDetails = require("../controllers/handleDeliberyDetails.js");
const handleConfirmOrModify = require("../controllers/handleConfirmOrModify");
const handleCancel = require("../controllers/handleCancel.js");
const welcomeFLow = require("../controllers/handlerWelcome.js");
const handlePayment = require("../controllers/handlePayment.js");
const clearUserCache = require("../config/clearCache.js");
const handleOrder = require('../controllers/handleOrder.js');
const { getChatGPTResponse } = require("../config/openaiClient.js");
const { sendMessage } = require("../utils/twilioHelper.js");
const { sendNewBusinessRegistrationEmail } = require("../controllers/businessRegistrationController.js");
require("dotenv").config();

const axios = require("axios");
const FormData = require("form-data");

const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const router = express.Router();

const User = require("../models/User");

const systemPrompt = `
**Informacion de la empresa**
- Nombre: Balros
- Ubicacion: Castellanos 2486, Rosario, Santa Fe, Argentina
- Horario de Atencion: Lunes a Viernes de 07:00 a 16:00

**Reglas de Formato**
- No uses negritas. Tene en cuenta que la aplicacion se despliega en whatsapp, y las negritas son con un asterisco para cada lado de la palabra.
- Coloca asteriscos alrededor de los nombres de productos y el costo total para facilitar la lectura al cliente.
- No incluyas centavos en los precios (ej: $600, no $600.00).
- Si un producto no tiene marca o unidad de medida, omítelos.

**Manejo de Inventario**
- Solo incluye productos disponibles en el inventario (inventoryTable).
- Verifica que la cantidad en stock sea suficiente para cubrir la solicitud del cliente.

**Productos No Disponibles**
- Si un producto está agotado, no lo incluyas en la lista.
- Avisa al cliente y sugiere un artículo similar disponible.
- Ejemplo: "No tenemos [producto sin stock] ahora, pero te puedo ofrecer [producto similar con stock]."

**Especificaciones de Productos**
- Sé específico al referirte a los productos (tipo de alimento, medicamento, accesorios, etc.).
- Guíate por las categorías y secciones de la inventoryTable.

**Productos con Múltiples Opciones**
- Si un cliente solicita un producto con varias opciones (ej: "alimento para gatos"), ofrece las opciones disponibles y deja que elija.
- Si faltan características clave (tamaño, tipo), pregunta antes de enviar la lista.
- Si hay varios productos de la misma marca, pide aclaraciones.

**Interacción con el Cliente**
**Lenguaje y Tono**
- Usa un lenguaje claro, amigable y local (ej: "tenés", "querés").
- Varía tus respuestas para mantener una conversación fluida y amena.

**Tipo de cliente**
- Cuando el cliente envie un mensaje por primera vez, indicale que primero debe decirnos si es consumidor final o si es para un negocio.

**Negocio**
- En caso de que el usuario sea un negocio, solicita los siguiente datos:
  - Nombre del negocio
  - Cuit
  - Dirección
- En este caso, avisarle al usuario que se debera confirmar los datos del negocio y que nos comunicaremos con el para confirmar los datos y continuar con el proceso de compra.

**Preguntas sobre el Sistema**
- Si el cliente pregunta cómo usar el sistema, explica:
- Pueden enviar una lista de productos para comprar.
- Recibirán un resumen con precios y costo total.
- Pueden modificar o cancelar su pedido en cualquier momento.
- Estarás disponible para ayudar en lo que necesiten.

**Confirmación del Pedido**
- Una vez el pedido este confirmado, indicale que el pedido fue confirmado y que pasara a la etapa de pago. 
- El retiro se realizara en el local dentro de los horarios de atención.

**Cancelación del Pedido**
- Si el cliente quiere cancelar, pregunta si está seguro.

**Pago**
- Informa que el pago se realiza solo a través de Mercado Pago.
- No preguntes sobre medios de pago ni envíes links.

**Notas Adicionales**
- CPC significa: Carne, pollo y cereales.
- Si piden el producto más barato o más caro, asegúrate de que lo sea.
- Si el cliente es un negocio, no le des la opción de realizar un pedido, ya que no puede realizarlo sin estar registrado ni verificados los datos del negocio.

`;

// Ruta para el webhook
router.post("/", async (req, res) => {
  const { Body, From, MediaContentType0, MediaUrl0 } = req.body;
  const phoneNumber = From.trim();
  console.log(`Mensaje recibido de ${phoneNumber}: ${Body}`);

  try {
    let user = await User.findOne({ phoneNumber });
    console.log(`Usuario encontrado:`, user);

    let message = Body;

    if (MediaContentType0 && MediaContentType0.startsWith("audio/")) {
      console.log("El mensaje es un audio");
      message = await transcribeAudio(MediaUrl0);
      console.log("El mensaje convertido a texto es:", message);
    }


    // Comando para limpiar la caché del usuario
    if (message.toLowerCase() === "clear") {
      await clearUserCache(phoneNumber);
      await client.messages.create({
        body: "Limpiado",
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber,
      });
    } else {
      // Crear un nuevo usuario si no existe
      if (!user) {
        user = new User({ phoneNumber, conversation: [], stage: "welcome" });
        await user.save();
        console.log(`Nuevo usuario creado:`, user);
      }

      const conversation = user.conversation || [];
      console.log("Conversación actual:", conversation);

      // Verifica si el mensaje del sistema ya está en la conversación
      const hasSystemMessage = conversation.some(
        (msg) => msg.role === "system"
      );

      if (!hasSystemMessage) {
        // Agrega el mensaje del sistema solo si no está presente
        const formattedList = await handleOrder();
        const systemMessage = { role: "system", content: `${systemPrompt}, InventoryTable: ${formattedList}` };
        conversation.push(systemMessage);
        await user.save();
      }

      let responseMessage;
      console.log(`Tipo de cliente actual: ${user.typeOfClient}`);
      if (user.typeOfClient === "" || user.typeOfClient === null) {
        const verificationMessagePrompt = `
        Eres el encargado de verificar si el cliente es un consumidor final o un negocio.
        Tienes que identificar una de las siguientes opciones:

        **Instrucciones:**
        - No agregues puntos ni guiones en caso de la respuesta sea "consumidor final" o "negocio".
        - No agregues comillas en ningun caso.
        - No agregues nada mas si la respuesta es "consumidor final" o "negocio".
        - Si no puedes determinar, responde con "no_determinado".

        **1. Consumidor Final:**
        - Si el cliente es un consumidor final, responde con "consumidor final".
      
        **2. Negocio:**
        - Si el cliente es un negocio, responde con "negocio".

        **3. No determinado:**
        - Si no puedes determinar, responde con "no_determinado".`

        
        const conversationMessages = conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
        responseMessage = await getChatGPTResponse([
          ...conversationMessages,
          { role: "user", content: message },
          { role: "system", content: `${verificationMessagePrompt}` },
        ]);

        console.log(`Respuesta de ChatGPT para verificación de tipo de cliente:`, responseMessage);
        
        if (responseMessage) {
          console.log(`Mensaje enviado al usuario`);
        } else {
          console.log("Advertencia: responseMessage es undefined después de la verificación del tipo de cliente");
        }
      }
      
      if (responseMessage && responseMessage.toLowerCase() === "consumidor final" || user.typeOfClient === "consumidor final") {
        user.typeOfClient = "consumidor final";
        await user.save();
        console.log(`Usuario actualizado a consumidor final:`, user);

        if (user.stage !== "payment" && user.stage !== "ending") {
          console.log(`Etapa actual del usuario: ${user.stage}`);
          // Redirigir a la función correspondiente según el estado del usuario
          switch (user.stage) {
            case "welcome":
              await welcomeFLow(user, phoneNumber, message);
              break;
            case "confirm_or_modify":
              await handleConfirmOrModify(user, phoneNumber, message);
              break;
            case "cancel":
              await handleCancel(user, phoneNumber, message);
              break;
            // Cuando se termine de implementar el envio, descomentar el caso de "delivery_details"
            /*case "delivery_details":
              await handleDeliveryDetails(user, phoneNumber, Body);
              break;
            case "home_delivery":
              await handleHomeDelivery(user, phoneNumber, Body);
              break;*/
            default:
              // Si el estado no es reconocido
              await client.messages.create({
                body: "No pude entender tu mensaje. Por favor, intenta nuevamente.",
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: phoneNumber,
              });
          
          }
          console.log(user.paymentStatus);
        }
        try {
          if (user.stage === "payment") {
            await handlePayment(phoneNumber, message);
            // Actualizar el estado del usuario a 'ending'
            await user.save();
          }
        } catch (error) {
          console.error("Error en el proceso de pago:", error);
        }

      } else if (responseMessage && responseMessage.toLowerCase() === "negocio" || user.typeOfClient === "negocio") {
        const businessPrompt = `
        Eres el encargado del registro de un negocio.
        Tienes que identificar una de las siguientes opciones:

        **1. Datos del negocio:**
            1. Nombre del negocio.
            2. Cuit.
            3. Dirección.
        Ten en cuenta que hay calles que tienen nombres de personas.
        Tu respuesta tiene que estar dada en este formato: Nombre del negocio, cuit, dirección, telefono y email. Por ejemplo: "Balros, 30-60234567-9, Castellanos 2486 Rosario".
        Solo responde con la información solicitada y en ningún caso agregues información adicional.
        Si la informacion esta incompleta, no completes esos campos faltantes.

        **2. Mensajes de confirmación:**
        Si no hay ningún dato de envio, responde manteniendo el contexto de la conversación.

        **3. Aclaraciones sobre el negocio:**
        No incluyas los datos de nuestro negocio como datos del negocio del usuario.
        `;
        user.typeOfClient = "negocio";
        await user.save();
        
        console.log(`Datos actuales del negocio:`, user.businessData);
        if (!user.businessData || !isBusinessDataComplete(user.businessData)) {
          const conversation = user.conversation;
          const conversationMessages = conversation.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
          responseMessage = await getChatGPTResponse([
            ...conversationMessages,
            { role: "user", content: message },
            { role: "system", content: `${businessPrompt}` },
          ]);

          console.log(`Respuesta de ChatGPT para datos del negocio:`, responseMessage);
          const extractedData = extractBusinessData(responseMessage);
          console.log(`Datos extraídos:`, extractedData);

          if (extractedData) {
            // Modificar esta parte para evitar sobrescribir datos válidos
            user.businessData = {
              name: extractedData.name || user.businessData?.name,
              cuit: extractedData.cuit || user.businessData?.cuit,
              address: extractedData.address || user.businessData?.address,
              phone: user.phoneNumber
            };
            await user.save();
            console.log(`Datos del negocio actualizados:`, user.businessData);

            if (isBusinessDataComplete(user.businessData)) {
              responseMessage = await getChatGPTResponse([
                ...conversationMessages,
                { role: "user", content: message },
                { role: "system", content: "Los datos del negocio están completos. Genera un mensaje de confirmación y pregunta si desean realizar un pedido." },
              ]);
              await sendMessage(responseMessage, phoneNumber);
              conversation.push({role: "user", content: message});
              conversation.push({role: "assistant", content: responseMessage});
              user.status = "pending verification";
              await user.save();
              // Enviar correo de notificación
              await sendNewBusinessRegistrationEmail(user.businessData);
              
            } else {
              try {
                let missingDataMessage = await getMissingDataPrompt(user.businessData, conversation);
                
                // Si por alguna razón el mensaje está vacío, usa un mensaje predeterminado
                if (!missingDataMessage || missingDataMessage.trim() === '') {
                  missingDataMessage = "Por favor, proporciona los datos faltantes de tu negocio.";
                }
                conversation.push({role: "user", content: message});
                conversation.push({role: "assistant", content: missingDataMessage});

                await user.save();
                await sendMessage(missingDataMessage, phoneNumber);
              } catch (error) {
                console.error("Error al procesar la solicitud de datos faltantes:", error);
                await sendMessage("Lo siento, hubo un problema al procesar tu solicitud. Por favor, intenta nuevamente.", phoneNumber);
              }
            }
          } else {
            responseMessage = await getChatGPTResponse([
              ...conversationMessages,
              { role: "user", content: message },
              { role: "system", content: "No se pudieron extraer los datos del negocio. Solicita amablemente al usuario que proporcione el nombre del negocio, CUIT y dirección separados por comas." },
            ]);
            conversation.push({role: "user", content: message});
            conversation.push({role: "assistant", content: responseMessage});
            await user.save();
            await sendMessage(responseMessage, phoneNumber);
          }
        } else if (user.status === "pending verification") {
          console.log("El negocio está pendiente de verificación");
          const verificationPrompt = `El negocio está pendiente de verificación. 
          Tene en cuenta las siguientes instrucciones:
          - Si el usuario envia un mensaje, responde amablemente manteniendo el contexto de la conversación pero no le des la opcion de realizar un pedido.
          - No des informacion de productos ni precios.
          - En caso de preguntarlo, aclarale al usuario que una vez esten verificados los datos, nos comunicaremos para continuar el proceso`

          const conversationMessages = conversation.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
          responseMessage = await getChatGPTResponse([
            ...conversationMessages,
            { role: "user", content: message },
            { role: "system", content: verificationPrompt },
          ]);
          await sendMessage(responseMessage, phoneNumber);
          conversation.push({role: "user", content: message});
          conversation.push({role: "assistant", content: responseMessage});
          await user.save();
        } else {
          console.log("Advertencia: No se pudo determinar el tipo de cliente o procesar el mensaje");
        }
      } else if (responseMessage && responseMessage.toLowerCase() === "no_determinado") {
        console.log("Tipo de cliente no determinado, procesando mensaje general");
        const conversationMessages = conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
        responseMessage = await getChatGPTResponse([
          ...conversationMessages,
          { role: "user", content: Body }
        ]);

        console.log(`Respuesta de ChatGPT para mensaje general:`, responseMessage);
        if (responseMessage) {
          await sendMessage(responseMessage, phoneNumber);
          console.log(`Mensaje general enviado al usuario`);
          conversation.push({role: "user", content: message});
          conversation.push({role: "assistant", content: responseMessage});
          await user.save();
        } else {
          console.log("Advertencia: responseMessage es undefined para mensaje general");
        }
      } else {
        console.log("Advertencia: No se pudo determinar el tipo de cliente o procesar el mensaje");
      }

      res.status(200).send("Mensaje procesado");
      console.log(`Respuesta enviada al servidor de Twilio`);
    }

  } catch (error) {
    console.error("Error procesando el mensaje:", error);
    res.status(500).send("Error procesando el mensaje");
  }
});

module.exports = router;


// Función para transcribir el audio
async function transcribeAudio(audioUrl) {
  try {
    // Descarga el archivo de audio
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });

    // Crea el buffer de audio a partir de la respuesta
    const audioBuffer = Buffer.from(audioResponse.data);
    
    // Prepara los datos para enviar a la API de transcripción
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename: 'audio.ogg' });
    formData.append('model', 'whisper-1');

    // Envía la solicitud a la API de OpenAI para transcribir
    const transcriptionResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    return transcriptionResponse.data.text;
  } catch (error) {
    console.error('Error al transcribir el audio:', error);
    if (error.response && error.response.status === 401) {
      console.error('Error de autenticación. Verifica tus credenciales de Twilio.');
      return 'No se pudo acceder al audio debido a un error de autenticación.';
    }
    return 'Error al transcribir el audio';
  }
}


function isBusinessDataComplete(businessData) {
  return businessData && 
         businessData.name && 
         businessData.name !== 'Por favor' && // Agregar esta condición
         businessData.cuit && 
         businessData.cuit !== 'proporcioname los datos de tu negocio: nombre' && // Agregar esta condición
         businessData.address &&
         businessData.address !== 'cuit y dirección.'; // Agregar esta condición
}

function extractBusinessData(message) {
  const parts = message.split(',').map(part => part.trim());
  if (parts.length >= 3) {
    return {
      name: parts[0],
      cuit: parts[1],
      address: parts.slice(2).join(', '),
    };
  }
  return null;
}

async function getMissingDataPrompt(businessData, conversation) {
  const missingFields = [];
  if (!businessData.name) missingFields.push("nombre del negocio");
  if (!businessData.cuit) missingFields.push("CUIT");
  if (!businessData.address) missingFields.push("dirección");

  const missingFieldsString = missingFields.join(", ");

  const prompt = `
  Eres un asistente amable que ayuda a registrar negocios. 
  Necesitas solicitar los siguientes datos faltantes del negocio: ${missingFieldsString}.
  
  Por favor, genera un mensaje amable y profesional en español para solicitar esta información.
  El mensaje debe:
  1. Agradecer por la información proporcionada hasta ahora
  2. Explicar qué datos faltan.
  3. Solicitar los datos faltantes de manera clara y concisa
  4. Ofrecer ayuda si tienen alguna duda

  No incluyas comillas en tu respuesta.
  `;

  const conversationMessages = conversation.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  try {
    const response = await getChatGPTResponse([
      ...conversationMessages,
      { role: "system", content: prompt },
    ]);

    return response;
  } catch (error) {
    console.error("Error al generar el mensaje para datos faltantes:", error);
    return `Por favor, proporciona los siguientes datos faltantes: ${missingFieldsString}.`;
  }
}