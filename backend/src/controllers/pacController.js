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
    consultarPeticionesPendientesPAC 
} from '../services/cfdiService.js';
import { Op } from 'sequelize';

/**
 * Resumen global del PAC (cuenta integradora Profact)
 */
export const getResumenCuentaIntegrador = async (req, res) => {
    try {
        // Buscar un emisor de referencia (cualquiera activo) para consultar el saldo maestro
        let emisorRef = await Emisor.findOne({ order: [['id', 'ASC']] });
        if (!emisorRef) {
            emisorRef = { rfc: 'AAA010101AAA', modo_prueba: false };
        }

        const pacResult = await getCreditosDisponibles(emisorRef);
        
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
