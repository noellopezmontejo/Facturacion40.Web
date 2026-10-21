import { sequelize } from './src/models/index.js';

async function check() {
    try {
        const [results] = await sequelize.query("SHOW TABLES LIKE 'impuestos_locales'");
        console.log('Results:', results);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
