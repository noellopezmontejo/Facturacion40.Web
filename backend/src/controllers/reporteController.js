import { Documento, DetalleDocumento, Concepto, Impuesto, Pago, PagoDocumento, Receptor, Emisor, Empresa, DocumentoRecibido } from '../models/index.js';
import { Op } from 'sequelize';

const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

export const getReporteCompleto = async (req, res) => {
    try {
        const { empresaId, emisorId, fechaInicio, fechaFin } = req.query;

        // 1. Determinar el espacio de trabajo (Empresa)
        let targetEmpresaId = req.usuario.empresa_id;

        if (req.usuario.rol === 'Administrador') {
            if (empresaId) {
                targetEmpresaId = Number(empresaId);
            } else if (emisorId && emisorId !== 'TODOS') {
                const emisorObj = await Emisor.findByPk(emisorId);
                if (emisorObj) targetEmpresaId = emisorObj.empresa_id;
            } else {
                const firstEmpresa = await Empresa.findOne({ order: [['id', 'ASC']] });
                if (firstEmpresa) targetEmpresaId = firstEmpresa.id;
            }
        }

        if (!targetEmpresaId) {
            return res.status(400).json({ message: 'No se encontró un espacio de trabajo válido.' });
        }

        const empresa = await Empresa.findByPk(targetEmpresaId);
        if (!empresa) {
            return res.status(404).json({ message: 'Espacio de trabajo no encontrado.' });
        }

        // 2. Obtener los emisores pertenecientes a este espacio de trabajo
        const emisoresEmpresa = await Emisor.findAll({
            where: { empresa_id: targetEmpresaId },
            attributes: ['id', 'rfc', 'razon_social', 'regimen_fiscal', 'codigo_postal']
        });

        const todosEmisorIds = emisoresEmpresa.map(e => e.id);

        let targetEmisorIds = todosEmisorIds;
        if (emisorId && emisorId !== 'TODOS') {
            const selectedId = Number(emisorId);
            if (todosEmisorIds.includes(selectedId)) {
                targetEmisorIds = [selectedId];
            }
        }

        // 3. Rango de Fechas
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        let startDate = startOfMonth;
        let endDate = endOfMonth;

        if (fechaInicio) {
            startDate = new Date(fechaInicio + 'T00:00:00.000Z');
        }
        if (fechaFin) {
            endDate = new Date(fechaFin + 'T23:59:59.999Z');
        }

        // 4. Consultar Documentos Emitidos en el Periodo
        const documentosEmitidos = await Documento.findAll({
            where: {
                emisor_id: { [Op.in]: targetEmisorIds },
                fecha: { [Op.between]: [startDate, endDate] }
            },
            include: [
                { model: Receptor, attributes: ['id', 'rfc', 'razon_social'] },
                {
                    model: DetalleDocumento,
                    as: 'detalles',
                    include: [{ model: Concepto, include: [Impuesto] }]
                }
            ],
            order: [['fecha', 'DESC']]
        });

        // 5. Consultar Pagos / Complementos REP en el Periodo
        const pagosPeriodo = await Pago.findAll({
            where: {
                emisor_id: { [Op.in]: targetEmisorIds },
                fecha_pago: { [Op.between]: [startDate, endDate] }
            },
            include: [
                { model: Receptor, attributes: ['id', 'rfc', 'razon_social'] },
                {
                    model: Documento,
                    attributes: ['id', 'serie', 'folio', 'uuid', 'total', 'moneda', 'metodo_pago'],
                    through: { attributes: ['num_parcialidad', 'imp_saldo_ant', 'imp_pagado', 'imp_saldo_insoluto'] }
                },
                { model: Documento, as: 'DocumentoREP', attributes: ['id', 'serie', 'folio', 'uuid', 'estado_sat'] }
            ],
            order: [['fecha_pago', 'DESC']]
        });

        // 6. Consultar Cartera Pendiente (Aging de Cuentas por Cobrar)
        // Todas las facturas de ingreso PPD con saldo insoluto vigente
        const facturasPendientesPPD = await Documento.findAll({
            where: {
                emisor_id: { [Op.in]: targetEmisorIds },
                tipo_comprobante: 'I',
                metodo_pago: 'PPD',
                estado_sat: { [Op.ne]: 'Cancelado' },
                [Op.or]: [
                    { saldo_insoluto: { [Op.gt]: 0.01 } },
                    { saldo_insoluto: null }
                ]
            },
            include: [{ model: Receptor, attributes: ['id', 'rfc', 'razon_social'] }],
            order: [['fecha', 'ASC']]
        });

        // Clasificar documentos por tipo
        const facturasIngreso = documentosEmitidos.filter(d => d.tipo_comprobante === 'I');
        const notasCredito = documentosEmitidos.filter(d => d.tipo_comprobante === 'E');
        const complementosREP = documentosEmitidos.filter(d => d.tipo_comprobante === 'P');
        const trasladosCP = documentosEmitidos.filter(d => d.tipo_comprobante === 'T');

        // Métricas de Facturación (Ingresos)
        const facturasVigentes = facturasIngreso.filter(d => d.estado_sat !== 'Cancelado');
        const facturasCanceladas = facturasIngreso.filter(d => d.estado_sat === 'Cancelado');

        const totalFacturadoVigente = round2(facturasVigentes.reduce((acc, d) => acc + parseFloat(d.total || 0), 0));
        const subtotalFacturadoVigente = round2(facturasVigentes.reduce((acc, d) => acc + parseFloat(d.subtotal || 0), 0));
        const totalTrasladosFacturados = round2(facturasVigentes.reduce((acc, d) => acc + parseFloat(d.total_impuestos_trasladados || 0), 0));
        const totalRetencionesFacturadas = round2(facturasVigentes.reduce((acc, d) => acc + parseFloat(d.total_impuestos_retenidos || 0), 0));
        const totalCancelado = round2(facturasCanceladas.reduce((acc, d) => acc + parseFloat(d.total || 0), 0));

        // Desglose PUE vs PPD en facturas de ingreso vigentes
        const facturasPUE = facturasVigentes.filter(d => (d.metodo_pago || 'PUE') === 'PUE');
        const facturasPPD = facturasVigentes.filter(d => d.metodo_pago === 'PPD');

        const totalPUE = round2(facturasPUE.reduce((acc, d) => acc + parseFloat(d.total || 0), 0));
        const totalPPD = round2(facturasPPD.reduce((acc, d) => acc + parseFloat(d.total || 0), 0));

        // Cobranza del Periodo:
        // Pagos activos aplicados a facturas + Facturas PUE del periodo
        const pagosVigentes = pagosPeriodo.filter(p => p.estado !== 'Cancelado');
        const totalCobradoREPs = round2(pagosVigentes.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0));
        const totalCobradoEfectivo = round2(totalPUE + totalCobradoREPs);

        // Formas de Pago en Cobranza
        const formasPagoNombres = {
            '01': '01 - Efectivo',
            '02': '02 - Cheque nominativo',
            '03': '03 - Transferencia electrónica (SPEI)',
            '04': '04 - Tarjeta de crédito',
            '28': '28 - Tarjeta de débito',
            '99': '99 - Por definir'
        };

        const desgloseFormasCobro = {};
        // Sumar pagos de facturas PUE
        facturasPUE.forEach(f => {
            const fp = f.forma_pago || '03';
            desgloseFormasCobro[fp] = round2((desgloseFormasCobro[fp] || 0) + parseFloat(f.total || 0));
        });
        // Sumar abonos de REPs
        pagosVigentes.forEach(p => {
            const fp = p.forma_pago || '03';
            desgloseFormasCobro[fp] = round2((desgloseFormasCobro[fp] || 0) + parseFloat(p.monto || 0));
        });

        const formasCobroArray = Object.keys(desgloseFormasCobro).map(key => ({
            clave: key,
            nombre: formasPagoNombres[key] || `Forma ${key}`,
            total: desgloseFormasCobro[key]
        })).sort((a, b) => b.total - a.total);

        // Notas de Crédito / Egresos
        const notasCreditoVigentes = notasCredito.filter(n => n.estado_sat !== 'Cancelado');
        const totalNotasCreditoVigentes = round2(notasCreditoVigentes.reduce((acc, n) => acc + parseFloat(n.total || 0), 0));

        // Conciliación Fiscal de Impuestos (IVA, ISR, Impuestos Locales)
        let baseIVA16 = 0;
        let baseIVA8 = 0;
        let baseIVA0 = 0;
        let baseExento = 0;
        let totalIVA16 = 0;
        let totalRetISRResico = 0;
        let totalRetISROtros = 0;
        let totalRetIVAFletes = 0;
        let totalRetIVAOtros = 0;
        let totalTrasladosLocales = 0;
        let totalRetencionesLocales = 0;

        facturasVigentes.forEach(doc => {
            // Analizar partidas
            if (doc.detalles && doc.detalles.length > 0) {
                doc.detalles.forEach(det => {
                    const importe = parseFloat(det.importe || (det.cantidad * det.valor_unitario - det.descuento) || 0);
                    const concepto = det.Concepto;
                    const impuestos = concepto?.Impuestos || [];

                    let tieneIVA = false;
                    impuestos.forEach(imp => {
                        const tasa = parseFloat(imp.tasa_cuota || 0);
                        if (imp.tipo === 'traslado' && imp.impuesto_sat === '002') {
                            tieneIVA = true;
                            if (Math.abs(tasa - 0.16) < 0.01) {
                                baseIVA16 += importe;
                                totalIVA16 += (importe * tasa);
                            } else if (Math.abs(tasa - 0.08) < 0.01) {
                                baseIVA8 += importe;
                            } else if (tasa === 0) {
                                baseIVA0 += importe;
                            }
                        }
                    });

                    if (!tieneIVA) {
                        if (det.es_objeto_imp === '01') {
                            baseExento += importe;
                        } else {
                            baseIVA16 += importe;
                            totalIVA16 += (importe * 0.16);
                        }
                    }

                    // Retenciones
                    if (det.retencion_isr) {
                        const tasaRetISR = parseFloat(det.retencion_isr_tasa || 0.10);
                        if (Math.abs(tasaRetISR - 0.0125) < 0.001) {
                            totalRetISRResico += (importe * tasaRetISR);
                        } else {
                            totalRetISROtros += (importe * tasaRetISR);
                        }
                    }
                    if (det.retencion_iva) {
                        totalRetIVAFletes += (importe * 0.04);
                    }
                });
            } else {
                // Fallback a nivel cabecera si no hay detalle cargado
                baseIVA16 += parseFloat(doc.subtotal || 0);
                totalIVA16 += parseFloat(doc.total_impuestos_trasladados || 0);
                totalRetISROtros += parseFloat(doc.total_impuestos_retenidos || 0);
            }

            // Impuestos Locales
            if (doc.impuestos_locales) {
                try {
                    const loc = typeof doc.impuestos_locales === 'string' ? JSON.parse(doc.impuestos_locales) : doc.impuestos_locales;
                    if (loc.trasladosLocales) {
                        loc.trasladosLocales.forEach(tl => totalTrasladosLocales += parseFloat(tl.importe || 0));
                    }
                    if (loc.retencionesLocales) {
                        loc.retencionesLocales.forEach(rl => totalRetencionesLocales += parseFloat(rl.importe || 0));
                    }
                } catch (e) {}
            }
        });

        // Estimación de IVA Efectivamente Cobrado
        // Proporción PUE + proporción de IVA cobrado en pagos REP
        let ivaCobradoPUE = round2(facturasPUE.reduce((acc, d) => acc + parseFloat(d.total_impuestos_trasladados || 0), 0));
        let ivaCobradoREPs = 0;
        pagosVigentes.forEach(p => {
            const montoPago = parseFloat(p.monto || 0);
            // Proporción estándar 16% sobre base gravable: IVA = Total / 1.16 * 0.16
            ivaCobradoREPs += (montoPago / 1.16) * 0.16;
        });

        const totalIVACobradoEfectivo = round2(ivaCobradoPUE + ivaCobradoREPs);

        // 7. Antigüedad de Saldos (Aging Cartera)
        const hoy = new Date();
        const aging = {
            dias0_30: { total: 0, count: 0 },
            dias31_60: { total: 0, count: 0 },
            dias61_90: { total: 0, count: 0 },
            diasMas90: { total: 0, count: 0 }
        };

        const listaCarteraDetalle = facturasPendientesPPD.map(fac => {
            const saldo = round2(fac.saldo_insoluto !== null ? fac.saldo_insoluto : fac.total);
            const fechaFac = new Date(fac.fecha);
            const diffMs = hoy - fechaFac;
            const diasTranscurridos = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

            let rango = '0-30 días';
            if (diasTranscurridos <= 30) {
                aging.dias0_30.total = round2(aging.dias0_30.total + saldo);
                aging.dias0_30.count += 1;
            } else if (diasTranscurridos <= 60) {
                aging.dias31_60.total = round2(aging.dias31_60.total + saldo);
                aging.dias31_60.count += 1;
                rango = '31-60 días';
            } else if (diasTranscurridos <= 90) {
                aging.dias61_90.total = round2(aging.dias61_90.total + saldo);
                aging.dias61_90.count += 1;
                rango = '61-90 días';
            } else {
                aging.diasMas90.total = round2(aging.diasMas90.total + saldo);
                aging.diasMas90.count += 1;
                rango = '+90 días';
            }

            return {
                id: fac.id,
                folio: `${fac.serie || 'A'}-${fac.folio || fac.id}`,
                uuid: fac.uuid,
                fecha: fac.fecha,
                cliente: fac.Receptor?.razon_social || 'Cliente General',
                rfc: fac.Receptor?.rfc || 'XAXX010101000',
                total: round2(fac.total),
                saldo_insoluto: saldo,
                dias_antiguedad: diasTranscurridos,
                rango_antiguedad: rango,
                moneda: fac.moneda
            };
        });

        const totalCarteraPendiente = round2(
            aging.dias0_30.total + aging.dias31_60.total + aging.dias61_90.total + aging.diasMas90.total
        );
        const totalCarteraVencida = round2(
            aging.dias31_60.total + aging.dias61_90.total + aging.diasMas90.total
        );

        // 8. Ranking de Top Clientes (Por volumen de facturación y cobranza)
        const clientesMap = {};
        facturasVigentes.forEach(f => {
            const clienteKey = f.Receptor?.rfc || f.receptor_id || 'XAXX010101000';
            if (!clientesMap[clienteKey]) {
                clientesMap[clienteKey] = {
                    rfc: f.Receptor?.rfc || 'XAXX010101000',
                    razon_social: f.Receptor?.razon_social || 'Público en General',
                    facturas_count: 0,
                    total_facturado: 0,
                    total_cobrado: 0,
                    saldo_pendiente: 0
                };
            }
            clientesMap[clienteKey].facturas_count += 1;
            clientesMap[clienteKey].total_facturado = round2(clientesMap[clienteKey].total_facturado + parseFloat(f.total || 0));
            clientesMap[clienteKey].saldo_pendiente = round2(clientesMap[clienteKey].saldo_pendiente + parseFloat(f.saldo_insoluto !== null ? f.saldo_insoluto : (f.metodo_pago === 'PPD' ? f.total : 0)));
        });

        pagosVigentes.forEach(p => {
            const clienteKey = p.Receptor?.rfc || p.receptor_id;
            if (clienteKey && clientesMap[clienteKey]) {
                clientesMap[clienteKey].total_cobrado = round2(clientesMap[clienteKey].total_cobrado + parseFloat(p.monto || 0));
            }
        });

        const topClientes = Object.values(clientesMap)
            .sort((a, b) => b.total_facturado - a.total_facturado)
            .slice(0, 10);

        // 9. Formatear Listas Tabulares Detalladas para Exportación
        const detalleFacturasTabla = facturasIngreso.map(f => ({
            id: f.id,
            fecha: f.fecha,
            folio: `${f.serie || 'A'}-${f.folio || f.id}`,
            uuid: f.uuid || 'Sin Timbrar',
            cliente: f.Receptor?.razon_social || 'Cliente General',
            rfc: f.Receptor?.rfc || 'XAXX010101000',
            subtotal: round2(f.subtotal),
            traslados: round2(f.total_impuestos_trasladados),
            retenciones: round2(f.total_impuestos_retenidos),
            total: round2(f.total),
            saldo_insoluto: round2(f.saldo_insoluto !== null ? f.saldo_insoluto : (f.metodo_pago === 'PPD' ? f.total : 0)),
            metodo_pago: f.metodo_pago || 'PUE',
            forma_pago: f.forma_pago || '03',
            estado_sat: f.estado_sat,
            estado_pago: f.estado_pago,
            moneda: f.moneda,
            motivo_cancelacion: f.motivo_cancelacion || ''
        }));

        const detallePagosTabla = pagosPeriodo.map(p => {
            const facturasAbonadas = (p.Documentos || []).map(d => `${d.serie || ''}${d.folio || d.id}`).join(', ');
            return {
                id: p.id,
                fecha_pago: p.fecha_pago,
                cliente: p.Receptor?.razon_social || 'Cliente General',
                rfc: p.Receptor?.rfc || 'XAXX010101000',
                forma_pago: p.forma_pago,
                forma_pago_nombre: formasPagoNombres[p.forma_pago] || p.forma_pago,
                monto: round2(p.monto),
                moneda: p.moneda || 'MXN',
                folio_rep: p.DocumentoREP ? `${p.DocumentoREP.serie || 'P'}-${p.DocumentoREP.folio || p.id}` : 'Sin Timbrar',
                uuid_rep: p.DocumentoREP?.uuid || '',
                estado: p.estado || 'Activo',
                facturas_relacionadas: facturasAbonadas
            };
        });

        const detalleNotasCreditoTabla = notasCredito.map(nc => ({
            id: nc.id,
            fecha: nc.fecha,
            folio: `${nc.serie || 'NC'}-${nc.folio || nc.id}`,
            uuid: nc.uuid || 'Sin Timbrar',
            cliente: nc.Receptor?.razon_social || 'Cliente General',
            rfc: nc.Receptor?.rfc || 'XAXX010101000',
            subtotal: round2(nc.subtotal),
            total: round2(nc.total),
            moneda: nc.moneda,
            tipo_relacion: nc.tipo_relacion || '01',
            uuids_relacionados: nc.uuids_relacionados || '',
            estado_sat: nc.estado_sat
        }));

        res.json({
            espacio: {
                id: empresa.id,
                nombre: empresa.nombre
            },
            periodo: {
                fechaInicio: startDate.toISOString().split('T')[0],
                fechaFin: endDate.toISOString().split('T')[0]
            },
            emisoresDisponibles: emisoresEmpresa,
            emisorSeleccionado: emisorId && emisorId !== 'TODOS' ? Number(emisorId) : 'TODOS',
            resumen: {
                facturacion: {
                    totalFacturadoVigente,
                    subtotalFacturadoVigente,
                    totalTrasladosFacturados,
                    totalRetencionesFacturadas,
                    totalCancelado,
                    cantidadFacturasVigentes: facturasVigentes.length,
                    cantidadFacturasCanceladas: facturasCanceladas.length,
                    totalPUE,
                    totalPPD,
                    cantidadPUE: facturasPUE.length,
                    cantidadPPD: facturasPPD.length
                },
                cobranza: {
                    totalCobradoEfectivo,
                    totalCobradoREPs,
                    totalCobradoPUE: totalPUE,
                    cantidadPagosRegistrados: pagosVigentes.length,
                    desgloseFormasCobro: formasCobroArray
                },
                cartera: {
                    totalCarteraPendiente,
                    totalCarteraVencida,
                    totalFacturasPendientes: facturasPendientesPPD.length,
                    aging
                },
                egresos: {
                    totalNotasCreditoVigentes,
                    cantidadNotasCredito: notasCreditoVigentes.length
                },
                fiscal: {
                    baseIVA16: round2(baseIVA16),
                    baseIVA8: round2(baseIVA8),
                    baseIVA0: round2(baseIVA0),
                    baseExento: round2(baseExento),
                    totalIVA16: round2(totalIVA16),
                    totalIVACobradoEfectivo,
                    retenciones: {
                        isrResico: round2(totalRetISRResico),
                        isrOtros: round2(totalRetISROtros),
                        ivaFletes: round2(totalRetIVAFletes),
                        ivaOtros: round2(totalRetIVAOtros),
                        totalRetenciones: round2(totalRetISRResico + totalRetISROtros + totalRetIVAFletes + totalRetIVAOtros)
                    },
                    impuestosLocales: {
                        trasladosLocales: round2(totalTrasladosLocales),
                        retencionesLocales: round2(totalRetencionesLocales)
                    }
                }
            },
            topClientes,
            detalle: {
                facturas: detalleFacturasTabla,
                pagos: detallePagosTabla,
                notasCredito: detalleNotasCreditoTabla,
                cartera: listaCarteraDetalle
            }
        });

    } catch (error) {
        console.error('Error generando reporte completo:', error);
        res.status(500).json({ message: 'Error interno al generar el reporte del espacio de trabajo.', error: error.message });
    }
};

