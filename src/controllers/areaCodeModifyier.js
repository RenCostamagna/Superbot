const validAreaCodes =  ['341']; // Ejemplos de códigos de área

// Función para verificar el código de áread
function verifyAreaCode(phoneNumber) {
    // Eliminar espacios, guiones o paréntesis del número de teléfono
    const cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    // Extraer el código de área (primeros 2-4 dígitos según el formato del país)
    // Aquí se asume que el número es argentino con código de país '+54'
    const areaCode = cleanedPhoneNumber.startsWith('+549') 
        ? cleanedPhoneNumber.slice(3, 6) 
        : cleanedPhoneNumber.slice(0, 3);

    // Verificar si el código de área está en la lista de válidos
    return validAreaCodes.includes(areaCode);
}

module.exports = verifyAreaCode;
