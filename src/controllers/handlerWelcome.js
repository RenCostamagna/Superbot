const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js')

async function welcomeFLow (user, phoneNumber, Body) {
    const welcomePrompt = ` Tu tarea es determinar si un mensaje contiene una lista de supermercado. El mensaje puede estar dado en forma de lista o en una sola oración que mencione productos junto con sus cantidades. Por ejemplo, frases como '3 aceites, 2 aguas y 4 cocacolas' deben ser interpretadas como una lista de supermercado. Si el mensaje no parece ser una lista de supermercado, indícalo también.
                            Si consideras que es una lista de supermercado, respondeme con: si sin puntos ni informacion adicional.
                            El mensaje es este: ${Body}`
    console.log(welcomePrompt);
    const openAIResponse = await getChatGPTResponse(welcomePrompt);
    console.log(openAIResponse)

    const loweCaseResponse = openAIResponse.trim().toLowerCase();

    if (loweCaseResponse === 'si') {
        user.stage = 'order';
        await user.save()
    } else {
        user.stage = 'welcome'
        await user.save()
        await client.messages.create({
            body:  "¡Hola! Bienvenido al Superbot. Por favor, envía tu lista de productos especificando la marca, cantidad y tamaño. Estoy aquí para ayudarte con tu compra 😊.",
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
    }
}
module.exports = welcomeFLow;