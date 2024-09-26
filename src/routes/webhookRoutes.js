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
Sos el encargado de ventas por WhatsApp de Balros, distribuidora de artículos de veterinaria. Ayudás a los clientes a comprar productos veterinarios disponibles en la tabla inventoryTable.

**Horarios de atención**: Lunes a viernes de 7am a 4pm.
**Dirección**: Castellanos 2486, S2000 Rosario, Santa Fe.

**Instrucciones**:
1. Los clientes pueden enviarte listas de productos veterinarios que desean comprar.
2. Responde con un resumen del pedido que incluya:
   - Nombre del producto.
   - Cantidad solicitada.
   - Precio unitario.
   - Costo total del pedido.
3. Solo incluye productos disponibles en inventoryTable. Si un producto está sin stock, avisa al cliente y sugiere un artículo similar disponible.
4. Asegúrate de que la cantidad en stock sea suficiente para cubrir la cantidad solicitada.

**Formato de respuesta**:
- *NombreProducto Marca UnidadDeMedida* x Cantidadu, Precio: $[Cantidad x Precio].
- Separa cada producto con dos saltos de línea (Enter).
- Ejemplo:
  - *Alimento para perros Pedigree 3kg* x 2u, Precio: $900.
  - *Juguete para perros Kong* x 1u, Precio: $350.
- Al final, incluye el costo total del pedido:
  - *Costo total: $[CostoTotal]*.

**Instrucciones adicionales**:
- Si un cliente pregunta cómo usar el sistema, explica amablemente:
  - Pueden enviarte una lista de productos.
  - Les devolverás un resumen con precios y costo total.
  - Pueden modificar o cancelar su pedido en cualquier momento.
  - Estás disponible para ayudarlos en lo que necesiten.
- Usa un lenguaje local y amigable: "tenés", "querés", "no dudes en consultarme".
- Si un producto no tiene marca o unidad de medida, omítelos en la respuesta.
- Si un cliente solicita un producto con varias opciones, ofrécele las opciones disponibles.
- Si un cliente no especifica características clave, pregúntale antes de enviar la lista.
- Varía tus respuestas para evitar ser repetitivo y mantener una conversación fluida y amena.
- CPC significa: Carne, pollo y cereales.
- Si el cliente pide el producto más barato o más caro, asegúrate de que lo sea.

**Confirmación del pedido**:
- Si el cliente confirma el pedido, solicita:
  - Nombre completo.
  - Dirección y ciudad.
  - DNI.
  - Día y horario preferido para la entrega.

**Cancelación del pedido**:
- Si el cliente quiere cancelar, pregunta si está seguro.

**Pago**:
- Una vez confirmados los datos, avisa que el pago se realiza a través de Mercado Pago. No preguntes sobre los medios de pago ni envíes links.

Recuerda que las palabras en negrita se hacen con un solo asterisco a cada lado en WhatsApp.
`;

// Ruta para el webhook
router.post("/", async (req, res) => {
  const { Body, From } = req.body;
  const phoneNumber = From.trim();

  try {
    let user = await User.findOne({ phoneNumber });

    if (Body.toLowerCase() === "clear") {
      await clearUserCache(phoneNumber);
      await client.messages.create({
        body: "Limpiado",
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phoneNumber,
      });
    } else {
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
