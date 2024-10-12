const axios = require('axios');

async function handleProductsList() {
  const itemList = [];  // Definir la lista de productos

  try {
    // Realizar la solicitud a la API de Azure para obtener los productos
    const response = await axios.get('https://superbotwebapi-affufwf8ctcfeedv.brazilsouth-01.azurewebsites.net/api/productos');
    const items = response.data;

    if (items.length === 0) {
      itemList.push({ name: "No hay productos disponibles", error: "No se encontraron productos en la API" });
    } else {
      // Iterar sobre los productos obtenidos de la API
      items.forEach((item) => {
        // Asegúrate de que los valores sean cadenas antes de reemplazar
        const conIva = item.con_iva ? item.con_iva.toString().replace(',', '.') : '0';
        const sinIva = item.sin_iva ? item.sin_iva.toString().replace(',', '.') : '0';

        // Convertir las cadenas a números después de reemplazar
        const itemsPriceIva = parseFloat(conIva);
        const itemsPriceNoIva = parseFloat(sinIva);

        itemList.push({
          name: item.artículo_descripcion,
          priceIva: itemsPriceIva.toFixed(2),
          priceNoIva: itemsPriceNoIva.toFixed(2),
          moneda: item.moneda,
          category: item.rubro,
        });
      });
    }
  } catch (error) {
    itemList.push({
      name: "Error en la API",
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

module.exports = handleProductsList;
