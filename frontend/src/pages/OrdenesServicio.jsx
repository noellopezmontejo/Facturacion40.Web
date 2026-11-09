import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Plus, Search, FileText, RefreshCw, Eye, Laptop, X, Filter, Wrench, 
    CheckCircle2, Clock, Printer, Loader2, Camera, Video, Image as ImageIcon, 
    Upload, Trash2, Maximize2, Play, AlertCircle, FileCheck, Save, Edit3, Calendar
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { openPdfViewer } from '../utils/pdfViewer';

export const OrdenesServicio = () => {
    const [ordenes, setOrdenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    
    // Modal de Detalle
    const [selectedOrden, setSelectedOrden] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    
    // Modal de Edición (Diagnóstico y Servicios / Refacciones)
    const [editOrden, setEditOrden] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [conceptosCat, setConceptosCat] = useState([]);
    const [newDetalle, setNewDetalle] = useState({
        tipo_detalle: 'Servicio',
        descripcion: '',
        cantidad: 1,
        valor_unitario: 0,
        clave_prod_serv: '81112306',
        clave_unidad: 'E48'
    });

    // Estados de Impresión
    const [printingId, setPrintingId] = useState(null);

    // Estados de Multimedia
    const [quickMediaOrden, setQuickMediaOrden] = useState(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [mediaDescripcion, setMediaDescripcion] = useState('');
    const [lightboxImage, setLightboxImage] = useState(null);
    const fileInputRef = useRef(null);

    const { showToast } = useToast();
    const { activeEmisor } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrdenes();
        if (activeEmisor) {
            api.get(`/conceptos/emisor/${activeEmisor.id}`)
                .then(res => setConceptosCat(Array.isArray(res.data) ? res.data : []))
                .catch(() => {});
        }
    }, [activeEmisor]);

    const fetchOrdenes = async () => {
        try {
            setLoading(true);
            const url = activeEmisor ? `/ordenes-servicio?emisorId=${activeEmisor.id}` : '/ordenes-servicio';
            const response = await api.get(url);
            setOrdenes(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching ordenes:', error);
            showToast('Error al cargar órdenes de servicio', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = async (id) => {
        setLoadingDetail(true);
        try {
            const res = await api.get(`/ordenes-servicio/${id}`);
            setSelectedOrden(res.data);
        } catch (error) {
            console.error('Error fetching orden detail:', error);
            showToast('Error al cargar el detalle de la orden de servicio', 'error');
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleOpenEdit = async (orden) => {
        let fullOrden = orden;
        try {
            const res = await api.get(`/ordenes-servicio/${orden.id}`);
            if (res.data) fullOrden = res.data;
        } catch (e) {
            console.error('Error fetching full orden for edit', e);
        }

        const rawDetalles = Array.isArray(fullOrden.detalles) ? fullOrden.detalles : [];
        setEditOrden({
            id: fullOrden.id,
            folio: fullOrden.folio || `#${fullOrden.id}`,
            estado: fullOrden.estado || 'En Diagnóstico',
            diagnostico_tecnico: fullOrden.diagnostico_tecnico || '',
            falla_reportada: fullOrden.falla_reportada || '',
            equipo: fullOrden.equipo || '',
            marca: fullOrden.marca || '',
            modelo: fullOrden.modelo || '',
            numero_serie: fullOrden.numero_serie || '',
            fecha_entrega_estimada: fullOrden.fecha_entrega_estimada ? fullOrden.fecha_entrega_estimada.slice(0, 10) : '',
            fecha_entrega_real: fullOrden.fecha_entrega_real ? fullOrden.fecha_entrega_real.slice(0, 10) : '',
            detalles: rawDetalles.map(d => ({
                id: d.id,
                concepto_id: d.concepto_id || null,
                tipo_detalle: d.tipo_detalle || 'Servicio',
                descripcion: d.descripcion || '',
                cantidad: parseFloat(d.cantidad || 1),
                valor_unitario: parseFloat(d.valor_unitario || 0),
                importe: parseFloat(d.importe || 0),
                descuento: parseFloat(d.descuento || 0),
                clave_prod_serv: d.clave_prod_serv || '81112306',
                clave_unidad: d.clave_unidad || 'E48'
            }))
        });

        setNewDetalle({
            tipo_detalle: 'Servicio',
            descripcion: '',
            cantidad: 1,
            valor_unitario: 0,
            clave_prod_serv: '81112306',
            clave_unidad: 'E48'
        });
    };

    const handleAddDetalleToEdit = () => {
        if (!newDetalle.descripcion.trim()) {
            showToast('Ingresa una descripción para el concepto', 'warning');
            return;
        }
        const cant = parseFloat(newDetalle.cantidad || 1);
        const precio = parseFloat(newDetalle.valor_unitario || 0);
        const importe = cant * precio;

        const item = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            concepto_id: newDetalle.concepto_id || null,
            tipo_detalle: newDetalle.tipo_detalle || 'Servicio',
            descripcion: newDetalle.descripcion.trim(),
            cantidad: cant,
            valor_unitario: precio,
            importe: importe,
            descuento: 0,
            clave_prod_serv: newDetalle.clave_prod_serv || '81112306',
            clave_unidad: newDetalle.clave_unidad || 'E48'
        };

        setEditOrden(prev => ({
            ...prev,
            detalles: [...prev.detalles, item]
        }));

        setNewDetalle({
            tipo_detalle: 'Servicio',
            descripcion: '',
            cantidad: 1,
            valor_unitario: 0,
            clave_prod_serv: '81112306',
            clave_unidad: 'E48'
        });
    };

    const handleRemoveDetalleFromEdit = (indexToRemove) => {
        setEditOrden(prev => ({
            ...prev,
            detalles: prev.detalles.filter((_, idx) => idx !== indexToRemove)
        }));
    };

    const handleConceptoSelect = (e) => {
        const conceptoId = e.target.value;
        if (!conceptoId) return;
        const found = conceptosCat.find(c => String(c.id) === String(conceptoId));
        if (found) {
            setNewDetalle(prev => ({
                ...prev,
                concepto_id: found.id,
                descripcion: found.descripcion || '',
                valor_unitario: parseFloat(found.precio_unitario || 0),
                clave_prod_serv: found.clave_prod_serv || '81112306',
                clave_unidad: found.clave_unidad || 'E48'
            }));
        }
    };

    const handleSaveEdit = async () => {
        if (!editOrden) return;
        try {
            setSavingEdit(true);
            
            // Calcular totales a partir de los detalles
            let subtotal = 0;
            (editOrden.detalles || []).forEach(d => {
                const cant = parseFloat(d.cantidad || 1);
                const precio = parseFloat(d.valor_unitario || 0);
                subtotal += (cant * precio);
            });
            const iva = Math.round(subtotal * 0.16 * 100) / 100;
            const total = subtotal + iva;

            const payload = {
                estado: editOrden.estado,
                diagnostico_tecnico: editOrden.diagnostico_tecnico,
                fecha_entrega_estimada: editOrden.fecha_entrega_estimada ? editOrden.fecha_entrega_estimada : null,
                fecha_entrega_real: editOrden.fecha_entrega_real ? editOrden.fecha_entrega_real : null,
                subtotal: subtotal,
                descuento: 0,
                total_impuestos_trasladados: iva,
                total_impuestos_retenidos: 0,
                total: total,
                detalles: (editOrden.detalles || []).map(d => ({
                    concepto_id: d.concepto_id || null,
                    tipo_detalle: d.tipo_detalle || 'Servicio',
                    descripcion: d.descripcion,
                    cantidad: parseFloat(d.cantidad || 1),
                    valor_unitario: parseFloat(d.valor_unitario || 0),
                    importe: parseFloat(d.cantidad || 1) * parseFloat(d.valor_unitario || 0),
                    descuento: 0,
                    clave_prod_serv: d.clave_prod_serv || '81112306',
                    clave_unidad: d.clave_unidad || 'E48',
                    impuestos_trasladados: [{
                        impuesto: '002',
                        tipo: 'Traslado',
                        tasa: '0.160000',
                        importe: Math.round(parseFloat(d.cantidad || 1) * parseFloat(d.valor_unitario || 0) * 0.16 * 100) / 100
                    }]
                }))
            };

            const res = await api.put(`/ordenes-servicio/${editOrden.id}`, payload);
            if (res.data?.success) {
                showToast('Diagnóstico y servicios actualizados correctamente', 'success');
                const updated = res.data.orden;

                if (selectedOrden && selectedOrden.id === updated.id) {
                    setSelectedOrden(updated);
                }

                setOrdenes(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
                setEditOrden(null);
            }
        } catch (error) {
            console.error('Error guardando orden:', error);
            showToast('Error al guardar diagnóstico y servicios', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    const handlePrintReporte = async (ordenId, folio) => {
        try {
            setPrintingId(ordenId);
            showToast('Generando Reporte de Seguimiento en PDF...', 'info');
            const res = await api.get(`/ordenes-servicio/${ordenId}/pdf`);
            if (res.data?.success && res.data?.pdfUrl) {
                await openPdfViewer(res.data.pdfUrl, `Reporte Seguimiento ${folio || ordenId}`);
                showToast('Reporte generado exitosamente', 'success');
            } else {
                showToast('No se pudo generar el reporte de seguimiento', 'error');
            }
        } catch (error) {
            console.error('Error imprimiendo reporte de orden:', error);
            showToast('Error al emitir el reporte de seguimiento de la orden', 'error');
        } finally {
            setPrintingId(null);
        }
    };

    const resolveMediaUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        const apiBase = api.defaults.baseURL || '/api';
        const rootHost = apiBase.startsWith('http')
            ? apiBase.replace(/\/api\/?$/, '')
            : (typeof window !== 'undefined' ? window.location.origin : '');
        return `${rootHost}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const handleUploadEvidencias = async (ordenId) => {
        if (!selectedFiles || selectedFiles.length === 0) {
            showToast('Selecciona al menos una foto o video para subir', 'warning');
            return;
        }

        try {
            setUploadingMedia(true);
            const formData = new FormData();
            for (let i = 0; i < selectedFiles.length; i++) {
                formData.append('archivos', selectedFiles[i]);
            }
            if (mediaDescripcion.trim()) {
                formData.append('descripcion', mediaDescripcion.trim());
            }

            const res = await api.post(`/ordenes-servicio/${ordenId}/evidencias`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.success) {
                showToast(res.data.message || 'Evidencias subidas con éxito', 'success');
                const updatedList = res.data.evidencias || [];
                
                if (selectedOrden && selectedOrden.id === ordenId) {
                    setSelectedOrden(prev => ({
                        ...prev,
                        evidencias_multimedia: updatedList
                    }));
                }

                if (quickMediaOrden && quickMediaOrden.id === ordenId) {
                    setQuickMediaOrden(prev => ({
                        ...prev,
                        evidencias_multimedia: updatedList
                    }));
                }

                setOrdenes(prev => prev.map(o => o.id === ordenId ? { ...o, evidencias_multimedia: updatedList } : o));

                setSelectedFiles([]);
                setMediaDescripcion('');
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Error subiendo evidencias:', error);
            showToast('Error al subir archivos multimedia', 'error');
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleDeleteEvidencia = async (ordenId, evidenciaId) => {
        if (!window.confirm('¿Seguro que deseas eliminar esta evidencia multimedia?')) return;

        try {
            const res = await api.delete(`/ordenes-servicio/${ordenId}/evidencias/${evidenciaId}`);
            if (res.data?.success) {
                showToast('Evidencia eliminada correctamente', 'success');
                const updatedList = res.data.evidencias || [];

                if (selectedOrden && selectedOrden.id === ordenId) {
                    setSelectedOrden(prev => ({
                        ...prev,
                        evidencias_multimedia: updatedList
                    }));
                }

                if (quickMediaOrden && quickMediaOrden.id === ordenId) {
                    setQuickMediaOrden(prev => ({
                        ...prev,
                        evidencias_multimedia: updatedList
                    }));
                }

                setOrdenes(prev => prev.map(o => o.id === ordenId ? { ...o, evidencias_multimedia: updatedList } : o));
            }
        } catch (error) {
            console.error('Error eliminando evidencia:', error);
            showToast('Error al eliminar evidencia multimedia', 'error');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Recibido':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'En Diagnóstico':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Esperando Aprobación':
                return 'bg-orange-50 text-orange-700 border-orange-200';
            case 'En Reparación':
                return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'Reparado':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Entregado':
                return 'bg-teal-50 text-teal-700 border-teal-200';
            case 'Cancelado':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Facturado':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const filteredOrdenes = ordenes.filter((orden) => {
        const matchesSearch =
            (orden.folio && orden.folio.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.equipo && orden.equipo.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.marca && orden.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.modelo && orden.modelo.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.numero_serie && orden.numero_serie.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.Receptor?.razon_social && orden.Receptor.razon_social.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'Todos' || orden.estado === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getEvidenciasCount = (orden) => {
        const evs = Array.isArray(orden.evidencias_multimedia)
            ? orden.evidencias_multimedia
            : (typeof orden.evidencias_multimedia === 'string'
                ? JSON.parse(orden.evidencias_multimedia || '[]')
                : []);
        const fotos = evs.filter(e => e.tipo !== 'video').length;
        const videos = evs.filter(e => e.tipo === 'video').length;
        return { total: evs.length, fotos, videos };
    };

    // Cálculos en vivo para el modal de edición
    const editSubtotal = (editOrden?.detalles || []).reduce((acc, d) => acc + (parseFloat(d.cantidad || 1) * parseFloat(d.valor_unitario || 0)), 0);
    const editIva = Math.round(editSubtotal * 0.16 * 100) / 100;
    const editTotal = editSubtotal + editIva;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Órdenes de Servicio</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Control de equipos de cómputo en recepción, seguimiento técnico, diagnóstico y evidencias multimedia.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={fetchOrdenes}
                        className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-slate-200 bg-white"
                        title="Actualizar listado"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => navigate('/ordenes-servicio/nueva')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 shadow-sm shadow-primary-500/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nueva Orden</span>
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        placeholder="Buscar por folio, cliente, equipo o serie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:border-primary-500"
                    >
                        <option value="Todos">Todos</option>
                        <option value="Recibido">Recibido</option>
                        <option value="En Diagnóstico">En Diagnóstico</option>
                        <option value="Esperando Aprobación">Esperando Aprobación</option>
                        <option value="En Reparación">En Reparación</option>
                        <option value="Reparado">Reparado</option>
                        <option value="Entregado">Entregado</option>
                        <option value="Facturado">Facturado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-600 animate-spin mx-auto mb-4"></div>
                            <p className="text-sm">Cargando órdenes de servicio...</p>
                        </div>
                    ) : filteredOrdenes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
                            <Laptop className="w-16 h-16 mb-4 text-slate-200" />
                            <p className="font-medium text-lg text-slate-600 mb-1">No se encontraron órdenes de servicio</p>
                            <p className="text-sm text-slate-400">
                                {searchTerm || statusFilter !== 'Todos'
                                    ? 'Prueba modificando los filtros de búsqueda.'
                                    : 'Aún no has registrado órdenes de servicio para este emisor.'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider">
                                    <th className="p-4 font-semibold w-28">Folio</th>
                                    <th className="p-4 font-semibold w-32">Ingreso</th>
                                    <th className="p-4 font-semibold">Cliente</th>
                                    <th className="p-4 font-semibold">Equipo</th>
                                    <th className="p-4 font-semibold text-center w-36">Estado</th>
                                    <th className="p-4 font-semibold text-center w-28">Evidencias</th>
                                    <th className="p-4 font-semibold text-right w-36">Total</th>
                                    <th className="p-4 font-semibold text-right w-52">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredOrdenes.map((orden) => {
                                    const counts = getEvidenciasCount(orden);
                                    return (
                                        <tr key={orden.id} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="p-4 font-mono font-semibold text-slate-800">
                                                {orden.folio || `#${orden.id}`}
                                            </td>
                                            <td className="p-4 text-slate-600">
                                                {orden.fecha_ingreso
                                                    ? new Date(orden.fecha_ingreso).toLocaleDateString('es-MX', {
                                                          day: '2-digit',
                                                          month: 'short',
                                                          year: 'numeric'
                                                      })
                                                    : '-'}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-slate-800">
                                                    {orden.Receptor?.razon_social || 'Cliente no especificado'}
                                                </div>
                                                {orden.Receptor?.rfc && (
                                                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                                                        {orden.Receptor.rfc}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-slate-100 rounded text-slate-600">
                                                        <Laptop className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-slate-800 block">
                                                            {orden.equipo || 'Equipo sin especificar'}
                                                        </span>
                                                        {(orden.marca || orden.modelo) && (
                                                            <span className="text-xs text-slate-400">
                                                                {[orden.marca, orden.modelo].filter(Boolean).join(' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                                                        orden.estado
                                                    )}`}
                                                >
                                                    {orden.estado}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setQuickMediaOrden(orden)}
                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                                        counts.total > 0
                                                            ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200'
                                                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                                    title="Gestionar fotos y videos de evidencia"
                                                >
                                                    <Camera className="w-3.5 h-3.5" />
                                                    <span>{counts.total}</span>
                                                    {counts.videos > 0 && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="font-bold text-slate-800">
                                                    ${Number(orden.total || 0).toLocaleString('es-MX', {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </span>
                                                <span className="text-[11px] text-slate-400 ml-1 uppercase">
                                                    {orden.moneda || 'MXN'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleViewDetail(orden.id)}
                                                        className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                                                        title="Ver ficha técnica de orden"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenEdit(orden)}
                                                        className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors border border-amber-200/60"
                                                        title="Subir Diagnóstico y Servicios / Refacciones"
                                                    >
                                                        <Wrench className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintReporte(orden.id, orden.folio)}
                                                        disabled={printingId === orden.id}
                                                        className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-50"
                                                        title="Emitir Reporte de Seguimiento (PDF)"
                                                    >
                                                        {printingId === orden.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                                                        ) : (
                                                            <Printer className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    {orden.estado !== 'Facturado' && (
                                                        <button
                                                            onClick={() => navigate('/facturas/nueva', { state: { ordenServicioId: orden.id } })}
                                                            className="px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                                                            title="Facturar Orden"
                                                        >
                                                            Facturar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Count */}
                {!loading && filteredOrdenes.length > 0 && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
                        <span>Mostrando {filteredOrdenes.length} de {ordenes.length} órdenes</span>
                    </div>
                )}
            </div>

            {/* Detail Modal with Full Order Info & Evidences */}
            {selectedOrden && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-4 px-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                                    <Laptop className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-800 text-lg">
                                        Orden {selectedOrden.folio || `#${selectedOrden.id}`}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Ingreso: {new Date(selectedOrden.fecha_ingreso).toLocaleDateString('es-MX', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleOpenEdit(selectedOrden)}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                                    title="Actualizar Diagnóstico y Conceptos"
                                >
                                    <Wrench className="w-3.5 h-3.5" />
                                    Actualizar Diagnóstico / Partidas
                                </button>
                                <button
                                    onClick={() => handlePrintReporte(selectedOrden.id, selectedOrden.folio)}
                                    disabled={printingId === selectedOrden.id}
                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                                    title="Imprimir Reporte Técnico"
                                >
                                    {printingId === selectedOrden.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" />
                                    ) : (
                                        <Printer className="w-3.5 h-3.5 text-primary-600" />
                                    )}
                                    Reporte de Seguimiento
                                </button>
                                <button
                                    onClick={() => setSelectedOrden(null)}
                                    className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Cliente y Estado */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                                <div>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                        Cliente
                                    </span>
                                    <p className="font-bold text-slate-800">
                                        {selectedOrden.Receptor?.razon_social || 'N/A'}
                                    </p>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                                        RFC: {selectedOrden.Receptor?.rfc || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                        Estado de la Orden
                                    </span>
                                    <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                                            selectedOrden.estado
                                        )}`}
                                    >
                                        {selectedOrden.estado}
                                    </span>
                                </div>
                            </div>

                            {/* Datos del Equipo */}
                            <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <Laptop className="w-4 h-4 text-primary-600" />
                                    Datos del Equipo
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                                    <div>
                                        <span className="text-slate-400 block">Tipo / Equipo:</span>
                                        <span className="font-semibold text-slate-800">{selectedOrden.equipo || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Marca / Modelo:</span>
                                        <span className="font-semibold text-slate-800">{[selectedOrden.marca, selectedOrden.modelo].filter(Boolean).join(' ') || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Número de Serie:</span>
                                        <span className="font-mono text-slate-700">{selectedOrden.numero_serie || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Contraseña:</span>
                                        <span className="font-mono text-slate-700">{selectedOrden.contrasena_equipo || 'Sin contraseña'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-slate-400 block">Accesorios Recibidos:</span>
                                        <span className="text-slate-700">{selectedOrden.accesorios_incluidos || 'Ninguno'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Falla y Diagnóstico */}
                            <div className="space-y-3">
                                {selectedOrden.falla_reportada && (
                                    <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-100 text-xs">
                                        <span className="font-semibold text-rose-800 block mb-0.5">Falla reportada por el cliente:</span>
                                        <p className="text-slate-700 whitespace-pre-wrap">{selectedOrden.falla_reportada}</p>
                                    </div>
                                )}

                                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-blue-800">Diagnóstico Técnico:</span>
                                        <button
                                            onClick={() => handleOpenEdit(selectedOrden)}
                                            className="text-primary-600 hover:text-primary-800 text-[11px] font-semibold flex items-center gap-1"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            {selectedOrden.diagnostico_tecnico ? 'Editar Diagnóstico' : 'Capturar Diagnóstico'}
                                        </button>
                                    </div>
                                    <p className="text-slate-700 whitespace-pre-wrap">
                                        {selectedOrden.diagnostico_tecnico || 'Aún no se ha registrado diagnóstico técnico para esta orden.'}
                                    </p>
                                </div>
                            </div>

                            {/* Detalle de conceptos o refacciones */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Servicios y Refacciones Aplicadas
                                    </h3>
                                    <button
                                        onClick={() => handleOpenEdit(selectedOrden)}
                                        className="text-primary-600 hover:text-primary-800 text-xs font-semibold flex items-center gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Agregar / Modificar Partidas
                                    </button>
                                </div>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="p-2.5">Tipo</th>
                                                <th className="p-2.5">Cant.</th>
                                                <th className="p-2.5">Descripción</th>
                                                <th className="p-2.5 text-right">P. Unitario</th>
                                                <th className="p-2.5 text-right">Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedOrden.detalles && selectedOrden.detalles.length > 0 ? (
                                                selectedOrden.detalles.map((det, idx) => (
                                                    <tr key={det.id || idx}>
                                                        <td className="p-2.5">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase">
                                                                {det.tipo_detalle || 'Servicio'}
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 font-semibold text-slate-700">
                                                            {det.cantidad} {det.clave_unidad || 'Pza'}
                                                        </td>
                                                        <td className="p-2.5 text-slate-800 font-medium">
                                                            {det.descripcion}
                                                        </td>
                                                        <td className="p-2.5 text-right text-slate-600">
                                                            ${Number(det.valor_unitario).toFixed(2)}
                                                        </td>
                                                        <td className="p-2.5 text-right font-medium text-slate-800">
                                                            ${Number(det.importe).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="p-5 text-center text-slate-400">
                                                        No hay conceptos ni refacciones registradas aún.
                                                        <button
                                                            onClick={() => handleOpenEdit(selectedOrden)}
                                                            className="block mx-auto mt-2 text-primary-600 font-semibold underline text-xs"
                                                        >
                                                            Hacer clic aquí para agregar refacciones y servicios
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totales */}
                            <div className="flex justify-end">
                                <div className="w-64 space-y-1.5 text-sm">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Subtotal:</span>
                                        <span>${Number(selectedOrden.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>IVA / Impuestos:</span>
                                        <span>${Number(selectedOrden.total_impuestos_trasladados || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-200 text-base">
                                        <span>Total:</span>
                                        <span className="text-primary-600">
                                            ${Number(selectedOrden.total || 0).toFixed(2)}{' '}
                                            <span className="text-xs font-normal text-slate-400">
                                                {selectedOrden.moneda || 'MXN'}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN DE EVIDENCIAS MULTIMEDIA (FOTOS / VIDEO) */}
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <Camera className="w-4 h-4 text-primary-600" />
                                            Evidencias Multimedia del Servicio (Fotos y Video)
                                        </h3>
                                        <p className="text-[11px] text-slate-500">
                                            Adjunta fotografías de daños, avance de reparación y videos de pruebas técnicas.
                                        </p>
                                    </div>
                                    <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-600 self-start sm:self-auto">
                                        {(selectedOrden.evidencias_multimedia || []).length} archivo(s)
                                    </span>
                                </div>

                                {/* Formulario para subir */}
                                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="sm:col-span-2">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                accept="image/*,video/*"
                                                multiple
                                                onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                                                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                            />
                                        </div>
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => handleUploadEvidencias(selectedOrden.id)}
                                                disabled={uploadingMedia || selectedFiles.length === 0}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-md text-xs font-medium transition-colors"
                                            >
                                                {uploadingMedia ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Upload className="w-3.5 h-3.5" />
                                                )}
                                                <span>{uploadingMedia ? 'Subiendo...' : 'Subir Archivos'}</span>
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Descripción o nota opcional (ej. Falla en pantalla, ventilador reemplazado, video de encendido)..."
                                        value={mediaDescripcion}
                                        onChange={(e) => setMediaDescripcion(e.target.value)}
                                        className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-primary-500"
                                    />
                                </div>

                                {/* Grid de Evidencias */}
                                {(!selectedOrden.evidencias_multimedia || selectedOrden.evidencias_multimedia.length === 0) ? (
                                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                                        <Camera className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                                        No se han registrado fotos ni videos para esta orden todavía.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {selectedOrden.evidencias_multimedia.map((item) => (
                                            <div key={item.id} className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
                                                {item.tipo === 'video' ? (
                                                    <div className="relative bg-black w-full h-32 flex items-center justify-center">
                                                        <video
                                                            src={resolveMediaUrl(item.url)}
                                                            controls
                                                            preload="metadata"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="relative w-full h-32 bg-slate-100 overflow-hidden cursor-pointer" onClick={() => setLightboxImage(resolveMediaUrl(item.url))}>
                                                        <img
                                                            src={resolveMediaUrl(item.url)}
                                                            alt={item.nombre_original}
                                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <span className="p-1.5 bg-white/90 rounded-full text-slate-800 shadow">
                                                                <Maximize2 className="w-4 h-4" />
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div className="p-2 text-[11px] flex-1 flex flex-col justify-between bg-white">
                                                    <div>
                                                        <div className="font-semibold text-slate-800 truncate" title={item.nombre_original}>
                                                            {item.nombre_original}
                                                        </div>
                                                        {item.descripcion && (
                                                            <div className="text-slate-500 text-[10px] mt-0.5 line-clamp-2" title={item.descripcion}>
                                                                {item.descripcion}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-100 text-[10px] text-slate-400">
                                                        <span>{new Date(item.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                                                        <button
                                                            onClick={() => handleDeleteEvidencia(selectedOrden.id, item.id)}
                                                            className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors"
                                                            title="Eliminar evidencia"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button
                                onClick={() => setSelectedOrden(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => handlePrintReporte(selectedOrden.id, selectedOrden.folio)}
                                disabled={printingId === selectedOrden.id}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
                            >
                                {printingId === selectedOrden.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Printer className="w-4 h-4" />
                                )}
                                Emitir Reporte de Seguimiento
                            </button>
                            {selectedOrden.estado !== 'Facturado' && (
                                <button
                                    onClick={() => navigate('/facturas/nueva', { state: { ordenServicioId: selectedOrden.id } })}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
                                >
                                    <FileText className="w-4 h-4" />
                                    Facturar Orden
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PARA ACTUALIZAR DIAGNÓSTICO Y CONCEPTOS / REFACCIONES */}
            {editOrden && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 px-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                                    <Wrench className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-800 text-lg">
                                        Actualizar Diagnóstico y Servicios — Orden {editOrden.folio}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Equipo: {editOrden.equipo} {[editOrden.marca, editOrden.modelo].filter(Boolean).join(' ')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditOrden(null)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* 1. Estado y Fechas */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                                <div>
                                    <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                        Estado de la Orden:
                                    </label>
                                    <select
                                        value={editOrden.estado}
                                        onChange={(e) => setEditOrden(prev => ({ ...prev, estado: e.target.value }))}
                                        className="w-full p-2 border border-slate-200 rounded-lg font-semibold text-slate-800 bg-white focus:outline-none focus:border-primary-500"
                                    >
                                        <option value="Recibido">Recibido</option>
                                        <option value="En Diagnóstico">En Diagnóstico</option>
                                        <option value="Esperando Aprobación">Esperando Aprobación</option>
                                        <option value="En Reparación">En Reparación</option>
                                        <option value="Reparado">Reparado</option>
                                        <option value="Entregado">Entregado</option>
                                        <option value="Cancelado">Cancelado</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                        Entrega Estimada:
                                    </label>
                                    <input
                                        type="date"
                                        value={editOrden.fecha_entrega_estimada || ''}
                                        onChange={(e) => setEditOrden(prev => ({ ...prev, fecha_entrega_estimada: e.target.value }))}
                                        className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                                    />
                                </div>

                                <div>
                                    <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                        Entrega Real (Si ya concluyó):
                                    </label>
                                    <input
                                        type="date"
                                        value={editOrden.fecha_entrega_real || ''}
                                        onChange={(e) => setEditOrden(prev => ({ ...prev, fecha_entrega_real: e.target.value }))}
                                        className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                            </div>

                            {/* 2. Falla reportada y Diagnóstico Técnico */}
                            <div className="space-y-4">
                                {editOrden.falla_reportada && (
                                    <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-100 text-xs">
                                        <span className="font-bold text-rose-800 block mb-0.5 uppercase tracking-wider">
                                            Falla Reportada por el Cliente al Recibir:
                                        </span>
                                        <p className="text-slate-700">{editOrden.falla_reportada}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="font-bold text-slate-700 text-xs uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                                        <Edit3 className="w-3.5 h-3.5 text-primary-600" />
                                        Diagnóstico Técnico Especializado:
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={editOrden.diagnostico_tecnico}
                                        onChange={(e) => setEditOrden(prev => ({ ...prev, diagnostico_tecnico: e.target.value }))}
                                        placeholder="Escribe el dictamen técnico tras la inspección del equipo (ej. Se detectó falla en circuito de alimentación, sector dañado en unidad de almacenamiento SSD, requiere reemplazo de display o mantenimiento térmico general)..."
                                        className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 leading-relaxed"
                                    />
                                </div>
                            </div>

                            {/* 3. Refacciones y Servicios (Partidas) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                        <Wrench className="w-3.5 h-3.5 text-primary-600" />
                                        Refacciones, Piezas y Mano de Obra
                                    </h3>
                                    <span className="text-xs text-slate-500 font-medium">
                                        {editOrden.detalles.length} concepto(s) agregado(s)
                                    </span>
                                </div>

                                {/* Formulario para agregar partida */}
                                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                        <div className="sm:col-span-3">
                                            <label className="font-semibold text-slate-600 block mb-1">Tipo:</label>
                                            <select
                                                value={newDetalle.tipo_detalle}
                                                onChange={(e) => setNewDetalle(prev => ({ ...prev, tipo_detalle: e.target.value }))}
                                                className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-primary-500 font-medium"
                                            >
                                                <option value="Refaccion">Refacción / Pieza</option>
                                                <option value="Mano de Obra">Mano de Obra</option>
                                                <option value="Servicio">Servicio Técnico</option>
                                            </select>
                                        </div>

                                        {conceptosCat.length > 0 && (
                                            <div className="sm:col-span-4">
                                                <label className="font-semibold text-slate-600 block mb-1">Del catálogo (opcional):</label>
                                                <select
                                                    onChange={handleConceptoSelect}
                                                    defaultValue=""
                                                    className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                                                >
                                                    <option value="">-- Seleccionar concepto --</option>
                                                    {conceptosCat.map(c => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.descripcion} (${Number(c.precio_unitario || 0).toFixed(2)})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div className={conceptosCat.length > 0 ? "sm:col-span-5" : "sm:col-span-9"}>
                                            <label className="font-semibold text-slate-600 block mb-1">Descripción de la refacción o labor:</label>
                                            <input
                                                type="text"
                                                value={newDetalle.descripcion}
                                                onChange={(e) => setNewDetalle(prev => ({ ...prev, descripcion: e.target.value }))}
                                                placeholder="ej. Módulo SSD NVMe 512GB Kingston, Limpieza interna y pasta térmica..."
                                                className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                        <div className="sm:col-span-3">
                                            <label className="font-semibold text-slate-600 block mb-1">Cantidad:</label>
                                            <input
                                                type="number"
                                                min="0.1"
                                                step="any"
                                                value={newDetalle.cantidad}
                                                onChange={(e) => setNewDetalle(prev => ({ ...prev, cantidad: e.target.value }))}
                                                className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                                            />
                                        </div>

                                        <div className="sm:col-span-4">
                                            <label className="font-semibold text-slate-600 block mb-1">Precio Unitario ($):</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={newDetalle.valor_unitario}
                                                onChange={(e) => setNewDetalle(prev => ({ ...prev, valor_unitario: e.target.value }))}
                                                className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-primary-500 font-mono"
                                            />
                                        </div>

                                        <div className="sm:col-span-3">
                                            <label className="font-semibold text-slate-600 block mb-1">Importe:</label>
                                            <div className="p-2 bg-slate-100 rounded-lg font-mono font-bold text-slate-700">
                                                ${(parseFloat(newDetalle.cantidad || 0) * parseFloat(newDetalle.valor_unitario || 0)).toFixed(2)}
                                            </div>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <button
                                                type="button"
                                                onClick={handleAddDetalleToEdit}
                                                className="w-full p-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>Agregar</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabla de Partidas en Edición */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="p-2.5">Tipo</th>
                                                <th className="p-2.5">Cant.</th>
                                                <th className="p-2.5">Descripción</th>
                                                <th className="p-2.5 text-right">P. Unitario</th>
                                                <th className="p-2.5 text-right">Importe</th>
                                                <th className="p-2.5 text-center w-16">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {editOrden.detalles.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-6 text-center text-slate-400">
                                                        No hay refacciones o servicios en esta orden. Utiliza el formulario arriba para agregar piezas y mano de obra.
                                                    </td>
                                                </tr>
                                            ) : (
                                                editOrden.detalles.map((det, idx) => (
                                                    <tr key={det.id || idx} className="hover:bg-slate-50/70">
                                                        <td className="p-2.5">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                                                det.tipo_detalle === 'Refaccion'
                                                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                    : det.tipo_detalle === 'Mano de Obra'
                                                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            }`}>
                                                                {det.tipo_detalle}
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 font-bold text-slate-800">
                                                            {det.cantidad}
                                                        </td>
                                                        <td className="p-2.5 text-slate-800 font-medium">
                                                            {det.descripcion}
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono text-slate-600">
                                                            ${Number(det.valor_unitario).toFixed(2)}
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                                                            ${(Number(det.cantidad) * Number(det.valor_unitario)).toFixed(2)}
                                                        </td>
                                                        <td className="p-2.5 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveDetalleFromEdit(idx)}
                                                                className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors"
                                                                title="Eliminar partida"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Resumen de Totales en Edición */}
                                <div className="flex justify-end pt-2">
                                    <div className="w-64 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                                        <div className="flex justify-between text-slate-600">
                                            <span>Subtotal:</span>
                                            <span className="font-mono font-bold">${editSubtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                            <span>IVA (16%):</span>
                                            <span className="font-mono font-bold">${editIva.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-slate-800 pt-1.5 border-t border-slate-200 text-sm">
                                            <span>Total:</span>
                                            <span className="text-primary-600 font-mono">${editTotal.toFixed(2)} MXN</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEditOrden(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                                className="px-5 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                            >
                                {savingEdit ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                <span>{savingEdit ? 'Guardando...' : 'Guardar Diagnóstico y Servicios'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Multimedia Modal (Accesible directamente desde la tabla) */}
            {quickMediaOrden && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 px-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-800 text-base">
                                        Evidencias Multimedia — {quickMediaOrden.folio || `#${quickMediaOrden.id}`}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        {quickMediaOrden.equipo} &bull; {quickMediaOrden.Receptor?.razon_social}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setQuickMediaOrden(null)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4">
                            {/* Upload Area */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                    Subir Foto o Video del Servicio:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="sm:col-span-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="image/*,video/*"
                                            multiple
                                            onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                                            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                        />
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => handleUploadEvidencias(quickMediaOrden.id)}
                                            disabled={uploadingMedia || selectedFiles.length === 0}
                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-md text-xs font-medium transition-colors"
                                        >
                                            {uploadingMedia ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Upload className="w-3.5 h-3.5" />
                                            )}
                                            <span>{uploadingMedia ? 'Subiendo...' : 'Subir'}</span>
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Descripción o nota opcional (ej. Estado al recibir, detalle de daño, etc.)..."
                                    value={mediaDescripcion}
                                    onChange={(e) => setMediaDescripcion(e.target.value)}
                                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-primary-500 bg-white"
                                />
                            </div>

                            {/* Evidence list */}
                            {(!quickMediaOrden.evidencias_multimedia || quickMediaOrden.evidencias_multimedia.length === 0) ? (
                                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                                    <Camera className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                    No hay archivos de evidencia todavía. Puedes subir fotos o videos del servicio.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {quickMediaOrden.evidencias_multimedia.map((item) => (
                                        <div key={item.id} className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
                                            {item.tipo === 'video' ? (
                                                <div className="relative bg-black w-full h-28 flex items-center justify-center">
                                                    <video
                                                        src={resolveMediaUrl(item.url)}
                                                        controls
                                                        preload="metadata"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div 
                                                    className="relative w-full h-28 bg-slate-100 overflow-hidden cursor-pointer"
                                                    onClick={() => setLightboxImage(resolveMediaUrl(item.url))}
                                                >
                                                    <img
                                                        src={resolveMediaUrl(item.url)}
                                                        alt={item.nombre_original}
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="p-1.5 bg-white/90 rounded-full text-slate-800 shadow">
                                                            <Maximize2 className="w-4 h-4" />
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="p-2 text-[11px] flex-1 flex flex-col justify-between bg-white">
                                                <div>
                                                    <div className="font-semibold text-slate-800 truncate" title={item.nombre_original}>
                                                        {item.nombre_original}
                                                    </div>
                                                    {item.descripcion && (
                                                        <div className="text-slate-500 text-[10px] mt-0.5 line-clamp-2" title={item.descripcion}>
                                                            {item.descripcion}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-100 text-[10px] text-slate-400">
                                                    <span>{new Date(item.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                                                    <button
                                                        onClick={() => handleDeleteEvidencia(quickMediaOrden.id, item.id)}
                                                        className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors"
                                                        title="Eliminar evidencia"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setQuickMediaOrden(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Modal para fotos en tamaño completo */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img
                            src={lightboxImage}
                            alt="Evidencia ampliada"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
