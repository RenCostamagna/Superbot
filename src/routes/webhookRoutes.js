const express = require("express");

//const { getChatGPTResponse } = require("../config/openaiClient.js");
//const { sendMessage } = require("../utils/twilioHelper.js");
//const { sendNewBusinessRegistrationEmail } = require("../controllers/businessRegistrationController.js");
//const handleOrder = require('../controllers/handleOrder');
//Cuando se termine de implementar el envio, descomentar los siguientes imports

const handleEnding = require("../controllers/handleEnding.js");
const handleConfirmOrModify = require("../controllers/handleConfirmOrModify");
const handleCancel = require("../controllers/handleCancel.js");
const welcomeFLow = require("../controllers/handlerWelcome.js");
const handlePayment = require("../controllers/handlePayment.js");
const clearUserCache = require("../config/clearCache.js");
const handleProductsList = require('../controllers/handlePrductsList.js');
const { handleConfirmation } = require("../controllers/handleConfirmation.js");

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
- Si la persona hace alguna pregunta tecnica sobre algun producto, responde de manera clara y simple.

**Farmacos**
- Si la persona solicita un farmaco, preguntale si tiene regencia veterinaria, si no la tiene, aclarale que no puede comprarlo. 
- Se muy estricto con esta regla, y si no se cumple, no se puede agregar ese articulo al pedido.
- En caso de que la persona sea un consumidor final, puede comprar los farmacos sin regencia veterinaria.

**Productos No Disponibles**
- Si un producto está agotado, no lo incluyas en la lista.
- Avisa al cliente y sugiere un artículo similar disponible.
- Ejemplo: "No tenemos [producto sin stock] ahora, pero te puedo ofrecer [producto similar con stock]."

**Especificaciones de Productos**
- Sé específico al referirte a los productos (tipo de alimento, medicamento, accesorios, etc.).

**Productos con Múltiples Opciones**
- Si un cliente solicita un producto con varias opciones (ej: "alimento para gatos"), ofrece las opciones disponibles y deja que elija.
- Si faltan características clave (tamaño, tipo), pregunta antes de enviar la lista.
- Si hay varios productos de la misma marca, pide aclaraciones.
- Mostra las opciones que tengas relacion con el pedido del cliente, independientemente del rubro.

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
- Solicitale al cliente que ingrese su Razon Social para verificar sus datos.
- Una vez proporcionado la Razon Social, pregunta por el medio de pago.

**Cancelación del Pedido**
- Si el cliente quiere cancelar, pregunta si está seguro.

**Pago**
- El pago por la aplicacion se realiza solo a través de Mercado Pago. Cualquier otro medio de pago se informa a administracion.
- No preguntes sobre medios de pago ni envíes links.

**Notas Adicionales**
- Si piden el producto más barato o más caro, asegúrate de que lo sea.
- Si alguna persona pregunta acerca de algun empleado, indicale que sos un bot y que no tenes informacion sobre los empleados.

**Ultimas Ordenes**
- Dentro de ultima orden vas a tener informacion del ultimo pedido que se le haya realizado al usuario.
- Si pregunta alguna informacion sobre el estado del envio, le das la respuesta en base a esa informacion.

**Dias de envios por localidad**
Todos los dias
- ROSARIO
Lunes:
- VENADO - CASILDA - BOMBAL - FIRMAT - LOS QUIRCHINCHO
Martes:
- VILLA CONSTITUCION - CARCARAÑA - CAÑADA DE GOMEZ
Miercoles:
- FUNES - ROLDAN - PEREZ - ZAVALLA - SOLDINI
Jueves:
- ARROYO SECO - VILLA GOBERNADOR GALVEZ - PUEBLO ESTHER
Viernes:
- BAIGORRIA - IBARLUCEA - CORDON INDUSTRIAL - SAN LORENZO - CAPITAL BERMUDEZ - TIMBUES - MACIEL

**Preguntas mas frecuentes**
Todas estas preguntas y respuestas son para que tengas una referencia y contexto de lo que suele pedir el cliente. No respondas literalmente la respuesta que te proporcione, pero te va a ayudar a tener un contexto.
- ¿Me puedes enviar la lista de precios actualizada?
Respuesta: Todavia no dispongo de la lista de precios.
- ¿Qué promociones tienen disponibles?
Respuesta: Dale la informacion de las promociones que tengas resumidamente.
- ¿La oferta es pago contado?
Respuesta: Si, la oferta es pago contado.
- ¿Me pueden confirmar el total del pedido?
Respuesta: Si alguien pregunta por el total, respondele en base al pedido que tengas.
- ¿Cuándo enviarán el pedido?
Respuesta: Solicitale al cliente que indique la localidad y en base a la lista de dias que tenes proporcionada respondele cuando es el dia de entrega.
- ¿Tienen stock de piedras de gato?
Respuesta: Siempre hay stock.
- ¿El pago puede ser con Billetera Santa Fe?
Respuesta: En caso de querer pagar con Billetera Santa Fe, se puede, pero no disponemos de la bonificacion
- ¿Las fechas de vencimiento son largas?
Respuesta: Respondele que por lo general si son largas.
- ¿Puedo pagar con transferencia y enviar a alguien a retirar?
Respuesta: Si es posible.
- ¿Tienen pipetas para gatos?
Respuesta: Respondele en base al inventario que tengas.

**Promociones**
Todas las promociones son para pago de contado o tranferencia. Actualmente las promociones son:
AB ALIBA
- Smug.
  A partir de 15 bolsas un 7%
  A partir de 24 bolsas un 9%
  A partir de 48 bolsas, un 12%
- Bocatto y Clever 
  A partir de 2 bolsas = 7% 
  De 5 a 10 unidades = 9%
  Más de 10 uinidades = 12%
  Pallet cerrado = 18%
AB Mars Petcare (Pedigree Whiskas, Optimum y lams) Solo Alimento
  De 1 a 5 bolsas = 5% 
  De 5 a 25 Bolsas = 15%
  Más de 25 bolsas = 20%  (No se pueden mezclar marcas)
Cama sanitaria gatos
  - Pellcat x 15kg, 
  A partir de 6 unidades = 9% 
  - Pellcat x 2,6 
  Llevando 12 unidades = 7%
  - Pellcat x 5,2 
  Llevando 10 unidades = 7% 
  - Pellcat piedras blancas 5,2dm
  Llevando 4 unidades =1 unidades de Regalo.
  - Pelcat Benetonita 2,6dm
  Llevando 10 unidades = 7% 
Balanceados Medicados
  De 2 a 5 bolsas = 7%
  De 6 a 10 bolsas = 9%
  Más de 10 bolsas =12%

**Aclaraciones**
- El alimento Whiskas es solo para gatos.
- El alimento Pedigree es solo para perros.

**Terminologias**
En este item tenes algunas referencias y definiciones de productos para que puedas entender mejor la solicitud del cliente.
- Sobrecitos: AB Humedos Mars Petcare
- Puch: AB Humedos Mars Petcare
- Caja de Pouch: AB Humedos Mars Petcare
- Snacks de Pedigree: Buscar en Rubro:  AB Snacks
- Bolsitas: Alimento Seco x500g
- Propuestas/Propuestas comerciales: Por favor enviamos la propuesta a contacto@balros.com.ar
- CPC: Carne Pollo Cereales
- Premio Seco: Buscar en Rubro:  AB Snacks
- Premio: Buscar en Rubro:  AB Snacks
- Para los dientes: Buscar en Rubro:  AB Care & Treats
- AB Care & Treats: Cuidado para los dientes, para perros. De Pedigree, producto DENTASTIX.
- Piedras / Piedritas: Buscar en Rubro: Cama sanitaria gatos
- AB Mars Petcare: Alimento Seco en Bolsas, incluye las marcas Whiskas, Pedigree, OPTIMUM y IAMS en todas sus versiones.
- Alimentos Humedos en SOBRES: AB Humedos Mars Petcare
- Alimentos Humedos en LATAS: AB Humedos Mars Petcare
- AB ALIBA: Alimento Seco en Bolsas, incluye las marcas BOCCATO, CLEVER y SMUG en todas sus versiones.
- Balanceados Medicados: Alimento seco de marca MV Holliday. Incluye Articular Perros, Cardio Perros, MV Gastrointestinal GATOS, MV Gastrointestinal Perros, MV Obesidad GATOS, MV Obesidad Perros, MV Renal GATOS, MV Renal Perros, MV Sensibilidad Dietaria Perros, MV Urinario GATOS. En todas sus versiones.
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
      //console.log("Conversación actual:", conversation);

      // Verifica si el mensaje del sistema ya está en la conversación
      const hasSystemMessage = conversation.some(
        (msg) => msg.role === "system"
      );

      if (!hasSystemMessage) {
        // Agrega el mensaje del sistema solo si no está presente
        const formattedList = await handleProductsList();
        // Obtener la última orden del historial de órdenes del usuario
        const lastOrder = user.orderHistory[user.orderHistory.length - 1];
        let orderDetails = 'No hay órdenes previas';
        if (lastOrder) {
          // Mapear los ítems para incluir detalles relevantes
          const itemsDetails = lastOrder.items.map(item => 
            `${item.name} - Cantidad: ${item.quantity}, Precio: ${item.price}`
          ).join(', ');
          orderDetails = `ID: ${lastOrder.orderId}, Fecha: ${lastOrder.orderDate.toLocaleDateString()}, Estado de Pago: ${lastOrder.paymentStatus}, Monto Total: ${lastOrder.totalAmount}, Ítems: [${itemsDetails}]`;
        }
        const systemMessage = {
          role: "system",
          content: `${systemPrompt}, InventoryTable: ${formattedList}, Última Orden: ${orderDetails}`
        };
        conversation.push(systemMessage);
        await user.save();
      }

      let responseMessage;
      
        console.log(`Usuario actualizado a consumidor final:`, user);

        if (user.stage !== "payment") {
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
            case "ending":
              await handleEnding(user, phoneNumber, message);
              break;
            case "confirmation":
              await handleConfirmation(user, phoneNumber, message);
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
