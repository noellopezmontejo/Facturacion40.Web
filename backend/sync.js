import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function init() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || 'lmak',
        });

        const dbName = process.env.DB_NAME || 'facturacion_cfdi4';
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`Database ${dbName} created or already exists.`);
        await connection.end();

        console.log('Loading models and syncing with DB...');
        const { sequelize } = await import('./src/config/database.js');
        await import('./src/models/index.js');

        await sequelize.sync({ alter: true });
        console.log('Database synced successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing database:', error);
        process.exit(1);
    }
}

init();
