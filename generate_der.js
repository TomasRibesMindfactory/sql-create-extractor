#!/usr/bin/env node
/**
 * generate_der.js
 * ---------------
 * Genera un Diagrama de Entidad-Relación (DER) en formato Mermaid a partir de un volcado Oracle SQL.
 * El diagrama se guarda en un archivo Markdown con sintaxis Mermaid.
 *
 * Uso:
 *   node generate_der.js <input_dump.sql> [output_der.md]
 *
 * Ejemplo:
 *   node generate_der.js dump.sql database_der.md
 */

const fs = require('fs');
const path = require('path');

// Obtener argumentos de línea de comandos
const [, , inputFile, outputFile = 'database_der.md'] = process.argv;

if (!inputFile) {
  console.error('Uso: node generate_der.js <input_dump.sql> [output_der.md]');
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

// Estructuras para almacenar información de la base de datos
const tables = new Map();
const relationships = [];

// Función para limpiar nombres de tabla/columna
function cleanName(name) {
  return name.replace(/["`\[\]]/g, '')
             .replace(/\./g, '_')
             .replace(/#/g, '_NUM')
             .replace(/[^a-zA-Z0-9_]/g, '_')
             .trim();
}

// Función para extraer tipo de dato simplificado
function simplifyDataType(dataType) {
  const type = dataType.toUpperCase();
  if (type.includes('VARCHAR') || type.includes('CHAR')) return 'STRING';
  if (type.includes('NUMBER') || type.includes('INTEGER') || type.includes('DECIMAL')) return 'NUMBER';
  if (type.includes('DATE') || type.includes('TIMESTAMP')) return 'DATE';
  if (type.includes('CLOB') || type.includes('BLOB')) return 'LOB';
  return 'OTHER';
}

// Extraer información de CREATE TABLE
// Regex más robusta que maneja múltiples formatos
const createTableRegex = /CREATE\s+TABLE\s+([^\s(]+)\s*\(([\s\S]*?)\)(?:\s*[^;]*)?;/gi;
let match;

console.log('Procesando archivo SQL...');

while ((match = createTableRegex.exec(sql)) !== null) {
  const tableName = cleanName(match[1]);
  const tableDefinition = match[2];
  
  const columns = [];
  const constraints = [];
  
  // Dividir por comas, pero respetando paréntesis
  const lines = [];
  let currentLine = '';
  let parenthesesCount = 0;
  
  for (let i = 0; i < tableDefinition.length; i++) {
    const char = tableDefinition[i];
    currentLine += char;
    
    if (char === '(') parenthesesCount++;
    if (char === ')') parenthesesCount--;
    
    if (char === ',' && parenthesesCount === 0) {
      lines.push(currentLine.slice(0, -1).trim()); // Remover la coma
      currentLine = '';
    }
  }
  
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  for (let line of lines) {
    line = line.trim();
    
    // Saltar líneas vacías
    if (!line || line.match(/^\s*$/)) continue;
    
    // Detectar constraints
    if (line.toUpperCase().includes('CONSTRAINT')) {
      if (line.toUpperCase().includes('PRIMARY KEY')) {
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const pkColumns = pkMatch[1].split(',').map(col => cleanName(col.trim()));
          constraints.push({ type: 'PK', columns: pkColumns });
        }
      } else if (line.toUpperCase().includes('FOREIGN KEY')) {
        const fkMatch = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i);
        if (fkMatch) {
          const fkColumns = fkMatch[1].split(',').map(col => cleanName(col.trim()));
          const refTable = cleanName(fkMatch[2]);
          const refColumns = fkMatch[3].split(',').map(col => cleanName(col.trim()));
          
          relationships.push({
            from: tableName,
            to: refTable,
            fromColumns: fkColumns,
            toColumns: refColumns
          });
        }
      }
    } else {
      // Procesar definición de columna
      // Regex más flexible para diferentes formatos de Oracle
      const columnMatch = line.match(/^\s*([^\s]+)\s+([^\s,\(]+)(?:\([^)]*\))?/);
      if (columnMatch) {
        let columnName = cleanName(columnMatch[1]);
        
        // Filtrar columnas no válidas o artefactos del parsing
        if (columnName.toUpperCase() === 'PARTITION' || 
            columnName.includes(')') || 
            columnName.match(/^\d+\)$/) ||
            columnName.toUpperCase() === 'PRIMARY' ||
            columnName.toUpperCase() === 'KEY' ||
            columnName.length === 0) {
          continue;
        }
        
        const dataType = simplifyDataType(columnMatch[2]);
        const isPrimaryKey = line.toUpperCase().includes('PRIMARY KEY');
        const isNotNull = line.toUpperCase().includes('NOT NULL') && !isPrimaryKey;
        
        columns.push({
          name: columnName,
          type: dataType,
          isPrimaryKey,
          isNotNull
        });
      }
    }
  }
  
  // Solo agregar la tabla si tiene columnas válidas
  if (columns.length > 0) {
    tables.set(tableName, { columns, constraints });
    
    // Debug: mostrar progreso cada 100 tablas
    if (tables.size % 100 === 0) {
      console.log(`Procesadas ${tables.size} tablas...`);
    }
  }
}

console.log(`Terminado procesamiento de CREATE TABLE. Encontradas ${tables.size} tablas.`);

// Extraer relaciones de ALTER TABLE ADD CONSTRAINT
const alterConstraintRegex = /ALTER\s+TABLE\s+([^\s]+)\s+ADD\s+CONSTRAINT[^;]*FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/gi;

while ((match = alterConstraintRegex.exec(sql)) !== null) {
  const fromTable = cleanName(match[1]);
  const fromColumns = match[2].split(',').map(col => cleanName(col.trim()));
  const toTable = cleanName(match[3]);
  const toColumns = match[4].split(',').map(col => cleanName(col.trim()));
  
  relationships.push({
    from: fromTable,
    to: toTable,
    fromColumns,
    toColumns
  });
}

// Generar diagrama Mermaid
function generateMermaidDiagram(outputBaseName) {
  const tablesArray = Array.from(tables.entries());
  const totalTables = tablesArray.length;
  
  // Si hay más de 100 tablas, crear múltiples archivos
  if (totalTables > 100) {
    return generatePartitionedDiagrams(tablesArray, outputBaseName);
  }
  
  let mermaid = 'erDiagram\n';
  
  // Agregar todas las tablas
  for (const [tableName, tableInfo] of tablesArray) {
    // Limpiar nombre de tabla para Mermaid
    const cleanTableName = cleanName(tableName);
    mermaid += `    ${cleanTableName} {\n`;
    
    for (const column of tableInfo.columns) {
      const cleanColumnName = cleanName(column.name);
      let columnDef = `        ${column.type} ${cleanColumnName}`;
      
      if (column.isPrimaryKey) {
        columnDef += ' PK';
      }
      if (column.isNotNull && !column.isPrimaryKey) {
        columnDef += ' "NOT NULL"';
      }
      
      mermaid += columnDef + '\n';
    }
    
    mermaid += '    }\n\n';
  }
  
  // Agregar todas las relaciones
  for (const rel of relationships) {
    // Limpiar nombres para Mermaid
    const cleanFromTable = cleanName(rel.from);
    const cleanToTable = cleanName(rel.to);
    
    // Verificar que ambas tablas existan
    if (tables.has(rel.from) && tables.has(rel.to)) {
      mermaid += `    ${cleanFromTable} ||--o{ ${cleanToTable} : "references"\n`;
    }
  }
  
  return mermaid;
}

// Generar diagramas particionados para bases de datos grandes
function generatePartitionedDiagrams(tablesArray, outputBaseName) {
  const partitionSize = 50; // 50 tablas por partición
  const totalPartitions = Math.ceil(tablesArray.length / partitionSize);
  
  let indexContent = `# Índice de Diagramas DER - Base de Datos\n\n`;
  indexContent += `**Generado el:** ${new Date().toLocaleString('es-ES')}  \n`;
  indexContent += `**Total de tablas:** ${tablesArray.length}  \n`;
  indexContent += `**Total de relaciones:** ${relationships.length}  \n`;
  indexContent += `**Particiones generadas:** ${totalPartitions}  \n\n`;
  
  indexContent += `## Particiones Disponibles\n\n`;
  
  for (let i = 0; i < totalPartitions; i++) {
    const startIndex = i * partitionSize;
    const endIndex = Math.min(startIndex + partitionSize, tablesArray.length);
    const partitionTables = tablesArray.slice(startIndex, endIndex);
    const partitionFileName = `${outputBaseName}_parte_${i + 1}.md`;
    
    // Crear contenido para esta partición
    let partitionContent = `# DER - Partición ${i + 1} de ${totalPartitions}\n\n`;
    partitionContent += `**Tablas:** ${startIndex + 1} - ${endIndex} (${partitionTables.length} tablas)  \n`;
    partitionContent += `**Archivo:** ${partitionFileName}  \n`;
    partitionContent += `**Generado el:** ${new Date().toLocaleString('es-ES')}  \n\n`;
    
    // Agregar navegación
    partitionContent += `## Navegación\n\n`;
    if (i > 0) {
      partitionContent += `⬅️ [Partición anterior (${i})](${outputBaseName}_parte_${i}.md)  \n`;
    }
    partitionContent += `🏠 [Índice principal](${outputBaseName}_index.md)  \n`;
    if (i < totalPartitions - 1) {
      partitionContent += `➡️ [Partición siguiente (${i + 2})](${outputBaseName}_parte_${i + 2}.md)  \n`;
    }
    partitionContent += `\n`;
    
    // Agregar diagrama Mermaid
    partitionContent += `## Diagrama\n\n`;
    partitionContent += '```mermaid\n';
    partitionContent += 'erDiagram\n';
    
    // Agregar tablas de esta partición
    for (const [tableName, tableInfo] of partitionTables) {
      const cleanTableName = cleanName(tableName);
      partitionContent += `    ${cleanTableName} {\n`;
      
      for (const column of tableInfo.columns) {
        const cleanColumnName = cleanName(column.name);
        let columnDef = `        ${column.type} ${cleanColumnName}`;
        
        if (column.isPrimaryKey) {
          columnDef += ' PK';
        }
        if (column.isNotNull && !column.isPrimaryKey) {
          columnDef += ' "NOT NULL"';
        }
        
        partitionContent += columnDef + '\n';
      }
      
      partitionContent += '    }\n\n';
    }
    
    // Agregar relaciones que involucren tablas de esta partición
    const partitionTableNames = partitionTables.map(([name]) => name);
    let partitionRelationships = [];
    
    for (const rel of relationships) {
      if (partitionTableNames.includes(rel.from) && partitionTableNames.includes(rel.to)) {
        const cleanFromTable = cleanName(rel.from);
        const cleanToTable = cleanName(rel.to);
        partitionContent += `    ${cleanFromTable} ||--o{ ${cleanToTable} : "references"\n`;
        partitionRelationships.push(rel);
      }
    }
    
    partitionContent += '```\n\n';
    
    // Agregar lista detallada de tablas de esta partición
    partitionContent += `## Tablas en esta Partición\n\n`;
    for (const [tableName, tableInfo] of partitionTables) {
      partitionContent += `### ${tableName}\n\n`;
      partitionContent += `| Columna | Tipo | Características |\n`;
      partitionContent += `|---------|------|----------------|\n`;
      
      for (const column of tableInfo.columns) {
        let characteristics = [];
        if (column.isPrimaryKey) characteristics.push('PK');
        if (column.isNotNull) characteristics.push('NOT NULL');
        
        partitionContent += `| ${column.name} | ${column.type} | ${characteristics.join(', ')} |\n`;
      }
      partitionContent += `\n`;
    }
    
    // Agregar relaciones específicas de esta partición
    if (partitionRelationships.length > 0) {
      partitionContent += `## Relaciones en esta Partición\n\n`;
      partitionContent += `| Tabla Origen | Columna(s) | Tabla Destino | Columna(s) |\n`;
      partitionContent += `|--------------|------------|---------------|------------|\n`;
      
      for (const rel of partitionRelationships) {
        partitionContent += `| ${rel.from} | ${rel.fromColumns.join(', ')} | ${rel.to} | ${rel.toColumns.join(', ')} |\n`;
      }
      partitionContent += `\n`;
    }
    
    partitionContent += `---\n\n`;
    partitionContent += `*Partición ${i + 1} de ${totalPartitions} - Generado automáticamente por generate_der.js*\n`;
    
    // Escribir archivo de partición
    try {
      fs.writeFileSync(path.resolve(partitionFileName), partitionContent);
      console.log(`Partición ${i + 1}/${totalPartitions} guardada: ${partitionFileName}`);
    } catch (err) {
      console.error(`Error al escribir partición ${i + 1}: ${err.message}`);
    }
    
    // Agregar a índice
    indexContent += `### [Partición ${i + 1}](${partitionFileName})\n`;
    indexContent += `- **Tablas:** ${startIndex + 1} - ${endIndex}\n`;
    indexContent += `- **Cantidad:** ${partitionTables.length} tablas\n`;
    indexContent += `- **Relaciones:** ${partitionRelationships.length} relaciones internas\n`;
    indexContent += `- **Primeras tablas:** ${partitionTables.slice(0, 3).map(([name]) => name).join(', ')}${partitionTables.length > 3 ? '...' : ''}\n\n`;
  }
  
  // Agregar resumen al índice
  indexContent += `## Resumen Completo\n\n`;
  indexContent += `### Todas las Relaciones\n\n`;
  if (relationships.length > 0) {
    indexContent += `| Tabla Origen | Columna(s) | Tabla Destino | Columna(s) |\n`;
    indexContent += `|--------------|------------|---------------|------------|\n`;
    
    for (const rel of relationships) {
      indexContent += `| ${rel.from} | ${rel.fromColumns.join(', ')} | ${rel.to} | ${rel.toColumns.join(', ')} |\n`;
    }
    indexContent += `\n`;
  }
  
  indexContent += `---\n\n`;
  indexContent += `*Índice generado automáticamente por generate_der.js*\n`;
  
  return indexContent;
}

// Generar contenido del archivo Markdown
function generateMarkdownContent(outputBaseName) {
  const timestamp = new Date().toLocaleString('es-ES');
  const tableCount = tables.size;
  const relationshipCount = relationships.length;
  
  if (tableCount > 100) {
    // Para bases de datos grandes, generar solo el índice
    console.log(`Base de datos grande detectada (${tableCount} tablas). Generando archivos por particiones...`);
    return generateMermaidDiagram(outputBaseName);
  } else {
    // Para bases de datos pequeñas, generar archivo único tradicional
    let content = `# Diagrama de Entidad-Relación (DER)\n\n`;
    content += `**Generado el:** ${timestamp}  \n`;
    content += `**Archivo fuente:** ${inputFile}  \n`;
    content += `**Tablas encontradas:** ${tableCount}  \n`;
    content += `**Relaciones encontradas:** ${relationshipCount}  \n\n`;
    
    content += `## Diagrama\n\n`;
    content += `\`\`\`mermaid\n`;
    content += generateMermaidDiagram(outputBaseName);
    content += `\`\`\`\n\n`;
    
    // Agregar lista de tablas
    content += `## Tablas\n\n`;
    for (const [tableName, tableInfo] of tables) {
      content += `### ${tableName}\n\n`;
      content += `| Columna | Tipo | Características |\n`;
      content += `|---------|------|----------------|\n`;
      
      for (const column of tableInfo.columns) {
        let characteristics = [];
        if (column.isPrimaryKey) characteristics.push('PK');
        if (column.isNotNull) characteristics.push('NOT NULL');
        
        content += `| ${column.name} | ${column.type} | ${characteristics.join(', ')} |\n`;
      }
      content += `\n`;
    }
    
    // Agregar lista de relaciones
    if (relationships.length > 0) {
      content += `## Relaciones\n\n`;
      content += `| Tabla Origen | Columna(s) | Tabla Destino | Columna(s) |\n`;
      content += `|--------------|------------|---------------|------------|\n`;
      
      for (const rel of relationships) {
        content += `| ${rel.from} | ${rel.fromColumns.join(', ')} | ${rel.to} | ${rel.toColumns.join(', ')} |\n`;
      }
      content += `\n`;
    }
    
    content += `---\n\n`;
    content += `*Generado automáticamente por generate_der.js*\n`;
    
    return content;
  }
}

// Verificar si se encontraron tablas
if (tables.size === 0) {
  console.log('No se encontraron tablas en el archivo.');
  process.exit(0);
}

// Escribir archivo de salida
try {
  // Extraer nombre base del archivo de salida (sin extensión)
  const outputBaseName = path.basename(outputFile, '.md');
  const markdownContent = generateMarkdownContent(outputBaseName);
  
  if (tables.size > 100) {
    // Para bases de datos grandes, escribir el índice
    const indexFileName = `${outputBaseName}_index.md`;
    fs.writeFileSync(path.resolve(indexFileName), markdownContent);
    
    console.log(`\nDER generado exitosamente en múltiples archivos:`);
    console.log(`- ${tables.size} tablas procesadas`);
    console.log(`- ${relationships.length} relaciones encontradas`);
    console.log(`- Archivo índice: ${indexFileName}`);
    console.log(`- Archivos de particiones: ${outputBaseName}_parte_1.md a ${outputBaseName}_parte_${Math.ceil(tables.size / 50)}.md`);
  } else {
    // Para bases de datos pequeñas, escribir archivo único
    fs.writeFileSync(path.resolve(outputFile), markdownContent);
    
    console.log(`DER generado exitosamente:`);
    console.log(`- ${tables.size} tablas procesadas`);
    console.log(`- ${relationships.length} relaciones encontradas`);
    console.log(`- Diagrama guardado en '${outputFile}'`);
  }
  
  console.log(`\nPuede visualizar los diagramas en GitHub, GitLab, o cualquier editor que soporte Mermaid.`);
} catch (err) {
  console.error(`Error al escribir archivos de salida: ${err.message}`);
  process.exit(1);
}
