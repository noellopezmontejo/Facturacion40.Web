import { CatTipoFactura } from './src/models/index.js';
import { sequelize } from './src/config/database.js';

async function check() {
    try {
        await sequelize.authenticate();
        const rows = await CatTipoFactura.findAll();
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
