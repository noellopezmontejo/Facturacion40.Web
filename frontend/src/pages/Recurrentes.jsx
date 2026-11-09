import React, { useState, useEffect, useMemo } from 'react';
import { 
    CalendarClock, Plus, Search, Play, Pause, Clock, History, FileText, 
    CheckCircle2, AlertCircle, Trash2, Edit3, Sparkles, RefreshCw, 
    DollarSign, Check, ExternalLink, X, ChevronRight, Send, Calendar, 
    Users, AlertTriangle, ArrowRight, Info, Loader2, Download
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { openPdfViewer } from '../utils/pdfViewer';

const FRECUENCIAS = [
    { value: 'Semanal', label: 'Semanal (cada 7 días)' },
    { value: 'Quincenal', label: 'Quincenal (cada 15 días)' },
    { value: 'Mensual', label: 'Mensual (mismo día cada mes)' },
    { value: 'Bimestral', label: 'Bimestral (cada 2 meses)' },
    { value: 'Trimestral', label: 'Trimestral (cada 3 meses)' },
    { value: 'Semestral', label: 'Semestral (cada 6 meses)' },
    { value: 'Anual', label: 'Anual (cada año)' }
];

const FORMAS_PAGO = [
    { clave: '03', descripcion: '03 - Transferencia electrónica de fondos' },
    { clave: '01', descripcion: '01 - Efectivo' },
    { clave: '02', descripcion: '02 - Cheque nominativo' },
    { clave: '04', descripcion: '04 - Tarjeta de crédito' },
    { clave: '28', descripcion: '28 - Tarjeta de débito' },
    { clave: '99', descripcion: '99 - Por definir' }
];

const USOS_CFDI = [
    { clave: 'G03', descripcion: 'G03 - Gastos en general' },
    { clave: 'G01', descripcion: 'G01 - Adquisición de mercancías' },
    { clave: 'G02', descripcion: 'G02 - Devoluciones, descuentos o bonificaciones' },
    { clave: 'I01', descripcion: 'I01 - Construcciones' },
    { clave: 'I08', descripcion: 'I08 - Otra maquinaria y equipo' },
    { clave: 'D01', descripcion: 'D01 - Honorarios médicos, dentales y hospitalarios' },
    { clave: 'S01', descripcion: 'S01 - Sin efectos fiscales' },
    { clave: 'CP01', descripcion: 'CP01 - Pagos' }
];

const TAGS_DINAMICOS = [
    { tag: '{{MES}}', label: 'Mes actual', desc: 'Ej: Noviembre' },
    { tag: '{{AÑO}}', label: 'Año actual', desc: 'Ej: 2026' },
    { tag: '{{PERIODO}}', label: 'Mes y Año', desc: 'Ej: Noviembre 2026' },
    { tag: '{{MES_ANTERIOR}}', label: 'Mes previo', desc: 'Ej: Octubre' },
    { tag: '{{MES_SIGUIENTE}}', label: 'Mes siguiente', desc: 'Ej: Diciembre' },
    { tag: '{{AÑO_CORTO}}', label: 'Año 2 dígitos', desc: 'Ej: 26' },
    { tag: '{{DIA}}', label: 'Día de emisión', desc: 'Ej: 05' }
];

export const Recurrentes = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();

    // Data States
    const [recurrentes, setRecurrentes] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');

    // Catalogs
    const [receptores, setReceptores] = useState([]);
    const [conceptosCat, setConceptosCat] = useState([]);

    // Action & Modal States
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [executingId, setExecutingId] = useState(null);
    const [batchProcessing, setBatchProcessing] = useState(false);

    // History Modal
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState(null);

    // Initial Form State
    const defaultForm = {
        id: null,
        nombre_suscripcion: '',
        emisor_id: activeEmisor?.id || '',
        receptor_id: '',
        serie: 'REC',
        frecuencia: 'Mensual',
        dia_ejecucion: new Date().getDate(),
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: '',
        proxima_emision: new Date().toISOString().slice(0, 10),
        metodo_pago: 'PUE',
        forma_pago: '03',
        uso_cfdi: 'G03',
        tipo_comprobante: 'I',
        moneda: 'MXN',
        tipo_cambio: 1,
        auto_timbrar: true,
        enviar_email: true,
        notas: '',
        detalles: [
            {
                clave_prod_serv: '81112100',
                no_identificacion: 'SRV-01',
                clave_unidad: 'E48',
                unidad: 'Servicio',
                descripcion: 'Mantenimiento y soporte correspondiente a {{MES}} {{AÑO}}',
                cantidad: 1,
                valor_unitario: 1000,
                descuento: 0,
                objeto_imp: '02',
                tasa_iva: 0.16,
                tasa_ret_iva: 0,
                tasa_ret_isr: 0
            }
        ]
    };

    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => {
        fetchRecurrentes();
        fetchStats();
        fetchCatalogs();
    }, [activeEmisor]);

    const fetchRecurrentes = async () => {
        try {
            setLoading(true);
            const params = {};
            if (activeEmisor) params.emisorId = activeEmisor.id;
            if (statusFilter !== 'Todos') params.estado = statusFilter;
            if (searchTerm) params.search = searchTerm;

            const res = await api.get('/recurrentes', { params });
            setRecurrentes(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error fetching recurrentes:', error);
            showToast('Error al cargar suscripciones recurrentes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const params = activeEmisor ? { emisorId: activeEmisor.id } : {};
            const res = await api.get('/recurrentes/stats', { params });
            setStats(res.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchCatalogs = async () => {
        if (!activeEmisor) return;
        try {
            const [resReceptores, resConceptos] = await Promise.all([
                api.get(`/receptores/emisor/${activeEmisor.id}`).catch(() => api.get('/receptores')),
                api.get(`/conceptos/emisor/${activeEmisor.id}`).catch(() => api.get('/conceptos'))
            ]);
            setReceptores(Array.isArray(resReceptores.data) ? resReceptores.data : []);
            setConceptosCat(Array.isArray(resConceptos.data) ? resConceptos.data : []);
        } catch (error) {
            console.error('Error fetching catalogs for recurrentes:', error);
        }
    };

    // Calculate Totals dynamically
    const computedTotals = useMemo(() => {
        let subtotal = 0;
        let descuento = 0;
        let totalTraslados = 0;
        let totalRetenciones = 0;

        formData.detalles.forEach(item => {
            const qty = parseFloat(item.cantidad) || 0;
            const price = parseFloat(item.valor_unitario) || 0;
            const desc = parseFloat(item.descuento) || 0;
            const rowBase = Math.max(0, (qty * price) - desc);

            subtotal += (qty * price);
            descuento += desc;

            const tasaIva = parseFloat(item.tasa_iva || 0);
            const tasaRetIva = parseFloat(item.tasa_ret_iva || 0);
            const tasaRetIsr = parseFloat(item.tasa_ret_isr || 0);

            if (tasaIva > 0) totalTraslados += Math.round(rowBase * tasaIva * 100) / 100;
            if (tasaRetIva > 0) totalRetenciones += Math.round(rowBase * tasaRetIva * 100) / 100;
            if (tasaRetIsr > 0) totalRetenciones += Math.round(rowBase * tasaRetIsr * 100) / 100;
        });

        const total = subtotal - descuento + totalTraslados - totalRetenciones;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            descuento: Math.round(descuento * 100) / 100,
            totalTraslados: Math.round(totalTraslados * 100) / 100,
            totalRetenciones: Math.round(totalRetenciones * 100) / 100,
            total: Math.round(total * 100) / 100
        };
    }, [formData.detalles]);

    // Open Modal for New Subscription
    const handleNewSubscription = () => {
        setIsEditing(false);
        setFormData({
            ...defaultForm,
            emisor_id: activeEmisor?.id || '',
            fecha_inicio: new Date().toISOString().slice(0, 10),
            proxima_emision: new Date().toISOString().slice(0, 10),
            dia_ejecucion: new Date().getDate()
        });
        setShowModal(true);
    };

    // Open Modal for Edit
    const handleEditSubscription = async (item) => {
        try {
            setLoading(true);
            const res = await api.get(`/recurrentes/${item.id}`);
            const data = res.data;
            setIsEditing(true);
            setFormData({
                id: data.id,
                nombre_suscripcion: data.nombre_suscripcion || '',
                emisor_id: data.emisor_id || activeEmisor?.id,
                receptor_id: data.receptor_id || '',
                serie: data.serie || 'REC',
                frecuencia: data.frecuencia || 'Mensual',
                dia_ejecucion: data.dia_ejecucion || 1,
                fecha_inicio: data.fecha_inicio ? data.fecha_inicio.slice(0, 10) : '',
                fecha_fin: data.fecha_fin ? data.fecha_fin.slice(0, 10) : '',
                proxima_emision: data.proxima_emision ? data.proxima_emision.slice(0, 10) : '',
                metodo_pago: data.metodo_pago || 'PUE',
                forma_pago: data.forma_pago || '03',
                uso_cfdi: data.uso_cfdi || 'G03',
                tipo_comprobante: data.tipo_comprobante || 'I',
                moneda: data.moneda || 'MXN',
                tipo_cambio: data.tipo_cambio || 1,
                auto_timbrar: data.auto_timbrar !== undefined ? data.auto_timbrar : true,
                enviar_email: data.enviar_email !== undefined ? data.enviar_email : true,
                notas: data.notas || '',
                detalles: (data.detalles && data.detalles.length > 0) ? data.detalles.map(d => ({
                    clave_prod_serv: d.clave_prod_serv,
                    no_identificacion: d.no_identificacion || '',
                    clave_unidad: d.clave_unidad || 'E48',
                    unidad: d.unidad || 'Servicio',
                    descripcion: d.descripcion,
                    cantidad: d.cantidad || 1,
                    valor_unitario: d.valor_unitario || 0,
                    descuento: d.descuento || 0,
                    objeto_imp: d.objeto_imp || '02',
                    tasa_iva: (d.impuestos_trasladados && d.impuestos_trasladados[0]) ? parseFloat(d.impuestos_trasladados[0].tasa || 0.16) : 0.16,
                    tasa_ret_iva: (d.impuestos_retenidos && d.impuestos_retenidos.find(r => r.impuesto === '002')) ? parseFloat(d.impuestos_retenidos.find(r => r.impuesto === '002').tasa) : 0,
                    tasa_ret_isr: (d.impuestos_retenidos && d.impuestos_retenidos.find(r => r.impuesto === '001')) ? parseFloat(d.impuestos_retenidos.find(r => r.impuesto === '001').tasa) : 0
                })) : defaultForm.detalles
            });
            setShowModal(true);
        } catch (error) {
            console.error('Error loading subscription for edit:', error);
            showToast('Error al cargar datos de la suscripción', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Save or Update Subscription
    const handleSaveSubscription = async (e) => {
        e.preventDefault();
        if (!formData.nombre_suscripcion.trim()) {
            showToast('Ingresa un nombre para la suscripción', 'warning');
            return;
        }
        if (!formData.receptor_id) {
            showToast('Selecciona el cliente receptor', 'warning');
            return;
        }
        if (formData.detalles.length === 0) {
            showToast('Agrega al menos una partida o concepto', 'warning');
            return;
        }

        try {
            setIsSaving(true);
            const payload = {
                ...formData,
                emisor_id: activeEmisor?.id || formData.emisor_id,
                subtotal: computedTotals.subtotal,
                descuento: computedTotals.descuento,
                total_impuestos_trasladados: computedTotals.totalTraslados,
                total_impuestos_retenidos: computedTotals.totalRetenciones,
                total: computedTotals.total,
                detalles: formData.detalles.map(det => {
                    const cant = parseFloat(det.cantidad || 1);
                    const precio = parseFloat(det.valor_unitario || 0);
                    const desc = parseFloat(det.descuento || 0);
                    const imp = Math.round(cant * precio * 100) / 100;
                    const baseImp = Math.max(0, imp - desc);

                    const traslados = [];
                    if (parseFloat(det.tasa_iva || 0) > 0) {
                        traslados.push({
                            impuesto: '002',
                            tipo: 'Traslado',
                            tasa: parseFloat(det.tasa_iva).toFixed(6),
                            importe: Math.round(baseImp * parseFloat(det.tasa_iva) * 100) / 100
                        });
                    }

                    const retenciones = [];
                    if (parseFloat(det.tasa_ret_iva || 0) > 0) {
                        retenciones.push({
                            impuesto: '002',
                            tipo: 'Retencion',
                            tasa: parseFloat(det.tasa_ret_iva).toFixed(6),
                            importe: Math.round(baseImp * parseFloat(det.tasa_ret_iva) * 100) / 100
                        });
                    }
                    if (parseFloat(det.tasa_ret_isr || 0) > 0) {
                        retenciones.push({
                            impuesto: '001',
                            tipo: 'Retencion',
                            tasa: parseFloat(det.tasa_ret_isr).toFixed(6),
                            importe: Math.round(baseImp * parseFloat(det.tasa_ret_isr) * 100) / 100
                        });
                    }

                    return {
                        ...det,
                        importe: imp,
                        impuestos_trasladados: traslados,
                        impuestos_retenidos: retenciones
                    };
                })
            };

            if (isEditing && formData.id) {
                await api.put(`/recurrentes/${formData.id}`, payload);
                showToast('Suscripción actualizada correctamente', 'success');
            } else {
                await api.post('/recurrentes', payload);
                showToast('Suscripción recurrente programada exitosamente', 'success');
            }

            setShowModal(false);
            fetchRecurrentes();
            fetchStats();
        } catch (error) {
            console.error('Error saving subscription:', error);
            showToast(error.response?.data?.message || 'Error al guardar suscripción', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Toggle Subscription Status (Activa / Pausada)
    const handleToggleStatus = async (item) => {
        const nextEstado = item.estado === 'Activa' ? 'Pausada' : 'Activa';
        try {
            await api.patch(`/recurrentes/${item.id}/estado`, { estado: nextEstado });
            showToast(`Suscripción marcada como ${nextEstado}`, 'info');
            fetchRecurrentes();
            fetchStats();
        } catch (error) {
            console.error('Error toggling estado:', error);
            showToast('Error al cambiar el estado de la suscripción', 'error');
        }
    };

    // Execute Subscription manually right now
    const handleExecuteNow = async (item) => {
        if (!window.confirm(`¿Deseas emitir y generar la factura para la suscripción "${item.nombre_suscripcion}" ahora mismo?`)) {
            return;
        }

        try {
            setExecutingId(item.id);
            showToast(`Ejecutando suscripción "${item.nombre_suscripcion}"...`, 'info');
            const res = await api.post(`/recurrentes/${item.id}/ejecutar`);
            
            if (res.data?.success) {
                const doc = res.data.documento;
                const uuidMsg = res.data.uuid ? `UUID: ${res.data.uuid.slice(0, 8)}...` : 'Borrador generado';
                showToast(`¡Factura emitida exitosamente! Folio: ${doc?.serie || ''}-${doc?.folio || ''} (${uuidMsg})`, 'success');
                
                // If PDF is available, offer quick view
                if (doc?.pdf_url) {
                    openPdfViewer(doc.pdf_url, `Factura ${doc.serie || ''}-${doc.folio || ''}`);
                }
                
                fetchRecurrentes();
                fetchStats();
            } else {
                showToast(res.data?.message || 'No se pudo completar la emisión', 'warning');
            }
        } catch (error) {
            console.error('Error executing subscription manual:', error);
            const msg = error.response?.data?.message || error.message || 'Error al emitir factura recurrente';
            showToast(msg, 'error');
        } finally {
            setExecutingId(null);
        }
    };

    // Process Batch of Pending Subscriptions for today
    const handleProcessBatch = async () => {
        try {
            setBatchProcessing(true);
            showToast('Buscando y emitiendo suscripciones programadas para hoy...', 'info');
            const res = await api.post('/recurrentes/procesar-pendientes');
            
            if (res.data?.success) {
                showToast(`Proceso completado: ${res.data.total} suscripciones procesadas`, 'success');
                fetchRecurrentes();
                fetchStats();
            }
        } catch (error) {
            console.error('Error running batch:', error);
            showToast('Error al procesar suscripciones pendientes', 'error');
        } finally {
            setBatchProcessing(false);
        }
    };

    // Delete Subscription
    const handleDeleteSubscription = async (item) => {
        if (!window.confirm(`¿Estás seguro de eliminar la suscripción "${item.nombre_suscripcion}"? Esta acción cancelará las futuras emisiones programadas.`)) {
            return;
        }

        try {
            await api.delete(`/recurrentes/${item.id}`);
            showToast('Suscripción eliminada', 'info');
            fetchRecurrentes();
            fetchStats();
        } catch (error) {
            console.error('Error deleting subscription:', error);
            showToast('Error al eliminar suscripción', 'error');
        }
    };

    // Open History Modal
    const handleOpenHistory = async (item) => {
        try {
            setSelectedSubscription(item);
            setShowHistoryModal(true);
            setHistoryLoading(true);
            const res = await api.get(`/recurrentes/${item.id}`);
            setSelectedSubscription(res.data);
        } catch (error) {
            console.error('Error fetching subscription history:', error);
            showToast('Error al cargar historial', 'error');
        } finally {
            setHistoryLoading(false);
        }
    };

    // Add Concept Row
    const handleAddRow = () => {
        setFormData(prev => ({
            ...prev,
            detalles: [
                ...prev.detalles,
                {
                    clave_prod_serv: '81112100',
                    no_identificacion: '',
                    clave_unidad: 'E48',
                    unidad: 'Servicio',
                    descripcion: 'Servicio recurrente periodo {{PERIODO}}',
                    cantidad: 1,
                    valor_unitario: 0,
                    descuento: 0,
                    objeto_imp: '02',
                    tasa_iva: 0.16,
                    tasa_ret_iva: 0,
                    tasa_ret_isr: 0
                }
            ]
        }));
    };

    // Remove Concept Row
    const handleRemoveRow = (idx) => {
        setFormData(prev => ({
            ...prev,
            detalles: prev.detalles.filter((_, i) => i !== idx)
        }));
    };

    // Update Concept Row Field
    const handleUpdateRow = (idx, field, value) => {
        setFormData(prev => {
            const next = [...prev.detalles];
            next[idx] = { ...next[idx], [field]: value };
            return { ...prev, detalles: next };
        });
    };

    // Insert Dynamic Tag in Description
    const handleInsertTag = (idx, tag) => {
        setFormData(prev => {
            const next = [...prev.detalles];
            const currentDesc = next[idx].descripcion || '';
            next[idx] = { ...next[idx], descripcion: `${currentDesc} ${tag}`.trim() };
            return { ...prev, detalles: next };
        });
    };

    // Pick Concept from Catalog
    const handlePickCatalogConcept = (idx, conceptoId) => {
        const found = conceptosCat.find(c => c.id === parseInt(conceptoId));
        if (found) {
            setFormData(prev => {
                const next = [...prev.detalles];
                next[idx] = {
                    ...next[idx],
                    clave_prod_serv: found.clave_prod_serv || '81112100',
                    clave_unidad: found.clave_unidad || 'E48',
                    unidad: found.unidad || 'Servicio',
                    no_identificacion: found.codigo || '',
                    descripcion: found.descripcion || '',
                    valor_unitario: parseFloat(found.precio_unitario || 0)
                };
                return { ...prev, detalles: next };
            });
        }
    };

    const getEstadoBadge = (estado) => {
        switch (estado) {
            case 'Activa':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Activa</span>;
            case 'Pausada':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"><Pause className="w-3 h-3" /> Pausada</span>;
            case 'Completada':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200"><Check className="w-3 h-3" /> Completada</span>;
            case 'Cancelada':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200"><X className="w-3 h-3" /> Cancelada</span>;
            default:
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{estado}</span>;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-md text-white">
                            <CalendarClock className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Facturación Recurrente & Suscripciones</h1>
                            <p className="text-sm text-slate-500">Automatiza la emisión de facturas mensuales, igualas contables, rentas y servicios periódicos.</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleProcessBatch}
                        disabled={batchProcessing}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm shadow-sm transition-all disabled:opacity-50"
                        title="Emite de forma inmediata todas las suscripciones activas programadas para hoy"
                    >
                        <RefreshCw className={`w-4 h-4 ${batchProcessing ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
                        <span>{batchProcessing ? 'Procesando...' : 'Procesar Pendientes Hoy'}</span>
                    </button>

                    <button
                        onClick={handleNewSubscription}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium text-sm shadow-md transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nueva Suscripción</span>
                    </button>
                </div>
            </div>

            {/* KPI Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Suscripciones Activas</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.activas} <span className="text-sm font-normal text-slate-400">/ {stats.totalSuscripciones}</span></p>
                            <p className="text-xs text-slate-400 mt-0.5">{stats.pausadas} pausadas</p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ingreso Mensual Proyectado</p>
                            <p className="text-2xl font-bold text-cyan-700 mt-1">${stats.montoMensualProyectado?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Base recurrente estimada</p>
                        </div>
                        <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-600 border border-cyan-100">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Próximas en 7 Días</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.proximasEn7Dias}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Emisiones próximas en agenda</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Facturas Emitidas</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalFacturasEmitidas}</p>
                            <p className="text-xs text-slate-400 mt-0.5">CFDIs generados por el motor</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                            <FileText className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            )}

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, cliente, folio o serie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchRecurrentes()}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <span className="text-xs font-medium text-slate-500 mr-1">Estado:</span>
                    {['Todos', 'Activa', 'Pausada', 'Cancelada', 'Completada'].map((st) => (
                        <button
                            key={st}
                            onClick={() => { setStatusFilter(st); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === st
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {st}
                        </button>
                    ))}
                    <button
                        onClick={fetchRecurrentes}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 ml-2"
                        title="Actualizar listado"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
                        <p className="text-sm">Cargando suscripciones recurrentes...</p>
                    </div>
                ) : recurrentes.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                        <CalendarClock className="w-12 h-12 text-slate-300" />
                        <p className="font-semibold text-slate-700">No se encontraron suscripciones recurrentes</p>
                        <p className="text-xs text-slate-400 max-w-md">Crea una nueva suscripción periódica para emitir y timbrar facturas automáticamente en las fechas programadas.</p>
                        <button
                            onClick={handleNewSubscription}
                            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Crear primera suscripción
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                                <tr>
                                    <th className="py-3 px-4">Suscripción</th>
                                    <th className="py-3 px-4">Cliente / RFC</th>
                                    <th className="py-3 px-4">Frecuencia</th>
                                    <th className="py-3 px-4">Próxima Emisión</th>
                                    <th className="py-3 px-4 text-right">Total</th>
                                    <th className="py-3 px-4 text-center">Configuración</th>
                                    <th className="py-3 px-4 text-center">Estado</th>
                                    <th className="py-3 px-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {recurrentes.map((item) => {
                                    const isDue = item.proxima_emision && new Date(item.proxima_emision) <= new Date();
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-slate-900">{item.nombre_suscripcion}</div>
                                                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                    <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[11px] font-semibold text-slate-600">{item.serie || 'REC'}</span>
                                                    <span>• Folio actual: #{item.ultimo_folio || 0}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-800 line-clamp-1">{item.Receptor?.razon_social || 'Cliente'}</div>
                                                <div className="text-xs text-slate-400 font-mono">{item.Receptor?.rfc}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-700">{item.frecuencia}</div>
                                                <div className="text-xs text-slate-400">Día {item.dia_ejecucion} de corte</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className={`font-semibold text-xs flex items-center gap-1.5 ${isDue ? 'text-amber-600' : 'text-slate-700'}`}>
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span>{item.proxima_emision || 'N/A'}</span>
                                                    {isDue && (
                                                        <span className="px-1.5 py-0.2 text-[10px] bg-amber-100 text-amber-800 rounded font-bold">HOY / PENDIENTE</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    {item.total_facturas_emitidas || 0} emitidas hasta hoy
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <span className="font-bold text-slate-900">${parseFloat(item.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <div className="text-[11px] text-slate-400 uppercase">{item.moneda || 'MXN'}</div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span 
                                                        title={item.auto_timbrar ? 'Timbrado automático ante el SAT activado' : 'Genera borrador de factura sin timbrar'}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.auto_timbrar ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500'}`}
                                                    >
                                                        {item.auto_timbrar ? 'PAC AUTO' : 'BORRADOR'}
                                                    </span>
                                                    {item.enviar_email && (
                                                        <span 
                                                            title="Envío automático por correo activado" 
                                                            className="p-1 text-blue-600 bg-blue-50 rounded"
                                                        >
                                                            <Send className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {getEstadoBadge(item.estado)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Emitir Ahora */}
                                                    <button
                                                        onClick={() => handleExecuteNow(item)}
                                                        disabled={executingId === item.id}
                                                        className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title="Emitir y timbrar factura de esta suscripción en este momento"
                                                    >
                                                        {executingId === item.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                                        ) : (
                                                            <Play className="w-4 h-4 fill-emerald-600" />
                                                        )}
                                                    </button>

                                                    {/* Historial */}
                                                    <button
                                                        onClick={() => handleOpenHistory(item)}
                                                        className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Ver historial de facturas generadas"
                                                    >
                                                        <History className="w-4 h-4" />
                                                    </button>

                                                    {/* Pausar / Reanudar */}
                                                    <button
                                                        onClick={() => handleToggleStatus(item)}
                                                        className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title={item.estado === 'Activa' ? 'Pausar suscripción' : 'Reanudar suscripción'}
                                                    >
                                                        {item.estado === 'Activa' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                                    </button>

                                                    {/* Editar */}
                                                    <button
                                                        onClick={() => handleEditSubscription(item)}
                                                        className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Editar suscripción y conceptos"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>

                                                    {/* Eliminar */}
                                                    <button
                                                        onClick={() => handleDeleteSubscription(item)}
                                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar suscripción"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Crear / Editar Suscripción Recurrente */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-600 text-white rounded-xl">
                                    <CalendarClock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg">
                                        {isEditing ? 'Editar Suscripción Recurrente' : 'Nueva Suscripción de Facturación Recurrente'}
                                    </h3>
                                    <p className="text-xs text-slate-500">Configura la regla de emisión periódica y sus conceptos con variables dinámicas.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveSubscription} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {/* Bloque 1: Datos Generales */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Info className="w-4 h-4 text-cyan-600" />
                                    Datos de la Suscripción & Cliente
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Suscripción *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Mantenimiento Servidores Cloud - ACME Corp"
                                            value={formData.nombre_suscripcion}
                                            onChange={(e) => setFormData({ ...formData, nombre_suscripcion: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Serie de Facturación</label>
                                        <input
                                            type="text"
                                            placeholder="REC"
                                            value={formData.serie}
                                            onChange={(e) => setFormData({ ...formData, serie: e.target.value.toUpperCase() })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente Receptor (RFC) *</label>
                                        <select
                                            required
                                            value={formData.receptor_id}
                                            onChange={(e) => setFormData({ ...formData, receptor_id: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        >
                                            <option value="">-- Selecciona el cliente --</option>
                                            {receptores.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.razon_social} ({r.rfc}) {r.correo ? `- ${r.correo}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 2: Frecuencia y Fechas */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-cyan-600" />
                                    Periodicidad & Calendario de Emisión
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Frecuencia *</label>
                                        <select
                                            value={formData.frecuencia}
                                            onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        >
                                            {FRECUENCIAS.map((f) => (
                                                <option key={f.value} value={f.value}>{f.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Día de Emisión (1-31)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={formData.dia_ejecucion}
                                            onChange={(e) => setFormData({ ...formData, dia_ejecucion: parseInt(e.target.value) || 1 })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Inicio *</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.fecha_inicio}
                                            onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Próxima Emisión *</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.proxima_emision}
                                            onChange={(e) => setFormData({ ...formData, proxima_emision: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Término (Opcional)</label>
                                        <input
                                            type="date"
                                            value={formData.fecha_fin}
                                            onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        />
                                        <p className="text-[11px] text-slate-400 mt-0.5">Dejar vacío para suscripción indefinida (hasta que se pause o cancele).</p>
                                    </div>

                                    <div className="sm:col-span-2 flex flex-col justify-center space-y-2 pt-2">
                                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.auto_timbrar}
                                                onChange={(e) => setFormData({ ...formData, auto_timbrar: e.target.checked })}
                                                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                                            />
                                            <span>Timbrar automáticamente con PAC en cada emisión</span>
                                        </label>

                                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.enviar_email}
                                                onChange={(e) => setFormData({ ...formData, enviar_email: e.target.checked })}
                                                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                                            />
                                            <span>Enviar PDF y XML al correo del cliente al emitirse</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 3: Datos Fiscales CFDI 4.0 */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-cyan-600" />
                                    Parámetros Fiscales SAT
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Método de Pago</label>
                                        <select
                                            value={formData.metodo_pago}
                                            onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        >
                                            <option value="PUE">PUE - Pago en una sola exhibición</option>
                                            <option value="PPD">PPD - Pago en parcialidades o diferido</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Forma de Pago</label>
                                        <select
                                            value={formData.forma_pago}
                                            onChange={(e) => setFormData({ ...formData, forma_pago: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        >
                                            {FORMAS_PAGO.map((fp) => (
                                                <option key={fp.clave} value={fp.clave}>{fp.descripcion}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Uso de CFDI</label>
                                        <select
                                            value={formData.uso_cfdi}
                                            onChange={(e) => setFormData({ ...formData, uso_cfdi: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        >
                                            {USOS_CFDI.map((u) => (
                                                <option key={u.clave} value={u.clave}>{u.descripcion}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 4: Partidas y Conceptos con Variables Dinámicas */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900">Conceptos y Partidas de la Factura</h4>
                                        <p className="text-xs text-slate-500">Agrega los conceptos que se cobrarán en cada factura recurrente.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddRow}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 text-xs font-semibold transition-all self-start sm:self-auto"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Agregar Concepto
                                    </button>
                                </div>

                                {/* Banner explicativo de variables dinámicas */}
                                <div className="p-3 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl text-xs text-cyan-900 space-y-1.5">
                                    <div className="flex items-center gap-2 font-bold text-cyan-800">
                                        <Sparkles className="w-4 h-4 text-cyan-600" />
                                        <span>Variables Dinámicas en Descripciones:</span>
                                    </div>
                                    <p className="text-cyan-700">
                                        Puedes hacer clic en los tags abajo para insertarlos en la descripción del concepto activo. Se reemplazarán automáticamente con el mes o año real al momento de timbrar:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {TAGS_DINAMICOS.map((t) => (
                                            <button
                                                key={t.tag}
                                                type="button"
                                                onClick={() => handleInsertTag(0, t.tag)}
                                                className="px-2 py-1 bg-white border border-cyan-300 hover:border-cyan-500 rounded text-cyan-800 font-mono text-[11px] font-semibold transition-all shadow-2xs hover:bg-cyan-50"
                                                title={`Insertar ${t.tag} (${t.desc})`}
                                            >
                                                {t.tag} <span className="text-[9px] font-sans text-cyan-600 font-normal">({t.desc})</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Lista de Partidas */}
                                <div className="space-y-3">
                                    {formData.detalles.map((row, idx) => {
                                        const rowTotal = Math.round(((row.cantidad * row.valor_unitario) - row.descuento) * 100) / 100;
                                        return (
                                            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-700">Partida #{idx + 1}</span>

                                                        {/* Concepto catalog selector */}
                                                        {conceptosCat.length > 0 && (
                                                            <select
                                                                onChange={(e) => handlePickCatalogConcept(idx, e.target.value)}
                                                                defaultValue=""
                                                                className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 text-slate-600 focus:outline-none"
                                                            >
                                                                <option value="">-- Cargar de catálogo --</option>
                                                                {conceptosCat.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion?.slice(0, 35)}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>

                                                    {formData.detalles.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveRow(idx)}
                                                            className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                                            title="Eliminar partida"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Clave SAT</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="81112100"
                                                            value={row.clave_prod_serv}
                                                            onChange={(e) => handleUpdateRow(idx, 'clave_prod_serv', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Clave Unidad</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="E48"
                                                            value={row.clave_unidad}
                                                            onChange={(e) => handleUpdateRow(idx, 'clave_unidad', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <label className="block text-[11px] font-semibold text-slate-600">Descripción del Servicio / Producto *</label>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleInsertTag(idx, '{{MES}} {{AÑO}}')}
                                                                    className="text-[10px] text-cyan-600 hover:text-cyan-800 font-medium underline"
                                                                >
                                                                    + {'{{MES}} {{AÑO}}'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="Ej: Servicio de consultoría correspondiente a {{MES}} {{AÑO}}"
                                                            value={row.descripcion}
                                                            onChange={(e) => handleUpdateRow(idx, 'descripcion', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cantidad</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0.0001"
                                                            required
                                                            value={row.cantidad}
                                                            onChange={(e) => handleUpdateRow(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Precio Unitario ($)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            required
                                                            value={row.valor_unitario}
                                                            onChange={(e) => handleUpdateRow(idx, 'valor_unitario', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Descuento ($)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={row.descuento}
                                                            onChange={(e) => handleUpdateRow(idx, 'descuento', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">IVA Trasladado</label>
                                                        <select
                                                            value={row.tasa_iva}
                                                            onChange={(e) => handleUpdateRow(idx, 'tasa_iva', parseFloat(e.target.value))}
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                                                        >
                                                            <option value={0.16}>16% IVA</option>
                                                            <option value={0.08}>8% Frontera</option>
                                                            <option value={0}>0% Tasa Cero</option>
                                                            <option value={-1}>Exento</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ret. IVA</label>
                                                        <select
                                                            value={row.tasa_ret_iva}
                                                            onChange={(e) => handleUpdateRow(idx, 'tasa_ret_iva', parseFloat(e.target.value))}
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                                                        >
                                                            <option value={0}>Sin retención</option>
                                                            <option value={0.106667}>10.6667% (2/3 IVA)</option>
                                                            <option value={0.04}>4% Fletes</option>
                                                            <option value={0.16}>16% Completo</option>
                                                        </select>
                                                    </div>

                                                    <div className="flex flex-col justify-end">
                                                        <span className="text-[11px] text-slate-500">Subtotal partida:</span>
                                                        <span className="font-bold text-slate-900 text-sm font-mono">${rowTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Resumen de Totales */}
                            <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs text-slate-400 uppercase font-semibold">Resumen de Facturación Recurrente</p>
                                    <p className="text-sm text-slate-300 mt-1">Este monto se liquidará o cobrará en cada ciclo de corte de la suscripción.</p>
                                </div>

                                <div className="w-full md:w-auto flex flex-wrap items-center gap-6 justify-end text-right">
                                    <div>
                                        <p className="text-xs text-slate-400">Subtotal</p>
                                        <p className="font-mono text-sm text-slate-200">${computedTotals.subtotal.toFixed(2)}</p>
                                    </div>
                                    {computedTotals.descuento > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-400">Descuento</p>
                                            <p className="font-mono text-sm text-amber-400">-${computedTotals.descuento.toFixed(2)}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs text-slate-400">IVA Trasladado</p>
                                        <p className="font-mono text-sm text-slate-200">+${computedTotals.totalTraslados.toFixed(2)}</p>
                                    </div>
                                    {computedTotals.totalRetenciones > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-400">Retenciones</p>
                                            <p className="font-mono text-sm text-rose-400">-${computedTotals.totalRetenciones.toFixed(2)}</p>
                                        </div>
                                    )}
                                    <div className="pl-4 border-l border-slate-700">
                                        <p className="text-xs text-cyan-400 font-bold uppercase">TOTAL POR CICLO</p>
                                        <p className="font-mono text-2xl font-black text-white">${computedTotals.total.toFixed(2)} <span className="text-xs font-normal text-slate-400">{formData.moneda}</span></p>
                                    </div>
                                </div>
                            </div>
                        </form>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSubscription}
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>{isEditing ? 'Guardar Cambios' : 'Crear y Programar Suscripción'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Historial de Emisiones */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 text-white rounded-xl">
                                    <History className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">Historial de Facturas Emitidas</h3>
                                    <p className="text-xs text-slate-500">
                                        Suscripción: <span className="font-semibold text-slate-800">{selectedSubscription?.nombre_suscripcion}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {historyLoading ? (
                                <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                    <p className="text-sm">Cargando bitácora de ejecuciones...</p>
                                </div>
                            ) : (!selectedSubscription?.historial || selectedSubscription.historial.length === 0) ? (
                                <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                                    <Clock className="w-10 h-10 text-slate-300" />
                                    <p className="font-medium text-slate-700">Aún no se han emitido facturas para esta suscripción</p>
                                    <p className="text-xs text-slate-400">Las facturas aparecerán aquí automáticamente conforme se ejecuten en su fecha programada o al hacer clic en "Emitir Ahora".</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                    <table className="w-full text-left text-sm text-slate-600">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                                            <tr>
                                                <th className="py-2.5 px-3">Fecha Ejecución</th>
                                                <th className="py-2.5 px-3">Folio / Comprobante</th>
                                                <th className="py-2.5 px-3">UUID Fiscal</th>
                                                <th className="py-2.5 px-3 text-right">Monto</th>
                                                <th className="py-2.5 px-3 text-center">Estado</th>
                                                <th className="py-2.5 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedSubscription.historial.map((log) => {
                                                const doc = log.documento;
                                                return (
                                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-2.5 px-3 text-xs text-slate-700">
                                                            {new Date(log.fecha_ejecucion).toLocaleString('es-MX')}
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            <div className="font-semibold text-slate-900 text-xs">
                                                                {doc?.serie ? `${doc.serie}-${doc.folio}` : `Folio #${doc?.folio || log.documento_id || 'N/A'}`}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">{log.mensaje}</div>
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                                                            {log.uuid ? (
                                                                <span title={log.uuid}>{log.uuid.slice(0, 8)}...{log.uuid.slice(-6)}</span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">Borrador no timbrado</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                                                            ${parseFloat(log.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center">
                                                            {log.estado === 'Exitoso' ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">EXITOSO</span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">ERROR</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                {doc?.pdf_url && (
                                                                    <button
                                                                        onClick={() => openPdfViewer(doc.pdf_url, `Factura ${doc.serie || ''}-${doc.folio || ''}`)}
                                                                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                                        title="Ver PDF en Visor Interactivo"
                                                                    >
                                                                        <FileText className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {doc?.xml_url && (
                                                                    <a
                                                                        href={doc.xml_url}
                                                                        download
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="p-1 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                                                        title="Descargar archivo XML"
                                                                    >
                                                                        <Download className="w-4 h-4" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

