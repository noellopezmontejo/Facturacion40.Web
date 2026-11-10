import { PlanGlobal, Empresa } from '../models/index.js';

/**
 * Obtiene todos los planes globales disponibles
 */
export const getPlanes = async (req, res) => {
    try {
        const planes = await PlanGlobal.findAll({
            order: [['orden', 'ASC'], ['id', 'ASC']]
        });
        res.json(planes);
    } catch (error) {
        console.error('Error al obtener planes:', error);
        res.status(500).json({ message: 'Error al obtener los planes globales.', error: error.message });
    }
};

/**
 * Actualiza los precios globales y parámetros de los planes (Solo Administrador)
 */
export const updatePlanesGlobales = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden modificar precios globales.' });
        }

        const { planes } = req.body;
        if (!Array.isArray(planes) || planes.length === 0) {
            return res.status(400).json({ message: 'Se requiere una lista de planes válida para actualizar.' });
        }

        const planesActualizados = [];

        for (const p of planes) {
            let planItem = null;
            if (p.id) {
                planItem = await PlanGlobal.findByPk(p.id);
            } else if (p.codigo) {
                planItem = await PlanGlobal.findOne({ where: { codigo: p.codigo } });
            }

            if (planItem) {
                const updateData = {};
                if (p.nombre !== undefined) updateData.nombre = p.nombre;
                if (p.descripcion !== undefined) updateData.descripcion = p.descripcion;
                if (p.precio_mensual !== undefined) updateData.precio_mensual = parseFloat(p.precio_mensual) || 0;
                if (p.precio_anual !== undefined) updateData.precio_anual = parseFloat(p.precio_anual) || 0;
                if (p.folios_mensuales !== undefined) updateData.folios_mensuales = parseInt(p.folios_mensuales) || 0;
                if (p.max_emisores !== undefined) updateData.max_emisores = parseInt(p.max_emisores) || 1;
                if (p.max_usuarios !== undefined) updateData.max_usuarios = parseInt(p.max_usuarios) || 1;
                if (p.permite_cotizaciones !== undefined) updateData.permite_cotizaciones = Boolean(p.permite_cotizaciones);
                if (p.permite_ordenes_servicio !== undefined) updateData.permite_ordenes_servicio = Boolean(p.permite_ordenes_servicio);
                if (p.permite_carta_porte !== undefined) updateData.permite_carta_porte = Boolean(p.permite_carta_porte);
                if (p.permite_recurrentes !== undefined) updateData.permite_recurrentes = Boolean(p.permite_recurrentes);
                if (p.permite_descarga_sat !== undefined) updateData.permite_descarga_sat = Boolean(p.permite_descarga_sat);
                if (p.es_popular !== undefined) updateData.es_popular = Boolean(p.es_popular);
                if (p.activo !== undefined) updateData.activo = Boolean(p.activo);

                await planItem.update(updateData);
                planesActualizados.push(planItem);
            }
        }

        res.json({
            message: 'Precios y características globales de planes actualizados exitosamente.',
            planes: planesActualizados
        });
    } catch (error) {
        console.error('Error actualizando planes globales:', error);
        res.status(500).json({ message: 'Error al actualizar precios globales.', error: error.message });
    }
};

/**
 * Obtiene la suscripción de una empresa en específico, calculando si usa precio global o a discreción
 */
export const getSuscripcionEmpresa = async (req, res) => {
    try {
        const empresaId = req.params.id || req.usuario.empresa_id;

        // Validar que el usuario pertenezca a la empresa o sea Administrador
        if (req.usuario.rol !== 'Administrador' && Number(req.usuario.empresa_id) !== Number(empresaId)) {
            return res.status(403).json({ message: 'No tienes permiso para consultar esta suscripción.' });
        }

        const empresa = await Empresa.findByPk(empresaId, {
            include: [{
                model: PlanGlobal,
                as: 'planGlobal'
            }]
        });

        if (!empresa) {
            return res.status(404).json({ message: 'Espacio empresarial no encontrado.' });
        }

        const planGlobal = empresa.planGlobal || await PlanGlobal.findOne({ where: { codigo: empresa.plan_codigo || 'negocio' } });

        // Determinar precio efectivo
        const esPersonalizado = empresa.precio_personalizado !== null && empresa.precio_personalizado !== undefined;
        let precioEfectivo = 0;
        let precioGlobalReferencia = 0;

        if (planGlobal) {
            precioGlobalReferencia = empresa.periodo_suscripcion === 'anual'
                ? parseFloat(planGlobal.precio_anual)
                : parseFloat(planGlobal.precio_mensual);
        }

        if (esPersonalizado) {
            precioEfectivo = parseFloat(empresa.precio_personalizado);
        } else {
            precioEfectivo = precioGlobalReferencia;
        }

        // Calcular días restantes de suscripción
        const ahora = new Date();
        const fechaVence = empresa.fecha_vencimiento ? new Date(empresa.fecha_vencimiento) : null;
        let diasRestantes = null;
        let estadoCalculado = empresa.estado_suscripcion || 'activa';

        if (fechaVence) {
            const diffTime = fechaVence.getTime() - ahora.getTime();
            diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diasRestantes < 0) {
                // Si venció hace menos de 5 días, período de gracia
                if (diasRestantes >= -5) {
                    estadoCalculado = 'periodo_gracia';
                } else {
                    estadoCalculado = 'vencida';
                }
            }
        }

        res.json({
            empresa_id: empresa.id,
            empresa_nombre: empresa.nombre,
            plan_codigo: empresa.plan_codigo || 'negocio',
            plan_nombre: planGlobal?.nombre || 'Plan Personalizado',
            periodo_suscripcion: empresa.periodo_suscripcion || 'mensual',
            es_personalizado: esPersonalizado,
            precio_personalizado: esPersonalizado ? parseFloat(empresa.precio_personalizado) : null,
            precio_global_referencia: precioGlobalReferencia,
            precio_efectivo: precioEfectivo,
            folios_incluidos: empresa.folios_incluidos || planGlobal?.folios_mensuales || 200,
            fecha_inicio: empresa.fecha_inicio,
            fecha_vencimiento: empresa.fecha_vencimiento,
            dias_restantes: diasRestantes,
            estado_suscripcion: estadoCalculado,
            notas_suscripcion: empresa.notas_suscripcion,
            plan_detalles: planGlobal
        });
    } catch (error) {
        console.error('Error al obtener suscripción de empresa:', error);
        res.status(500).json({ message: 'Error al obtener datos de suscripción.', error: error.message });
    }
};

/**
 * Modifica a discreción la suscripción y precio de una empresa específica (Solo Administrador)
 */
export const updateSuscripcionEmpresa = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden gestionar suscripciones.' });
        }

        const empresaId = req.params.id;
        const empresa = await Empresa.findByPk(empresaId);
        if (!empresa) {
            return res.status(404).json({ message: 'Espacio empresarial no encontrado.' });
        }

        const {
            plan_codigo,
            periodo_suscripcion,
            usar_precio_personalizado,
            precio_personalizado,
            folios_incluidos,
            fecha_inicio,
            fecha_vencimiento,
            estado_suscripcion,
            notas_suscripcion
        } = req.body;

        const updateData = {};

        if (plan_codigo !== undefined) updateData.plan_codigo = plan_codigo;
        if (periodo_suscripcion !== undefined) updateData.periodo_suscripcion = periodo_suscripcion;

        if (usar_precio_personalizado === false) {
            // Eliminar precio a discreción para volver a heredar del precio global
            updateData.precio_personalizado = null;
        } else if (precio_personalizado !== undefined && precio_personalizado !== null && precio_personalizado !== '') {
            updateData.precio_personalizado = parseFloat(precio_personalizado);
        }

        if (folios_incluidos !== undefined) updateData.folios_incluidos = parseInt(folios_incluidos) || 0;
        if (fecha_inicio !== undefined) updateData.fecha_inicio = fecha_inicio ? new Date(fecha_inicio) : null;
        if (fecha_vencimiento !== undefined) updateData.fecha_vencimiento = fecha_vencimiento ? new Date(fecha_vencimiento) : null;
        if (estado_suscripcion !== undefined) updateData.estado_suscripcion = estado_suscripcion;
        if (notas_suscripcion !== undefined) updateData.notas_suscripcion = notas_suscripcion;

        await empresa.update(updateData);

        // Retornar la suscripción actualizada
        const planGlobal = await PlanGlobal.findOne({ where: { codigo: empresa.plan_codigo || 'negocio' } });

        res.json({
            message: 'Suscripción y condiciones actualizadas exitosamente a discreción.',
            empresa: {
                id: empresa.id,
                nombre: empresa.nombre,
                plan_codigo: empresa.plan_codigo,
                periodo_suscripcion: empresa.periodo_suscripcion,
                precio_personalizado: empresa.precio_personalizado,
                folios_incluidos: empresa.folios_incluidos,
                fecha_inicio: empresa.fecha_inicio,
                fecha_vencimiento: empresa.fecha_vencimiento,
                estado_suscripcion: empresa.estado_suscripcion,
                notas_suscripcion: empresa.notas_suscripcion,
                planGlobal
            }
        });
    } catch (error) {
        console.error('Error al actualizar suscripción de empresa:', error);
        res.status(500).json({ message: 'Error al actualizar suscripción.', error: error.message });
    }
};
