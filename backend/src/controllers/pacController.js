import fs from 'fs';
import path from 'path';
import { 
    Emisor, 
    Empresa, 
    Usuario, 
    FolioHistorial 
} from '../models/index.js';
import { 
    getCreditosDisponibles, 
    asignarTimbresPAC, 
    testConexionPACService, 
    consultarStatusSatPAC, 
    consultarPeticionesPendientesPAC,
    getPacToken,
    getPacRfcIntegrador
} from '../services/cfdiService.js';
import { Op } from 'sequelize';

/**
 * Resumen global del PAC (cuenta integradora Profact)
 */
export const getResumenCuentaIntegrador = async (req, res) => {
    try {
        const rfcIntegrador = getPacRfcIntegrador();
        
        // 1. Consultar la BOLSA MAESTRA global del Integrador PAC (rfcEmisor vacío devuelve el saldo total de la cuenta: 54,740 contratados, 1,785 disponibles de asignación)
        const pacResult = await getCreditosDisponibles({ rfc: '', modo_prueba: false });

        // 2. Si se solicitó un emisor específico en query, consultar su saldo individual de timbrado
        let emisorIndividual = null;
        if (req.query.emisor_id) {
            const em = await Emisor.findByPk(req.query.emisor_id);
            if (em) {
                const emResult = await getCreditosDisponibles(em);
                emisorIndividual = {
                    id: em.id,
                    rfc: em.rfc,
                    razon_social: em.razon_social,
                    disponibles: emResult.disponibles || 0,
                    totales: emResult.totales || 0,
                    utilizados: emResult.utilizados || 0
                };
            }
        }
        
        // Total de emisores y folios asignados localmente
        const totalEmisores = await Emisor.count();
        const emisoresRegistradosPac = await Emisor.count({ where: { registrado_pac: true } });
        const sumFoliosAsignados = await Emisor.sum('ultimos_folios_pac') || 0;

        res.json({
            success: pacResult.success,
            creditos_totales: pacResult.totales || 0,
            creditos_utilizados: pacResult.utilizados || 0,
            creditos_disponibles: pacResult.disponibles || 0,
            tipo_cuenta: pacResult.tipo_cuenta || 'Integrador',
            latencia_ms: pacResult.latencia_ms || 0,
            pac_nombre: pacResult.pac_nombre || 'PROFACT (PAC SAT No. 58073)',
            modo_prueba: pacResult.modo_prueba,
            rfc_cuenta: rfcIntegrador,
            emisor_individual: emisorIndividual,
            estadisticas_locales: {
                total_emisores: totalEmisores,
                emisores_registrados_pac: emisoresRegistradosPac,
                total_folios_en_emisores: sumFoliosAsignados
            },
            mensaje: pacResult.mensaje,
            message: pacResult.mensaje
        });
    } catch (error) {
        console.error('Error al obtener resumen de cuenta PAC:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al consultar cuenta del PAC: ' + error.message,
            mensaje: 'Error al consultar cuenta del PAC: ' + error.message
        });
    }
};

/**
 * Historial / Bitácora de folios agregados y asignados a emisores
 */
export const getHistorialFolios = async (req, res) => {
    try {
        const { emisor_id, empresa_id, limit = 50 } = req.query;
        const whereClause = {};

        if (emisor_id) whereClause.emisor_id = Number(emisor_id);
        if (empresa_id) whereClause.empresa_id = Number(empresa_id);

        const historial = await FolioHistorial.findAll({
            where: whereClause,
            include: [
                { model: Emisor, attributes: ['id', 'rfc', 'razon_social', 'empresa_id'] },
                { model: Empresa, attributes: ['id', 'nombre'] },
                { model: Usuario, attributes: ['id', 'nombre', 'email'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: Math.min(Number(limit) || 50, 200)
        });

        res.json(historial);
    } catch (error) {
        console.error('Error consultando historial de folios:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al consultar historial de asignación de folios',
            mensaje: 'Error al consultar historial de asignación de folios'
        });
    }
};

/**
 * Asigna / Transfiere folios a un emisor específico y registra en bitácora
 */
export const asignarFoliosAEmisor = async (req, res) => {
    const { emisor_id, no_timbres, notas } = req.body;
    
    if (!emisor_id) {
        return res.status(400).json({ 
            success: false, 
            message: 'Se requiere especificar el emisor a quien asignar folios.',
            mensaje: 'Se requiere especificar el emisor a quien asignar folios.'
        });
    }

    const cantidad = Number(no_timbres);
    if (!cantidad || cantidad <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'La cantidad de timbres a asignar debe ser mayor a 0.',
            mensaje: 'La cantidad de timbres a asignar debe ser mayor a 0.'
        });
    }

    try {
        const emisor = await Emisor.findByPk(emisor_id, {
            include: [{ model: Empresa, attributes: ['id', 'nombre'] }]
        });
        if (!emisor) {
            return res.status(404).json({ 
                success: false, 
                message: 'Emisor no encontrado.',
                mensaje: 'Emisor no encontrado.'
            });
        }

        const saldoAnterior = emisor.ultimos_folios_pac || 0;

        // Llamar servicio PAC SOAP
        const resultPac = await asignarTimbresPAC(emisor, cantidad);

        if (!resultPac.success) {
            return res.status(400).json({
                ...resultPac,
                message: resultPac.mensaje || 'Error devuelto por el PAC al asignar timbres',
                mensaje: resultPac.mensaje || 'Error devuelto por el PAC al asignar timbres'
            });
        }

        // Saldo nuevo calculado
        const saldoNuevo = saldoAnterior + cantidad;
        await emisor.update({ ultimos_folios_pac: saldoNuevo });

        // Registrar en la Bitácora / Historial
        const registroHistorial = await FolioHistorial.create({
            emisor_id: emisor.id,
            empresa_id: emisor.empresa_id || null,
            usuario_id: req.usuario?.id || null,
            cantidad: cantidad,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
            tipo_movimiento: 'ASIGNACION_PAC',
            notas: notas || `Asignación de ${cantidad} folios desde Configuración Global`,
            resultado_pac: resultPac.mensaje || 'Asignación exitosa'
        });

        res.json({
            success: true,
            message: `✅ Se asignaron exitosamente ${cantidad} folios al emisor "${emisor.razon_social}". Nuevo saldo: ${saldoNuevo} folios.`,
            mensaje: `✅ Se asignaron exitosamente ${cantidad} folios al emisor "${emisor.razon_social}". Nuevo saldo: ${saldoNuevo} folios.`,
            emisor_id: emisor.id,
            emisor_rfc: emisor.rfc,
            razon_social: emisor.razon_social,
            cantidad_asignada: cantidad,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
            historial_id: registroHistorial.id,
            fecha: registroHistorial.createdAt
        });
    } catch (error) {
        console.error('Error en asignarFoliosAEmisor:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error interno al asignar folios al emisor',
            mensaje: error.message || 'Error interno al asignar folios al emisor'
        });
    }
};

/**
 * Prueba de diagnóstico (Ping) con el PAC
 */
export const testConexionGlobal = async (req, res) => {
    try {
        const { emisor_id } = req.query;
        const rfcIntegrador = process.env.PAC_RFC_INTEGRADOR || 'LOMC791127F35';
        let emisor = null;
        if (emisor_id) {
            emisor = await Emisor.findByPk(emisor_id);
        }
        if (!emisor) {
            emisor = await Emisor.findOne({ where: { rfc: rfcIntegrador } });
        }
        if (!emisor) {
            emisor = await Emisor.findOne({ where: { modo_prueba: false } });
        }
        if (!emisor) {
            emisor = { rfc: rfcIntegrador, modo_prueba: false };
        }

        const result = await testConexionPACService(emisor);
        res.json({
            ...result,
            message: result.mensaje || result.message,
            mensaje: result.mensaje || result.message
        });
    } catch (error) {
        console.error('Error en test de conexión PAC:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al diagnosticar conexión con el PAC: ' + error.message,
            mensaje: 'Error al diagnosticar conexión con el PAC: ' + error.message
        });
    }
};

/**
 * Consulta de estatus fiscal de un UUID ante el SAT mediante el PAC
 */
export const consultarStatusSatGlobal = async (req, res) => {
    const { uuid, emisor_id } = req.body;
    if (!uuid || uuid.trim().length < 10) {
        return res.status(400).json({ 
            success: false, 
            message: 'Se requiere un UUID fiscal SAT válido (36 caracteres).',
            mensaje: 'Se requiere un UUID fiscal SAT válido (36 caracteres).'
        });
    }

    try {
        let emisor = null;
        if (emisor_id) {
            emisor = await Emisor.findByPk(emisor_id);
        }
        if (!emisor) {
            emisor = await Emisor.findOne();
        }
        if (!emisor) {
            emisor = { rfc: 'AAA010101AAA', modo_prueba: false };
        }

        const result = await consultarStatusSatPAC(emisor, uuid.trim());
        res.json({
            ...result,
            message: result.mensaje || result.message,
            mensaje: result.mensaje || result.message
        });
    } catch (error) {
        console.error('Error consultando estatus SAT global:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al consultar estatus SAT: ' + error.message,
            mensaje: 'Error al consultar estatus SAT: ' + error.message
        });
    }
};

/**
 * Consulta de peticiones pendientes de cancelación SAT
 */
export const consultarPeticionesPendientesGlobal = async (req, res) => {
    const { emisor_id } = req.params;
    try {
        const emisor = await Emisor.findByPk(emisor_id);
        if (!emisor) {
            return res.status(404).json({ 
                success: false, 
                message: 'Emisor no encontrado.',
                mensaje: 'Emisor no encontrado.'
            });
        }

        const result = await consultarPeticionesPendientesPAC(emisor);
        res.json({
            ...result,
            message: result.mensaje || result.message,
            mensaje: result.mensaje || result.message
        });
    } catch (error) {
        console.error('Error consultando peticiones SAT:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al consultar peticiones SAT: ' + error.message,
            mensaje: 'Error al consultar peticiones SAT: ' + error.message
        });
    }
};

/**
 * Consulta las credenciales activas del PAC
 */
export const getCredencialesPAC = async (req, res) => {
    try {
        const token = getPacToken();
        const rfc = getPacRfcIntegrador();
        const pacEnv = (process.env.PAC_ENV || 'production').toLowerCase();

        res.json({
            success: true,
            rfc_integrador: rfc,
            usuario_integrador: token,
            password_integrador: process.env.PAC_PROFACT_PASSWORD || token,
            modo_entorno: pacEnv === 'sandbox' || pacEnv === 'pruebas' ? 'sandbox' : 'production'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Guarda o actualiza las credenciales del PAC directamente desde la interfaz
 */
export const guardarCredencialesPAC = async (req, res) => {
    const { rfc_integrador, usuario_integrador, password_integrador, modo_entorno } = req.body;
    try {
        if (rfc_integrador && rfc_integrador.trim()) {
            process.env.PAC_RFC_INTEGRADOR = rfc_integrador.trim().toUpperCase();
        }
        if (usuario_integrador && usuario_integrador.trim()) {
            process.env.PAC_PROFACT_USER = usuario_integrador.trim();
        }
        if (password_integrador && password_integrador.trim()) {
            process.env.PAC_PROFACT_PASSWORD = password_integrador.trim();
        }
        if (modo_entorno && modo_entorno.trim()) {
            process.env.PAC_ENV = modo_entorno.trim();
        }

        // Intentar actualizar el archivo .env físico en disco para persistencia
        try {
            const envPath = path.resolve(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf-8');
                const updateVar = (key, val) => {
                    const regex = new RegExp(`^${key}=.*$`, 'm');
                    if (regex.test(envContent)) {
                        envContent = envContent.replace(regex, `${key}=${val}`);
                    } else {
                        envContent += `\n${key}=${val}`;
                    }
                };
                if (rfc_integrador) updateVar('PAC_RFC_INTEGRADOR', rfc_integrador.trim().toUpperCase());
                if (usuario_integrador) updateVar('PAC_PROFACT_USER', usuario_integrador.trim());
                if (password_integrador) updateVar('PAC_PROFACT_PASSWORD', password_integrador.trim());
                if (modo_entorno) updateVar('PAC_ENV', modo_entorno.trim());
                fs.writeFileSync(envPath, envContent);
            }
        } catch (e) {
            console.warn('[PAC Controller] Advertencia al persistir en .env físico:', e.message);
        }

        // Verificar inmediatamente la disponibilidad de timbres con el PAC
        const saldoVerificado = await getCreditosDisponibles({
            rfc: process.env.PAC_RFC_INTEGRADOR || 'LOMC791127F35',
            modo_prueba: false
        });

        res.json({
            success: true,
            message: 'Credenciales del PAC actualizadas y verificadas con éxito.',
            saldo_verificado: saldoVerificado
        });
    } catch (error) {
        console.error('Error al guardar credenciales PAC:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

