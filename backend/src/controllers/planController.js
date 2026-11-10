import { PlanGlobal, Empresa, PagoSuscripcion, Usuario } from '../models/index.js';
import axios from 'axios';

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

/**
 * Consulta la suscripción propia de la empresa del usuario en sesión
 */
export const getMiSuscripcion = async (req, res) => {
    try {
        const empresaId = req.usuario.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asignada.' });
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

        const esPersonalizado = empresa.precio_personalizado !== null && empresa.precio_personalizado !== undefined;
        let precioMensual = planGlobal ? parseFloat(planGlobal.precio_mensual) : 349;
        let precioAnual = planGlobal ? parseFloat(planGlobal.precio_anual) : 3490;

        if (esPersonalizado) {
            precioMensual = parseFloat(empresa.precio_personalizado);
            // Si tiene precio personalizado, el anual suele ser el equivalente a 10 meses (2 meses gratis)
            precioAnual = Math.round(precioMensual * 10);
        }

        const periodoActual = empresa.periodo_suscripcion || 'mensual';
        const precioActual = periodoActual === 'anual' ? precioAnual : precioMensual;

        // Calcular días restantes y estado real
        const ahora = new Date();
        const fechaVence = empresa.fecha_vencimiento ? new Date(empresa.fecha_vencimiento) : null;
        let diasRestantes = null;
        let estadoCalculado = empresa.estado_suscripcion || 'activa';

        if (fechaVence) {
            const diffTime = fechaVence.getTime() - ahora.getTime();
            diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diasRestantes < 0) {
                if (diasRestantes >= -5) {
                    estadoCalculado = 'periodo_gracia';
                } else {
                    estadoCalculado = 'vencida';
                }
            } else {
                estadoCalculado = 'activa';
            }
        }

        // Historial de pagos recientes de la empresa
        const historialPagos = await PagoSuscripcion.findAll({
            where: { empresa_id: empresaId },
            include: [
                { model: Usuario, attributes: ['id', 'nombre', 'email'] },
                { model: PlanGlobal, as: 'planGlobal', attributes: ['codigo', 'nombre'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        // Datos de cuenta Banorte para transferencias
        const datosBancarios = {
            banco: process.env.BANCO_NOMBRE || 'BANORTE',
            beneficiario: process.env.BANCO_BENEFICIARIO || 'Net Consultores',
            clabe: process.env.BANCO_CLABE || '072 180 00000000000 0',
            cuenta: process.env.BANCO_CUENTA || '0458923412',
            referencia_sugerida: `ESP-${String(empresa.id).padStart(4, '0')}`
        };

        res.json({
            empresa: {
                id: empresa.id,
                nombre: empresa.nombre,
                plan_codigo: empresa.plan_codigo || 'negocio',
                periodo_suscripcion: periodoActual,
                folios_incluidos: empresa.folios_incluidos || planGlobal?.folios_mensuales || 200,
                fecha_inicio: empresa.fecha_inicio,
                fecha_vencimiento: empresa.fecha_vencimiento,
                dias_restantes: diasRestantes,
                estado_suscripcion: estadoCalculado,
                es_personalizado: esPersonalizado,
                precio_personalizado: esPersonalizado ? parseFloat(empresa.precio_personalizado) : null,
                precio_mensual: precioMensual,
                precio_anual: precioAnual,
                precio_actual: precioActual
            },
            plan: planGlobal,
            datos_bancarios: datosBancarios,
            historial_pagos: historialPagos
        });
    } catch (error) {
        console.error('Error al obtener mi suscripción:', error);
        res.status(500).json({ message: 'Error al consultar la suscripción.', error: error.message });
    }
};

/**
 * Registra un comprobante de transferencia bancaria BANORTE subido por el cliente
 */
export const reportarPagoTransferencia = async (req, res) => {
    try {
        const empresaId = req.usuario.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asignada.' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'Es obligatorio adjuntar el archivo del comprobante de pago.' });
        }

        const { plan_codigo, periodo, monto, referencia_pago } = req.body;
        const empresa = await Empresa.findByPk(empresaId);
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }

        const diasExtendidos = periodo === 'anual' ? 365 : 30;
        const comprobanteUrl = `/storage/comprobantes/${file.filename}`;

        const nuevoPago = await PagoSuscripcion.create({
            empresa_id: empresaId,
            usuario_id: req.usuario.id,
            plan_codigo: plan_codigo || empresa.plan_codigo || 'negocio',
            periodo: periodo || empresa.periodo_suscripcion || 'mensual',
            monto: parseFloat(monto) || 0,
            metodo_pago: 'transferencia_banorte',
            estado: 'pendiente',
            referencia_pago: referencia_pago || `ESP-${String(empresaId).padStart(4, '0')}`,
            comprobante_url: comprobanteUrl,
            dias_extendidos: diasExtendidos
        });

        res.status(201).json({
            message: 'Comprobante de transferencia Banorte enviado exitosamente. En breve el administrador validará tu pago.',
            pago: nuevoPago
        });
    } catch (error) {
        console.error('Error al reportar transferencia:', error);
        res.status(500).json({ message: 'Error al registrar el comprobante de pago.', error: error.message });
    }
};

/**
 * Crea una preferencia de pago en Mercado Pago (Tarjetas, OXXO, SPEI inmediato)
 */
export const crearPreferenciaMercadoPago = async (req, res) => {
    try {
        const empresaId = req.usuario.empresa_id;
        const empresa = await Empresa.findByPk(empresaId, {
            include: [{ model: PlanGlobal, as: 'planGlobal' }]
        });

        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada.' });
        }

        const { periodo = 'mensual', plan_codigo } = req.body;
        const targetPlanCodigo = plan_codigo || empresa.plan_codigo || 'negocio';
        const plan = await PlanGlobal.findOne({ where: { codigo: targetPlanCodigo } });

        // Determinar monto
        const esPersonalizado = empresa.precio_personalizado !== null && empresa.precio_personalizado !== undefined;
        let monto = 0;
        if (esPersonalizado) {
            const precioBase = parseFloat(empresa.precio_personalizado);
            monto = periodo === 'anual' ? (precioBase * 10) : precioBase;
        } else if (plan) {
            monto = periodo === 'anual' ? parseFloat(plan.precio_anual) : parseFloat(plan.precio_mensual);
        } else {
            monto = periodo === 'anual' ? 3490 : 349;
        }

        const diasExtendidos = periodo === 'anual' ? 365 : 30;
        const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

        // Registrar registro de intención de pago
        const externalReference = `SUSC-${empresa.id}-${Date.now()}`;
        const nuevoPago = await PagoSuscripcion.create({
            empresa_id: empresa.id,
            usuario_id: req.usuario.id,
            plan_codigo: targetPlanCodigo,
            periodo: periodo,
            monto: monto,
            metodo_pago: 'mercadopago',
            estado: 'pendiente',
            referencia_pago: externalReference,
            dias_extendidos: diasExtendidos
        });

        if (!mpAccessToken) {
            // Modo simulación informativa / Sandbox si aún no colocan sus credenciales
            return res.json({
                modo_simulacion: true,
                message: 'Mercado Pago listo. Configura MERCADOPAGO_ACCESS_TOKEN en tu .env para pasarelas en producción.',
                monto: monto,
                periodo: periodo,
                referencia: externalReference,
                pago_id: nuevoPago.id,
                init_point: null
            });
        }

        // Crear la preferencia real en la API de Mercado Pago
        const clientOrigin = req.headers.origin || 'http://localhost:3000';
        const apiHost = req.protocol + '://' + req.get('host');

        const mpBody = {
            items: [
                {
                    title: `Suscripción ${plan?.nombre || 'Facturación 4.0'} (${periodo.toUpperCase()})`,
                    description: `Servicio de facturación CFDI 4.0 - Espacio: ${empresa.nombre}`,
                    quantity: 1,
                    currency_id: 'MXN',
                    unit_price: parseFloat(monto)
                }
            ],
            payer: {
                name: req.usuario.nombre || 'Cliente',
                email: req.usuario.email || 'cliente@facturacion40.com'
            },
            back_urls: {
                success: `${clientOrigin}/mi-suscripcion?pago_status=success&ref=${externalReference}`,
                failure: `${clientOrigin}/mi-suscripcion?pago_status=failure&ref=${externalReference}`,
                pending: `${clientOrigin}/mi-suscripcion?pago_status=pending&ref=${externalReference}`
            },
            auto_return: 'approved',
            external_reference: externalReference,
            notification_url: `${apiHost}/api/planes/webhook-mp`
        };

        const mpResponse = await axios.post('https://api.mercadopago.com/checkout/preferences', mpBody, {
            headers: {
                'Authorization': `Bearer ${mpAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({
            modo_simulacion: false,
            init_point: mpResponse.data.init_point,
            sandbox_init_point: mpResponse.data.sandbox_init_point,
            preference_id: mpResponse.data.id,
            monto: monto,
            pago_id: nuevoPago.id
        });
    } catch (error) {
        console.error('Error al crear preferencia Mercado Pago:', error?.response?.data || error);
        res.status(500).json({ message: 'Error al inicializar pago con Mercado Pago.', error: error.message });
    }
};

/**
 * Webhook para recibir notificaciones automáticas de Mercado Pago
 */
export const webhookMercadoPago = async (req, res) => {
    try {
        const { type, data } = req.body;
        console.log('[Webhook Mercado Pago] Recibido:', type, data);

        if (type === 'payment' && data?.id && process.env.MERCADOPAGO_ACCESS_TOKEN) {
            const paymentResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${data.id}`, {
                headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
            });

            const payment = paymentResponse.data;
            if (payment.status === 'approved') {
                const extRef = payment.external_reference;
                const pago = await PagoSuscripcion.findOne({ where: { referencia_pago: extRef } });
                if (pago && pago.estado !== 'aprobado') {
                    pago.estado = 'aprobado';
                    pago.fecha_aprobacion = new Date();
                    pago.notas_admin = `Aprobado automáticamente por Mercado Pago ID: ${payment.id}`;
                    await pago.save();

                    // Extender suscripción
                    const empresa = await Empresa.findByPk(pago.empresa_id);
                    if (empresa) {
                        const dias = pago.dias_extendidos || 30;
                        const baseDate = (empresa.fecha_vencimiento && new Date(empresa.fecha_vencimiento) > new Date())
                            ? new Date(empresa.fecha_vencimiento)
                            : new Date();
                        empresa.fecha_vencimiento = new Date(baseDate.getTime() + (dias * 24 * 60 * 60 * 1000));
                        empresa.estado_suscripcion = 'activa';
                        empresa.periodo_suscripcion = pago.periodo;
                        await empresa.save();
                    }
                }
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error en webhook de Mercado Pago:', error);
        res.status(500).send('Error');
    }
};

/**
 * Obtiene lista de comprobantes pendientes de validación para el Administrador
 */
export const getComprobantesPendientes = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
        }

        const pendientes = await PagoSuscripcion.findAll({
            where: { estado: 'pendiente' },
            include: [
                { model: Empresa, attributes: ['id', 'nombre', 'rfc', 'telefono', 'email'] },
                { model: Usuario, attributes: ['id', 'nombre', 'email'] },
                { model: PlanGlobal, as: 'planGlobal', attributes: ['codigo', 'nombre'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(pendientes);
    } catch (error) {
        console.error('Error al obtener comprobantes pendientes:', error);
        res.status(500).json({ message: 'Error al obtener comprobantes.', error: error.message });
    }
};

/**
 * Aprueba un pago por transferencia y extiende automáticamente la vigencia del espacio
 */
export const aprobarPagoSuscripcion = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
        }

        const { id } = req.params;
        const { notas_admin } = req.body;

        const pago = await PagoSuscripcion.findByPk(id);
        if (!pago) {
            return res.status(404).json({ message: 'Registro de pago no encontrado.' });
        }

        if (pago.estado === 'aprobado') {
            return res.status(400).json({ message: 'Este pago ya ha sido aprobado anteriormente.' });
        }

        const empresa = await Empresa.findByPk(pago.empresa_id);
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa asociada no encontrada.' });
        }

        const dias = pago.dias_extendidos || (pago.periodo === 'anual' ? 365 : 30);
        const baseDate = (empresa.fecha_vencimiento && new Date(empresa.fecha_vencimiento) > new Date())
            ? new Date(empresa.fecha_vencimiento)
            : new Date();

        const nuevaFechaVencimiento = new Date(baseDate.getTime() + (dias * 24 * 60 * 60 * 1000));

        empresa.fecha_vencimiento = nuevaFechaVencimiento;
        empresa.estado_suscripcion = 'activa';
        empresa.periodo_suscripcion = pago.periodo;
        if (pago.plan_codigo) empresa.plan_codigo = pago.plan_codigo;
        await empresa.save();

        pago.estado = 'aprobado';
        pago.fecha_aprobacion = new Date();
        pago.notas_admin = notas_admin || 'Aprobado por administración';
        await pago.save();

        res.json({
            message: `Pago aprobado con éxito. La suscripción de ${empresa.nombre} se extendió por ${dias} días (nueva vigencia: ${nuevaFechaVencimiento.toLocaleDateString()}).`,
            pago,
            empresa
        });
    } catch (error) {
        console.error('Error al aprobar pago:', error);
        res.status(500).json({ message: 'Error al aprobar el pago.', error: error.message });
    }
};

/**
 * Rechaza un comprobante de pago
 */
export const rechazarPagoSuscripcion = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
        }

        const { id } = req.params;
        const { motivo } = req.body;

        const pago = await PagoSuscripcion.findByPk(id);
        if (!pago) {
            return res.status(404).json({ message: 'Registro de pago no encontrado.' });
        }

        pago.estado = 'rechazado';
        pago.notas_admin = motivo || 'Comprobante no válido o no localizado en la cuenta bancaria.';
        await pago.save();

        res.json({
            message: 'Comprobante marcado como rechazado.',
            pago
        });
    } catch (error) {
        console.error('Error al rechazar pago:', error);
        res.status(500).json({ message: 'Error al rechazar el pago.', error: error.message });
    }
};


