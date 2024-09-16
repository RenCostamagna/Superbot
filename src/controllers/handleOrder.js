const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { getChatGPTResponse } = require('../config/openaiClient.js');
const { convertPrice } = require('../utils/converPrice.js');
const Item = require('../models/item.js');

async function handleOrder(user, phoneNumber, openAIResponse) {
    const interpretedItems = openAIResponse.trim().split(',').map(item => item.trim());
    console.log('Interpreted Items:', interpretedItems);
    
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
            let formattedItem = `Cant: ${cantidad}, ${item.product_name} ${itemWeightOrVolume ? itemWeightOrVolume : ''} ${itemBrand ? itemBrand : ''}, Precio: $${itemPrice.toFixed(2)} c/u, Total: $${itemTotal.toFixed(2)}`;
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
    
    console.log(responseMessage);
    
    
    console.log('Response Message:', responseMessage);
    
    
    
    const thanksPrompt = `Sos el encargado de responder los mensajes de WhatsApp de una aplicación que gestiona pedidos de supermercado. 
                        Genera un breve mensaje para continuar con el proceso de pedido. 
                        El mensaje debe incluir un agradecimiento por el pedido, y debe preguntar al usuario si desea modificar algo. 
                        La respuesta debe ser clara y cálida.
                        No agregues mensaje de saludo. Solamente agradeciendo y preguntando si se desan realizar modificaciones.
                        Ejemplo de respuesta: "Gracias por tu pedido! ¿Deseas realizar alguna modificación?"`;
    
    let openAIThanksResponse;
    try {
        openAIThanksResponse = await getChatGPTResponse(thanksPrompt);
        if (!openAIThanksResponse || typeof openAIThanksResponse !== 'string') {
            throw new Error('Respuesta de OpenAI no válida');
        }
    } catch (error) {
        openAIThanksResponse = "Gracias por tu pedido. Si deseas hacer alguna modificación, indícalo.";
        console.error('Error al obtener respuesta de OpenAI:', error);
    }
    
    // Usa openAIThanksResponse como parte del mensaje final si es necesario
    

    user.stage = 'confirm_or_modify';  // Cambiar el estado
    await user.save();

    try {
        await client.messages.create({
            body: responseMessage,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
        await client.messages.create({
            body: openAIThanksResponse,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phoneNumber
        });
    } catch (error) {
        console.error('Error al enviar el mensaje con Twilio:', error.message);
    }
}

module.exports = handleOrder;
