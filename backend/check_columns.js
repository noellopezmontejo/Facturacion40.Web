import { sequelize } from './src/config/database.js';

async function checkTable() {
    try {
        const [results] = await sequelize.query("DESCRIBE detalle_documentos");
        const fields = results.map(r => r.Field);
        console.log('FIELDS:', fields.join(', '));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkTable();
