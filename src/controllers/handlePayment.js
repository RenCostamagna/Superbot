const client = require("twilio")(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  const { createPaymentLink } = require("../controllers/handleLinkPayment.js");
  const { getChatGPTResponse } = require("../config/openaiClient.js");
  const User = require("../models/User");
  
  const mapPrompt = `
  En base a la lista que tienes, de productos con sus cantidades y precios. Y al final, en la ultima linea, el total. Quiero que la transformes en el siguiente formato:
  
  - Nombre del producto,peso o volumen,cantidad,precio unitario
  - Total: total
  
  Ejemplo:
  Pan lactal Bimbo,500g,2,550.00
  Yogur bebible con cereales Yogurísimo,200ml,6,500.00
  Total: $[total]
  
  Asegúrate de mantener el formato exacto en cada línea, sin agregar puntos al final ni un guion adelante.
  `;
  
  const handlePayment = async (phoneNumber) => {
    // Obtén el usuario usando el número de teléfono
    const user = await User.findOne({ phoneNumber: phoneNumber });
  
    if (!user) {
      throw new Error("Usuario no encontrado.");
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
    .filter((line) => line.length > 0 && !line.startsWith('-')) // Filtrar líneas vacías y líneas que comienzan con guiones
    .map((line) => line.replace(/^-*\s*/, '').trim()); // Eliminar guion y espacios al inicio
  
  console.log("Líneas de productos después del procesamiento:", productLines);
  
  const products = productLines.map((line) => {
    const [productInfo, weightOrVolume, quantity, pricePerUnit] = line
      .split(",")
      .map((item) => item.trim());
  
    console.log("Procesando línea:", line); // Verificar cada línea procesada
  
    if (!productInfo || !weightOrVolume || !quantity || !pricePerUnit) {
      throw new Error(`Datos faltantes en la línea: ${line}`);
    }
  
    const quantityNumber = parseInt(quantity, 10);
    const pricePerUnitNumber = parseFloat(pricePerUnit);
  
    if (isNaN(quantityNumber) || isNaN(pricePerUnitNumber)) {
      throw new Error(`Cantidad o precio no válido para el producto ${productInfo}`);
    }
  
    return {
      productName: productInfo,
      weightOrVolume,
      quantity: quantityNumber,
      pricePerUnit: pricePerUnitNumber,
      totalPrice: quantityNumber * pricePerUnitNumber,
    };
  });
  
  console.log("Productos procesados:", products);
  
  const total = parseFloat(totalPart.trim().replace('$', '').replace(',', ''));
  if (isNaN(total)) {
    throw new Error("Total no válido.");
  }
  
  console.log("Total:", total);
  
  // Aquí es donde guardas los productos y el total en lastOrderToLink del usuario
  user.lastOrderToLink = {
    items: products,
    total: total,
  };
  
  await user.save();
  
  const userId = user._id;
  const paymentLink = await createPaymentLink(user, userId);
  console.log("Enlace de pago:", paymentLink);
  
  await client.messages.create({
    body: paymentLink,
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: phoneNumber,
  });
  };
  
  module.exports = handlePayment;
  
  
  
  
  
  
  