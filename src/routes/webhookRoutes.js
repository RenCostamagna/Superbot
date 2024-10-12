const express = require("express");

//const { getChatGPTResponse } = require("../config/openaiClient.js");
//const { sendMessage } = require("../utils/twilioHelper.js");
//const { sendNewBusinessRegistrationEmail } = require("../controllers/businessRegistrationController.js");
//const handleOrder = require('../controllers/handleOrder');
//Cuando se termine de implementar el envio, descomentar los siguientes imports
//const handleDeliveryDetails = require("../controllers/handleDeliberyDetails.js");

const handleHomeDelivery = require("../controllers/handleHomeDelivery.js");
const handleConfirmOrModify = require("../controllers/handleConfirmOrModify");
const handleCancel = require("../controllers/handleCancel.js");
const welcomeFLow = require("../controllers/handlerWelcome.js");
const handlePayment = require("../controllers/handlePayment.js");
const clearUserCache = require("../config/clearCache.js");
const handleProductsList = require('../controllers/handlePrductsList.js');

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
- Cuando se realizan preguntas muy generales sobre productos, hace una subpregunta para obtener más información.

**Productos No Disponibles**
- Si un producto está agotado, no lo incluyas en la lista.
- Avisa al cliente y sugiere un artículo similar disponible.
- Ejemplo: "No tenemos [producto sin stock] ahora, pero te puedo ofrecer [producto similar con stock]."

**Especificaciones de Productos**
- Sé específico al referirte a los productos (tipo de alimento, medicamento, accesorios, etc.).
- Devuelve todos los productos que tengan relacion con el pedido del cliente, independientemente del rubro.

**Productos con Múltiples Opciones**
- Si un cliente solicita un producto con varias opciones (ej: "alimento para gatos"), ofrece las opciones disponibles y deja que elija.
- Si faltan características clave (tamaño, tipo), pregunta antes de enviar la lista.
- Si hay varios productos de la misma marca, pide aclaraciones.

**Interacción con el Cliente**
**Lenguaje y Tono**
- Usa un lenguaje claro, amigable y local (ej: "tenés", "querés").
- Varía tus respuestas para mantener una conversación fluida y amena.

**Preguntas sobre el Sistema**
- Si el cliente pregunta cómo usar el sistema, explica:
- Pueden enviar una lista de productos para comprar.
- Recibirán un resumen con precios y costo total.
- Pueden modificar o cancelar su pedido en cualquier momento.
- Estarás disponible para ayudar en lo que necesiten.

**Confirmación del Pedido**
- Cuando se confirme el pedido envia un breve mensaje de agradecimiento y el resumen del pedido y el costo total.

**Cancelación del Pedido**
- Si el cliente quiere cancelar, pregunta si está seguro.

**Pago**
- Informa que el pago se realiza solo a través de Mercado Pago.
- No preguntes sobre medios de pago ni envíes links.

**Notas Adicionales**
- CPC significa: Carne, pollo y cereales.
- Si piden el producto más barato o más caro, asegúrate de que lo sea.
- Si el cliente es un negocio, no le des la opción de realizar un pedido, ya que no puede realizarlo sin estar registrado ni verificados los datos del negocio.
- Si alguna persona pregunta acerca de algun empleado, indicale que sos un bot y que no tenes informacion sobre los empleados.
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
        const formattedList = await handleProductsList();
        const systemMessage = { role: "system", content: `${systemPrompt}, InventoryTable: ${formattedList}` };
        conversation.push(systemMessage);
        await user.save();
      }

      let responseMessage;
      
        console.log(`Usuario actualizado a consumidor final:`, user);

        if (user.stage !== "payment" && user.stage !== "ending" && user.stage !== "confirmation") {
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
            // Esperando a la api del berna de usuarios
            // Cuando se termine de implementar el envio, descomentar el caso de "delivery_details"
            /*case "delivery_details":
              await handleDeliveryDetails(user, phoneNumber, Body);
              break;*/
            case "home_delivery":
              await handleHomeDelivery(user, phoneNumber, Body);
              break;
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
          } else if (user.stage === "confirmation") {
            await handleConfirmation(user, phoneNumber, Body);
          }
        } catch (error) {
        console.error("Error en el proceso de pago:", error);
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
/*
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
}*/