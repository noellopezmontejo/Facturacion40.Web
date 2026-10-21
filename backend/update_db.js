import { sequelize } from './src/config/database.js';

async function updateSchema() {
    try {
        console.log('Updating detalle_documentos table...');
        await sequelize.query("ALTER TABLE detalle_documentos ADD COLUMN IF NOT EXISTS retencion_isr BOOLEAN DEFAULT FALSE");
        await sequelize.query("ALTER TABLE detalle_documentos ADD COLUMN IF NOT EXISTS retencion_iva BOOLEAN DEFAULT FALSE");
        await sequelize.query("ALTER TABLE detalle_documentos ADD COLUMN IF NOT EXISTS retencion_isr_tasa DECIMAL(10, 6) DEFAULT 0.10");
        console.log('Table updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error updating table:', err);
        process.exit(1);
    }
}

updateSchema();
