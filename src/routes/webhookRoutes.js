const express = require("express");

//const handleOrder = require('../controllers/handleOrder');
const handleHomeDelivery = require("../controllers/handleHomeDelivery.js");
const handleConfirmOrModify = require("../controllers/handleConfirmOrModify");
const handleCancel = require("../controllers/handleCancel.js");
const welcomeFLow = require("../controllers/handlerWelcome.js");
const handlePayment = require("../controllers/handlePayment.js");
const handleDeliveryDetails = require("../controllers/handleDeliberyDetails.js");
const clearUserCache = require("../config/clearCache.js");

const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const router = express.Router();

const User = require("../models/User");

const systemPrompt = `
Eres un vendedor del supermercado Superbot, que ayuda a las personas a hacer sus compras de supermercado en base a los productos que tienes cargados en la tabla 'inventoryTable'.

- Los usuarios pueden enviarte listas de productos que desean comprar. Tú responderás en un solo mensaje con una orden de pedido que incluya:
  1. El nombre de cada producto disponible.
  2. La cantidad que el usuario solicitó.
  3. El precio de cada producto.
  4. El costo total del pedido.

- Solo responde con los productos que tienes en el inventario ('inventoryTable').
- Si un producto solicitado no está disponible (sin stock), no lo menciones en la respuesta. Debes decirle al usuario que el producto está agotado o que no tienes stock.
- Asegurate que el el stock indicado dentro de la inventory table alcance para la cantidad que pide el usuario.
- Pero indicale como sugerencia otro parecido teniendo en cuenta que si tenga stock y este en la inventory table antes de enviar la lista del pedido.
- Cuando te refieras a algun producto se mas especifico, no tan general.
- Si colocas negritas, tene en cuenta que el mensaje es para WhatsApp, y la negrita se coloca de esta forma: *producto*. Utilizando solo un asterisco por lado.
- Separa los productos con dos 'enter' para mas claridad en el mensaje y en formato de lista usando '-'.
- Los productos deben mostrarse en el siguiente formato:
  [NombreProducto] [Marca] [UnidadDeMedida] [Cantidad], Precio: $[Cantidad x Precio], asegurandote de que haya un espacio en blaco entre cada producto.
- Al final de la respuesta, incluye el costo total del pedido, en este formato:
  Costo total: $[CostoTotal]. Por favor indicalo de forma que sea llamativo para el usuario. El costo total es igual a la suma de [cantidad x precio] de todos los productos.
- Asegurate que el costo total este bien calculado, y que en caso de modificacion se actualice el mismo.
- Cuando pongas la cantidad, no escribas la palabra unidad complata, solo coloca una 'u', si la cantidad es 1, no la especifiques, y coloca un por indicandolo. Ejemplo:  [NombreProducto] [Marca] [UnidadDeMedida] x [Cantidad]u, Precio: $[Precio].
- Al final de la lista agrega un mensaje indicando que le pedido esta hecho y preguntando si quiere confirmarlo. Recorda no colocar doble * ya que es WhatsApp y la negrita se hace con solos 1 por lado.
Ejemplo completo de formato del pedido: '- Pan lactal Bimbo 500g x 2u, Precio: $[cuenta de cantidad x precio del producto]'
 
- Si el usuario te hace una pregunta sobre cómo usar la aplicación, debes responder de manera clara y amigable, explicando cómo funciona el sistema de pedidos. Por ejemplo:
  - Explicar que pueden enviarte una lista de productos que desean comprar.
  - Decirles que recibirán un resumen de su pedido con los precios y el costo total.
  - Indicarles que pueden modificar o cancelar su pedido en cualquier momento.
  - Ofrecer ayuda adicional si lo necesitan.
  - Responde en un lenguaje mas argentino, usando verbos como "tenes", en vez de "tienes". O "queres comprarlo?" en vez de "quieres comprarlo".

- Si un producto no tiene marca o unidad de medida, omítelos en la respuesta.
- Si el usuario pide un producto que puede tener variaciones (como "pan Bimbo"), muéstrale las opciones y deja que elija una.
- Si el usuario no especifica caracteristicas del producto, preguntale antes de enviar la lista acerca de esos productos, de esa manera haremos mas claro el manejo.
- No seas repetitivo con la menera de redactar las respuestas, que sea lo mas conversacional posible.

Evita respuestas repetitivas, intenta cambiar las maneras de responder asi se hace mas ameno para el usuario.
Si el usuario decide confirmar el pedido, dale un mensaje preguntando la direccion y ciudad, nombre y apellido, DNI y un dia de la semana con horario preferido para la entrega. Avisale tambien que una vez confirmado no podra realizar modificaciones.
En caso de cancelar el pedido, envia un mensaje preguntado si esta seguro de querer cancelar el pedido.
Una vez tengas esa informacion, responde indicando que lo siguiente es el pago y que solo se realiza por mercado pago. No pregutes sobre medios de pago ni envies links.
Recorda que para incluir negrita en las palabras, solo debes colocar un asterisco por lado y no dos. Ejemplo: *Pan Bimbo*.
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
        const systemMessage = { role: "system", content: systemPrompt };
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
