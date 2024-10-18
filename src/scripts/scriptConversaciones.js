const fs = require('fs');
const path = require('path');

// Ruta de la carpeta principal que contiene todas las subcarpetas
const folderPath = 'F:\\descargas\\Conversaciones SUPERBOT-20241015T142913Z-001\\Conversaciones SUPERBOT'; // Cambia esto por la ruta real
const outputFile = 'notas_unificadas.txt';

// Array para almacenar el contenido de cada archivo
let allConversations = [];

// Función para leer archivos de manera recursiva
const readFilesRecursively = (dir) => {
    fs.readdir(dir, (err, files) => {
        if (err) {
            return console.error('Error al leer la carpeta:', err);
        }

        let filePromises = files.map(file => {
            const filePath = path.join(dir, file);
            return new Promise((resolve, reject) => {
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        return reject(err);
                    }

                    // Si es un directorio, llama recursivamente
                    if (stats.isDirectory()) {
                        readFilesRecursively(filePath);
                    } else if (path.extname(file) === '.txt') {
                        // Si es un archivo .txt, lo lee
                        fs.readFile(filePath, 'utf8', (err, content) => {
                            if (err) {
                                return reject(err);
                            }
                            allConversations.push(content);
                            resolve();
                        });
                    } else {
                        resolve(); // Resuelve si no es un archivo .txt
                    }
                });
            });
        });

        // Espera a que todos los archivos hayan sido leídos
        Promise.all(filePromises)
            .then(() => {
                if (allConversations.length) {
                    // Escribe todo el contenido en un solo archivo
                    fs.writeFile(outputFile, allConversations.join('\n\n'), (err) => {
                        if (err) {
                            return console.error('Error al escribir el archivo de salida:', err);
                        }
                        console.log(`Se han unificado ${allConversations.length} archivos en ${outputFile}`);
                    });
                } else {
                    console.log('No se encontraron archivos .txt.');
                }
            })
            .catch(err => console.error('Error al leer archivos:', err));
    });
};

// Comienza a leer archivos desde la carpeta principal
readFilesRecursively(folderPath);