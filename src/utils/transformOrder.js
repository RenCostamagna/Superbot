const transformOrder = (order) => {
  // Implementa la lógica para transformar la orden aquí
  return {
    items: order.items.map(item => ({
      title: item.productName,
      quantity: item.quantity,
      unit_price: item.pricePerUnit,
    })),
  };
};

module.exports = { transformOrder };
