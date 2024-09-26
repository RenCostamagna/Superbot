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
        const itemsPrice = convertPrice(item.PRECIO);

        itemList.push({
          name: item.PRODUCTO,
          price: itemsPrice.toFixed(2),
          category: item.CATEGORIA,
          format: item.Formato,
          paraQueSirve: item.Para_que_sirve,
          stock: item.Stock,
          brand: item.MARCA,
          edadAnimal: item.Edad_del_Animal,
          cuantoTrae: item.Cuanto_trae,
          tamanoAnimal: item.Tamaño_del_Animal,
          proteinasBrutas: item.Cantidad_de_Proteina_bruta,
          fechaDeVencimiento: item.Fecha_de_Vencimiento,
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
        return `Nombre: ${item.name}, Precio: $${item.price}, Formato: ${item.format}, Para qué sirve: ${item.paraQueSirve}, Stock: ${item.stock}, Marca: ${item.brand}, Tamaño del animal: ${item.tamanoAnimal}, Cuánto trae: ${item.cuantoTrae}, Categoría: ${item.category}, Edad del animal: ${item.edadAnimal}, Proteínas brutas: ${item.proteinasBrutas}, Fecha de vencimiento: ${item.fechaDeVencimiento}`;
      }
    })
    .join("\n\n");

  // Mostrar la lista formateada
  console.log("Lista legible para la IA:", formattedList);

  return formattedList;  // Devolver la lista formateada para el uso futuro
}

module.exports = handleOrder;
