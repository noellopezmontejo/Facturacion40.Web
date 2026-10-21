import { sequelize } from './src/config/database.js';

async function migrate() {
    try {
        console.log('Iniciando migración manual: Agregando tipo_documento_id a series_folios');
        
        // 1. Agregar columna
        try {
            await sequelize.query('ALTER TABLE series_folios ADD COLUMN tipo_documento_id INT NULL AFTER emisor_id');
            console.log('Columna tipo_documento_id agregada.');
        } catch (e) {
            console.log('Aviso: La columna tipo_documento_id ya existe o hubo un error al crearla.');
        }
        
        // 2. Intentar eliminar índices únicos antiguos
        const indicesToDrop = [
            'emisor_id_serie',
            'series_folios_emisor_id_serie',
            'series_folios_emisor_id_serie_unique',
            'series_folios_emisor_id_serie_idx'
        ];

        for (const idx of indicesToDrop) {
            try {
                await sequelize.query(`ALTER TABLE series_folios DROP INDEX ${idx}`);
                console.log(`Índice ${idx} eliminado.`);
            } catch (e) {
                // Silencioso si no existe
            }
        }
        
        // 3. Crear el nuevo índice consolidado
        try {
            await sequelize.query(`
                ALTER TABLE series_folios 
                ADD UNIQUE INDEX idx_emisor_serie_tipo (emisor_id, serie, tipo_documento_id);
            `);
            console.log('Nuevo índice idx_emisor_serie_tipo creado.');
        } catch (e) {
            console.log('Nota: El índice idx_emisor_serie_tipo ya existe o no se pudo crear.');
        }
        
        console.log('Migración finalizada.');
        process.exit(0);
    } catch (error) {
        console.error('Error durante la migración:', error);
        process.exit(1);
    }
}

migrate();
