import { sequelize } from './src/config/database.js';

async function updateSchema() {
    try {
        console.log('Checking columns in detalle_documentos...');
        const [columns] = await sequelize.query("SHOW COLUMNS FROM detalle_documentos");
        const existingColumns = columns.map(c => c.Field);

        if (!existingColumns.includes('retencion_isr')) {
            console.log('Adding retencion_isr...');
            await sequelize.query("ALTER TABLE detalle_documentos ADD COLUMN retencion_isr BOOLEAN DEFAULT FALSE");
        }
        if (!existingColumns.includes('retencion_iva')) {
            console.log('Adding retencion_iva...');
            await sequelize.query("ALTER TABLE detalle_documentos ADD COLUMN retencion_iva BOOLEAN DEFAULT FALSE");
        }
        if (!existingColumns.includes('retencion_isr_tasa')) {
            console.log('Adding retencion_isr_tasa...');
            await sequelize.query("ALTER TABLE detalle_documentos ADD COLUMN retencion_isr_tasa DECIMAL(10, 6) DEFAULT 0.10");
        }

        console.log('Table update process completed!');
        process.exit(0);
    } catch (err) {
        console.error('Error updating table:', err);
        process.exit(1);
    }
}

updateSchema();
