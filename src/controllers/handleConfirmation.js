const { getChatGPTResponse } = require("../config/openaiClient.js");
const { sendMessage } = require("../utils/twilioHelper.js");
const { sendNewBusinessRegistrationEmail } = require("./businessRegistrationController.js");
const axios = require('axios');


const db = require('../models/clients');

const cuitPrompt = `Extrae del mensaje el CUIT o CUIL del cliente y responde solo con esa informacion. No propones ninguna opcion, solo extraes la informacion. Si el mensaje no contiene CUIT o CUIL, responde con "no esta". Responde exactamente eso sin dar informacion adicional.`;             
const noCuitPrompt = `El cliente no ingreso su Razon Social. Envia un mensaje al usuario informandole que ingrese su Razon Social.`;

async function handleConfirmation(user, phoneNumber, Body) {
  try {
    // Agregar el mensaje del usuario al final de la conversación
    user.conversation.push({ role: "user", content: Body });
    await user.save();
    // Mapeo de la conversacion.  
    let conversation = user.conversation;
    const conversationMessages = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    // Extrae el CUIT o CUIL del mensaje del cliente
    if (user.cuit === null){
      const cuit = await getChatGPTResponse([
        ...conversationMessages,
        { role: "system", content: cuitPrompt },
      ]);
      if (cuit !== "no esta"){
        console.log("Inicio de handleConfirmation con usuario:", user._id);
        console.log("CUIT extraído:", cuit);
        user.cuit = cuit;
        await user.save();
      } else {
        user.cuit = null;
        await user.save();
        const noCuitResponse = await getChatGPTResponse([
          ...conversationMessages,
          { role: "system", content: noCuitPrompt },
        ]);
        conversation.push({ role: "assistant", content: noCuitResponse });
        await user.save();
        await sendMessage(noCuitResponse, phoneNumber);
        return;
      }
    }
    // Verificar si el CUIT está registrado y asignar estado al usuario
    let isRegistered;
    if (user.status === 'registrado' || user.status === 'no_registrado') {
      isRegistered = user.status === 'registrado';
    } else {
      isRegistered = await isCUITRegistered(phoneNumber);
      user.status = isRegistered ? 'registrado' : 'no_registrado';
      await user.save();
    }

    if (isRegistered) {
      // Si el CUIT está registrado, se continua con el pedido para consumidor final preguntando por el medio de pago.
      const paymentPrompt = `Pregunta a la persona si desea pagar con mercado pago o con otro medio de pago. Hazle saber que en caso de pagar con otro medio de pago o no querer pagar, se comunicaran con el a la brevedad.`;
      const tipoDePagoPrompt = `Analiza la respuesta del usuario y determina si desea pagar, de ser asi, si es con mercado pago o con otro medio de pago. Responde con "mercado pago" o "otro medio de pago". Si la respuesta es que no quiere pagar, responde de igual manera con "otro medio de pago".`;
      if (user.paymentMethodAsked){
        const tipoDePagoResponse = await getChatGPTResponse([
          ...conversationMessages,
          { role: "system", content: tipoDePagoPrompt },
        ]);
        console.log("tipoDePagoResponse", tipoDePagoResponse);
        if (tipoDePagoResponse === "mercado pago") {
          const mercadoPagoResponse = await getChatGPTResponse([
            ...conversationMessages,
          ]);
          await sendMessage(mercadoPagoResponse, phoneNumber);
          console.log("El usuario desea pagar con mercado pago");
          user.status = "registrado_y_pago";
          user.stage = "payment";
          conversation.push({ role: "assistant", content: mercadoPagoResponse });
          await user.save();
        } else if (tipoDePagoResponse === "otro medio de pago") {
          const otroMedioDePagoResponse = await getChatGPTResponse([
            ...conversationMessages,
          ]);
          await sendMessage(otroMedioDePagoResponse, phoneNumber);
          conversation.push({ role: "assistant", content: otroMedioDePagoResponse });
          user.stage = "payment";
          await user.save();
          console.log("El usuario desea pagar con otro medio de pago");
        } else {
          const noPagoResponse = await getChatGPTResponse([
            ...conversationMessages,
          ]);
          await sendMessage(noPagoResponse, phoneNumber);
          conversation.push({ role: "assistant", content: noPagoResponse });
          user.status = "registrado_y_no_paga";
          user.stage = "payment";
          await user.save();
          console.log("El usuario no desea pagar");
        }
      } else {
        const paymentResponse = await getChatGPTResponse([
          ...conversationMessages,
          { role: "system", content: paymentPrompt },
        ]);
        user.conversation.push({ role: "assistant", content: paymentResponse });
        console.log("paymentResponse", paymentResponse);
        await sendMessage(paymentResponse, phoneNumber);
        user.paymentMethodAsked = true;
        //Guardo el usuario con el nuevo pago
        await user.save();
      } 
    } else {
      // Si el CUIT no está registrado, se continua con el pedido para consumidor final preguntando por el medio de pago.
      const avisoPrompt = `El cliente no esta registrado en el sistema. Envia un mensaje al usuario informandole que su pedido se va a enviar a los administradores para su aprobacion y que se contactaran con el a la brevedad.`;
      const avisoResponse = await getChatGPTResponse([
        ...conversationMessages,
        { role: "system", content: avisoPrompt },
      ]);
      user.conversation.push({ role: "assistant", content: avisoResponse });
      await user.save();
      console.log("avisoResponse", avisoResponse);
      await sendMessage(avisoResponse, phoneNumber);
      await sendNewBusinessRegistrationEmail(user.cuit, phoneNumber);
      user.stage = "payment";
      await user.save();
    }
  } catch (error) {
    console.error("Error en handleConfirmation:", error);
    // Considera reenviar el error o manejarlo según el flujo de tu aplicación
  }
}

module.exports = { handleConfirmation };


// Simulación de la función para verificar el CUIT en la API
async function isCUITRegistered(phoneNumber) {
  try {
    // Limpia el número de teléfono del WhatsApp
    const cleanPhoneNumber = phoneNumber.replace(/whatsapp:\+\d{6}/, '');
    console.log("cleanPhoneNumber", cleanPhoneNumber);
    
    // Obtiene la lista de clientes de la API
    const response = await axios.get(`https://superbotwebapi-affufwf8ctcfeedv.brazilsouth-01.azurewebsites.net/api/clientes?clientId=1`);

    const clients = response.data;
    
    // Limpia el número de teléfono para la búsqueda (solo dígitos)
    const searchNumber = cleanPhoneNumber.replace(/\D/g, '');
    
    // Busca si algún cliente tiene el número de teléfono
    const clientFound = clients.some(client => {
      // Limpia los números de teléfono del cliente (solo dígitos)
      const clientPhones = client.telefonos
        .split('/')
        .map(phone => phone.trim().replace(/\D/g, ''));
      
      // Verifica si alguno de los números del cliente coincide
      return clientPhones.some(phone => phone.includes(searchNumber));
    });

    console.log("Cliente encontrado:", clientFound);
    return clientFound;
    
  } catch (error) {
    console.error("Error al verificar teléfono en API:", error);
    throw error;
  }
}



