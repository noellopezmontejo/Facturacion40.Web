import { sequelize } from '../config/database.js';
import { FolioHistorial } from '../models/FolioHistorial.js';
import { SolicitudDescargaSat } from '../models/SolicitudDescargaSat.js';
import { FacturacionRecurrente } from '../models/FacturacionRecurrente.js';
import { DetalleFacturacionRecurrente } from '../models/DetalleFacturacionRecurrente.js';
import { HistorialFacturacionRecurrente } from '../models/HistorialFacturacionRecurrente.js';
import { PlanGlobal } from '../models/PlanGlobal.js';

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
            { name: 'smtp_from_email', def: 'VARCHAR(255) NULL' },
            { name: 'plan_codigo', def: "VARCHAR(50) DEFAULT 'negocio'" },
            { name: 'periodo_suscripcion', def: "VARCHAR(20) DEFAULT 'mensual'" },
            { name: 'precio_personalizado', def: 'DECIMAL(10,2) NULL' },
            { name: 'folios_incluidos', def: 'INT DEFAULT 200' },
            { name: 'fecha_inicio', def: 'DATETIME NULL' },
            { name: 'fecha_vencimiento', def: 'DATETIME NULL' },
            { name: 'estado_suscripcion', def: "VARCHAR(30) DEFAULT 'activa'" },
            { name: 'notas_suscripcion', def: 'TEXT NULL' }
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

        // 5. Columnas en tabla 'usuarios' (Recuperación de contraseña)
        try {
            const [userCols] = await sequelize.query("SHOW COLUMNS FROM usuarios");
            const userColNames = userCols.map(c => c.Field);

            if (!userColNames.includes('reset_password_token')) {
                try {
                    await sequelize.query("ALTER TABLE usuarios ADD COLUMN `reset_password_token` VARCHAR(255) NULL");
                    console.log("[DB Migration] Columna `reset_password_token` agregada a 'usuarios'.");
                } catch (colErr) {
                    console.warn("[DB Migration] Advertencia al agregar reset_password_token a usuarios:", colErr.message);
                }
            }
            if (!userColNames.includes('reset_password_expires')) {
                try {
                    await sequelize.query("ALTER TABLE usuarios ADD COLUMN `reset_password_expires` DATETIME NULL");
                    console.log("[DB Migration] Columna `reset_password_expires` agregada a 'usuarios'.");
                } catch (colErr) {
                    console.warn("[DB Migration] Advertencia al agregar reset_password_expires a usuarios:", colErr.message);
                }
            }
        } catch (userErr) {
            console.warn("[DB Migration] Error verificando tabla usuarios:", userErr.message);
        }

        // 6. Asegurar nuevas tablas
        await FolioHistorial.sync().catch(e => console.warn('FolioHistorial sync notice:', e.message));
        await SolicitudDescargaSat.sync().catch(e => console.warn('SolicitudDescargaSat sync notice:', e.message));
        await FacturacionRecurrente.sync().catch(e => console.warn('FacturacionRecurrente sync notice:', e.message));
        await DetalleFacturacionRecurrente.sync().catch(e => console.warn('DetalleFacturacionRecurrente sync notice:', e.message));
        await HistorialFacturacionRecurrente.sync().catch(e => console.warn('HistorialFacturacionRecurrente sync notice:', e.message));
        await PlanGlobal.sync().catch(e => console.warn('PlanGlobal sync notice:', e.message));

        // 7. Sembrar planes globales si no existen
        const planesCount = await PlanGlobal.count();
        if (planesCount === 0) {
            console.log("[DB Migration] Sembrando planes globales predeterminados...");
            await PlanGlobal.bulkCreate([
                {
                    codigo: 'basico',
                    nombre: 'Plan Básico (RESICO / Emprendedor)',
                    descripcion: 'Ideal para personas físicas, honorarios, arrendamiento y pequeños negocios que inician.',
                    precio_mensual: 149.00,
                    precio_anual: 1490.00,
                    folios_mensuales: 50,
                    max_emisores: 1,
                    max_usuarios: 1,
                    permite_cotizaciones: false,
                    permite_ordenes_servicio: false,
                    permite_carta_porte: false,
                    permite_recurrentes: false,
                    permite_descarga_sat: false,
                    es_popular: false,
                    activo: true,
                    orden: 1
                },
                {
                    codigo: 'negocio',
                    nombre: 'Plan Negocio / PyME (Servicios & Talleres)',
                    descripcion: 'Para empresas en crecimiento, talleres y prestadores de servicios que requieren cotizaciones y evidencias.',
                    precio_mensual: 349.00,
                    precio_anual: 3490.00,
                    folios_mensuales: 200,
                    max_emisores: 2,
                    max_usuarios: 3,
                    permite_cotizaciones: true,
                    permite_ordenes_servicio: true,
                    permite_carta_porte: false,
                    permite_recurrentes: false,
                    permite_descarga_sat: true,
                    es_popular: true,
                    activo: true,
                    orden: 2
                },
                {
                    codigo: 'corporativo',
                    nombre: 'Plan Corporativo / Logística & Carta Porte',
                    descripcion: 'Solución integral con emisión masiva, choferes, vehículos, facturas recurrentes y multi-empresa.',
                    precio_mensual: 699.00,
                    precio_anual: 6990.00,
                    folios_mensuales: 1000,
                    max_emisores: 999,
                    max_usuarios: 999,
                    permite_cotizaciones: true,
                    permite_ordenes_servicio: true,
                    permite_carta_porte: true,
                    permite_recurrentes: true,
                    permite_descarga_sat: true,
                    es_popular: false,
                    activo: true,
                    orden: 3
                }
            ]);
            console.log("[DB Migration] Planes globales predeterminados creados con éxito.");
        }

        // 8. Inicializar suscripciones en empresas existentes que tengan fecha_vencimiento nula
        try {
            const fechaHoy = new Date();
            const fechaVenceDefault = new Date();
            fechaVenceDefault.setFullYear(fechaHoy.getFullYear() + 1); // 1 año de vigencia inicial

            await sequelize.query(`
                UPDATE empresas 
                SET 
                    plan_codigo = IFNULL(plan_codigo, 'negocio'),
                    periodo_suscripcion = IFNULL(periodo_suscripcion, 'mensual'),
                    folios_incluidos = IFNULL(folios_incluidos, 200),
                    fecha_inicio = IFNULL(fecha_inicio, '${fechaHoy.toISOString().slice(0, 19).replace('T', ' ')}'),
                    fecha_vencimiento = IFNULL(fecha_vencimiento, '${fechaVenceDefault.toISOString().slice(0, 19).replace('T', ' ')}'),
                    estado_suscripcion = IFNULL(estado_suscripcion, 'activa')
                WHERE fecha_vencimiento IS NULL OR plan_codigo IS NULL
            `);
        } catch (initEmpErr) {
            console.warn("[DB Migration] Advertencia inicializando datos de suscripción en empresas:", initEmpErr.message);
        }

        console.log("[DB Migration] Esquema de base de datos verificado y actualizado con éxito.");
    } catch (e) {
        console.error("[DB Migration] Error general asegurando columnas y tablas:", e.message);
    }
};
