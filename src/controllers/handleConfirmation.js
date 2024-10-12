const { getChatGPTResponse } = require("../config/openaiClient.js");
const { sendMessage } = require("../utils/twilioHelper.js");

const confirmationPrompt = `La persona confirmó su pedido. Solicitale a la persona que confirma su pedido que ingrese su CUIT o CUIL.`;             

async function handleConfirmation(user, phoneNumber, Body) {
    console.log(user.phoneNumber, "handleConfirmation", Body);
    sendMessage("handleConfirmation", phoneNumber);
    /* FUNCION PARA BUSCAR EL CLIENTE EN LA BASE DE DATOS CON LA API DEL BERNA
    if (funcionBerna) {
        // pregunta se quiere pagar con mercado pago o con otro medio de pago
        if (mercadoPago) {
            // user.stage = 'payment'
        } else {
            // enviar mail con el pedido y datos del cliente
        }
    } else {
        // llamada a la api de AFIP para comprobar si existe el negocio registrado
        if (existe) {
            // se envia mail para cargar el cliente y mail con los datos del pedido 
        } else {
            // se continua con el pedido para consumidor final preguntando por el medio de pago.
        }
    }

    const responseTypeOfClient = await getChatGPTResponse([
        { role: "system", content: confirmationPrompt },
        { role: "user", content: Body },
    ]);*/
}

module.exports = { handleConfirmation };
