import React, { useState, useEffect } from 'react';
import { 
    CreditCard, Search, FileCheck2, AlertCircle, RefreshCw, Plus, 
    FileText, Link2, XCircle, Eye, Download, CheckCircle, Ban, FileCheck,
    Landmark, Upload, Calendar, CheckCircle2, ArrowUpRight, History, Check, 
    X, ShieldCheck, Sparkles, Inbox, Clock, Building2, TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { openPdfViewer } from '../utils/pdfViewer';
import { PagoModal } from '../components/PagoModal';
import { CarteraModal } from '../components/CarteraModal';
import { ModalCancelarPago } from '../components/ModalCancelarPago';
import { ModalAcuseSAT } from '../components/ModalAcuseSAT';
import { useToast } from '../context/ToastContext';

export const ControlPagos = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const [pagos, setPagos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [showCarteraModal, setShowCarteraModal] = useState(false);
    const [selectedPagoRelacionados, setSelectedPagoRelacionados] = useState(null);
    const [pagoParaCancelar, setPagoParaCancelar] = useState(null);
    const [docParaAcuse, setDocParaAcuse] = useState(null);

    // Modal de Descarga Masiva SAT para Facturas Emitidas (Cuentas por Cobrar)
    const [showSatModal, setShowSatModal] = useState(false);
    const [satModalTab, setSatModalTab] = useState('nueva'); // 'nueva' | 'historial'
    const [satDateStart, setSatDateStart] = useState('');
    const [satDateEnd, setSatDateEnd] = useState('');
    const [satLoading, setSatLoading] = useState(false);
    const [satResult, setSatResult] = useState(null);
    const [solicitudesSat, setSolicitudesSat] = useState([]);
    const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
    const [verificandoId, setVerificandoId] = useState(null);
    const [descargandoId, setDescargandoId] = useState(null);
    const [importingXmls, setImportingXmls] = useState(false);

    const fetchPagos = async () => {
        if (!activeEmisor) return;
        setLoading(true);
        try {
            const res = await api.get(`/pagos?emisor_id=${activeEmisor.id}`);
            setPagos(res.data);
        } catch (error) {
            console.error("Error fetching pagos", error);
            showToast("Error al cargar la lista de pagos", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchSolicitudesSat = async () => {
        if (!activeEmisor) return;
        setLoadingSolicitudes(true);
        try {
            const res = await api.get(`/pagos/solicitudes-sat?emisor_id=${activeEmisor.id}`);
            setSolicitudesSat(res.data);
        } catch (error) {
            console.error("Error al obtener solicitudes emitidas SAT:", error);
        } finally {
            setLoadingSolicitudes(false);
        }
    };

    const setQuickDates = (type) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const formatDate = (d) => d.toISOString().split('T')[0];

        if (type === 'este-mes') {
            const start = new Date(year, month, 1);
            setSatDateStart(formatDate(start));
            setSatDateEnd(formatDate(now));
        } else if (type === 'mes-anterior') {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            setSatDateStart(formatDate(start));
            setSatDateEnd(formatDate(end));
        } else if (type === 'ultimos-3-meses') {
            const start = new Date(year, month - 2, 1);
            setSatDateStart(formatDate(start));
            setSatDateEnd(formatDate(now));
        } else if (type === 'anio-actual') {
            const start = new Date(year, 0, 1);
            setSatDateStart(formatDate(start));
            setSatDateEnd(formatDate(now));
        }
    };

    const handleSatDownload = async (e) => {
        e.preventDefault();
        if (!satDateStart || !satDateEnd) {
            showToast("Selecciona un rango de fechas", "error");
            return;
        }

        setSatLoading(true);
        setSatResult(null);
        try {
            const res = await api.post('/pagos/solicitar-descarga-sat', {
                emisor_id: activeEmisor.id,
                fecha_inicio: satDateStart,
                fecha_fin: satDateEnd,
                tipo_solicitud: 'CFDI'
            });
            setSatResult(res.data);
            showToast(res.data.message || "Petición de facturas emitidas enviada al SAT");
            fetchSolicitudesSat();
            fetchPagos();
        } catch (error) {
            console.error("Error en descarga SAT emitidas", error);
            showToast(error.response?.data?.message || "Error al solicitar la descarga masiva al SAT", "error");
        } finally {
            setSatLoading(false);
        }
    };

    const handleVerificarSolicitud = async (id) => {
        setVerificandoId(id);
        try {
            const res = await api.post(`/pagos/verificar-solicitud-sat/${id}`);
            showToast(res.data.message || "Estatus actualizado con el SAT");
            fetchSolicitudesSat();
        } catch (error) {
            console.error("Error al verificar solicitud SAT:", error);
            showToast(error.response?.data?.message || "Error al verificar con el SAT", "error");
        } finally {
            setVerificandoId(null);
        }
    };

    const handleDescargarEImportar = async (id) => {
        setDescargandoId(id);
        try {
            const res = await api.post(`/pagos/descargar-paquetes-sat/${id}`);
            showToast(res.data.message || "Facturas emitidas descargadas e importadas a Cartera con éxito");
            fetchSolicitudesSat();
            fetchPagos();
        } catch (error) {
            console.error("Error al descargar e importar paquetes SAT:", error);
            showToast(error.response?.data?.message || "Error al descargar del SAT", "error");
        } finally {
            setDescargandoId(null);
        }
    };

    const handleImportarXmlsManual = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0 || !activeEmisor) return;

        setImportingXmls(true);
        try {
            const formData = new FormData();
            formData.append('emisor_id', activeEmisor.id);
            files.forEach(f => formData.append('archivos_xml', f));

            const res = await api.post('/pagos/importar-xmls', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            showToast(res.data.message || `Se importaron ${files.length} archivos XML correctamente`);
            fetchPagos();
        } catch (error) {
            console.error("Error al importar XMLs emitidos:", error);
            showToast(error.response?.data?.message || "Error al procesar archivos XML", "error");
        } finally {
            setImportingXmls(false);
            e.target.value = '';
        }
    };

    useEffect(() => {
        fetchPagos();
    }, [activeEmisor]);

    const handleEmitirREP = async (pagoId) => {
        if (!window.confirm('¿Desea timbrar este pago ante el SAT?')) return;
        try {
            setLoading(true);
            const res = await api.post(`/pagos/${pagoId}/emitir`);
            showToast('REP Timbrado con éxito: ' + (res.data.uuid || 'Completado'));
            fetchPagos();
        } catch (error) {
            console.error("Error al timbrar REP", error);
            showToast(error.response?.data?.message || 'Error al timbrar el documento', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerPDF = async (item) => {
        const pdfUrl = item.DocumentoREP?.pdf_url || item.Documentos?.find(d => d.id === item.documento_rep_id)?.pdf_url;
        if (pdfUrl) {
            await openPdfViewer(pdfUrl);
        } else {
            showToast('El PDF aún no ha sido generado o no está disponible.', 'info');
        }
    };

    const handleReimprimirPDF = async (item) => {
        try {
            setLoading(true);
            const res = await api.get(`/documentos/${item.documento_rep_id}/pdf`);
            if (res.data?.pdfUrl) {
                await openPdfViewer(res.data.pdfUrl);
            }
        } catch (error) {
            console.error("Error regenerando PDF", error);
            showToast("Error al regenerar el reporte PDF", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadXml = (docId, uuid, serie, folio) => {
        if (!docId) return;
        const token = localStorage.getItem('token');
        api.get(`/documentos/${docId}/xml`, {
            responseType: 'blob',
            headers: { Authorization: `Bearer ${token}` }
        }).then((response) => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${uuid || `${serie || ''}${folio || docId}`}.xml`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        }).catch(() => {
            showToast("Error al descargar el archivo XML", "error");
        });
    };

    const filteredPagos = pagos.filter(p => 
        p.Receptor?.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.Receptor?.rfc.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        totalCobrado: pagos.reduce((acc, p) => acc + parseFloat(p.monto), 0),
        count: pagos.length
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cuentas Por Cobrar</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium italic">Gestión de cartera de clientes, facturas emitidas y Complementos de Recepción de Pagos (REP).</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => { setShowSatModal(true); fetchSolicitudesSat(); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md group"
                        title="Descargar facturas emitidas vía Web Service oficial del SAT"
                    >
                        <Landmark className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span>Sincronizar Emitidas SAT</span>
                    </button>

                    <label className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs">
                        <Upload className="w-4 h-4" />
                        <span>{importingXmls ? 'Importando...' : 'Subir XMLs Emitidos'}</span>
                        <input
                            type="file"
                            multiple
                            accept=".xml"
                            onChange={handleImportarXmlsManual}
                            disabled={importingXmls}
                            className="hidden"
                        />
                    </label>

                    <button 
                        onClick={() => setShowPagoModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-500 shadow-md shadow-primary-200 transition-all group"
                    >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                        <span>Registrar Nuevo Pago</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-primary-200 transition-colors">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cobrado Total</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">${stats.totalCobrado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                        <CreditCard className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-indigo-200 transition-colors">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operaciones</p>
                        <p className="text-2xl font-black text-indigo-600 mt-1">{stats.count}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                        <RefreshCw className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between col-span-2 bg-gradient-to-br from-white to-slate-50">
                    <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                             <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Recordatorios de Pago</p>
                            <p className="text-xs text-slate-500 font-medium italic">Mantén a tus clientes al día con sus saldos pendientes.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowCarteraModal(true)}
                        className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl transition-all shadow-md"
                    >
                        Gestionar Cartera
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col min-h-[500px] overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 backdrop-blur-sm">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente o RFC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 border-2 border-slate-100 focus:border-primary-500 focus:ring-0 rounded-2xl text-sm transition-all outline-none bg-white placeholder:text-slate-400 font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                <th className="px-6 py-4">Fecha de Pago</th>
                                <th className="px-6 py-4">Cliente / Receptor</th>
                                <th className="px-6 py-4">Metodo/Forma</th>
                                <th className="px-6 py-4 text-right">Monto Recibido</th>
                                <th className="px-6 py-4 text-center">Facturas Aplicadas</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-slate-400 font-medium italic">Cargando registros...</td>
                                </tr>
                            ) : filteredPagos.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-slate-400 font-medium italic uppercase tracking-widest">No se encontraron pagos registrados</td>
                                </tr>
                            ) : filteredPagos.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="font-bold text-slate-700">{new Date(item.fecha_pago).toLocaleDateString()}</div>
                                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter italic">Registro: {new Date(item.createdAt).toLocaleTimeString()}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-slate-800 font-bold tracking-tight">{item.Receptor?.razon_social}</div>
                                        <div className="text-xs text-slate-500 font-mono">{item.Receptor?.rfc}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase border border-slate-200">
                                            {item.forma_pago}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-right font-black text-slate-800 tracking-tight">
                                        ${parseFloat(item.monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <div className="flex flex-wrap gap-1 justify-center">
                                            {item.Documentos?.filter(d => d.tipo_comprobante === 'I').map(d => (
                                                <span key={d.id} className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-bold" title={d.uuid}>
                                                    {d.serie}{d.folio}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        {(() => {
                                            const esCancelado = item.estado === 'Cancelado' || item.DocumentoREP?.estado_sat === 'Cancelado';
                                            return (
                                                <div className="flex items-center justify-end gap-2">
                                                    {esCancelado ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 uppercase tracking-widest mb-1">
                                                                Cancelado
                                                            </span>
                                                            <div className="text-[8px] font-mono text-slate-400">
                                                                {item.motivo_cancelacion ? `Motivo ${item.motivo_cancelacion}` : (item.DocumentoREP?.motivo_cancelacion ? `Motivo ${item.DocumentoREP.motivo_cancelacion}` : 'Cancelado')}
                                                            </div>
                                                        </div>
                                                    ) : item.documento_rep_id ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest mb-1">
                                                                Timbrado
                                                            </span>
                                                            <div className="text-[8px] font-mono text-slate-400 max-w-[80px] truncate" title={item.DocumentoREP?.uuid || ''}>
                                                                {item.DocumentoREP?.serie || 'P'}-{item.DocumentoREP?.folio || item.id}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleEmitirREP(item.id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg hover:bg-indigo-500 shadow-md shadow-indigo-100 transition-all uppercase tracking-tight"
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                            Timbrar REP
                                                        </button>
                                                    )}

                                                    {item.documento_rep_id && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleVerPDF(item)}
                                                                className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100" 
                                                                title="Ver PDF"
                                                            >
                                                                <FileText className="w-5 h-5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleReimprimirPDF(item)}
                                                                className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100" 
                                                                title="Regenerar PDF"
                                                            >
                                                                <RefreshCw className="w-4 h-4" />
                                                            </button>
                                                            {item.DocumentoREP?.xml_url && (
                                                                <button
                                                                    onClick={() => handleDownloadXml(
                                                                        item.DocumentoREP.id,
                                                                        item.DocumentoREP.uuid,
                                                                        item.DocumentoREP.serie,
                                                                        item.DocumentoREP.folio
                                                                    )}
                                                                    className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                                                                    title="Descargar XML REP"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={() => setSelectedPagoRelacionados(item)}
                                                        className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-[11px] font-bold border ${
                                                            (item.Documentos?.filter(d => d.tipo_comprobante === 'I').length || 0) > 0
                                                                ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                                                                : 'text-slate-500 bg-slate-50 hover:bg-slate-100 border-slate-200'
                                                        }`}
                                                        title="Ver Documentos Relacionados"
                                                    >
                                                        <Link2 className="w-3.5 h-3.5" />
                                                        <span>Relacionados</span>
                                                        {(item.Documentos?.filter(d => d.tipo_comprobante === 'I').length || 0) > 0 && (
                                                            <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[9px] font-black">
                                                                {item.Documentos.filter(d => d.tipo_comprobante === 'I').length}
                                                            </span>
                                                        )}
                                                    </button>

                                                    {esCancelado ? (
                                                        item.DocumentoREP?.acuse_cancelacion && (
                                                            <button
                                                                onClick={() => setDocParaAcuse(item.DocumentoREP)}
                                                                className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                                title="Ver Acuse de Cancelación SAT"
                                                            >
                                                                <FileCheck className="w-4 h-4 text-emerald-600" />
                                                            </button>
                                                        )
                                                    ) : (
                                                        <button
                                                            onClick={() => setPagoParaCancelar(item)}
                                                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                                                            title="Cancelar Pago / REP ante el SAT"
                                                        >
                                                            <Ban className="w-4 h-4 text-rose-500" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedPagoRelacionados && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden">
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                                    <Link2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">
                                        Documentos Relacionados — Pago #{selectedPagoRelacionados.id}
                                        {selectedPagoRelacionados.DocumentoREP ? ` (${selectedPagoRelacionados.DocumentoREP.serie || 'REP'}-${selectedPagoRelacionados.DocumentoREP.folio || selectedPagoRelacionados.id})` : ''}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-mono">
                                        {selectedPagoRelacionados.DocumentoREP?.uuid || 'Complemento de Pago (REP) pendiente de timbrar'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedPagoRelacionados(null)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                            {/* Resumen del Pago / REP */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[10px]">Cliente / Receptor</span>
                                    <span className="font-bold text-slate-800 truncate block">{selectedPagoRelacionados.Receptor?.razon_social}</span>
                                    <span className="font-mono text-[10px] text-slate-500">{selectedPagoRelacionados.Receptor?.rfc}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[10px]">Fecha y Forma de Pago</span>
                                    <span className="font-black text-slate-700 block">{new Date(selectedPagoRelacionados.fecha_pago).toLocaleDateString()}</span>
                                    <span className="text-[10px] font-bold text-indigo-600">Forma SAT: {selectedPagoRelacionados.forma_pago}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[10px]">Monto Total Abonado</span>
                                    <span className="font-black text-emerald-700 text-sm">
                                        ${parseFloat(selectedPagoRelacionados.monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedPagoRelacionados.moneda || 'MXN'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[10px]">Comprobante REP</span>
                                    {selectedPagoRelacionados.estado === 'Cancelado' || selectedPagoRelacionados.DocumentoREP?.estado_sat === 'Cancelado' ? (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
                                                Cancelado {selectedPagoRelacionados.motivo_cancelacion ? `(${selectedPagoRelacionados.motivo_cancelacion})` : ''}
                                            </span>
                                            {selectedPagoRelacionados.DocumentoREP?.acuse_cancelacion && (
                                                <button
                                                    onClick={() => setDocParaAcuse(selectedPagoRelacionados.DocumentoREP)}
                                                    className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1"
                                                    title="Ver Acuse SAT"
                                                >
                                                    <FileCheck className="w-3 h-3" /> Acuse
                                                </button>
                                            )}
                                        </div>
                                    ) : selectedPagoRelacionados.DocumentoREP ? (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {selectedPagoRelacionados.DocumentoREP.pdf_url && (
                                                <button
                                                    onClick={() => openPdfViewer(selectedPagoRelacionados.DocumentoREP.pdf_url)}
                                                    className="px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 flex items-center gap-1"
                                                    title="Ver PDF del REP"
                                                >
                                                    <Eye className="w-3 h-3" /> PDF REP
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDownloadXml(
                                                    selectedPagoRelacionados.DocumentoREP.id,
                                                    selectedPagoRelacionados.DocumentoREP.uuid,
                                                    selectedPagoRelacionados.DocumentoREP.serie,
                                                    selectedPagoRelacionados.DocumentoREP.folio
                                                )}
                                                className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1"
                                                title="Descargar XML del REP"
                                            >
                                                <Download className="w-3 h-3" /> XML REP
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                                            Sin Timbrar
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Tabla de Facturas de Ingreso Pagadas */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                                    Facturas de Ingreso Relacionadas ({selectedPagoRelacionados.Documentos?.filter(d => d.tipo_comprobante === 'I').length || 0})
                                </h4>

                                {(!selectedPagoRelacionados.Documentos || selectedPagoRelacionados.Documentos.filter(d => d.tipo_comprobante === 'I').length === 0) ? (
                                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                                        No se encontraron facturas de ingreso vinculadas a este registro de pago.
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="py-2.5 px-3">Factura (I)</th>
                                                    <th className="py-2.5 px-3">UUID Fiscal</th>
                                                    <th className="py-2.5 px-3 text-center">Parc.</th>
                                                    <th className="py-2.5 px-3 text-right">Saldo Ant.</th>
                                                    <th className="py-2.5 px-3 text-right">Pagado</th>
                                                    <th className="py-2.5 px-3 text-right">Insoluto</th>
                                                    <th className="py-2.5 px-3 text-right">Archivos</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedPagoRelacionados.Documentos.filter(d => d.tipo_comprobante === 'I').map((doc) => {
                                                    const pd = doc.PagoDocumento;
                                                    return (
                                                        <tr key={doc.id} className="hover:bg-slate-50">
                                                            <td className="py-3 px-3">
                                                                <span className="font-black text-indigo-700">
                                                                    {doc.serie ? `${doc.serie}-` : ''}{doc.folio}
                                                                </span>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {doc.fecha ? new Date(doc.fecha).toLocaleDateString() : ''} • {doc.metodo_pago || 'PPD'}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 font-mono text-[10px] text-slate-500">
                                                                {doc.uuid || 'Sin UUID'}
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-bold text-[10px]">
                                                                    #{pd?.num_parcialidad || 1}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-right text-slate-600 font-medium">
                                                                ${Number(pd?.imp_saldo_ant || doc.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-3 px-3 text-right font-black text-emerald-700">
                                                                ${Number(pd?.imp_pagado || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-3 px-3 text-right font-bold text-slate-800">
                                                                ${Number(pd?.imp_saldo_insoluto ?? doc.saldo_insoluto ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {doc.pdf_url && (
                                                                        <button
                                                                            onClick={() => openPdfViewer(doc.pdf_url)}
                                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                            title="Ver PDF de la Factura"
                                                                        >
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleDownloadXml(doc.id, doc.uuid, doc.serie, doc.folio)}
                                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                        title="Descargar XML de la Factura"
                                                                    >
                                                                        <Download className="w-3.5 h-3.5" />
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
                        </div>

                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedPagoRelacionados(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PagoModal
                isOpen={showPagoModal}
                onClose={() => setShowPagoModal(false)}
                emisorId={activeEmisor?.id}
                onSuccess={() => {
                    fetchPagos();
                    showToast("Pago registrado correctamente");
                }}
            />

            <CarteraModal
                isOpen={showCarteraModal}
                onClose={() => setShowCarteraModal(false)}
                emisorId={activeEmisor?.id}
            />

            {/* Modal para Cancelación de Pago / Complemento REP ante el SAT */}
            <ModalCancelarPago
                pago={pagoParaCancelar}
                isOpen={Boolean(pagoParaCancelar)}
                onClose={() => setPagoParaCancelar(null)}
                onCancelled={() => {
                    fetchPagos();
                    setSelectedPagoRelacionados(null);
                }}
            />

            {/* Modal para Ver Acuse de Cancelación SAT */}
            <ModalAcuseSAT
                doc={docParaAcuse}
                isOpen={Boolean(docParaAcuse)}
                onClose={() => setDocParaAcuse(null)}
            />

            {/* Modal de Descarga Masiva SAT — Facturas Emitidas / Cartera */}
            {showSatModal && (
                <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Landmark className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Descarga Masiva SAT — Facturas Emitidas</h2>
                                    <p className="text-xs text-slate-500">
                                        Web Service Oficial de Descarga de CFDI Emitidos / Ventas a Clientes (e.firma)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowSatModal(false); setSatResult(null); }}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs del Modal */}
                        <div className="flex items-center gap-2 mt-4 p-1 bg-slate-100 rounded-xl border border-slate-200/60 self-start text-xs font-bold">
                            <button
                                onClick={() => setSatModalTab('nueva')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    satModalTab === 'nueva'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Nueva Solicitud SAT</span>
                            </button>
                            <button
                                onClick={() => { setSatModalTab('historial'); fetchSolicitudesSat(); }}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    satModalTab === 'historial'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Historial de Solicitudes</span>
                                {solicitudesSat.length > 0 && (
                                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                        {solicitudesSat.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Contenido TAB 1: Nueva Solicitud */}
                        {satModalTab === 'nueva' && (
                            <div className="overflow-y-auto space-y-4 mt-4 py-1 custom-scrollbar">
                                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-600">
                                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                                        <Building2 className="w-4 h-4 text-primary-600" />
                                        <span>Emisor: {activeEmisor?.razon_social}</span>
                                        <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">{activeEmisor?.rfc}</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-slate-500">
                                        La petición se autentica con la <strong>e.firma (FIEL)</strong> registrada en Emisores. Al descargarse, el sistema importa automáticamente las facturas emitidas, crea o actualiza los clientes receptores y actualiza los saldos de la Cartera.
                                    </p>
                                </div>

                                {activeEmisor?.fiel_info?.tieneCertificado ? (
                                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs">
                                        <span className="flex items-center gap-1.5 font-semibold">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            e.firma lista en sistema (Serie: {activeEmisor.fiel_info.noCertificado})
                                        </span>
                                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                            Vigente ({activeEmisor.fiel_info.diasRestantes} días)
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-xs">
                                        <span className="flex items-center gap-1.5 font-semibold">
                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                            e.firma pendiente de configurar en Emisores
                                        </span>
                                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                                            Requerida por el SAT
                                        </span>
                                    </div>
                                )}

                                <form onSubmit={handleSatDownload} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha Inicial</label>
                                            <input
                                                type="date"
                                                value={satDateStart}
                                                onChange={(e) => setSatDateStart(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:border-primary-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha Final</label>
                                            <input
                                                type="date"
                                                value={satDateEnd}
                                                onChange={(e) => setSatDateEnd(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:border-primary-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Botones de Rango Rápido */}
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Rangos rápidos:</span>
                                        <button
                                            type="button"
                                            onClick={() => setQuickDates('este-mes')}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                                        >
                                            Este Mes
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setQuickDates('mes-anterior')}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                                        >
                                            Mes Anterior
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setQuickDates('ultimos-3-meses')}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                                        >
                                            Últimos 3 Meses
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setQuickDates('anio-actual')}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                                        >
                                            Año 2026
                                        </button>
                                    </div>

                                    {satResult && (
                                        <div className={`p-4 rounded-xl text-xs space-y-1.5 border animate-in fade-in ${
                                            satResult.solicitud?.estado_sat === 'Rechazada' || satResult.resultado?.codigoEstado === '305'
                                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                        }`}>
                                            <div className="flex items-center gap-2 font-bold">
                                                {satResult.solicitud?.estado_sat === 'Rechazada' ? (
                                                    <AlertCircle className="w-4 h-4 text-rose-600" />
                                                ) : (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                )}
                                                <span>{satResult.solicitud?.estado_sat === 'Rechazada' ? 'Respuesta del SAT' : '¡Solicitud enviada exitosamente!'}</span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed opacity-90">{satResult.message}</p>
                                            {satResult.solicitud?.id_solicitud_sat && (
                                                <div className="pt-1 font-mono text-[11px]">
                                                    Folio SAT: <strong>{satResult.solicitud.id_solicitud_sat}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => { setShowSatModal(false); setSatResult(null); }}
                                            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={satLoading || !satDateStart || !satDateEnd}
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                        >
                                            {satLoading ? (
                                                <>
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Conectando con el SAT...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Landmark className="w-3.5 h-3.5" />
                                                    <span>Solicitar Descarga de Emitidas</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Contenido TAB 2: Historial de Solicitudes */}
                        {satModalTab === 'historial' && (
                            <div className="overflow-y-auto space-y-3 mt-4 py-1 custom-scrollbar">
                                {loadingSolicitudes ? (
                                    <div className="py-8 text-center text-xs text-slate-400">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                        <span>Consultando solicitudes emitidas...</span>
                                    </div>
                                ) : solicitudesSat.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                        <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                                        <p>No hay solicitudes de facturas emitidas registradas para este emisor.</p>
                                        <button
                                            type="button"
                                            onClick={() => setSatModalTab('nueva')}
                                            className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs"
                                        >
                                            Generar Primera Solicitud
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                                        {solicitudesSat.map(s => {
                                            const isTerminada = s.estado_sat === 'Terminada' || (s.paquetes_ids && s.paquetes_ids.length > 0 && s.estado_sat !== 'Descargada');
                                            const isDescargada = s.estado_sat === 'Descargada';
                                            const isVerificando = verificandoId === s.id;
                                            const isDescargando = descargandoId === s.id;

                                            return (
                                                <div key={s.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 hover:border-slate-300 transition-colors">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-[11px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                {s.id_solicitud_sat}
                                                            </span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                isDescargada
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                    : isTerminada
                                                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                                        : s.estado_sat === 'Error' || s.estado_sat === 'Rechazada'
                                                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            }`}>
                                                                {s.estado_sat}
                                                                {s.numero_cfdis > 0 && ` (${s.numero_cfdis} CFDIs)`}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(s.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                                        <span>Periodo: <strong className="text-slate-700">{s.fecha_inicio}</strong> al <strong className="text-slate-700">{s.fecha_fin}</strong></span>
                                                        {s.paquetes_ids && Array.isArray(s.paquetes_ids) && (
                                                            <span className="font-mono text-[10px] text-slate-400">
                                                                {s.paquetes_ids.length} paquete(s) SAT
                                                            </span>
                                                        )}
                                                    </div>

                                                    {s.mensaje_sat && (
                                                        <p className="text-[10px] text-slate-500 bg-white/70 p-2 rounded border border-slate-100 leading-relaxed">
                                                            {s.mensaje_sat}
                                                        </p>
                                                    )}

                                                    {/* Botones de acción */}
                                                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                                                        {!isDescargada && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleVerificarSolicitud(s.id)}
                                                                disabled={isVerificando || isDescargando}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                                                            >
                                                                <RefreshCw className={`w-3 h-3 ${isVerificando ? 'animate-spin text-indigo-600' : ''}`} />
                                                                <span>{isVerificando ? 'Consultando SAT...' : 'Verificar Estatus SAT'}</span>
                                                            </button>
                                                        )}

                                                        {isTerminada && !isDescargada && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDescargarEImportar(s.id)}
                                                                disabled={isDescargando || isVerificando}
                                                                className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                                                            >
                                                                <Download className={`w-3.5 h-3.5 ${isDescargando ? 'animate-bounce' : ''}`} />
                                                                <span>{isDescargando ? 'Importando Facturas...' : 'Descargar e Importar a Cartera'}</span>
                                                            </button>
                                                        )}

                                                        {isDescargada && (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Facturas y pagos importados a Cartera</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-end mt-4">
                            <button
                                type="button"
                                onClick={() => { setShowSatModal(false); setSatResult(null); }}
                                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-600"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
