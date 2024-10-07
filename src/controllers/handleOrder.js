const { convertPrice } = require("../utils/converPrice.js");
const Item = require("../models/item.js");

async function handleOrder() {
  const itemList = [];  // Definir la lista de productos

  try {
    // Buscar todos los productos en la base de datos
    const items = await Item.find({});

    if (items.length === 0) {
      itemList.push({ name: "No hay productos disponibles", error: "No se encontraron productos en la base de datos" });
    } else {
      // Iterar sobre los productos encontrados
      items.forEach((item) => {
        const itemsPriceIva = convertPrice(item.Con_iva);
        const itemsPriceNoIva = convertPrice(item.Sin_iva);
        itemList.push({
          name: item.Artículo_descripcion,
          priceIva: itemsPriceIva.toFixed(2),
          priceNoIva: itemsPriceNoIva.toFixed(2),
          moneda: item.Moneda,
          category: item.Rubro,

        });
      });
    }
  } catch (error) {
    itemList.push({
      name: "Error en la base de datos",
      error: `Error al procesar los productos: ${error.message}`,
    });
    console.error("Error al procesar los productos:", error);
  }

  // Convertir la lista a un formato legible para la IA
  const formattedList = itemList
    .map((item) => {
      if (item.error) {
        return `${item.name}: ${item.error}`;
      } else {
        return `Nombre: ${item.name}, Precio con IVA: $${item.priceIva}, Precio sin IVA: $${item.priceNoIva}, Moneda: ${item.moneda}, Categoría: ${item.category}`;
      }
    })
    .join("\n\n");

  // Mostrar la lista formateada
  console.log("Lista legible para la IA:", formattedList);

  return formattedList;  // Devolver la lista formateada para el uso futuro
}

module.exports = handleOrder;
