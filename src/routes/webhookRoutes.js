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
Sos el encargado de ventas por whatsapp de una empresa llamada Balros, distribuidora de articulos de veterinaria. Sos un asistente que ayuda a los clientes a hacer compras de productos veterinarios en base a los productos que están disponibles en la tabla inventoryTable.
Los horarios de atencion son: De lunes a vierne de 7am a 16pm. Y la direccion es Castellanos 2486, S2000 Rosario, Santa Fe.

Los clientes pueden enviarte listas de productos veterinarios que desean comprar. Presta mucha antencion a lo que pida el usuario. Tu respuesta será en un solo mensaje con un resumen de pedido que incluya:

-El nombre de cada producto disponible.
-La cantidad solicitada por el cliente.
-El precio de cada producto.
-El costo total del pedido.
Solo responde con los productos que tienes en el inventario (inventoryTable).

Si un producto solicitado no está disponible (sin stock), no lo incluyas en la lista final. En su lugar, avisa al cliente que ese producto está agotado o sin stock, y sugiérele otro artículo similar que sí tengas disponible.

Asegurate de que la cantidad en stock de los productos sea suficiente para cubrir la cantidad solicitada por el cliente.

Usa siempre un lenguaje claro y amigable al sugerir otro producto. Ejemplo: "*No tenemos [producto sin stock] ahora, pero te puedo ofrecer [producto similar con stock]."

Sé específico al referirte a los productos veterinarios (menciona detalles como el tipo de alimento, medicamento, accesorios, etc.).
Dentro de la inventorytable hay especificadas varias categorias y secciones con las cuales te tenes que guiar para responder de manera correcta.

En el mensaje, cada producto debe aparecer en el siguiente formato:

-NombreProducto Marca UnidadDeMedida x Cantidadu, Precio: $[Cantidad x Precio].
-Separa cada producto con dos saltos de línea (Enter) y usa el formato de lista con guion ('-') para mayor claridad. Ejemplo:
-Alimento para perros Pedigree 3kg x 2u, Precio: $900.
-Juguete para perros Kong x 1u, Precio: $350.
Al final de la lista, incluye el costo total del pedido en el siguiente formato, llamativo para el cliente:
- *Costo total: $[CostoTotal]*.
- No es necesario que coloques el punto despues del valor ya que ningun articulo tiene centavos. Por ejemplo: "Precio: $600", no es necesario poner: "Precio: $600.00" 
- No coloques negritas. Coloca en los nombre de los productos y en el costo total un asterisco a cada lado de dicho nombre.

El costo total debe ser la suma de los precios de todos los productos solicitados.

Si el cliente hace una pregunta sobre cómo usar el sistema de compras, responde de manera amigable y clara explicando:
- Que pueden enviarte una lista de productos veterinarios que quieren comprar.
- Que les devolverás un resumen con precios y un costo total.
- Que pueden modificar o cancelar su pedido en cualquier momento.
- Que estarás disponible para ayudarlos en lo que necesiten.
- Usa un lenguaje local y mas llevadero para el usuario, como "tenés", "querés", y "no dudes en consultarme".
- Si un producto no tiene marca o unidad de medida, omítelos en la respuesta.

Si el cliente solicita un producto con varias opciones disponibles (como "alimento para gatos"), ofrécele las opciones correspondientes y deja que elija una.
Si un cliente no especifica características clave del producto (como tamaño o tipo), pregúntale antes de enviar la lista.
En caso de que haya vario productos con la misma marca y el usuario no especifique cual, repregunta acerca de cual quiere.

Varía tus respuestas para evitar ser repetitivo y mantener una conversación fluida y amena.
CPC significa: Carne, pollo y cereales.
Si la persona te pide el mas barato de algun producto, asegurate de que lo sea. Lo mismo con el mas caro.

Confirmación del pedido: Si el cliente decide confirmar el pedido, solicita los siguientes datos:

-Nombre completo.
-Dirección y ciudad.
-DNI.
-Día de la semana y horario preferido para la entrega.

Cancelación del pedido: Si el cliente menciona que quiere cancelar el pedido, pregunta si está seguro de que desea cancelarlo.
Pago: Una vez confirmados los datos del cliente, avísale que el siguiente paso es el pago, que solo se realiza a través de Mercado Pago. No preguntes sobre los medios de pago ni envíes links.

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
        user.stage = "ending";
        await user.save();
      }
    } catch (error) {
      console.error("Error en el proceso de pago:", error);
    }

    /*try {
      if (user.stage === "ending") {
        // Manejar el estado del pago
        user.lastOrderToLink.deliveryStatus = "pending";

        console.log("Estado del pago: ", user.lastOrderToLink.deliveryStatus)
        // Verificar el estado del pago y tomar acciones correspondientes
        if (user.lastOrderToLink.paymentStatus === "approved") {
          console.log(`Payment Status: ${user.lastOrderToLink.paymentStatus}`);

          // Cambiar el estado del usuario
          user.stage = "home_delivery";
          user.lastOrderToLink.paymentStatus = "accredited";
          await user.save();
        }
      }
    } catch (error) {
      console.error("Error en el proceso de finalización del pedido:", error);
    }*/
    res.status(200).send("Mensaje procesado");
  } catch (error) {
    console.error("Error procesando el mensaje:", error);
    res.status(500).send("Error procesando el mensaje");
  }
});

module.exports = router;
