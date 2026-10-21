import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function createDB() {
    try {
        console.log("Conectando a MySQL para crear la base de datos...");
        // Conectamos sin especificar base de datos
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || 'lmak'
        });

        const dbName = process.env.DB_NAME || 'facturacion_cfdi4';
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`Base de datos '${dbName}' creada o ya existía.`);

        await connection.end();
    } catch (error) {
        console.error("Error creando la base de datos:", error);
    }
}

createDB();
