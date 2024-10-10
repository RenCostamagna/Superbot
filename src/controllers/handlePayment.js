const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { createPaymentLink } = require("../controllers/handleLinkPayment.js");
const { getChatGPTResponse } = require("../config/openaiClient.js");
const User = require("../models/User");
require('dotenv').config();
const { sendMessage } = require('../utils/twilioHelper');

const mapPrompt = `
  En base a la lista de pedido que tienes, de productos con sus cantidades y precios, y al final, en la última línea, el total. Quiero que la transformes en el siguiente formato:
  
  - Nombre del producto completo (incluyendo todo lo que esté en el campo que tiene el nombre del producto), peso o volumen, cantidad, precio unitario con IVA.
  - Total: total
  
  Ejemplo:
  BOCATTO Gato x 10kg Pedigree, 12kg, 2, 7000
  Shampoo para gatos Plusbelle, 200ml, 6, 500
  Total: $[total]
  
  Asegúrate de mantener el formato exacto en cada línea. No agregues el guion delante del artículo ni asteriscos.
  Si el no se dispone de peso o volumen, incluye la palabra "unidad" en el campo de peso o volumen.
  `;

const handlePayment = async (phoneNumber, Body) => {
  
  const user = await User.findOne({ phoneNumber: phoneNumber });

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  // Verificar si ya se ha enviado un enlace de pago
  if (user.lastOrderToLink && user.lastOrderToLink.paymentLinkSent) {

    const conversationDos = user.conversation;

    const conversationMessagesDos = conversationDos.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const responseMessage = await getChatGPTResponse([
      ...conversationMessagesDos,
      { role: "user", content: Body },
    ]);

    await sendMessage(responseMessage, phoneNumber);
    conversationDos.push({ role: "user", content: Body });
    conversationDos.push({ role: "assistant", content: responseMessage });
    await user.save();

    console.log("El enlace de pago ya ha sido enviado anteriormente.");
    return; // Salir de la función para evitar reenviar el enlace
  }

  const conversation = user.conversation;
  const conversationMessages = conversation.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const responseMessage = await getChatGPTResponse([
    ...conversationMessages,
    { role: "system", content: mapPrompt },
  ]);

  console.log("Respuesta de ChatGPT:", responseMessage);

  // Divide la respuesta en productos y total
  const [productsPart, totalPart] = responseMessage.split("Total: $");

  if (!productsPart || !totalPart) {
    throw new Error("Formato de respuesta de ChatGPT incorrecto.");
  }
  
  console.log("Parte de productos:", productsPart.trim());
  console.log("Parte del total:", totalPart.trim());
  
  // Filtrar y procesar las líneas de productos
  const productLines = productsPart
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0) // Filtrar líneas vacías
    .filter(line => /^([^,]+,){3}[^,]+$/.test(line)) // Asegurar que hay 4 campos separados por comas
    .map((line) => line.replace(/^-*\s*/, "").trim()); // Eliminar guion y espacios al inicio
  
  console.log("Líneas de productos después del procesamiento:", productLines);
  
  const products = productLines.map((line) => {
    // Separa los componentes por comas
    const [productName, weightOrVolume, quantity, pricePerUnit] = line
      .split(",")
      .map((item) => item.trim());
  
    console.log("Procesando línea:", line); // Verificar cada línea procesada
  
    // Comprobar si hay datos faltantes
    if (!productName || !weightOrVolume || !quantity || !pricePerUnit) {
      throw new Error(`Datos faltantes en la línea: ${line}`);
    }
  
    const quantityNumber = parseInt(quantity, 10);
    const pricePerUnitNumber = parseFloat(pricePerUnit.replace('$', '').replace('.', '').replace(',', '.')); // Ajustar el formato de precio
  
    // Validar cantidad y precio
    if (isNaN(quantityNumber) || isNaN(pricePerUnitNumber)) {
      throw new Error(`Cantidad o precio no válido para el producto ${productName}`);
    }
  
    return {
      productName,
      weightOrVolume,
      quantity: quantityNumber,
      pricePerUnit: pricePerUnitNumber,
      totalPrice: quantityNumber * pricePerUnitNumber,
    };
  });
  
  // Imprimir la lista de productos procesados
  console.log("Productos procesados:", products);
  

  const total = parseFloat(totalPart.trim().replace("$", "").replace(",", ""));
  if (isNaN(total)) {
    throw new Error("Total no válido.");
  }

  console.log("Total:", total);

  user.lastOrderToLink = {
    items: products,
    total: total,
    paymentLinkSent: false, // Agregar una bandera para rastrear el envío del enlace
  };

  await user.save();

  const userId = user._id;
  console.log("userId:", userId);
  const paymentLink = await createPaymentLink(user, userId);

  console.log("Enlace de pago:", paymentLink);

  await sendMessage(paymentLink, phoneNumber);

  // Actualizar la bandera después de enviar el enlace
  user.lastOrderToLink.paymentLinkSent = true;
  await user.save();

  const prompt = `Avisa a la persona que el pago puede impactar hasta dentro de 5 minutos, no des nombres ni envies una oracion de saludo. Ademas, no des informacion de envio. Solamente avisa el tiempo de espera.`;
  const conversationDos = user.conversation;

  const conversationMessagesDos = conversationDos.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  mercadoPagoDelay = await getChatGPTResponse([
    ...conversationMessagesDos,
    { role: "system", content: prompt },
  ]);

  conversation.push({ role: "assistant", content: mercadoPagoDelay });
  await user.save();
  console.log("Conversation:", user.conversation);

  await sendMessage(mercadoPagoDelay, phoneNumber);


};

module.exports = handlePayment;