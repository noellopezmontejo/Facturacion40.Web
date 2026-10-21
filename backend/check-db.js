import { Sequelize } from 'sequelize';

async function testConnection() {
    console.log("Testing connection with user 'root' and password 'lmak'...");
    const sequelize = new Sequelize('facturacion_cfdi4', 'root', 'lmak', {
        host: 'localhost',
        dialect: 'mysql',
        logging: console.log, // Enable logging to see what it's trying to do
    });

    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        process.exit();
    }
}

testConnection();
