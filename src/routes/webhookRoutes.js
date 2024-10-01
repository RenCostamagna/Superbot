const express = require("express");

//const handleOrder = require('../controllers/handleOrder');
const handleHomeDelivery = require("../controllers/handleHomeDelivery.js");
const handleConfirmOrModify = require("../controllers/handleConfirmOrModify");
const handleCancel = require("../controllers/handleCancel.js");
const welcomeFLow = require("../controllers/handlerWelcome.js");
const handlePayment = require("../controllers/handlePayment.js");
const handleDeliveryDetails = require("../controllers/handleDeliberyDetails.js");
const clearUserCache = require("../config/clearCache.js");
const handleOrder = require('../controllers/handleOrder.js');

const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const router = express.Router();

const User = require("../models/User");

const systemPrompt = `
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

**Preguntas sobre el Sistema**
- Si el cliente pregunta cómo usar el sistema, explica:
- Pueden enviar una lista de productos para comprar.
- Recibirán un resumen con precios y costo total.
- Pueden modificar o cancelar su pedido en cualquier momento.
- Estarás disponible para ayudar en lo que necesiten.

**Confirmación del Pedido**
- Si el cliente confirma, solicita:
- Nombre completo
- Dirección y ciudad
- DNI
- Día y horario preferido para la entrega
No preguntes sobre esta informacion si no se confirmo el pedido de forma clara y explícita.

**Cancelación del Pedido**
- Si el cliente quiere cancelar, pregunta si está seguro.

**Pago**
- Informa que el pago se realiza solo a través de Mercado Pago.
- No preguntes sobre medios de pago ni envíes links.

**Notas Adicionales**
- CPC significa: Carne, pollo y cereales.
- Si piden el producto más barato o más caro, asegúrate de que lo sea.

`;

// Ruta para el webhook
router.post("/", async (req, res) => {
  const { Body, From } = req.body;
  const phoneNumber = From.trim();

  try {
    let user = await User.findOne({ phoneNumber });

    // Comando para limpiar la caché del usuario
    if (Body.toLowerCase() === "clear") {
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

      if (user.stage !== "payment" && user.stage !== "ending") {
        // Redirigir a la función correspondiente según el estado del usuario
        switch (user.stage) {
          case "welcome":
            await welcomeFLow(user, phoneNumber, Body);
            break;
          case "confirm_or_modify":
            await handleConfirmOrModify(user, phoneNumber, Body);
            break;
          case "cancel":
            await handleCancel(user, phoneNumber, Body);
            break;
          case "delivery_details":
            await handleDeliveryDetails(user, phoneNumber, Body);
            break;
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
    }

    try {
      if (user.stage === "payment") {
        await handlePayment(phoneNumber);
        // Actualizar el estado del usuario a 'ending'
        await user.save();
      }
    } catch (error) {
      console.error("Error en el proceso de pago:", error);
    }

    res.status(200).send("Mensaje procesado");
  } catch (error) {
    console.error("Error procesando el mensaje:", error);
    res.status(500).send("Error procesando el mensaje");
  }
});

module.exports = router;