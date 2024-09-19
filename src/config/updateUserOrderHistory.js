const generateUniqueOrderId = () => {
    // Implementa una función para generar un ID único para la orden.
    return `ORD-${Date.now()}`;
};

const updateOrderHistory = async (user) => {
    if (user.lastOrderToLink && user.lastOrderToLink.items.length > 0) {
        const newOrder = {
            orderId: generateUniqueOrderId(), // Genera un ID único para el pedido
            items: user.lastOrderToLink.items,
            totalAmount: user.lastOrderToLink.totalAmount,
            deliveryDetails: user.deliveryDetails, 
            paymentStatus: user.lastOrderToLink.paymentStatus,
            orderDate: new Date(),
            shippingStatus: user.lastOrderToLink.deliveryStatus,
            converersation: user.conversation
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
