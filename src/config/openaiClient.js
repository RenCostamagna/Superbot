const { response } = require('express');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

 

const getChatGPTResponse = async ( message ) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: message,
            temperature: 0.7,
        });

        // Log de la respuesta completa para depuración
        const content = response.choices[0]?.message?.content;

        if (typeof content === 'string') {
            return content.trim(); // Limpiar espacios en blanco
        } else {
            console.error('Error: La respuesta no contiene un contenido válido', content);
            return "Lo siento, no pude procesar tu solicitud.";
        }
    } catch (error) {
        console.error('Error al obtener respuesta de ChatGPT:', error);
        return "Lo siento, no pude procesar tu solicitud.";
    }
};



module.exports = { getChatGPTResponse };
