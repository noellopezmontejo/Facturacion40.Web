import { PlanGlobal, Empresa, PagoSuscripcion, Usuario, ConfiguracionPlataforma } from '../models/index.js';
import axios from 'axios';

const maskToken = (token) => {
    if (!token || typeof token !== 'string') return '';
    const trimmed = token.trim();
    if (trimmed.length <= 12) return '••••••••';
    return `${trimmed.slice(0, 8)}••••••••${trimmed.slice(-4)}`;
};

/**
 * Obtiene la configuración activa de recepción de pagos (Mercado Pago y Banorte)
 * priorizando la tabla configuracion_plataforma en BD con fallback a variables de entorno.
 */
const obtenerConfigPagos = async () => {
    let row = await ConfiguracionPlataforma.findOne({ order: [['id', 'ASC']] }).catch(() => null);
    if (!row) {
        row = await ConfiguracionPlataforma.create({
            mp_activo: true,
            mp_modo: 'produccion',
            mp_access_token: process.env.MERCADOPAGO_ACCESS_TOKEN || null,
            mp_public_key: process.env.MERCADOPAGO_PUBLIC_KEY || null,
            banorte_activo: true,
            banco_nombre: process.env.BANCO_NOMBRE || 'BANORTE',
            banco_beneficiario: process.env.BANCO_BENEFICIARIO || 'Net Consultores',
            banco_clabe: process.env.BANCO_CLABE || '072 180 00000000000 0',
            banco_cuenta: process.env.BANCO_CUENTA || '0458923412'
        }).catch(() => null);
    }

    return {
        row,
        mp_activo: row ? Boolean(row.mp_activo) : true,
        mp_modo: row?.mp_modo || 'produccion',
        mp_access_token: row?.mp_access_token || process.env.MERCADOPAGO_ACCESS_TOKEN || '',
        mp_public_key: row?.mp_public_key || process.env.MERCADOPAGO_PUBLIC_KEY || '',
        mp_webhook_secret: row?.mp_webhook_secret || '',
        banorte_activo: row ? Boolean(row.banorte_activo) : true,
        banco_nombre: row?.banco_nombre || process.env.BANCO_NOMBRE || 'BANORTE',
        banco_beneficiario: row?.banco_beneficiario || process.env.BANCO_BENEFICIARIO || 'Net Consultores',
        banco_clabe: row?.banco_clabe || process.env.BANCO_CLABE || '072 180 00000000000 0',
        banco_cuenta: row?.banco_cuenta || process.env.BANCO_CUENTA || '0458923412'
    };
};

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
 * Resuelve el ID de empresa objetivo, permitiendo al Administrador consultar o operar sobre
 * la empresa seleccionada en el selector superior o la primera empresa registrada.
 */
const resolveEmpresaId = async (req) => {
    let empresaId = req.usuario?.empresa_id || null;

    if (req.usuario?.rol === 'Administrador') {
        const paramId = req.query?.empresa_id || req.query?.empresaId || req.body?.empresa_id || req.body?.empresaId;
        if (paramId) {
            return Number(paramId);
        }
    }

    if (!empresaId && req.usuario?.id) {
        const userDb = await Usuario.findByPk(req.usuario.id);
        if (userDb?.empresa_id) {
            empresaId = userDb.empresa_id;
        }
    }

    if (!empresaId && req.usuario?.rol === 'Administrador') {
        const firstEmpresa = await Empresa.findOne({ order: [['id', 'ASC']] });
        if (firstEmpresa) {
            empresaId = firstEmpresa.id;
        }
    }

    return empresaId;
};

/**
 * Consulta la suscripción propia de la empresa del usuario en sesión
 */
export const getMiSuscripcion = async (req, res) => {
    try {
        const empresaId = await resolveEmpresaId(req);
        if (!empresaId) {
            return res.status(400).json({ message: 'No se encontró un espacio empresarial asociado a este usuario.' });
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

        // Datos de cuenta Banorte y métodos activos desde la configuración global de la plataforma
        const configPagos = await obtenerConfigPagos();
        const datosBancarios = {
            banco: configPagos.banco_nombre,
            beneficiario: configPagos.banco_beneficiario,
            clabe: configPagos.banco_clabe,
            cuenta: configPagos.banco_cuenta,
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
            metodos_pago: {
                mercadopago_activo: configPagos.mp_activo,
                mercadopago_configurado: Boolean(configPagos.mp_access_token),
                mercadopago_modo: configPagos.mp_modo,
                banorte_activo: configPagos.banorte_activo
            },
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
        const empresaId = await resolveEmpresaId(req);
        if (!empresaId) {
            return res.status(400).json({ message: 'No se encontró un espacio empresarial asociado a este usuario.' });
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
        const empresaId = await resolveEmpresaId(req);
        if (!empresaId) {
            return res.status(400).json({ message: 'No se encontró un espacio empresarial asociado a este usuario.' });
        }
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
        const configPagos = await obtenerConfigPagos();

        if (!configPagos.mp_activo) {
            return res.status(400).json({ message: 'Los pagos en línea con Mercado Pago se encuentran deshabilitados temporalmente por el administrador.' });
        }

        const mpAccessToken = configPagos.mp_access_token;
        const externalReference = `SUSC-${empresa.id}-${Date.now()}`;

        if (!mpAccessToken) {
            // Modo simulación informativa si aún no configuran el Access Token desde el módulo de Configuración
            return res.json({
                modo_simulacion: true,
                message: 'Falta configurar el Access Token de Mercado Pago. Ve a Configuración > Mercado Pago y Bancos para activarlo.',
                monto: monto,
                periodo: periodo,
                referencia: externalReference,
                init_point: null
            });
        }

        // Registrar intención de pago
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

        // Crear la preferencia real en la API de Mercado Pago
        const clientOrigin = req.headers.origin || 'http://localhost:3000';
        const proto = req.headers['x-forwarded-proto'] || req.protocol;
        const apiHost = `${proto}://${req.get('host')}`;

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

        const checkoutUrl = configPagos.mp_modo === 'sandbox'
            ? (mpResponse.data.sandbox_init_point || mpResponse.data.init_point)
            : mpResponse.data.init_point;

        res.json({
            modo_simulacion: false,
            modo: configPagos.mp_modo,
            init_point: checkoutUrl,
            sandbox_init_point: mpResponse.data.sandbox_init_point,
            preference_id: mpResponse.data.id,
            monto: monto,
            pago_id: nuevoPago.id
        });
    } catch (error) {
        console.error('Error al crear preferencia Mercado Pago:', error?.response?.data || error);
        res.status(500).json({ message: 'Error al inicializar pago con Mercado Pago.', error: error?.response?.data?.message || error.message });
    }
};

/**
 * Webhook para recibir notificaciones automáticas de Mercado Pago
 */
export const webhookMercadoPago = async (req, res) => {
    try {
        const type = req.body?.type || req.query?.type || req.query?.topic;
        const paymentId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
        console.log('[Webhook Mercado Pago] Recibido:', type, paymentId);

        const configPagos = await obtenerConfigPagos();
        const mpAccessToken = configPagos.mp_access_token;

        if (type === 'payment' && paymentId && mpAccessToken) {
            const paymentResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${mpAccessToken}` }
            });

            const payment = paymentResponse.data;
            if (payment.status === 'approved') {
                const extRef = payment.external_reference;
                const pago = await PagoSuscripcion.findOne({ where: { referencia_pago: extRef } });
                const paidAmount = parseFloat(payment.transaction_amount || 0);
                const expectedAmount = parseFloat(pago?.monto || 0);
                if (pago && pago.estado !== 'aprobado' && (expectedAmount <= 0 || paidAmount >= expectedAmount - 1)) {
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
            where: { estado: 'pendiente', metodo_pago: 'transferencia_banorte' },
            include: [
                { model: Empresa, attributes: ['id', 'nombre'] },
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

/**
 * Obtiene la configuración global de pasarelas de pago (Mercado Pago y Banorte) (Solo Administrador)
 */
export const getConfiguracionPagos = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
        }

        const config = await obtenerConfigPagos();

        res.json({
            mp_activo: config.mp_activo,
            mp_modo: config.mp_modo,
            mp_token_configurado: Boolean(config.mp_access_token),
            mp_token_preview: maskToken(config.mp_access_token),
            mp_public_key: config.mp_public_key || '',
            mp_webhook_secret: config.mp_webhook_secret || '',
            banorte_activo: config.banorte_activo,
            banco_nombre: config.banco_nombre,
            banco_beneficiario: config.banco_beneficiario,
            banco_clabe: config.banco_clabe,
            banco_cuenta: config.banco_cuenta
        });
    } catch (error) {
        console.error('Error al obtener configuración de pagos:', error);
        res.status(500).json({ message: 'Error al obtener la configuración de pasarelas.', error: error.message });
    }
};

/**
 * Actualiza la configuración global de Mercado Pago y cuenta bancaria Banorte (Solo Administrador)
 */
export const updateConfiguracionPagos = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
        }

        const {
            mp_activo,
            mp_modo,
            mp_access_token,
            limpiar_mp_token,
            mp_public_key,
            mp_webhook_secret,
            banorte_activo,
            banco_nombre,
            banco_beneficiario,
            banco_clabe,
            banco_cuenta
        } = req.body;

        const config = await obtenerConfigPagos();
        let row = config.row;

        if (!row) {
            row = await ConfiguracionPlataforma.create({});
        }

        const updateData = {};
        if (mp_activo !== undefined) updateData.mp_activo = Boolean(mp_activo);
        if (mp_modo !== undefined) updateData.mp_modo = mp_modo === 'sandbox' ? 'sandbox' : 'produccion';
        if (mp_public_key !== undefined) updateData.mp_public_key = mp_public_key.trim();
        if (mp_webhook_secret !== undefined) updateData.mp_webhook_secret = mp_webhook_secret.trim();

        if (limpiar_mp_token === true) {
            updateData.mp_access_token = null;
            delete process.env.MERCADOPAGO_ACCESS_TOKEN;
        } else if (mp_access_token && typeof mp_access_token === 'string' && mp_access_token.trim() !== '') {
            updateData.mp_access_token = mp_access_token.trim();
            process.env.MERCADOPAGO_ACCESS_TOKEN = mp_access_token.trim();
        }

        if (banorte_activo !== undefined) updateData.banorte_activo = Boolean(banorte_activo);
        if (banco_nombre !== undefined) updateData.banco_nombre = banco_nombre.trim() || 'BANORTE';
        if (banco_beneficiario !== undefined) updateData.banco_beneficiario = banco_beneficiario.trim();
        if (banco_clabe !== undefined) updateData.banco_clabe = banco_clabe.trim();
        if (banco_cuenta !== undefined) updateData.banco_cuenta = banco_cuenta.trim();

        await row.update(updateData);

        const refreshed = await obtenerConfigPagos();
        res.json({
            message: 'Configuración de recepción de pagos guardada exitosamente.',
            config: {
                mp_activo: refreshed.mp_activo,
                mp_modo: refreshed.mp_modo,
                mp_token_configurado: Boolean(refreshed.mp_access_token),
                mp_token_preview: maskToken(refreshed.mp_access_token),
                mp_public_key: refreshed.mp_public_key || '',
                mp_webhook_secret: refreshed.mp_webhook_secret || '',
                banorte_activo: refreshed.banorte_activo,
                banco_nombre: refreshed.banco_nombre,
                banco_beneficiario: refreshed.banco_beneficiario,
                banco_clabe: refreshed.banco_clabe,
                banco_cuenta: refreshed.banco_cuenta
            }
        });
    } catch (error) {
        console.error('Error al actualizar configuración de pagos:', error);
        res.status(500).json({ message: 'Error al guardar la configuración de pagos.', error: error.message });
    }
};

/**
 * Prueba la validez del Access Token contra la API oficial de Mercado Pago (Solo Administrador)
 */
export const probarMercadoPago = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
        }

        const { mp_access_token } = req.body;
        const config = await obtenerConfigPagos();
        const tokenToTest = (mp_access_token && mp_access_token.trim()) ? mp_access_token.trim() : config.mp_access_token;

        if (!tokenToTest) {
            return res.status(400).json({
                ok: false,
                message: 'No hay ningún Access Token ingresado ni guardado para probar.'
            });
        }

        const mpResponse = await axios.get('https://api.mercadopago.com/users/me', {
            headers: {
                'Authorization': `Bearer ${tokenToTest}`
            },
            timeout: 10000
        });

        const account = mpResponse.data;
        const esTokenPrueba = tokenToTest.startsWith('TEST-');

        res.json({
            ok: true,
            message: `Conexión exitosa con Mercado Pago (${esTokenPrueba ? 'Entorno Sandbox / Pruebas' : 'Entorno Producción'}).`,
            es_sandbox: esTokenPrueba,
            cuenta: {
                id: account.id,
                nickname: account.nickname,
                email: account.email,
                nombre: `${account.first_name || ''} ${account.last_name || ''}`.trim() || account.nickname,
                site_id: account.site_id,
                country_id: account.country_id
            }
        });
    } catch (error) {
        const status = error?.response?.status;
        const detail = error?.response?.data?.message || error.message;
        console.warn('[Mercado Pago Test] Falló validación:', status, detail);
        res.status(400).json({
            ok: false,
            message: status === 401
                ? 'Access Token inválido o expirado (Error 401 de Mercado Pago). Verifica haber copiado el "Access Token" y no la "Public Key".'
                : `No se pudo validar el token con Mercado Pago: ${detail}`,
            detalle: detail
        });
    }
};



