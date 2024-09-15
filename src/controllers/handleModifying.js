const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { convertPrice } = require('../utils/converPrice.js');
const { getChatGPTResponse } = require('../config/openaiClient.js');
const Item = require('../models/item.js');

async function handleModifying(user, phoneNumber, Body) {
    const modifiPrompt = `
A continuación, te proporciono los detalles de un pedido de supermercado actual y un mensaje del usuario con modificaciones solicitadas. Tu tarea es interpretar las modificaciones que el usuario está haciendo y generar una lista actualizada de productos. La lista debe incluir los productos originales no modificados, además de las modificaciones solicitadas.

1. **Pedido Actual:** La lista actual del pedido de supermercado. Incluye nombre del producto, cantidad y unidad de medida si está disponible. Por ejemplo: "Harina 2 1kg, Azúcar 1 500g". Usa esta lista para saber cuáles productos ya están en el pedido y sus cantidades originales.
2. **Mensaje del Usuario:** El mensaje con las modificaciones que el usuario quiere hacer. Puede estar en formato de lista directa o en una oración completa. Por ejemplo: "Añadir 1 litro de leche y cambiar 1 harina de 1kg a 2kg". También puede contener instrucciones para eliminar productos, como: "Eliminar 1 azúcar 500g".

Debes:

1. **Actualizar la Lista:** Realiza las modificaciones indicadas por el usuario, manteniendo los productos no modificados con sus cantidades originales. Si un producto ya está en la lista y se modifica, actualiza la cantidad y unidad según las nuevas instrucciones. Si el usuario pide eliminar un producto, asegúrate de eliminarlo de la lista.
2. **Formatear la Respuesta:** Responde con la lista actualizada en el formato especificado. Asegúrate de que los productos no modificados se mantengan con sus cantidades originales. Por ejemplo: "Harina 2 2kg, Azúcar 1 500g, Leche 1 1L". Si un producto es eliminado, asegúrate de que no aparezca en la lista final.

Si el mensaje no parece ser una modificación de pedido y parece más una confirmación, responde con "confirmar". Asegúrate de:
1. Convertir palabras como "uno", "dos" a números.
2. Unificar cantidades similares (por ejemplo, sumar todas las cantidades de harina).
3. Utilizar las unidades de medida junto con la cantidad total (por ejemplo, "Harina 2 1kg", "Azúcar 3 500g", "Agua 1 1L").
4. Separar con comas cada producto, cantidad y unidad de medida del producto siguiente.
5. Agregar las modificaciones a la lista anterior y mantener los productos originales que no se modifican. Si se eliminan productos, asegúrate de que no aparezcan en la lista final.

**Pedido Actual:**
${user.lastOrder.items.map(item => `${item.name} ${item.quantity} ${item.itemWeightOrVolume}`).join(', ')}

**Mensaje del Usuario:**
${Body}`;

    console.log(modifiPrompt);
    
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

    const interpretedItems = openAIModifyingResponse.trim().split(',').map(item => item.trim());

    let total = 0;
    const itemDetails = [];
    const order = [];

    for (const itemData of interpretedItems) {
        const matches = itemData.match(/(.+)\s(\d+)(?:\s(.+))?$/);
        if (!matches) {
            itemDetails.push(`${itemData}: Formato no válido o datos no especificados`);
            continue;
        }

        const itemName = matches[1].trim();
        const quantity = parseInt(matches[2]);
        let itemWeightOrVolume = matches[3] ? matches[3].trim() : null;

        try {
            let item = await Item.findOne({
                product_name: { $regex: new RegExp('^' + itemName + '$', 'i') },
                weight_or_volume: itemWeightOrVolume
            });

            if (!item) {
                item = await Item.findOne({
                    product_name: { $regex: new RegExp('^' + itemName + '$', 'i') }
                });

                if (item) {
                    itemWeightOrVolume = item.quantity; // Asigna el peso/volumen predeterminado
                }
            }

            if (!item || item.stock < quantity) {
                itemDetails.push(`${itemName} ${itemWeightOrVolume ? itemWeightOrVolume : ''}: No disponible`);
                continue;
            }

            const itemPrice = convertPrice(item.price);
            const itemTotal = itemPrice * quantity;

            itemDetails.push(`Cant: ${quantity}, ${item.product_name} ${itemWeightOrVolume}, Precio: $${itemPrice.toFixed(2)} c/u, Total: $${itemTotal.toFixed(2)}`);
            total += itemTotal;
            order.push({ name: item.product_name, quantity, itemWeightOrVolume, price: itemPrice });
        } catch (error) {
            itemDetails.push(`${itemName}: Error al procesar el producto`);
        }
    }

    user.lastOrder.items = order;
    user.lastOrder.totalAmount = total;
    await user.save();

    let responseMessage = `\nAquí tienes tu lista con los productos, cantidad y precio:\n`;
    responseMessage += itemDetails.join('\n');
    responseMessage += `\nTotal: $${total.toFixed(2)}\n`;

    const modifyConfirmedPrompt = `Sos el encargado de responder los mensajes de WhatsApp de una aplicación que gestiona pedidos de supermercado. 
                        Genera un breve mensaje para continuar con el proceso de pedido. 
                        El mensaje debe confirmarle al usuario que pudo modificar su pedido. 
                        La respuesta debe ser clara y debe incluir las instrucciones para confirmar o modificar el pedido.
                        Ejemplo de respuesta: "Tu modificación está hecha! En caso de realizar otra modificación escribe 'modificar', sino, 'confirmar'".`;

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

module.exports = handleModifying;
