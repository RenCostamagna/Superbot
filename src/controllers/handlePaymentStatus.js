const handlePaymentStatus = (status, user) => {
    switch (status) {
        case 'approved':
            console.log('Pago aprobado. Proceder con el pedido.');
            // Lógica adicional para un pago aprobado
            break;

        case 'pending':
            console.log('Pago pendiente. Esperar confirmación.');
            // Lógica adicional para un pago pendiente
            break;

        case 'rejected':
            console.log('Pago rechazado. Notificar al usuario.');
            // Lógica adicional para un pago rechazado
            break;

        case 'cancelled':
            console.log('Pago cancelado. Actualizar estado del pedido.');
            // Lógica adicional para un pago cancelado
            break;

        default:
            console.log('Estado del pago desconocido:', status);
            break;
    }
};

module.exports = handlePaymentStatus;