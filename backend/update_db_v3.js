import { sequelize } from './src/config/database.js';

async function updateSchema() {
    try {
        console.log('Checking columns in documentos...');
        const [columns] = await sequelize.query("SHOW COLUMNS FROM documentos");
        const existingColumns = columns.map(c => c.Field);

        if (!existingColumns.includes('ajuste_manual')) {
            console.log('Adding column ajuste_manual...');
            await sequelize.query("ALTER TABLE documentos ADD COLUMN ajuste_manual BOOLEAN DEFAULT FALSE");
            console.log('Column ajuste_manual added successfully!');
        } else {
            console.log('Column ajuste_manual already exists.');
        }

        console.log('Table update process completed!');
        process.exit(0);
    } catch (err) {
        console.error('Error updating table:', err);
        process.exit(1);
    }
}

updateSchema();
