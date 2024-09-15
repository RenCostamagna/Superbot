const generateUniqueOrderId = () => {
    // Implementa una función para generar un ID único para la orden.
    return `ORD-${Date.now()}`;
};

const updateOrderHistory = async (user) => {
    if (user.lastOrder && user.lastOrder.items.length > 0) {
        const newOrder = {
            orderId: generateUniqueOrderId(), // Genera un ID único para el pedido
            items: user.lastOrder.items,
            totalAmount: user.lastOrder.totalAmount,
            deliveryDetails: user.deliveryDetails, 
            paymentStatus: user.lastOrder.paymentStatus,
            orderDate: new Date()
        };

        // Agregar la nueva orden al historial de órdenes
        user.orderHistory.push(newOrder);

        // Limpiar `lastOrder`
        user.lastOrder = {
            items: [],
            totalAmount: 0,
            paymentId: '',
            paymentStatus: ''
        };

        // Guardar los cambios en el usuario
        await user.save();
    }
};

module.exports = {
    updateOrderHistory
};
