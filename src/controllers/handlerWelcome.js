const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const handleOrder = require('./handleOrder.js');

async function welcomeFLow(user, phoneNumber, Body) {
    const welcomePrompt = `
        Nuestro nombre es Superbot. Tu tarea es analizar los mensajes de los usuarios y proporcionar detalles sobre los productos que mencionan. Responde siguiendo este formato:

        1. **Nombre del producto**
        2. **Cantidad**
        3. **Unidad de medida** (incluye la cantidad y unidad juntos, como '1L')
        4. **Marca**

        Si el mensaje del usuario menciona varios productos, proporciona la información de cada uno separados por comas. Y si la marca no esta presente, en su lugar no devulvas nada, dejalo vacio.

        Guarda la respuesta en el siguiente formato general: Nombre del producto Cantidad Unidad de medida Marca.
        Corrije los errores ortograficos y agrega los acentos correspondientes.

        Ejemplos de cómo debes responder:
        - Para el mensaje "aceite natura de 1L", tu respuesta debe ser: Aceite 1 1L Natura.
        - Para el mensaje "dos vino tinto navarro correas de 750ml", tu respuesta debe ser: Vino tinto 2 750ml Navarro Correas.
        - Para el mensaje "una botella de leche entera de 1L y dos paquetes de galletas oreo", tu respuesta debe ser: Leche entera 1 1L Marca, Galletas Oreo 2 Paquete.
        - Para el mensaje "dos harina pureza", tu respuesta debe ser: Harina 2 nada Navarro Correas.
        - Para el mensaje "leche, azucar, harina", tu respuesta debe ser: "Leche 1, Azucar 1, Harina 1".

        Si el mensaje no corresponde a una lista de supermercado, responde solo con "no". Asegurate de que la respuesta "no", sea en minuscula y sin punto al final.
        No coleques puntos al final items.
        El mensaje del usuario es el siguiente: ${Body}`;

    console.log(welcomePrompt);
    let openAIResponse = await getChatGPTResponse(welcomePrompt);
    console.log('Respuesta de OpenAI:', openAIResponse);

    openAIResponse = openAIResponse.replace(/"/g, '')

    const response = openAIResponse ? openAIResponse.trim() : '';
    
    if (response === 'no') {
        user.stage = 'welcome';
        await user.save();

        const welcomeMessagePrompt = `El mensaje es este: ${Body}
            Somos Superbot, un chatbot encargado de gestionar pedidos de supermercado via WhatsApp.
            Quiero que des una respuesta al mensaje siendo breve y amistoso 
            Por ejemplo: "¡Hola! Bienvenido al Superbot. Por favor, envía tu lista de productos especificando la marca, cantidad y tamaño. Estoy aquí para ayudarte con tu compra ."
        `;
        const openAIWelcomeResponse = await getChatGPTResponse(welcomeMessagePrompt);
        console.log('Respuesta de bienvenida:', openAIWelcomeResponse);

        if (openAIWelcomeResponse && openAIWelcomeResponse.trim()) {
            try {
                await client.messages.create({
                    body: openAIWelcomeResponse.trim(),
                    from: process.env.TWILIO_WHATSAPP_NUMBER,
                    to: phoneNumber
                });
            } catch (error) {
                console.error("Error al enviar el mensaje:", error.message);
            }
        } else {
            console.error("No hay respuesta válida para enviar");
        }
    } else {
        user.stage = 'order';
        await user.save();
        await handleOrder(user, phoneNumber, openAIResponse);
    }
}

module.exports = welcomeFLow;
