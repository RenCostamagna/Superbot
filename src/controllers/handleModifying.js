const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { convertPrice } = require('../utils/converPrice.js');
const { getChatGPTResponse } = require('../config/openaiClient.js');
const Item = require('../models/item.js');

async function handleModifying(user, phoneNumber, openAIResponse, Body) {
    // Primer paso: Identificar si el mensaje es una solicitud de modificación o ya contiene modificaciones.
    const identificationPrompt = `
            A continuación te proporciono un mensaje del usuario. Tu tarea es identificar si el mensaje es una solicitud para realizar una modificación en el pedido o si el mensaje ya contiene las modificaciones necesarias.

            - Si el mensaje es una solicitud para realizar una modificación en el pedido, como una petición general para hacer cambios, responde con "solicitud de modificación". Ejemplos: "Quiero hacer una modificación", "Necesito cambiar algo en mi pedido", "Quisiera modificar mi pedido".

            - Si el mensaje ya contiene las modificaciones específicas que se deben aplicar al pedido, como la adición, eliminación o cambio de productos, responde con "modificación". Ejemplos: "Quiero eliminar un yogurt y agregar una leche de 1L", "Añadir 2 litros de jugo y quitar 1 kilogramo de azúcar", "Reemplazar 1 litro de aceite con 1 litro de vinagre".

            **Mensaje del Usuario:**
            ${Body}

    `;

    console.log(identificationPrompt);
    let identificationResponse;

    try {
        identificationResponse = await getChatGPTResponse(identificationPrompt);
        if (!identificationResponse || typeof identificationResponse !== 'string') {
            throw new Error('Respuesta de OpenAI no válida para la identificación');
        }
        console.log(identificationResponse);
    } catch (error) {
        console.error('Error al obtener respuesta de OpenAI para la identificación:', error);
        identificationResponse = "no";
    }

    identificationResponse = identificationResponse.replace(/\.$/, '');
    if (identificationResponse.trim().toLowerCase() === 'solicitud de modificación') {
        // Si es una solicitud de modificación, envía un mensaje de confirmación o modificación.
        await client.messages.create({
            body: "Por favor, proporciona los detalles de la modificación que deseas realizar en el pedido.",
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });

        user.stage = 'awaiting_modification_details';  // Cambia al estado de espera de detalles de modificación
        await user.save();
        return;

    } else if (identificationResponse.trim().toLowerCase() === 'modificación') {
        // Si el mensaje ya contiene modificaciones, procesa las modificaciones.
        const modifiPrompt = `
                        Eres un asistente de supermercado especializado en interpretar y modificar solicitudes de productos. Tu tarea es analizar los mensajes de los usuarios, identificar cambios en la lista de productos previamente proporcionada y devolver la lista actualizada. Responde siguiendo este formato:

                        1. **Nombre del producto**
                        2. **Cantidad**
                        3. **Unidad de medida** (incluye la cantidad y unidad juntos, como '1L')
                        4. **Marca**

                        Si el usuario indica agregar o eliminar productos, realiza los cambios necesarios. Devuelve la lista completa con las modificaciones aplicadas en el formato exacto: Nombre del producto Cantidad Unidad de medida Marca, separados por comas.
                        Corrije los errores ortograficos y agrega los acentos correspondientes.

                        Si la marca no está presente, no devuelvas nada en su lugar, simplemente deja ese espacio vacío.

                        Si el mensaje parece más bien una solicitud general de modificación (como "Me gustaría modificar el pedido" o "Quiero hacer algunas modificaciones") y no una lista de productos, responde solo con "no".

                        Ejemplos de cómo debes responder:
                        - Para "agregar dos botellas de agua mineral de 500ml", tu respuesta debe ser: Agua mineral 2 500ml Marca.
                        - Para "quitar una caja de té verde", elimina ese producto de la lista y devuelve los demás en este formato, separados por comas.
                        - Para "Me gustaría modificar el pedido" o "Quiero hacer algunas modificaciones", responde con "no".
                        - Para el mensaje "leche, azucar, harina", tu respuesta debe ser: Leche 1, Azucar 1, Harina 1.

                        El mensaje del usuario es el siguiente: ${Body}
                        La lista actual de productos es la siguiente: ${user.lastOrder.items.map(item => `${item.name} ${item.quantity} ${item.itemWeightOrVolume || ''} ${item.brand || ''}`).join(', ')}.`;

        let openAIModifyingResponse;
        try {
            openAIModifyingResponse = await getChatGPTResponse(modifiPrompt);
            if (!openAIModifyingResponse || typeof openAIModifyingResponse !== 'string') {
                throw new Error('Respuesta de OpenAI no válida para la modificación');
            }
        } catch (error) {
            console.error('Error al obtener respuesta de OpenAI para la modificación:', error);
            openAIModifyingResponse = "No se pudo procesar la modificación. Por favor, intente nuevamente.";
        }

        // Procesar la respuesta de OpenAI para obtener los productos interpretados
        const interpretedItems = openAIModifyingResponse.trim().split(',').map(item => item.trim());
        console.log(openAIModifyingResponse)
        console.log(interpretedItems)

    let total = 0;
    const itemDetails = [];
    const order = [];
    
    for (const itemData of interpretedItems) {
        // Utiliza una expresión regular mejorada para capturar el nombre del producto, la cantidad, la unidad de medida opcional, y la marca opcional al final
        const matches = itemData.match(/(.+?)\s(\d+)\s*(?:([\d\.]+[a-zA-Z]+)?)\s*(.*)$/);
    
        if (!matches) {
            itemDetails.push(`${itemData}: Formato no válido o datos no especificados`);
            continue;
        }
    
        let itemName = matches[1].trim(); 
        const cantidad = parseInt(matches[2], 10); // Cantidad en número
        let itemWeightOrVolume = matches[3] ? matches[3].trim() : null; 
        let itemBrand = matches[4] ? matches[4].trim() : null; 
    
        // Elimina el punto final del nombre del producto o de la marca, si existe
        itemName = itemName.replace(/\.$/, ''); 
        if (itemBrand) {
            itemBrand = itemBrand.replace(/\.$/, ''); 
        }
        
        console.log(matches)
        console.log(`${itemName}, ${cantidad}, ${itemWeightOrVolume}, ${itemBrand}`)
        try {
            // Buscar el producto en la base de datos, incluyendo la marca si está disponible
            let item = await Item.findOne({
                product_name: { $regex: new RegExp('^' + itemName + '$', 'i') },
                weight_or_volume: itemWeightOrVolume,
                ...(itemBrand ? { brand: itemBrand } : {}) // Si hay marca, incluirla en la búsqueda
            });
            
            console.log(`Primera búsqueda de item: ${item}`);

            if (!item) {
                // Intentar buscar el producto sin la unidad de medida si no se encontró con todos los parámetros
                item = await Item.findOne({
                    product_name: { $regex: new RegExp('^' + itemName + '$', 'i') },
                    ...(itemBrand ? { brand: itemBrand } : {}) // Si hay marca, incluirla en la búsqueda
                });
    
                console.log(`Segunda búsqueda de item: ${item}`);
                
                if (item && (itemWeightOrVolume === item.quantity || itemWeightOrVolume === undefined)) {
                    // Usar el peso/volumen del producto encontrado si no se especificó
                    itemWeightOrVolume = item.quantity;
                    itemBrand = itemBrand || item.brand;
                } else if (item && itemWeightOrVolume !== item.quantity && itemWeightOrVolume !== undefined){
                    itemDetails.push(`${itemName} no esta disponible en ${itemWeightOrVolume}. Disponible en ${item.quantity}`)
                    continue;
                } else {
                    // Búsqueda adicional para encontrar un producto que contenga la palabra clave
                    item = await Item.findOne({
                        product_name: { $regex: new RegExp(itemName, 'i') }  // Buscar coincidencias parciales
                    });
    
                    console.log(`Tercera búsqueda de item: ${item}`);
    
                    if (item) {
                        // Usar el peso/volumen del producto encontrado si no se especificó
                        itemWeightOrVolume = itemWeightOrVolume || item.quantity;
                        itemBrand = item.brand;
                    }
                }
                
            } else {
                itemWeightOrVolume = item.quantity;
                itemBrand = item.brand;
            }
    
            if (!item || item.stock < cantidad) {
                itemDetails.push(`${itemName} ${itemWeightOrVolume ? itemWeightOrVolume : ''}${itemBrand ? ' ' + itemBrand : ''}: No disponible`);
                continue;
            }
    
            const itemPrice = convertPrice(item.price);
            const itemTotal = itemPrice * cantidad;
    
            // Formatear la respuesta con el formato especificado
            let formattedItem = `\nCant: ${cantidad}, ${item.product_name} ${itemWeightOrVolume ? itemWeightOrVolume : ''} ${itemBrand ? itemBrand : ''}, Precio: $${itemPrice.toFixed(2)} c/u, Total: $${itemTotal.toFixed(2)}`;
            itemDetails.push(formattedItem.trim());
            total += itemTotal;
    
            // Agregar al pedido
            order.push({
                name: item.product_name,
                quantity: cantidad,
                itemWeightOrVolume: itemWeightOrVolume,
                brand: itemBrand,
                price: itemPrice
            });
        } catch (error) {
            itemDetails.push(`${itemName} ${itemWeightOrVolume ? itemWeightOrVolume : ''}${itemBrand ? ' ' + itemBrand : ''}: Error al procesar el producto: ${error.message}`);
            console.error(`Error al procesar el producto ${itemName} ${itemWeightOrVolume ? itemWeightOrVolume : ''}${itemBrand ? ' ' + itemBrand : ''}:`, error);
        }
    }
    
    user.lastOrder.items = order;
    user.lastOrder.totalAmount = total;
    await user.save();
    
    let responseMessage = `\nAquí tienes tu lista con los productos, cantidad y precio:\n\n`;
    responseMessage += itemDetails.join('\n\n');
    responseMessage += `\n\nTOTAL: $${total.toFixed(2)}\n`;

    console.log('Response Message:', responseMessage);

        const modifyConfirmedPrompt = `Sos el encargado de responder los mensajes de WhatsApp de una aplicación que gestiona pedidos de supermercado. 
                            Genera un breve mensaje para continuar con el proceso de pedido. 
                            El mensaje debe confirmarle al usuario que pudo modificar su pedido. 
                            La respuesta debe ser clara y debe incluir la aclaracion de confirmar o modificar el pedido.
                            Ejemplo de respuesta: "Tu modificación está hecha! Puedes realizar otra modificación de ser necesario!".`;

        let modifyConfirmedResponse;
        try {
            modifyConfirmedResponse = await getChatGPTResponse(modifyConfirmedPrompt);
            if (!modifyConfirmedResponse || typeof modifyConfirmedResponse !== 'string') {
                throw new Error('Respuesta de OpenAI no válida para la confirmación de modificación');
            }
        } catch (error) {
            console.error('Error al obtener respuesta de OpenAI para la confirmación de modificación:', error);
            modifyConfirmedResponse = "Tu modificación está hecha! En caso de realizar otra modificación escribe 'modificar', sino, 'confirmar'.";
        }

        try {
            await client.messages.create({
                body: `${responseMessage}\n${modifyConfirmedResponse}`,
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: phoneNumber
            });
        } catch (error) {
            console.error('Error al enviar el mensaje con Twilio:', error.message);
        }

        user.stage = 'confirm_or_modify';  // Volver al estado de confirmación o modificación
        await user.save();
    }
}

module.exports = handleModifying;


