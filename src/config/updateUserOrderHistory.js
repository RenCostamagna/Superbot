const generateUniqueOrderId = () => {
    // Implementa una función para generar un ID único para la orden.
    return `ORD-${Date.now()}`;
};

const updateOrderHistory = async (user) => {
    if (user.lastOrderToLink && user.lastOrderToLink.items.length > 0) {
        const newOrder = {
            orderId: generateUniqueOrderId(), // Genera un ID único para el pedido
            items: user.lastOrderToLink.items.map(item => ({
                name: item.productName,
                quantity: item.quantity,
                itemWeightOrVolume: item.weightOrVolume,
                price: item.pricePerUnit,
              })),
            totalAmount: user.lastOrderToLink.total,
            deliveryDetails: user.deliveryStatus, 
            paymentStatus: user.lastOrderToLink.paymentStatus,
            orderDate: new Date(),
            shippingStatus: user.lastOrderToLink.deliveryStatus,
            conversation: user.conversation
        };

        // Agregar la nueva orden al historial de órdenes
        user.orderHistory.push(newOrder);

        // Guardar los cambios en el usuario
        await user.save();
    }
};

module.exports = {
    updateOrderHistory
};
