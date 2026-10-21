import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const testDb = async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    const tables = ['c_Colonia', 'c_cp', 'c_estado', 'c_municipio', 'c_pais'];
    for (const t of tables) {
        try {
            const [rows] = await conn.query(`SHOW CREATE TABLE ${t}`);
            console.log(rows[0]['Create Table']);
            console.log('-----------------------------------');
        } catch (e) {
            console.error('Error with table', t, e.message);
        }
    }
    await conn.end();
};

testDb();
