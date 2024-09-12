const validAreaCodes = ['341']; // Ejemplos de códigos de área

function verifyAreaCode(phoneNumber) {
    // Eliminar espacios, guiones, paréntesis o cualquier carácter no numérico
    const cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    let areaCode;

    // Verificar si el número comienza con +54 o 549 (código internacional de Argentina)
    if (cleanedPhoneNumber.startsWith('549')) {
        // Número con código de país +54 y 9 (que se usa para celulares en Argentina)
        areaCode = cleanedPhoneNumber.slice(3, 6); // Coge los 3 dígitos después de '549'
    } else if (cleanedPhoneNumber.startsWith('54')) {
        // Número con código de país +54 (Argentina), pero sin 9 para celular
        areaCode = cleanedPhoneNumber.slice(2, 5); // Coge los 3 dígitos después de '54'
    } else {
        // Asume que es un número local sin el prefijo del código de país
        areaCode = cleanedPhoneNumber.slice(0, 3); // Los primeros 3 dígitos son el código de área local
    }

    // Verificar si el código de área está en la lista de válidos
    return validAreaCodes.includes(areaCode);
}

module.exports = verifyAreaCode;
