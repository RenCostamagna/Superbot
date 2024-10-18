# Path del archivo
archivo_entrada = 'C:\\Users\\tator\\OneDrive\\Escritorio\\Balros\\Superbot\\src\\scripts\\notas_unificadas_limpio.txt'
archivo_salida = 'C:\\Users\\tator\\OneDrive\\Escritorio\\Balros\\Superbot\\src\\scripts\\notas_450_a_500_unificadas.txt'

# Texto que queremos buscar
texto_buscar = "Los mensajes y las llamadas están cifrados de extremo a extremo. Nadie fuera de este chat, ni siquiera WhatsApp, puede leerlos ni escucharlos. Toca para obtener más información."

# Contador para las ocurrencias
contador = 0
inicio_ocurrencia = 450
fin_ocurrencia = 500

# Lista para guardar las líneas seleccionadas
lineas_seleccionadas = []

# Leer el archivo original
with open(archivo_entrada, 'r', encoding='utf-8') as file:
    lines = file.readlines()

# Procesar las líneas para capturar las ocurrencias y todo lo que sigue hasta la próxima ocurrencia
i = 0
while i < len(lines):
    line = lines[i]
    if texto_buscar in line:
        contador += 1
        if contador > fin_ocurrencia:
            break
        if contador > inicio_ocurrencia:
            while i < len(lines) and (i + 1 == len(lines) or texto_buscar not in lines[i + 1]):
                lineas_seleccionadas.append(lines[i])
                i += 1
            lineas_seleccionadas.append(lines[i])  # Asegurarse de incluir la última línea antes de la siguiente ocurrencia
    i += 1

# Escribir las líneas seleccionadas en el nuevo archivo
with open(archivo_salida, 'w', encoding='utf-8') as file:
    file.writelines(lineas_seleccionadas)
