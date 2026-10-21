import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize(
    process.env.DB_NAME || 'facturacion_cfdi4',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || 'lmak',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        logging: console.log, // Set to console.log to see SQL queries
    }
);
