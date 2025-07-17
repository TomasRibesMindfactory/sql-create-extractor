# SQL Create Tables Extractor

Un script Node.js para extraer sentencias CREATE TABLE y sus relaciones de volcados de Oracle SQL.

## Descripción

Este script permite extraer de manera automática todas las sentencias CREATE TABLE junto con sus relaciones (constraints, foreign keys, índices) de un archivo de volcado SQL de Oracle y guardarlas en un archivo separado para facilitar su análisis y uso.

## Características

- ✅ Extrae sentencias `CREATE TABLE`
- ✅ Extrae sentencias `ALTER TABLE`
- ✅ Extrae constraints (`ADD CONSTRAINT`)
- ✅ Extrae índices (`CREATE INDEX`)
- ✅ Organiza la salida en secciones claramente delimitadas
- ✅ Proporciona un reporte detallado de elementos extraídos
- ✅ Compatible con volcados de Oracle SQL

## Requisitos

- Node.js (versión 12 o superior)

## Instalación

1. Clona o descarga este repositorio
2. No se requieren dependencias adicionales (usa módulos nativos de Node.js)

## Uso

### Sintaxis

```bash
node extract_create_tables.js <archivo_volcado.sql> [archivo_salida.sql]
```

### Parámetros

- `<archivo_volcado.sql>` (requerido): Ruta al archivo de volcado SQL de Oracle
- `[archivo_salida.sql]` (opcional): Nombre del archivo de salida. Por defecto: `create_tables.sql`

### Ejemplos

```bash
# Usar archivo de salida por defecto
node extract_create_tables.js dump_oracle.sql

# Especificar archivo de salida personalizado
node extract_create_tables.js dump_oracle.sql tablas_extraidas.sql

# Usando rutas completas
node extract_create_tables.js "C:\dumps\mi_dump.sql" "C:\output\tablas.sql"
```

## Formato de Salida

El archivo de salida se organiza en las siguientes secciones:

```sql
-- ====================================
-- CREATE TABLE STATEMENTS
-- ====================================

CREATE TABLE tabla1 (...);

CREATE TABLE tabla2 (...);

-- ====================================
-- ALTER TABLE STATEMENTS
-- ====================================

ALTER TABLE tabla1 ADD ...;

-- ====================================
-- CONSTRAINT STATEMENTS
-- ====================================

ALTER TABLE tabla1 ADD CONSTRAINT fk_tabla1 FOREIGN KEY ...;

-- ====================================
-- INDEX STATEMENTS
-- ====================================

CREATE INDEX idx_tabla1 ON tabla1 (...);
```

## Tipos de Sentencias Extraídas

### 1. CREATE TABLE
Extrae todas las definiciones de tablas:
- Estructura de columnas
- Tipos de datos
- Constraints inline (PRIMARY KEY, NOT NULL, etc.)

### 2. ALTER TABLE
Captura modificaciones posteriores a las tablas:
- Adición de columnas
- Modificación de restricciones
- Cambios en la estructura

### 3. CONSTRAINT STATEMENTS
Extrae específicamente las declaraciones de constraints:
- Foreign Keys (`FOREIGN KEY`)
- Primary Keys (`PRIMARY KEY`)
- Unique Constraints (`UNIQUE`)
- Check Constraints (`CHECK`)

### 4. CREATE INDEX
Captura la creación de índices:
- Índices únicos (`UNIQUE INDEX`)
- Índices compuestos
- Índices relacionados con foreign keys

## Reporte de Salida

El script proporciona un reporte detallado en la consola:

```
Extracción completada:
- 15 sentencias CREATE TABLE
- 8 sentencias ALTER TABLE
- 12 sentencias CONSTRAINT
- 20 sentencias CREATE INDEX
Total: 55 sentencias guardadas en 'create_tables.sql'.
```

## Casos de Uso

- **Análisis de estructura de BD**: Revisar rápidamente la estructura de una base de datos
- **Migración de datos**: Extraer solo las definiciones de tablas para recrear la estructura
- **Documentación**: Generar documentación de la estructura de base de datos
- **Debugging**: Analizar problemas de relaciones entre tablas
- **Backup selectivo**: Crear respaldos solo de la estructura sin datos

## Limitaciones

- Diseñado específicamente para volcados de Oracle SQL
- No extrae datos, solo estructura y relaciones
- Requiere que el volcado esté bien formateado (sentencias terminadas en `;`)

## Manejo de Errores

El script maneja los siguientes casos de error:

- **Archivo no encontrado**: Muestra error si el archivo de entrada no existe
- **Permisos de escritura**: Error si no se puede escribir el archivo de salida
- **Sin sentencias**: Informa si no se encuentran sentencias CREATE TABLE
- **Argumentos faltantes**: Muestra mensaje de uso correcto

## Contribuciones

Si encuentras algún problema o quieres sugerir mejoras:

1. Reporta issues específicos con ejemplos
2. Propón mejoras para casos de uso adicionales
3. Comparte ejemplos de volcados que no funcionen correctamente

## Licencia

Este script es de uso libre para propósitos educativos y comerciales.

---

**Versión**: 1.1.0  
**Compatibilidad**: Oracle SQL  
**Autor**: TomasRibesMindfactory
