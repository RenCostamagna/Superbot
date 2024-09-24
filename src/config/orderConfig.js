const transformOrder = (order) => {
    const items = order.lastOrderToLink.items.map(item => ({
        id: item.productName, 
        title: item.productName,
        description: item.description, // Puedes agregar descripciones si es necesario
        category_id: 'other', // Puedes definir categorías si es necesario
        quantity: item.quantity,
        currency_id: 'ARS', // Ajustar según la moneda que utilices
        unit_price: item.pricePerUnit
    }));

    console.log("Mapeo de items dentro del link: ",items);

    return {
        items,
        deliveryDetails: order.deliveryDetails,
        phoneNumber: order.phoneNumber,
    };
};

module.exports = { transformOrder };