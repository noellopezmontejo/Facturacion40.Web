import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import { openPdfViewer } from '../utils/pdfViewer';
import { 
    FileText, 
    Download, 
    FileDigit, 
    Calendar, 
    RefreshCcw, 
    Send, 
    CheckCircle2, 
    History, 
    AlertCircle, 
    Layers, 
    X, 
    CreditCard, 
    Mail, 
    Ban, 
    XCircle, 
    FileCheck 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModalCancelarCFDI } from '../components/ModalCancelarCFDI';
import { ModalAcuseSAT } from '../components/ModalAcuseSAT';

export const Documentos = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const [documentos, setDocumentos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isTimbrando, setIsTimbrando] = useState(null); // ID del documento procesándose
    const [selectedDocRelacionados, setSelectedDocRelacionados] = useState(null);
    const [docParaCorreo, setDocParaCorreo] = useState(null);
    const [correoDestino, setCorreoDestino] = useState('');
    const [asuntoCorreo, setAsuntoCorreo] = useState('');
    const [mensajeCorreo, setMensajeCorreo] = useState('');
    const [enviandoCorreo, setEnviandoCorreo] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState('I'); // 'I' (Ingreso por defecto), 'E' (Notas de Crédito), 'TODOS'
    const [docParaCancelar, setDocParaCancelar] = useState(null);
    const [docParaAcuse, setDocParaAcuse] = useState(null);

    const handleAbrirModalCorreo = (doc, receptorOverride = null) => {
        const receptor = receptorOverride || doc.Receptor;
        const folioStr = `${doc.serie || 'A'}-${doc.folio || doc.id}`;
        const tipoStr = doc.tipo_comprobante === 'P'
            ? 'Complemento de Pago'
            : doc.tipo_comprobante === 'E'
                ? 'Nota de Crédito'
                : 'Factura';
        setDocParaCorreo({ ...doc, Receptor: receptor });
        setCorreoDestino(receptor?.correo || '');
        setAsuntoCorreo(`${tipoStr} ${folioStr} - ${activeEmisor?.razon_social || ''}`);
        setMensajeCorreo('');
    };

    const handleEnviarCorreo = async (e) => {
        if (e) e.preventDefault();
        if (!docParaCorreo) return;
        if (!correoDestino.trim()) {
            showToast('Ingresa al menos un correo electrónico destinatario.', 'warning');
            return;
        }
        setEnviandoCorreo(true);
        try {
            const res = await api.post(`/documentos/${docParaCorreo.id}/enviar-correo`, {
                destinatarios: correoDestino.trim(),
                email: correoDestino.trim(),
                asunto: asuntoCorreo.trim() || undefined,
                mensaje: mensajeCorreo.trim() || undefined
            });
            showToast(res.data?.message || '✅ Comprobante enviado por correo exitosamente');
            setDocParaCorreo(null);
        } catch (error) {
            console.error('Error al enviar correo:', error);
            showToast(error.response?.data?.message || 'Error al enviar el comprobante por correo', 'error');
        } finally {
            setEnviandoCorreo(false);
        }
    };

    const fetchDocumentos = async () => {
        if (!activeEmisor) return;
        setIsLoading(true);
        try {
            const endpoint = filtroTipo === 'TODOS'
                ? `/documentos?emisorId=${activeEmisor.id}&tipoComprobante=I,E,P,T`
                : `/documentos?emisorId=${activeEmisor.id}&tipoComprobante=${filtroTipo}`;
            const res = await api.get(endpoint);
            setDocumentos(res.data || []);
        } catch (error) {
            console.error('Error fetching documentos', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocumentos();
    }, [activeEmisor, filtroTipo]);

    const handleDocCancelado = async () => {
        await fetchDocumentos();
        if (selectedDocRelacionados) {
            try {
                const res = await api.get(`/documentos?emisorId=${activeEmisor.id}&tipoComprobante=I`);
                const updated = (res.data || []).find(d => d.id === selectedDocRelacionados.id);
                if (updated) setSelectedDocRelacionados(updated);
            } catch (e) {
                console.error("Error al refrescar documento relacionado:", e);
            }
        }
    };

    const handleCancelarPagoDirecto = async (pago) => {
        if (!window.confirm(`¿Deseas cancelar el pago #${pago.id} de $${pago.monto} MXN? Se restaurará el saldo en las facturas asociadas.`)) return;
        try {
            const res = await api.post(`/pagos/${pago.id}/cancelar`, { motivoCancelacion: '02' });
            showToast(res.data?.message || 'Pago cancelado exitosamente.');
            handleDocCancelado();
        } catch (err) {
            console.error("Error al cancelar pago:", err);
            showToast(err.response?.data?.message || 'Error al cancelar pago', 'error');
        }
    };

    const handleDownload = async (url) => {
        if (!url) {
            showToast('Archivo no disponible aún.', 'info');
            return;
        }
        if (url.toLowerCase().endsWith('.xml')) {
            const baseUrl = (api.defaults.baseURL || '/api').replace('/api', '');
            window.open(`${baseUrl}${url}`, '_blank');
        } else {
            await openPdfViewer(url);
        }
    };

    const handleDownloadActualizado = async (docId) => {
        setIsTimbrando(docId); // Reusamos el estado de carga para feedback visual
        try {
            const res = await api.get(`/documentos/${docId}/pdf`);
            if (res.data.success) {
                await openPdfViewer(res.data.pdfUrl);
            }
        } catch (error) {
            console.error('Error al generar PDF actualizado', error);
            showToast('Error al generar PDF con el diseño actual', 'error');
        } finally {
            setIsTimbrando(null);
        }
    };

    const handleTimbrar = async (docId) => {
        if (!window.confirm('¿Deseas timbrar este documento ahora?')) return;

        setIsTimbrando(docId);
        try {
            await api.post(`/documentos/${docId}/timbrar`);
            showToast('✅ Documento timbrado exitosamente');
            fetchDocumentos(); // Recargar lista
        } catch (error) {
            console.error('Error al timbrar documento', error);
            showToast('Error al timbrar: ' + (error.response?.data?.message || error.message), 'error');
        } finally {
            setIsTimbrando(null);
        }
    };

    if (!activeEmisor) {
        return <div className="p-8 text-center text-slate-500">Selecciona un emisor para continuar.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto pb-12">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Documentos Emitidos</h1>
                    <p className="text-slate-500 text-sm mt-1">Consulta y administra tus comprobantes fiscales y facturas.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchDocumentos} className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-transparent hover:border-primary-100">
                        <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <Link to="/facturas/nueva" className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-500 shadow-md shadow-primary-500/20 transition-all">
                        <FileText className="w-4 h-4" />
                        Nueva Factura
                    </Link>
                </div>
            </div>

            {/* Selector de Pestañas / Filtro de Tipo de Comprobante */}
            <div className="flex items-center gap-2 mb-4 bg-slate-100 p-1 rounded-xl w-fit text-xs font-semibold">
                <button
                    onClick={() => setFiltroTipo('I')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                        filtroTipo === 'I' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Facturas de Ingreso (I)
                </button>
                <button
                    onClick={() => setFiltroTipo('E')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                        filtroTipo === 'E' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Notas de Crédito / Egresos (E)
                </button>
                <button
                    onClick={() => setFiltroTipo('TODOS')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                        filtroTipo === 'TODOS' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Todos los Comprobantes
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="p-12 text-center text-slate-500">
                            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-600 animate-spin mx-auto mb-4"></div>
                            Obteniendo historial de documentos...
                        </div>
                    ) : documentos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
                            <History className="w-16 h-16 mb-4 text-slate-200" />
                            <p className="font-medium text-lg text-slate-500 mb-1">No hay documentos registrados</p>
                            <p className="text-sm">No has emitido comprobantes fiscales en esta categoría aún.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider">
                                    <th className="p-4 font-semibold w-24">Fecha</th>
                                    <th className="p-4 font-semibold">Receptor (Cliente)</th>
                                    <th className="p-4 font-semibold w-28">Tipo</th>
                                    <th className="p-4 font-semibold text-right w-36">Total</th>
                                    <th className="p-4 font-semibold text-center w-36">Estatus SAT</th>
                                    <th className="p-4 font-semibold text-center w-28">Estatus Pago</th>
                                    <th className="p-4 font-semibold text-center w-44">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {documentos.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                {new Date(doc.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1 uppercase font-mono">
                                                {doc.serie || 'A'}-{doc.folio || doc.id} • ID: {doc.id}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {doc.Receptor ? (
                                                <>
                                                    <div className="font-semibold text-slate-800 line-clamp-1" title={doc.Receptor.razon_social}>
                                                        {doc.Receptor.razon_social}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                                                        {doc.Receptor.rfc}
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-slate-400 italic">Desconocido</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className={`inline-flex items-center px-2 py-1 rounded font-medium text-xs border ${
                                                doc.tipo_comprobante === 'E'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                    : doc.tipo_comprobante === 'P'
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                                {doc.tipo_comprobante === 'E'
                                                    ? 'Nota Crédito'
                                                    : doc.tipo_comprobante === 'P'
                                                        ? 'Pago REP'
                                                        : `Ingreso (${doc.metodo_pago || 'PUE'})`}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-bold text-slate-700">
                                                ${parseFloat(doc.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-[10px] font-mono text-primary-600 font-semibold mt-0.5">
                                                {doc.moneda}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {doc.estado_sat === 'Timbrado' ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Timbrado
                                                </div>
                                            ) : doc.estado_sat === 'Cancelado' ? (
                                                <div>
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        Cancelado
                                                    </div>
                                                    {doc.motivo_cancelacion && (
                                                        <div className="text-[9px] text-slate-400 mt-1 font-mono">
                                                            Motivo SAT: {doc.motivo_cancelacion}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                                                    <FileDigit className="w-3.5 h-3.5" />
                                                    Pendiente
                                                </div>
                                            )}
                                            {doc.uuid && (
                                                <div className="text-[9px] text-slate-400 mt-1.5 font-mono uppercase tracking-wider block" title={doc.uuid}>
                                                    {doc.uuid.substring(0, 8)}...
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                                                doc.estado_sat === 'Cancelado' ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' :
                                                doc.estado_pago === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200' :
                                                doc.estado_pago === 'Pago Parcial' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                doc.estado_pago === 'Vencido' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}>
                                                {doc.estado_pago}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => handleDownloadActualizado(doc.id)}
                                                    disabled={isTimbrando === doc.id}
                                                    className={`p-1.5 rounded transition-colors ${isTimbrando === doc.id ? 'opacity-50 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                    title={doc.estado_sat === 'Cancelado' ? "Descargar PDF (Con sello de CANCELADO)" : "Descargar PDF (Diseño Actual)"}
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDownload(doc.xml_url)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Descargar XML"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>

                                                <button
                                                    onClick={() => setSelectedDocRelacionados(doc)}
                                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                                        ((doc.Pagos?.length || 0) + (doc.NotasRelacionadas?.length || 0) > 0 || doc.uuids_relacionados)
                                                            ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200'
                                                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200'
                                                    }`}
                                                    title="Ver Pagos, Notas de Crédito y Documentos Relacionados"
                                                >
                                                    <Layers className="w-3.5 h-3.5" />
                                                    <span>Relacionados</span>
                                                    {((doc.Pagos?.length || 0) + (doc.NotasRelacionadas?.length || 0)) > 0 && (
                                                        <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[9px]">
                                                            {(doc.Pagos?.length || 0) + (doc.NotasRelacionadas?.length || 0)}
                                                        </span>
                                                    )}
                                                </button>

                                                {doc.estado_sat !== 'Timbrado' && doc.estado_sat !== 'Cancelado' && (
                                                    <button
                                                        onClick={() => handleTimbrar(doc.id)}
                                                        disabled={isTimbrando === doc.id}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg text-[11px] font-bold transition-all border border-primary-100 uppercase"
                                                        title="Generar Timbre Fiscal"
                                                    >
                                                        {isTimbrando === doc.id ? (
                                                            <RefreshCcw className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <FileDigit className="w-3 h-3" />
                                                        )}
                                                        Timbrar
                                                    </button>
                                                )}

                                                <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

                                                <button
                                                    onClick={() => handleAbrirModalCorreo(doc)}
                                                    className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                                    title="Enviar CFDI (PDF y XML) por Correo"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>

                                                {doc.estado_sat === 'Cancelado' ? (
                                                    <button
                                                        onClick={() => setDocParaAcuse(doc)}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                        title="Ver Acuse Oficial de Cancelación SAT"
                                                    >
                                                        <FileCheck className="w-4 h-4 text-emerald-600" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setDocParaCancelar(doc)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                        title="Cancelar Comprobante ante el SAT (CFDI 4.0)"
                                                    >
                                                        <Ban className="w-4 h-4 text-rose-500" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal de Pagos y Documentos Relacionados */}
            {selectedDocRelacionados && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden">
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">Documentos y Pagos Relacionados</h3>
                                    <p className="text-xs text-slate-400 font-mono">
                                        Factura {selectedDocRelacionados.serie || 'A'}-{selectedDocRelacionados.folio || selectedDocRelacionados.id} • UUID: {selectedDocRelacionados.uuid || 'Sin timbrar'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDocRelacionados(null)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                            {/* Resumen de la Factura de Ingreso */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Cliente</span>
                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{selectedDocRelacionados.Receptor?.razon_social}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Método de Pago</span>
                                    <span className="text-xs font-bold text-slate-800">{selectedDocRelacionados.metodo_pago || 'PUE'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Facturado</span>
                                    <span className="text-xs font-bold text-slate-900">
                                        ${parseFloat(selectedDocRelacionados.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedDocRelacionados.moneda}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Saldo Insoluto</span>
                                    <span className="text-xs font-bold text-indigo-600">
                                        ${parseFloat(selectedDocRelacionados.saldo_insoluto ?? selectedDocRelacionados.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedDocRelacionados.moneda}
                                    </span>
                                </div>
                            </div>

                            {/* Tabla de Pagos / Complementos REP asociados */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-indigo-600" />
                                        Complementos de Pago (REP) Aplicados
                                    </h4>
                                    <Link
                                        to="/pagos"
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                    >
                                        Ir a Control de Pagos →
                                    </Link>
                                </div>

                                {!selectedDocRelacionados.Pagos || selectedDocRelacionados.Pagos.length === 0 ? (
                                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                                        No hay abonos ni Complementos de Pago (REP) registrados para esta factura.
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                                                    <th className="p-3 font-bold">Parc.</th>
                                                    <th className="p-3 font-bold">Fecha Pago</th>
                                                    <th className="p-3 font-bold text-right">Saldo Ant.</th>
                                                    <th className="p-3 font-bold text-right">Pagado</th>
                                                    <th className="p-3 font-bold text-right">Insoluto</th>
                                                    <th className="p-3 font-bold text-center">CFDI REP</th>
                                                    <th className="p-3 font-bold text-center">Acciones REP</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedDocRelacionados.Pagos.map((pago) => {
                                                    const pd = pago.PagoDocumento || {};
                                                    const rep = pago.DocumentoREP;
                                                    return (
                                                        <tr key={pago.id} className="hover:bg-slate-50">
                                                            <td className="p-3 font-bold text-indigo-600">
                                                                #{pd.num_parcialidad || 1}
                                                            </td>
                                                            <td className="p-3 text-slate-700">
                                                                {new Date(pago.fecha_pago).toLocaleDateString('es-MX')}
                                                            </td>
                                                            <td className="p-3 text-right text-slate-500 font-mono">
                                                                ${parseFloat(pd.imp_saldo_ant || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                                                                +${parseFloat(pd.imp_pagado || pago.monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-slate-800 font-mono">
                                                                ${parseFloat(pd.imp_saldo_insoluto || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {rep ? (
                                                                    <div>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                                            rep.estado_sat === 'Cancelado' || pago.estado === 'Cancelado'
                                                                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        }`}>
                                                                            {rep.serie || 'P'}-{rep.folio || rep.id}
                                                                            {(rep.estado_sat === 'Cancelado' || pago.estado === 'Cancelado') && ' (Cancelado)'}
                                                                        </span>
                                                                        {rep.uuid && (
                                                                            <div className="text-[9px] text-slate-400 font-mono mt-0.5" title={rep.uuid}>
                                                                                {rep.uuid.substring(0, 8)}...
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                                        pago.estado === 'Cancelado'
                                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    }`}>
                                                                        {pago.estado === 'Cancelado' ? 'Cancelado' : 'Sin Timbrar'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {rep ? (
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        <button
                                                                            onClick={() => handleDownloadActualizado(rep.id)}
                                                                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                            title="Ver PDF del Complemento de Pago"
                                                                        >
                                                                            <FileText className="w-4 h-4" />
                                                                        </button>
                                                                        {rep.xml_url && (
                                                                            <button
                                                                                onClick={() => handleDownload(rep.xml_url)}
                                                                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                                title="Descargar XML del Complemento de Pago"
                                                                            >
                                                                                <Download className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleAbrirModalCorreo(rep, selectedDocRelacionados.Receptor)}
                                                                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                            title="Enviar Complemento de Pago por Correo"
                                                                        >
                                                                            <Send className="w-4 h-4" />
                                                                        </button>
                                                                        {rep.estado_sat === 'Cancelado' || pago.estado === 'Cancelado' ? (
                                                                            rep.acuse_cancelacion && (
                                                                                <button
                                                                                    onClick={() => setDocParaAcuse(rep)}
                                                                                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                                    title="Ver Acuse SAT de Cancelación"
                                                                                >
                                                                                    <FileCheck className="w-4 h-4 text-emerald-600" />
                                                                                </button>
                                                                            )
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => setDocParaCancelar(rep)}
                                                                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                                title="Cancelar Complemento de Pago (REP) ante el SAT"
                                                                            >
                                                                                <Ban className="w-4 h-4 text-rose-500" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    pago.estado === 'Cancelado' ? (
                                                                        <span className="text-[10px] text-rose-600 font-bold">Cancelado</span>
                                                                    ) : (
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <Link
                                                                                to="/pagos"
                                                                                className="text-[10px] font-bold text-indigo-600 hover:underline"
                                                                            >
                                                                                Timbrar
                                                                            </Link>
                                                                            <button
                                                                                onClick={() => handleCancelarPagoDirecto(pago)}
                                                                                className="text-[10px] font-bold text-rose-600 hover:underline"
                                                                                title="Cancelar este pago y restaurar el saldo"
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Tabla de Notas de Crédito / Devoluciones aplicadas a este documento */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-amber-600" />
                                        Notas de Crédito / Devoluciones Aplicadas ({selectedDocRelacionados.NotasRelacionadas?.length || 0})
                                    </h4>
                                </div>

                                {!selectedDocRelacionados.NotasRelacionadas || selectedDocRelacionados.NotasRelacionadas.length === 0 ? (
                                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                                        No hay Notas de Crédito ni Devoluciones aplicadas a esta factura.
                                    </div>
                                ) : (
                                    <div className="border border-amber-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-amber-50/70 border-b border-amber-200 text-amber-900 text-[10px] uppercase">
                                                    <th className="p-3 font-bold">Documento</th>
                                                    <th className="p-3 font-bold">Fecha</th>
                                                    <th className="p-3 font-bold">Tipo Relación</th>
                                                    <th className="p-3 font-bold">UUID Fiscal</th>
                                                    <th className="p-3 font-bold text-right">Monto Aplicado</th>
                                                    <th className="p-3 font-bold text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-100 bg-white">
                                                {selectedDocRelacionados.NotasRelacionadas.map((nc) => {
                                                    const relLabel = nc.tipo_relacion === '03'
                                                        ? '03 - Devolución'
                                                        : nc.tipo_relacion === '01'
                                                            ? '01 - Nota de Crédito'
                                                            : nc.tipo_relacion === '04'
                                                                ? '04 - Sustitución'
                                                                : `${nc.tipo_relacion || '01'} - Egreso`;
                                                    return (
                                                        <tr key={nc.id} className="hover:bg-amber-50/30">
                                                            <td className="p-3">
                                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-black">
                                                                    {nc.serie || 'NC'}-{nc.folio || nc.id}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-slate-700">
                                                                {nc.fecha ? new Date(nc.fecha).toLocaleDateString('es-MX') : ''}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="text-[11px] font-bold text-slate-700">{relLabel}</span>
                                                            </td>
                                                            <td className="p-3 font-mono text-[10px] text-slate-500" title={nc.uuid}>
                                                                {nc.uuid ? `${nc.uuid.substring(0, 13)}...` : 'Sin timbrar'}
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-rose-600 font-mono">
                                                                -${parseFloat(nc.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {nc.moneda || 'MXN'}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        onClick={() => handleDownloadActualizado(nc.id)}
                                                                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="Ver PDF de la Nota de Crédito / Devolución"
                                                                    >
                                                                        <FileText className="w-4 h-4" />
                                                                    </button>
                                                                    {nc.xml_url && (
                                                                        <button
                                                                            onClick={() => handleDownload(nc.xml_url)}
                                                                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                            title="Descargar XML de la Nota de Crédito / Devolución"
                                                                        >
                                                                            <Download className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleAbrirModalCorreo(nc, selectedDocRelacionados.Receptor)}
                                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                        title="Enviar Nota de Crédito por Correo"
                                                                    >
                                                                        <Send className="w-4 h-4" />
                                                                    </button>

                                                                    {nc.estado_sat === 'Cancelado' ? (
                                                                        nc.acuse_cancelacion && (
                                                                            <button
                                                                                onClick={() => setDocParaAcuse(nc)}
                                                                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                                title="Ver Acuse SAT de Cancelación"
                                                                            >
                                                                                <FileCheck className="w-4 h-4 text-emerald-600" />
                                                                            </button>
                                                                        )
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setDocParaCancelar(nc)}
                                                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                            title="Cancelar Nota de Crédito ante el SAT"
                                                                        >
                                                                            <Ban className="w-4 h-4 text-rose-500" />
                                                                        </button>
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

                            {/* CFDI Relacionados (si este documento sustituye a otro previo) */}
                            {selectedDocRelacionados.uuids_relacionados && (
                                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
                                    <h4 className="text-xs font-bold uppercase text-amber-800 mb-1">
                                        CFDI Relacionados (Tipo Relación: {selectedDocRelacionados.tipo_relacion || '04'})
                                    </h4>
                                    <p className="text-xs font-mono text-amber-900 break-all">
                                        {selectedDocRelacionados.uuids_relacionados}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedDocRelacionados(null)}
                                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para Enviar CFDI (PDF + XML) por Correo Electrónico */}
            {docParaCorreo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">Enviar CFDI por Correo Electrónico</h3>
                                    <p className="text-xs text-slate-400 font-mono">
                                        {docParaCorreo.serie || 'A'}-{docParaCorreo.folio || docParaCorreo.id} • {docParaCorreo.Receptor?.razon_social || 'Receptor'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDocParaCorreo(null)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleEnviarCorreo} className="p-6 space-y-4">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Archivos Adjuntos</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                            <FileText className="w-3 h-3" /> PDF Oficial
                                        </span>
                                        {docParaCorreo.estado_sat === 'Timbrado' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px]">
                                                <Download className="w-3 h-3" /> XML Timbrado SAT
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px]">
                                                Sin XML (Pendiente de Timbrar)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Remitente</span>
                                    <span className="font-bold text-slate-700 text-[11px]">
                                        {activeEmisor?.usar_smtp_propio ? '⚡ SMTP del Emisor' : '🏢 SMTP Espacio de Trabajo'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                    Correo(s) Destinatario(s) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={correoDestino}
                                    onChange={e => setCorreoDestino(e.target.value)}
                                    placeholder="cliente@empresa.com, contabilidad@empresa.com"
                                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Puedes ingresar varios correos separados por coma (,).
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                    Asunto del Correo
                                </label>
                                <input
                                    type="text"
                                    value={asuntoCorreo}
                                    onChange={e => setAsuntoCorreo(e.target.value)}
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                    Mensaje Adicional (Opcional)
                                </label>
                                <textarea
                                    rows={3}
                                    value={mensajeCorreo}
                                    onChange={e => setMensajeCorreo(e.target.value)}
                                    placeholder="Escribe un mensaje personalizado para tu cliente..."
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-indigo-500 outline-none resize-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setDocParaCorreo(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={enviandoCorreo}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{enviandoCorreo ? 'Enviando CFDI...' : 'Enviar PDF + XML'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal para Cancelación SAT CFDI 4.0 con Análisis de Reglas y Bloqueos */}
            <ModalCancelarCFDI
                doc={docParaCancelar}
                isOpen={Boolean(docParaCancelar)}
                onClose={() => setDocParaCancelar(null)}
                onCancelled={handleDocCancelado}
            />

            {/* Modal para Visualizar / Descargar Acuse Oficial SAT */}
            <ModalAcuseSAT
                doc={docParaAcuse}
                isOpen={Boolean(docParaAcuse)}
                onClose={() => setDocParaAcuse(null)}
            />
        </div>
    );
};
