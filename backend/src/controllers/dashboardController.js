import { Documento, Receptor, Pago, Emisor } from '../models/index.js';
import { Op } from 'sequelize';

export const getDashboardData = async (req, res) => {
    try {
        const { emisorId } = req.query;
        let emisorIds = [];

        // 1. Scoping & Permissions
        if (req.usuario.rol !== 'Administrador') {
            // Corporate role: must be restricted to their company (empresa_id)
            const userEmpresaId = req.usuario.empresa_id;
            
            // Find all emisores belonging to this company
            const companyEmisores = await Emisor.findAll({
                where: { empresa_id: userEmpresaId },
                attributes: ['id']
            });
            const companyEmisorIds = companyEmisores.map(e => e.id);

            if (emisorId) {
                // If specific emisor is requested, check if it belongs to user's company
                const idNum = parseInt(emisorId);
                if (!companyEmisorIds.includes(idNum)) {
                    return res.status(403).json({ message: 'No tienes acceso a este emisor.' });
                }
                emisorIds = [idNum];
            } else {
                emisorIds = companyEmisorIds;
            }
        } else {
            // Global administrator: can query globally or filter by emisorId
            if (emisorId) {
                emisorIds = [parseInt(emisorId)];
            }
        }

        // Setup emisor filter in query clauses
        const docWhereScope = {};
        const receptorWhereScope = {};
        const pagoWhereScope = {};

        if (emisorIds.length > 0 || req.usuario.rol !== 'Administrador') {
            // If we have a list of emisorIds, scope to them
            docWhereScope.emisor_id = { [Op.in]: emisorIds };
            receptorWhereScope.emisor_id = { [Op.in]: emisorIds };
            pagoWhereScope.emisor_id = { [Op.in]: emisorIds };
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed

        // Ranges
        const currentMonthStart = new Date(year, month, 1);
        const currentMonthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const prevMonthStart = new Date(year, month - 1, 1);
        const prevMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);

        // A. Ingresos del Mes (Facturado) & Facturas Emitidas
        // Current Month Invoices
        const currentInvoices = await Documento.findAll({
            where: {
                ...docWhereScope,
                tipo_comprobante: 'I',
                estado_sat: { [Op.ne]: 'Cancelado' },
                fecha: {
                    [Op.between]: [currentMonthStart, currentMonthEnd]
                }
            }
        });

        const currentMonthIngresos = currentInvoices.reduce((sum, doc) => {
            const total = parseFloat(doc.total) || 0;
            const rate = parseFloat(doc.tipo_cambio) || 1;
            return sum + (total * rate);
        }, 0);

        const currentMonthFacturasCount = currentInvoices.length;

        // Previous Month Invoices
        const prevInvoices = await Documento.findAll({
            where: {
                ...docWhereScope,
                tipo_comprobante: 'I',
                estado_sat: { [Op.ne]: 'Cancelado' },
                fecha: {
                    [Op.between]: [prevMonthStart, prevMonthEnd]
                }
            }
        });

        const prevMonthIngresos = prevInvoices.reduce((sum, doc) => {
            const total = parseFloat(doc.total) || 0;
            const rate = parseFloat(doc.tipo_cambio) || 1;
            return sum + (total * rate);
        }, 0);

        const prevMonthFacturasCount = prevInvoices.length;

        // B. Cartera Vencida (Past due outstanding)
        // Find unpaid invoices
        const unpaidInvoices = await Documento.findAll({
            where: {
                ...docWhereScope,
                tipo_comprobante: 'I',
                estado_sat: { [Op.ne]: 'Cancelado' },
                estado_pago: { [Op.in]: ['Pendiente', 'Pago Parcial', 'Vencido'] }
            }
        });

        // Current Cartera Vencida: unpaid where due date < now or status is Vencido
        const currentCarteraVencida = unpaidInvoices.reduce((sum, doc) => {
            const dueDate = doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento) : null;
            const isVencido = doc.estado_pago === 'Vencido' || (dueDate && dueDate < now);
            if (isVencido) {
                const balance = doc.saldo_insoluto !== null ? parseFloat(doc.saldo_insoluto) : parseFloat(doc.total);
                const rate = parseFloat(doc.tipo_cambio) || 1;
                return sum + (balance * rate);
            }
            return sum;
        }, 0);

        // Previous month Cartera Vencida
        const prevCarteraVencida = unpaidInvoices.reduce((sum, doc) => {
            const docDate = new Date(doc.fecha);
            if (docDate > prevMonthEnd) return sum;

            const dueDate = doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento) : null;
            const isVencido = doc.estado_pago === 'Vencido' || (dueDate && dueDate < prevMonthEnd);
            if (isVencido) {
                const balance = doc.saldo_insoluto !== null ? parseFloat(doc.saldo_insoluto) : parseFloat(doc.total);
                const rate = parseFloat(doc.tipo_cambio) || 1;
                return sum + (balance * rate);
            }
            return sum;
        }, 0);

        // C. Nuevos Clientes
        // Current month
        const currentNewReceptorsCount = await Receptor.count({
            where: {
                ...receptorWhereScope,
                createdAt: {
                    [Op.between]: [currentMonthStart, currentMonthEnd]
                }
            }
        });

        // Previous month
        const prevNewReceptorsCount = await Receptor.count({
            where: {
                ...receptorWhereScope,
                createdAt: {
                    [Op.between]: [prevMonthStart, prevMonthEnd]
                }
            }
        });

        // D. Chart: Facturado vs Cobrado (Last 6 Months)
        const chartData = [];
        for (let i = 5; i >= 0; i--) {
            const mStart = new Date(year, month - i, 1);
            const mEnd = new Date(year, month - i + 1, 0, 23, 59, 59, 999);
            const mName = mStart.toLocaleDateString('es-MX', { month: 'short' });

            // Invoiced in that month
            const docsInMonth = await Documento.findAll({
                where: {
                    ...docWhereScope,
                    tipo_comprobante: 'I',
                    estado_sat: { [Op.ne]: 'Cancelado' },
                    fecha: { [Op.between]: [mStart, mEnd] }
                }
            });
            const facturado = docsInMonth.reduce((sum, d) => sum + ((parseFloat(d.total) || 0) * (parseFloat(d.tipo_cambio) || 1)), 0);

            // Collected in that month (from payments table)
            const paymentsInMonth = await Pago.findAll({
                where: {
                    ...pagoWhereScope,
                    fecha_pago: { [Op.between]: [mStart, mEnd] }
                }
            });
            const cobrado = paymentsInMonth.reduce((sum, p) => sum + ((parseFloat(p.monto) || 0) * (parseFloat(p.tipo_cambio) || 1)), 0);

            // Also, any PUE invoices created in that month can count as "Cobrado" in the same month since they are paid in single exhibition
            const pueInvoices = docsInMonth.filter(d => d.metodo_pago === 'PUE');
            const pueCobrado = pueInvoices.reduce((sum, d) => sum + ((parseFloat(d.total) || 0) * (parseFloat(d.tipo_cambio) || 1)), 0);

            chartData.push({
                name: mName.charAt(0).toUpperCase() + mName.slice(1, 3), // Capitalize, e.g. Ene, Feb
                facturado: Math.round(facturado * 100) / 100,
                cobrado: Math.round((cobrado + pueCobrado) * 100) / 100
            });
        }

        // E. Recent Documents
        const recentDocuments = await Documento.findAll({
            where: docWhereScope,
            limit: 5,
            order: [['fecha', 'DESC']],
            include: [
                { model: Receptor, attributes: ['razon_social', 'rfc'] }
            ]
        });

        // Trends Calculations
        const calcTrend = (curr, prev) => {
            if (prev === 0) {
                return curr === 0 ? { change: '0%', trend: 'up' } : { change: '+100%', trend: 'up' };
            }
            const pct = ((curr - prev) / prev) * 100;
            return {
                change: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
                trend: pct >= 0 ? 'up' : 'down'
            };
        };

        const ingresosTrend = calcTrend(currentMonthIngresos, prevMonthIngresos);
        const facturasTrend = calcTrend(currentMonthFacturasCount, prevMonthFacturasCount);
        const carteraTrend = calcTrend(currentCarteraVencida, prevCarteraVencida);
        const clientesTrend = calcTrend(currentNewReceptorsCount, prevNewReceptorsCount);

        res.json({
            metrics: {
                ingresos: {
                    value: currentMonthIngresos,
                    ...ingresosTrend
                },
                facturas: {
                    value: currentMonthFacturasCount,
                    ...facturasTrend
                },
                carteraVencida: {
                    value: currentCarteraVencida,
                    ...carteraTrend
                },
                clientes: {
                    value: currentNewReceptorsCount,
                    ...clientesTrend
                }
            },
            chartData,
            recentDocuments
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Error al obtener datos del dashboard' });
    }
};
