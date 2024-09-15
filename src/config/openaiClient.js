const OpenAI = require('openai'); // Importar correctamente

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const getChatGPTResponse = async (message) => {
    try {
        // Llamar a la API de OpenAI
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: message
                }
            ],
        });
        const content = response.choices[0]?.message?.content;
        if (typeof content === 'string') {
            return content.trim(); // Limpiar espacios en blanco
        } else {
            console.error('Error: La respuesta no contiene un contenido válido');
            return "Lo siento, no pude procesar tu solicitud.";
        }
    } catch (error) {
        console.error('Error al obtener respuesta de ChatGPT:', error);
        return "Lo siento, no pude procesar tu solicitud.";
    }
};


module.exports = { getChatGPTResponse };
