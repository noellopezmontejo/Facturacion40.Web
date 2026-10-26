import { sequelize } from '../config/database.js';
import { FolioHistorial } from '../models/FolioHistorial.js';

export const ensurePacColumns = async () => {
    try {
        const [columns] = await sequelize.query("SHOW COLUMNS FROM emisores");
        const colNames = columns.map(c => c.Field);

        if (!colNames.includes('registrado_pac')) {
            await sequelize.query("ALTER TABLE emisores ADD COLUMN registrado_pac TINYINT(1) DEFAULT 0");
            console.log("[DB] Columna registrado_pac agregada a emisores.");
        }
        if (!colNames.includes('fecha_registro_pac')) {
            await sequelize.query("ALTER TABLE emisores ADD COLUMN fecha_registro_pac DATETIME NULL");
            console.log("[DB] Columna fecha_registro_pac agregada a emisores.");
        }
        if (!colNames.includes('ultimos_folios_pac')) {
            await sequelize.query("ALTER TABLE emisores ADD COLUMN ultimos_folios_pac INT DEFAULT 0");
            console.log("[DB] Columna ultimos_folios_pac agregada a emisores.");
        }

        // Asegurar tabla folios_historial
        await FolioHistorial.sync();
        console.log("[DB] Tabla folios_historial verificada/sincronizada.");
    } catch (e) {
        console.error("[DB] Error asegurando columnas PAC:", e.message);
    }
};
