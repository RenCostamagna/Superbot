function convertPrice(priceString) {
    priceString = priceString.replace(/^\s*|\s*$/g, ''); // Eliminar espacios al principio y al final
    priceString = priceString.replace(/^\$/, ''); // Eliminar el símbolo de dólar      
    priceString = priceString.replace(/\./g, ''); // Reemplazar puntos (separadores de miles) por nada
    priceString = priceString.replace(/,/g, '.'); // Reemplazar coma (separador decimal) por punto
    return parseFloat(priceString);
}

module.exports = { convertPrice };