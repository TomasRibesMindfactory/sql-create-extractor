#!/usr/bin/env node
/**
 * extract_create_tables.js
 * ------------------------
 * Extrae todas las sentencias CREATE TABLE y sus relaciones (constraints, foreign keys, etc.) 
 * de un volcado Oracle SQL y las guarda en un archivo separado.
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

// Expresiones regulares para extraer constraints y relaciones
const alterTableRegex = /ALTER\s+TABLE[\s\S]*?;/gi;
const addConstraintRegex = /ALTER\s+TABLE\s+\w+\s+ADD\s+CONSTRAINT[\s\S]*?;/gi;
const createIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX[\s\S]*?;/gi;

// Extraer ALTER TABLE statements
const alterTableMatches = sql.match(alterTableRegex) || [];
// Extraer ADD CONSTRAINT statements
const constraintMatches = sql.match(addConstraintRegex) || [];
// Extraer CREATE INDEX statements
const indexMatches = sql.match(createIndexRegex) || [];

if (!matches || matches.length === 0) {
  console.log('No se encontraron sentencias CREATE TABLE en el archivo.');
  process.exit(0);
}

// Combinar todas las sentencias encontradas
let allStatements = [];

// Agregar CREATE TABLE statements
allStatements.push('-- ====================================');
allStatements.push('-- CREATE TABLE STATEMENTS');
allStatements.push('-- ====================================');
allStatements.push('');
allStatements = allStatements.concat(matches);

// Agregar ALTER TABLE statements si existen
if (alterTableMatches.length > 0) {
  allStatements.push('');
  allStatements.push('-- ====================================');
  allStatements.push('-- ALTER TABLE STATEMENTS');
  allStatements.push('-- ====================================');
  allStatements.push('');
  allStatements = allStatements.concat(alterTableMatches);
}

// Agregar CONSTRAINT statements si existen
if (constraintMatches.length > 0) {
  allStatements.push('');
  allStatements.push('-- ====================================');
  allStatements.push('-- CONSTRAINT STATEMENTS');
  allStatements.push('-- ====================================');
  allStatements.push('');
  allStatements = allStatements.concat(constraintMatches);
}

// Agregar INDEX statements si existen
if (indexMatches.length > 0) {
  allStatements.push('');
  allStatements.push('-- ====================================');
  allStatements.push('-- INDEX STATEMENTS');
  allStatements.push('-- ====================================');
  allStatements.push('');
  allStatements = allStatements.concat(indexMatches);
}

// Escribir las sentencias extraídas en el archivo de salida
try {
  fs.writeFileSync(path.resolve(outputFile), allStatements.join('\n\n'));
  
  const totalStatements = matches.length + alterTableMatches.length + constraintMatches.length + indexMatches.length;
  console.log(`Extracción completada:`);
  console.log(`- ${matches.length} sentencias CREATE TABLE`);
  console.log(`- ${alterTableMatches.length} sentencias ALTER TABLE`);
  console.log(`- ${constraintMatches.length} sentencias CONSTRAINT`);
  console.log(`- ${indexMatches.length} sentencias CREATE INDEX`);
  console.log(`Total: ${totalStatements} sentencias guardadas en '${outputFile}'.`);
} catch (err) {
  console.error(`Error al escribir el archivo de salida: ${err.message}`);
  process.exit(1);
}
