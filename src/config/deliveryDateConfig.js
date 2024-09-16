
function obtenerProximaSemana(diaYHora) {
        // Separar el día de la semana de la hora usando un espacio como delimitador
        const [diaSemana, hora] = diaYHora.split(' ');
        // Crear una nueva fecha con el día actual
        const hoy = new Date();
        // Obtener el número del día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
        const diaActual = hoy.getDay();
        
        // Mapa para convertir los nombres de días a números de 0 a 6
        const dias = {
            'domingo': 0,
            'lunes': 1,
            'martes': 2,
            'miércoles': 3,
            'jueves': 4,
            'viernes': 5,
            'sábado': 6
        };
    
        // Si el día ingresado no es válido
        if (!(diaSemana.toLowerCase() in dias)) {
            throw new Error('El día proporcionado no es válido');
        }
    
        // Convertir el día de la semana ingresado en un número (0 a 6)
        const diaObjetivo = dias[diaSemana.toLowerCase()];
    
        // Calcular la diferencia de días hasta la próxima ocurrencia del día de la semana
        let diasParaSumar = (diaObjetivo + 7 - diaActual) % 7;
        if (diasParaSumar === 0) {
            // Si el día de la semana es hoy, sumar 7 días para obtener la próxima semana
            diasParaSumar = 7;
        }
    
        // Sumar los días calculados a la fecha actual
        hoy.setDate(hoy.getDate() + diasParaSumar);
    
        // Separar la hora ingresada
        const [horas, minutos] = hora.split(':').map(Number);
        hoy.setHours(horas);
        hoy.setMinutes(minutos);
        
        const opciones = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'};
        return hoy.toLocaleDateString('es-ES', opciones);
}
    
module.exports = obtenerProximaSemana