import { sequelize } from './src/config/database.js';
import './src/models/index.js'; // Import models to ensure they are registered

async function sync() {
    try {
        await sequelize.sync({ alter: true });
        console.log("Database synchronized successfully!");
    } catch (e) {
        console.error("Failed to sync database:", e);
    } finally {
        process.exit();
    }
}

sync();
