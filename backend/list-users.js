import { sequelize } from './src/config/database.js';
import { Usuario } from './src/models/index.js';

async function listUsers() {
    try {
        const users = await Usuario.findAll();
        console.log('--- USUARIOS ---');
        users.forEach(u => {
            console.log(`Email: ${u.email}, Nombre: ${u.nombre}, Activo: ${u.activo}`);
        });
        console.log('----------------');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

listUsers();
