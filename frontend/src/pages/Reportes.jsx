import React, { useState, useEffect } from 'react';
import { 
    BarChart3, 
    Building2, 
    Calendar, 
    CreditCard, 
    DollarSign, 
    Download, 
    FileSpreadsheet, 
    FileText, 
    Filter, 
    Layers, 
    Printer, 
    RefreshCcw, 
    Search, 
    TrendingUp, 
    Users, 
    Percent, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    ArrowUpRight,
    Tag,
    ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

export const Reportes = () => {
    const { activeEmisor, activeEmpresa } = useAuth();
    const { showToast } = useToast();

    // Filtros
    const [selectedEmisorId, setSelectedEmisorId] = useState('TODOS');
    const [presetRango, setPresetRango] = useState('este_mes');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    
    // Pestaña activa
    const [tabActiva, setTabActiva] = useState('resumen'); // 'resumen', 'facturacion', 'cobranza', 'cartera', 'fiscal', 'notas_credito'

    // Estados de datos y carga
    const [reporteData, setReporteData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [busquedaTabla, setBusquedaTabla] = useState('');

    // Inicializar fechas con el mes actual
    useEffect(() => {
        aplicarPresetRango('este_mes');
    }, []);

    const aplicarPresetRango = (preset) => {
        setPresetRango(preset);
        const hoy = new Date();
        const y = hoy.getFullYear();
        const m = hoy.getMonth();

        let ini = '';
        let fin = '';

        if (preset === 'este_mes') {
            ini = new Date(y, m, 1).toISOString().split('T')[0];
            fin = new Date(y, m + 1, 0).toISOString().split('T')[0];
        } else if (preset === 'mes_anterior') {
            ini = new Date(y, m - 1, 1).toISOString().split('T')[0];
            fin = new Date(y, m, 0).toISOString().split('T')[0];
        } else if (preset === 'ultimos_30') {
            const hace30 = new Date();
            hace30.setDate(hoy.getDate() - 30);
            ini = hace30.toISOString().split('T')[0];
            fin = hoy.toISOString().split('T')[0];
        } else if (preset === 'anio_actual') {
            ini = new Date(y, 0, 1).toISOString().split('T')[0];
            fin = new Date(y, 11, 31).toISOString().split('T')[0];
        }

        if (ini && fin) {
            setFechaInicio(ini);
            setFechaFin(fin);
        }
    };

    const fetchReporte = async () => {
        if (!activeEmpresa) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('empresaId', activeEmpresa.id);
            if (selectedEmisorId) params.append('emisorId', selectedEmisorId);
            if (fechaInicio) params.append('fechaInicio', fechaInicio);
            if (fechaFin) params.append('fechaFin', fechaFin);

            const res = await api.get(`/reportes/completo?${params.toString()}`);
            setReporteData(res.data);
        } catch (error) {
            console.error('Error fetching reporte completo:', error);
            showToast(error.response?.data?.message || 'Error al obtener reporte del espacio de trabajo', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (fechaInicio && fechaFin && activeEmpresa) {
            fetchReporte();
        }
    }, [activeEmpresa, selectedEmisorId, fechaInicio, fechaFin]);

    // Función de exportación a CSV (compatible con Excel con UTF-8 BOM)
    const exportarCSV = () => {
        if (!reporteData) return;

        let nombreArchivo = `Reporte_${reporteData.espacio?.nombre || 'Espacio'}_${tabActiva}_${fechaInicio}_${fechaFin}.csv`;
        let filas = [];

        if (tabActiva === 'facturacion' || tabActiva === 'resumen') {
            filas.push(['Fecha', 'Folio', 'UUID Fiscal', 'Cliente / Receptor', 'RFC Receptor', 'Subtotal', 'Traslados IVA', 'Retenciones', 'Total Facturado', 'Saldo Insoluto', 'Método Pago', 'Forma Pago', 'Estatus SAT', 'Estatus Pago', 'Moneda']);
            (reporteData.detalle?.facturas || []).forEach(f => {
                filas.push([
                    f.fecha ? new Date(f.fecha).toLocaleDateString('es-MX') : '',
                    f.folio,
                    f.uuid,
                    `"${(f.cliente || '').replace(/"/g, '""')}"`,
                    f.rfc,
                    f.subtotal,
                    f.traslados,
                    f.retenciones,
                    f.total,
                    f.saldo_insoluto,
                    f.metodo_pago,
                    f.forma_pago,
                    f.estado_sat,
                    f.estado_pago,
                    f.moneda
                ]);
            });
        } else if (tabActiva === 'cobranza') {
            filas.push(['Fecha Pago', 'ID Pago', 'Cliente / Receptor', 'RFC', 'Forma de Pago SAT', 'Monto Cobrado', 'Moneda', 'Folio REP', 'UUID REP', 'Estado', 'Facturas Abonadas']);
            (reporteData.detalle?.pagos || []).forEach(p => {
                filas.push([
                    p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-MX') : '',
                    p.id,
                    `"${(p.cliente || '').replace(/"/g, '""')}"`,
                    p.rfc,
                    `"${p.forma_pago_nombre || p.forma_pago}"`,
                    p.monto,
                    p.moneda,
                    p.folio_rep,
                    p.uuid_rep,
                    p.estado,
                    `"${(p.facturas_relacionadas || '').replace(/"/g, '""')}"`
                ]);
            });
        } else if (tabActiva === 'cartera') {
            filas.push(['Folio Factura', 'UUID Fiscal', 'Fecha Emisión', 'Cliente / Receptor', 'RFC', 'Total Original', 'Saldo Insoluto Pendiente', 'Días Transcurridos', 'Rango Antigüedad', 'Moneda']);
            (reporteData.detalle?.cartera || []).forEach(c => {
                filas.push([
                    c.folio,
                    c.uuid,
                    c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX') : '',
                    `"${(c.cliente || '').replace(/"/g, '""')}"`,
                    c.rfc,
                    c.total,
                    c.saldo_insoluto,
                    c.dias_antiguedad,
                    c.rango_antiguedad,
                    c.moneda
                ]);
            });
        } else if (tabActiva === 'fiscal') {
            const fis = reporteData.resumen?.fiscal || {};
            filas.push(['Concepto Fiscal', 'Base Gravable / Importe', 'Impuesto Resultante / Cobrado']);
            filas.push(['IVA Tasa 16% (Facturado)', fis.baseIVA16 || 0, fis.totalIVA16 || 0]);
            filas.push(['IVA Tasa 8% (Frontera)', fis.baseIVA8 || 0, '-']);
            filas.push(['IVA Tasa 0%', fis.baseIVA0 || 0, '0.00']);
            filas.push(['Actos Exentos de IVA', fis.baseExento || 0, '0.00']);
            filas.push(['IVA Efectivamente Cobrado (PUE + REP)', '-', fis.totalIVACobradoEfectivo || 0]);
            filas.push(['Retención ISR RESICO (1.25%)', '-', fis.retenciones?.isrResico || 0]);
            filas.push(['Otras Retenciones ISR (10%)', '-', fis.retenciones?.isrOtros || 0]);
            filas.push(['Retención IVA (4% Fletes/Servicios)', '-', fis.retenciones?.ivaFletes || 0]);
            filas.push(['Otras Retenciones IVA', '-', fis.retenciones?.ivaOtros || 0]);
            filas.push(['Total Retenciones Federales', '-', fis.retenciones?.totalRetenciones || 0]);
            filas.push(['Impuestos Locales Trasladados (ISH, etc.)', '-', fis.impuestosLocales?.trasladosLocales || 0]);
            filas.push(['Impuestos Locales Retenidos (5 al millar)', '-', fis.impuestosLocales?.retencionesLocales || 0]);
        } else if (tabActiva === 'notas_credito') {
            filas.push(['Fecha', 'Folio NC', 'UUID Fiscal', 'Cliente / Receptor', 'RFC', 'Subtotal', 'Total Descuento/Devolución', 'Tipo Relación SAT', 'UUIDs Facturas Afectadas', 'Estatus']);
            (reporteData.detalle?.notasCredito || []).forEach(nc => {
                filas.push([
                    nc.fecha ? new Date(nc.fecha).toLocaleDateString('es-MX') : '',
                    nc.folio,
                    nc.uuid,
                    `"${(nc.cliente || '').replace(/"/g, '""')}"`,
                    nc.rfc,
                    nc.subtotal,
                    nc.total,
                    nc.tipo_relacion,
                    `"${(nc.uuids_relacionados || '').replace(/"/g, '""')}"`,
                    nc.estado_sat
                ]);
            });
        }

        const csvContent = '\uFEFF' + filas.map(e => e.join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('✅ Reporte exportado a Excel / CSV exitosamente.');
    };

    const handlePrint = () => {
        window.print();
    };

    const resumen = reporteData?.resumen || {};
    const facRes = resumen.facturacion || {};
    const cobRes = resumen.cobranza || {};
    const carRes = resumen.cartera || {};
    const fisRes = resumen.fiscal || {};
    const egrRes = resumen.egresos || {};

    return (
        <div className="max-w-7xl mx-auto pb-16 space-y-6 animate-in fade-in duration-300">
            {/* Header del Espacio de Trabajo & Título */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
                        <Building2 className="w-4 h-4" />
                        <span>Espacio de Trabajo: {reporteData?.espacio?.nombre || activeEmpresa?.nombre || 'General'}</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <span>Reportes y Analítica Integral</span>
                        <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            CFDI 4.0
                        </span>
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">
                        Concentrado contable, fiscal y administrativo de facturación, cobranza, impuestos y cuentas por cobrar.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={exportarCSV}
                        disabled={!reporteData || isLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                        title="Descargar datos en formato CSV compatible con Microsoft Excel"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Exportar a Excel / CSV</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        disabled={!reporteData || isLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                        title="Imprimir vista ejecutiva o guardar en PDF"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir / PDF</span>
                    </button>
                </div>
            </div>

            {/* Barra de Filtros y Selección */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* Filtro de Emisores */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                            Emisor(es) del Espacio
                        </label>
                        <div className="relative">
                            <select
                                value={selectedEmisorId}
                                onChange={(e) => setSelectedEmisorId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition appearance-none"
                            >
                                <option value="TODOS">Todos los Emisores ({reporteData?.emisoresDisponibles?.length || 0})</option>
                                {(reporteData?.emisoresDisponibles || []).map(em => (
                                    <option key={em.id} value={em.id}>
                                        {em.rfc} - {em.razon_social}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                        </div>
                    </div>

                    {/* Presets Rápidos de Fecha */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                            Periodo Rápido
                        </label>
                        <div className="relative">
                            <select
                                value={presetRango}
                                onChange={(e) => aplicarPresetRango(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition appearance-none"
                            >
                                <option value="este_mes">Este Mes en Curso</option>
                                <option value="mes_anterior">Mes Anterior</option>
                                <option value="ultimos_30">Últimos 30 días</option>
                                <option value="anio_actual">Todo el Año en Curso</option>
                                <option value="personalizado">Rango Personalizado</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                        </div>
                    </div>

                    {/* Fecha Inicio y Fin */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                                Desde
                            </label>
                            <input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => {
                                    setFechaInicio(e.target.value);
                                    setPresetRango('personalizado');
                                }}
                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                                Hasta
                            </label>
                            <input
                                type="date"
                                value={fechaFin}
                                onChange={(e) => {
                                    setFechaFin(e.target.value);
                                    setPresetRango('personalizado');
                                }}
                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Botón Actualizar */}
                    <div>
                        <button
                            onClick={fetchReporte}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition disabled:opacity-50"
                        >
                            <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>{isLoading ? 'Calculando Reporte...' : 'Actualizar Datos'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards Superiores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Facturado */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Facturado</span>
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                            ${(facRes.totalFacturadoVigente || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">MXN Vigente</span>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>{facRes.cantidadFacturasVigentes || 0} Facturas emitidas</span>
                        <span className="font-semibold text-emerald-600">{facRes.cantidadPUE || 0} PUE / {facRes.cantidadPPD || 0} PPD</span>
                    </div>
                </div>

                {/* Cobranza Total Realizada */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Cobranza Realizada</span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-emerald-700 tracking-tight">
                            ${(cobRes.totalCobradoEfectivo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-emerald-600/70 block font-mono">Flujo Efectivo Cobrado</span>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>PUE: ${(cobRes.totalCobradoPUE || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                        <span className="font-semibold text-indigo-600">REPs: ${(cobRes.totalCobradoREPs || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                    </div>
                </div>

                {/* Cartera Pendiente (Cuentas por Cobrar) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Cartera por Cobrar</span>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <CreditCard className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-amber-900 tracking-tight">
                            ${(carRes.totalCarteraPendiente || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-amber-600 block font-mono">Saldo Insoluto Total</span>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>{carRes.totalFacturasPendientes || 0} Facturas PPD</span>
                        <span className="font-semibold text-rose-600">Vencido: ${(carRes.totalCarteraVencida || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                    </div>
                </div>

                {/* Conciliación Fiscal (IVA Trasladado & Retenciones) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-purple-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Impuestos Trasladados</span>
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                            <Percent className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-purple-900 tracking-tight">
                            ${(fisRes.totalIVA16 || facRes.totalTrasladosFacturados || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-purple-600 block font-mono">IVA Facturado Total</span>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>IVA Cobrado: ${(fisRes.totalIVACobradoEfectivo || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                        <span className="font-semibold text-rose-600">Ret: -${(fisRes.retenciones?.totalRetenciones || facRes.totalRetencionesFacturadas || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                    </div>
                </div>
            </div>

            {/* Navegación por Pestañas del Reporte */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center border-b border-slate-200 px-4 bg-slate-50/50 overflow-x-auto">
                    {[
                        { id: 'resumen', label: 'Resumen Ejecutivo', icon: BarChart3 },
                        { id: 'facturacion', label: 'Facturación (Ingresos)', count: reporteData?.detalle?.facturas?.length, icon: FileText },
                        { id: 'cobranza', label: 'Cobranza y REPs', count: reporteData?.detalle?.pagos?.length, icon: CreditCard },
                        { id: 'cartera', label: 'Antigüedad de Saldos', count: reporteData?.detalle?.cartera?.length, icon: Clock },
                        { id: 'fiscal', label: 'Resumen Fiscal e Impuestos', icon: Percent },
                        { id: 'notas_credito', label: 'Notas de Crédito (Egresos)', count: reporteData?.detalle?.notasCredito?.length, icon: Tag }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = tabActiva === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setTabActiva(tab.id)}
                                className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                                    active
                                        ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Contenido de la Pestaña Activa */}
                <div className="p-6">
                    {/* TAB 1: RESUMEN EJECUTIVO */}
                    {tabActiva === 'resumen' && (
                        <div className="space-y-6">
                            {/* Gráficos / Tarjetas de Análisis Visual */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Distribución Método de Pago (PUE vs PPD) */}
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-indigo-600" />
                                        Composición PUE vs PPD
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                                                <span>PUE (Pago en Una Exhibición)</span>
                                                <span className="text-emerald-700">${(facRes.totalPUE || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${facRes.totalFacturadoVigente ? ((facRes.totalPUE / facRes.totalFacturadoVigente) * 100) : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 block">
                                                {facRes.totalFacturadoVigente ? (((facRes.totalPUE / facRes.totalFacturadoVigente) * 100).toFixed(1)) : 0}% del total facturado
                                            </span>
                                        </div>

                                        <div>
                                            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                                                <span>PPD (Pago en Parcialidades)</span>
                                                <span className="text-indigo-700">${(facRes.totalPPD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${facRes.totalFacturadoVigente ? ((facRes.totalPPD / facRes.totalFacturadoVigente) * 100) : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 block">
                                                {facRes.totalFacturadoVigente ? (((facRes.totalPPD / facRes.totalFacturadoVigente) * 100).toFixed(1)) : 0}% del total facturado
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Formas de Pago Más Utilizadas */}
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                        Cobranza por Forma SAT
                                    </h4>
                                    {(!cobRes.desgloseFormasCobro || cobRes.desgloseFormasCobro.length === 0) ? (
                                        <p className="text-xs text-slate-400 text-center py-6">No hay cobros registrados en el periodo.</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {cobRes.desgloseFormasCobro.map((fc, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-200">
                                                    <span className="font-semibold text-slate-700 truncate pr-2" title={fc.nombre}>
                                                        {fc.nombre}
                                                    </span>
                                                    <span className="font-black text-slate-900 font-mono">
                                                        ${parseFloat(fc.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Resumen de Cartera y Aging */}
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                        Antigüedad de Cartera
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold text-emerald-700 block uppercase">Al Corriente (0-30 d)</span>
                                            <span className="font-black text-slate-800 text-sm">
                                                ${(carRes.aging?.dias0_30?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">{carRes.aging?.dias0_30?.count || 0} facturas</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold text-amber-700 block uppercase">31 a 60 días</span>
                                            <span className="font-black text-slate-800 text-sm">
                                                ${(carRes.aging?.dias31_60?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">{carRes.aging?.dias31_60?.count || 0} facturas</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold text-orange-700 block uppercase">61 a 90 días</span>
                                            <span className="font-black text-slate-800 text-sm">
                                                ${(carRes.aging?.dias61_90?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">{carRes.aging?.dias61_90?.count || 0} facturas</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-rose-200 bg-rose-50/30">
                                            <span className="text-[10px] font-bold text-rose-700 block uppercase">+90 días (Vencido)</span>
                                            <span className="font-black text-rose-900 text-sm">
                                                ${(carRes.aging?.diasMas90?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] text-rose-600/70 block">{carRes.aging?.diasMas90?.count || 0} facturas</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Top 10 Clientes del Periodo */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-indigo-600" />
                                    Top 10 Clientes del Periodo (Mayor Facturación)
                                </h4>
                                {(!reporteData?.topClientes || reporteData.topClientes.length === 0) ? (
                                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                                        No hay facturas vigentes para este periodo.
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                                                    <th className="p-3 font-bold">Cliente / Receptor</th>
                                                    <th className="p-3 font-bold">RFC</th>
                                                    <th className="p-3 font-bold text-center">Facturas</th>
                                                    <th className="p-3 font-bold text-right">Total Facturado</th>
                                                    <th className="p-3 font-bold text-right">Cobrado</th>
                                                    <th className="p-3 font-bold text-right">Saldo Pendiente</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {reporteData.topClientes.map((c, i) => (
                                                    <tr key={i} className="hover:bg-slate-50">
                                                        <td className="p-3 font-bold text-slate-800">{c.razon_social}</td>
                                                        <td className="p-3 font-mono text-[11px] text-slate-500">{c.rfc}</td>
                                                        <td className="p-3 text-center font-semibold text-slate-600">{c.facturas_count}</td>
                                                        <td className="p-3 text-right font-black text-slate-900 font-mono">
                                                            ${parseFloat(c.total_facturado).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                                                            ${parseFloat(c.total_cobrado).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-3 text-right font-bold text-amber-700 font-mono">
                                                            ${parseFloat(c.saldo_pendiente).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: FACTURACIÓN DETALLADA (INGRESOS) */}
                    {tabActiva === 'facturacion' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="relative w-full max-w-sm">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar por cliente, folio o UUID..."
                                        value={busquedaTabla}
                                        onChange={(e) => setBusquedaTabla(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <span className="text-xs font-bold text-slate-500">
                                    Total: {reporteData?.detalle?.facturas?.length || 0} registros
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs min-w-[900px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Folio</th>
                                            <th className="p-3">Cliente / Receptor</th>
                                            <th className="p-3 text-right">Subtotal</th>
                                            <th className="p-3 text-right">IVA Traslado</th>
                                            <th className="p-3 text-right">Retenciones</th>
                                            <th className="p-3 text-right">Total Factura</th>
                                            <th className="p-3 text-right">Saldo Insoluto</th>
                                            <th className="p-3 text-center">Método</th>
                                            <th className="p-3 text-center">Estatus SAT</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(reporteData?.detalle?.facturas || [])
                                            .filter(f => {
                                                if (!busquedaTabla) return true;
                                                const q = busquedaTabla.toLowerCase();
                                                return (f.cliente || '').toLowerCase().includes(q) ||
                                                    (f.folio || '').toLowerCase().includes(q) ||
                                                    (f.uuid || '').toLowerCase().includes(q);
                                            })
                                            .map(f => (
                                                <tr key={f.id} className="hover:bg-slate-50">
                                                    <td className="p-3 text-slate-600">
                                                        {f.fecha ? new Date(f.fecha).toLocaleDateString('es-MX') : ''}
                                                    </td>
                                                    <td className="p-3 font-mono font-bold text-indigo-700">
                                                        {f.folio}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-800 truncate max-w-[200px]" title={f.cliente}>
                                                            {f.cliente}
                                                        </div>
                                                        <div className="text-[10px] font-mono text-slate-400">{f.rfc}</div>
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-slate-600">
                                                        ${f.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-emerald-700">
                                                        +${f.traslados.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-rose-700">
                                                        {f.retenciones > 0 ? `-$${f.retenciones.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00'}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-black text-slate-900">
                                                        ${f.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-amber-700">
                                                        ${f.saldo_insoluto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                                            {f.metodo_pago}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                            f.estado_sat === 'Timbrado'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : f.estado_sat === 'Cancelado'
                                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {f.estado_sat}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: COBRANZA Y COMPLEMENTOS REP */}
                    {tabActiva === 'cobranza' && (
                        <div className="space-y-4">
                            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                                            <th className="p-3">Fecha de Pago</th>
                                            <th className="p-3">Cliente / Receptor</th>
                                            <th className="p-3">Forma de Pago SAT</th>
                                            <th className="p-3 text-right">Monto Cobrado</th>
                                            <th className="p-3 text-center">Folio REP</th>
                                            <th className="p-3 text-center">UUID Timbre</th>
                                            <th className="p-3">Facturas Abonadas</th>
                                            <th className="p-3 text-center">Estatus</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(reporteData?.detalle?.pagos || []).map(p => (
                                            <tr key={p.id} className="hover:bg-slate-50">
                                                <td className="p-3 text-slate-700 font-medium">
                                                    {p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-MX') : ''}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-800">{p.cliente}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{p.rfc}</div>
                                                </td>
                                                <td className="p-3 font-medium text-slate-700">
                                                    {p.forma_pago_nombre || p.forma_pago}
                                                </td>
                                                <td className="p-3 text-right font-black text-emerald-700 font-mono">
                                                    +${p.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })} {p.moneda}
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-indigo-700">
                                                    {p.folio_rep}
                                                </td>
                                                <td className="p-3 text-center font-mono text-[10px] text-slate-500" title={p.uuid_rep}>
                                                    {p.uuid_rep ? `${p.uuid_rep.substring(0, 8)}...` : 'N/A'}
                                                </td>
                                                <td className="p-3 text-slate-600 font-mono text-[11px]">
                                                    {p.facturas_relacionadas || '-'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                        p.estado === 'Cancelado'
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }`}>
                                                        {p.estado}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: ANTIGÜEDAD DE SALDOS (CARTERA) */}
                    {tabActiva === 'cartera' && (
                        <div className="space-y-4">
                            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                                            <th className="p-3">Factura</th>
                                            <th className="p-3">Fecha Emisión</th>
                                            <th className="p-3">Cliente / Receptor</th>
                                            <th className="p-3 text-right">Total Factura</th>
                                            <th className="p-3 text-right">Saldo Pendiente</th>
                                            <th className="p-3 text-center">Días Antigüedad</th>
                                            <th className="p-3 text-center">Rango Vencimiento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(reporteData?.detalle?.cartera || []).map(c => (
                                            <tr key={c.id} className="hover:bg-slate-50">
                                                <td className="p-3 font-mono font-bold text-indigo-700">
                                                    {c.folio}
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                    {c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX') : ''}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-800">{c.cliente}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{c.rfc}</div>
                                                </td>
                                                <td className="p-3 text-right font-mono text-slate-600">
                                                    ${c.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-3 text-right font-mono font-black text-rose-700">
                                                    ${c.saldo_insoluto.toLocaleString('en-US', { minimumFractionDigits: 2 })} {c.moneda}
                                                </td>
                                                <td className="p-3 text-center font-bold text-slate-700">
                                                    {c.dias_antiguedad} días
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                        c.dias_antiguedad <= 30
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : c.dias_antiguedad <= 60
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                    }`}>
                                                        {c.rango_antiguedad}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 5: RESUMEN FISCAL E IMPUESTOS */}
                    {tabActiva === 'fiscal' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Conciliación IVA */}
                                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
                                        <Percent className="w-4 h-4 text-indigo-600" />
                                        Bases Gravables e Impuesto al Valor Agregado (IVA)
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                                            <span className="font-semibold text-slate-700">Base Gravable Tasa 16%</span>
                                            <span className="font-black text-slate-900 font-mono">
                                                ${(fisRes.baseIVA16 || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                                            <span className="font-semibold text-slate-700">Total IVA 16% Trasladado (Facturado)</span>
                                            <span className="font-black text-emerald-700 font-mono">
                                                +${(fisRes.totalIVA16 || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                                            <span className="font-bold text-emerald-950">IVA Efectivamente Cobrado (PUE + REP)</span>
                                            <span className="font-black text-emerald-700 font-mono text-sm">
                                                ${(fisRes.totalIVACobradoEfectivo || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                                            <span className="font-semibold text-slate-700">Base Gravable Tasa 0% / Exenta</span>
                                            <span className="font-bold text-slate-500 font-mono">
                                                ${((fisRes.baseIVA0 || 0) + (fisRes.baseExento || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Retenciones Federales y Locales */}
                                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-rose-600" />
                                        Retenciones Fiscales y Locales Aplicadas
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                                            <span className="font-semibold text-slate-700">Retención ISR RESICO (1.25%)</span>
                                            <span className="font-bold text-rose-700 font-mono">
                                                -${(fisRes.retenciones?.isrResico || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                                            <span className="font-semibold text-slate-700">Otras Retenciones ISR (Honorarios/Arrend.)</span>
                                            <span className="font-bold text-rose-700 font-mono">
                                                -${(fisRes.retenciones?.isrOtros || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                                            <span className="font-semibold text-slate-700">Retención IVA (4% Fletes/Servicios)</span>
                                            <span className="font-bold text-rose-700 font-mono">
                                                -${(fisRes.retenciones?.ivaFletes || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs bg-rose-50/50 p-3 rounded-xl border border-rose-200">
                                            <span className="font-bold text-rose-950">Total Retenciones Federales</span>
                                            <span className="font-black text-rose-800 font-mono text-sm">
                                                -${(fisRes.retenciones?.totalRetenciones || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {(fisRes.impuestosLocales?.trasladosLocales > 0 || fisRes.impuestosLocales?.retencionesLocales > 0) && (
                                            <div className="flex items-center justify-between text-xs bg-indigo-50/50 p-3 rounded-xl border border-indigo-200">
                                                <span className="font-bold text-indigo-950">Impuestos Locales Netos (ISH/Estatal)</span>
                                                <span className="font-black text-indigo-800 font-mono">
                                                    ${(fisRes.impuestosLocales.trasladosLocales - fisRes.impuestosLocales.retencionesLocales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 6: NOTAS DE CRÉDITO (EGRESOS) */}
                    {tabActiva === 'notas_credito' && (
                        <div className="space-y-4">
                            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Folio NC</th>
                                            <th className="p-3">UUID Fiscal</th>
                                            <th className="p-3">Cliente / Receptor</th>
                                            <th className="p-3 text-right">Subtotal</th>
                                            <th className="p-3 text-right">Total Aplicado</th>
                                            <th className="p-3 text-center">Tipo Relación</th>
                                            <th className="p-3">Facturas Origen Afectadas</th>
                                            <th className="p-3 text-center">Estatus SAT</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(reporteData?.detalle?.notasCredito || []).map(nc => (
                                            <tr key={nc.id} className="hover:bg-slate-50">
                                                <td className="p-3 text-slate-700">
                                                    {nc.fecha ? new Date(nc.fecha).toLocaleDateString('es-MX') : ''}
                                                </td>
                                                <td className="p-3 font-mono font-bold text-amber-700">
                                                    {nc.folio}
                                                </td>
                                                <td className="p-3 font-mono text-[10px] text-slate-400" title={nc.uuid}>
                                                    {nc.uuid ? `${nc.uuid.substring(0, 12)}...` : 'N/A'}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-800">{nc.cliente}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{nc.rfc}</div>
                                                </td>
                                                <td className="p-3 text-right font-mono text-slate-600">
                                                    ${nc.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-3 text-right font-black font-mono text-rose-700">
                                                    -${nc.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {nc.moneda}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                                        {nc.tipo_relacion === '01' ? '01 - Nota Crédito' : nc.tipo_relacion === '03' ? '03 - Devolución' : nc.tipo_relacion}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-slate-600 font-mono text-[10px] truncate max-w-[150px]" title={nc.uuids_relacionados}>
                                                    {nc.uuids_relacionados || '-'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                        nc.estado_sat === 'Cancelado'
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }`}>
                                                        {nc.estado_sat}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

