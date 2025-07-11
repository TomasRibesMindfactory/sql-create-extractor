#!/usr/bin/env node
/**
 * extract_create_tables.js
 * ------------------------
 * Extrae todas las sentencias CREATE TABLE de un volcado Oracle SQL y las guarda en un archivo separado.
 *
 * Uso:
 *   node extract_create_tables.js <input_dump.sql> [output_tables.sql]
 *
 * Ejemplo:
 *   node extract_create_tables.js dump.sql create_tables.sql
 */

const fs = require('fs');
const path = require('path');

// Obtener argumentos de línea de comandos (ignorar los dos primeros: node y script)
const [, , inputFile, outputFile = 'create_tables.sql'] = process.argv;

if (!inputFile) {
  console.error('Uso: node extract_create_tables.js <input_dump.sql> [output_tables.sql]');
  process.exit(1);
}

// Leer contenido del dump
let sql;
try {
  sql = fs.readFileSync(path.resolve(inputFile), 'utf-8');
} catch (err) {
  console.error(`Error al leer el archivo de entrada: ${err.message}`);
  process.exit(1);
}

// Expresión regular para capturar bloques CREATE TABLE hasta el punto y coma final
const createTableRegex = /CREATE\s+TABLE[\s\S]*?;/gi;
const matches = sql.match(createTableRegex);

if (!matches || matches.length === 0) {
  console.log('No se encontraron sentencias CREATE TABLE en el archivo.');
  process.exit(0);
}

// Escribir las sentencias extraídas en el archivo de salida
try {
  fs.writeFileSync(path.resolve(outputFile), matches.join('\n\n'));
  console.log(`Se encontraron ${matches.length} sentencias CREATE TABLE. Guardadas en '${outputFile}'.`);
} catch (err) {
  console.error(`Error al escribir el archivo de salida: ${err.message}`);
  process.exit(1);
}
