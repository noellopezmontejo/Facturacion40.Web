import { sequelize } from '../config/database.js';
import { FolioHistorial } from '../models/FolioHistorial.js';
import { SolicitudDescargaSat } from '../models/SolicitudDescargaSat.js';
import { FacturacionRecurrente } from '../models/FacturacionRecurrente.js';
import { DetalleFacturacionRecurrente } from '../models/DetalleFacturacionRecurrente.js';
import { HistorialFacturacionRecurrente } from '../models/HistorialFacturacionRecurrente.js';

export const ensurePacColumns = async () => {
    try {
        console.log("[DB Migration] Verificando y sincronizando esquema de base de datos...");

        // 1. Columnas en tabla 'emisores'
        const [emisoresCols] = await sequelize.query("SHOW COLUMNS FROM emisores");
        const emisorColNames = emisoresCols.map(c => c.Field);

        const emisorColumnsToAdd = [
            { name: 'registrado_pac', def: 'TINYINT(1) DEFAULT 0' },
            { name: 'fecha_registro_pac', def: 'DATETIME NULL' },
            { name: 'ultimos_folios_pac', def: 'INT DEFAULT 0' },
            { name: 'usar_smtp_propio', def: 'TINYINT(1) DEFAULT 0' },
            { name: 'smtp_host', def: 'VARCHAR(255) NULL' },
            { name: 'smtp_port', def: 'INT DEFAULT 587' },
            { name: 'smtp_secure', def: 'TINYINT(1) DEFAULT 0' },
            { name: 'smtp_user', def: 'VARCHAR(255) NULL' },
            { name: 'smtp_pass', def: 'VARCHAR(255) NULL' },
            { name: 'smtp_from_name', def: 'VARCHAR(255) NULL' },
            { name: 'fiel_certificado_path', def: 'VARCHAR(255) NULL' },
            { name: 'fiel_llave_privada_path', def: 'VARCHAR(255) NULL' },
            { name: 'password_fiel', def: 'VARCHAR(255) NULL' }
        ];

        for (const col of emisorColumnsToAdd) {
            if (!emisorColNames.includes(col.name)) {
                try {
                    await sequelize.query(`ALTER TABLE emisores ADD COLUMN \`${col.name}\` ${col.def}`);
                    console.log(`[DB Migration] Columna \`${col.name}\` agregada a 'emisores'.`);
                } catch (colErr) {
                    console.warn(`[DB Migration] Advertencia al agregar columna ${col.name} a emisores:`, colErr.message);
                }
            }
        }

        // 2. Columnas en tabla 'empresas'
        const [empresasCols] = await sequelize.query("SHOW COLUMNS FROM empresas");
        const empresaColNames = empresasCols.map(c => c.Field);

        const empresaColumnsToAdd = [
            { name: 'smtp_host', def: 'VARCHAR(255) NULL' },
            { name: 'smtp_port', def: 'INT DEFAULT 587' },
            { name: 'smtp_secure', def: 'TINYINT(1) DEFAULT 0' },
            { name: 'smtp_user', def: 'VARCHAR(255) NULL' },
            { name: 'smtp_pass', def: 'VARCHAR(255) NULL' },
            { name: 'smtp_from_name', def: 'VARCHAR(255) NULL' },
            { name: 'smtp_from_email', def: 'VARCHAR(255) NULL' }
        ];

        for (const col of empresaColumnsToAdd) {
            if (!empresaColNames.includes(col.name)) {
                try {
                    await sequelize.query(`ALTER TABLE empresas ADD COLUMN \`${col.name}\` ${col.def}`);
                    console.log(`[DB Migration] Columna \`${col.name}\` agregada a 'empresas'.`);
                } catch (colErr) {
                    console.warn(`[DB Migration] Advertencia al agregar columna ${col.name} a empresas:`, colErr.message);
                }
            }
        }

        // 3. Columnas en tabla 'documentos' (Cancelación SAT CFDI 4.0)
        try {
            const [docCols] = await sequelize.query("SHOW COLUMNS FROM documentos");
            const docColNames = docCols.map(c => c.Field);

            const docColumnsToAdd = [
                { name: 'motivo_cancelacion', def: 'VARCHAR(2) NULL' },
                { name: 'uuid_sustitucion', def: 'VARCHAR(36) NULL' },
                { name: 'fecha_cancelacion', def: 'DATETIME NULL' },
                { name: 'acuse_cancelacion', def: 'LONGTEXT NULL' }
            ];

            for (const col of docColumnsToAdd) {
                if (!docColNames.includes(col.name)) {
                    try {
                        await sequelize.query(`ALTER TABLE documentos ADD COLUMN \`${col.name}\` ${col.def}`);
                        console.log(`[DB Migration] Columna \`${col.name}\` agregada a 'documentos'.`);
                    } catch (colErr) {
                        console.warn(`[DB Migration] Advertencia al agregar columna ${col.name} a documentos:`, colErr.message);
                    }
                }
            }
        } catch (docErr) {
            console.warn("[DB Migration] Error verificando tabla documentos:", docErr.message);
        }

        // 4. Columnas en tabla 'ordenes_servicio'
        try {
            const [ordenesCols] = await sequelize.query("SHOW COLUMNS FROM ordenes_servicio");
            const ordenColNames = ordenesCols.map(c => c.Field);

            if (!ordenColNames.includes('evidencias_multimedia')) {
                try {
                    await sequelize.query("ALTER TABLE ordenes_servicio ADD COLUMN `evidencias_multimedia` JSON NULL");
                    console.log("[DB Migration] Columna `evidencias_multimedia` agregada a 'ordenes_servicio'.");
                } catch (colErr) {
                    console.warn("[DB Migration] Advertencia al agregar evidencias_multimedia a ordenes_servicio:", colErr.message);
                }
            }
        } catch (ordenErr) {
            console.warn("[DB Migration] Error verificando tabla ordenes_servicio:", ordenErr.message);
        }

        // 5. Asegurar nuevas tablas
        await FolioHistorial.sync().catch(e => console.warn('FolioHistorial sync notice:', e.message));
        await SolicitudDescargaSat.sync().catch(e => console.warn('SolicitudDescargaSat sync notice:', e.message));
        await FacturacionRecurrente.sync().catch(e => console.warn('FacturacionRecurrente sync notice:', e.message));
        await DetalleFacturacionRecurrente.sync().catch(e => console.warn('DetalleFacturacionRecurrente sync notice:', e.message));
        await HistorialFacturacionRecurrente.sync().catch(e => console.warn('HistorialFacturacionRecurrente sync notice:', e.message));

        console.log("[DB Migration] Esquema de base de datos verificado y actualizado con éxito.");
    } catch (e) {
        console.error("[DB Migration] Error general asegurando columnas y tablas:", e.message);
    }
};
