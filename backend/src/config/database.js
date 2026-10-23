import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const rawHost = process.env.DB_HOST || 'localhost';
// Node 18+ resolves 'localhost' to IPv6 '::1', which Hostinger MySQL rejects.
// Normalize 'localhost' to '127.0.0.1'.
const dbHost = rawHost === 'localhost' ? '127.0.0.1' : rawHost;

export const sequelize = new Sequelize(
    process.env.DB_NAME || 'facturacion_cfdi4',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || 'lmak',
    {
        host: dbHost,
        port: Number(process.env.DB_PORT) || 3306,
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'production' ? false : console.log,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);
