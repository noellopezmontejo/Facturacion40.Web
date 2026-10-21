import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import { FileText, Download, Eye, FileDigit, Calendar, RefreshCcw, Send, CheckCircle2, History, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Documentos = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const [documentos, setDocumentos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isTimbrando, setIsTimbrando] = useState(null); // ID del documento procesándose

    const fetchDocumentos = async () => {
        if (!activeEmisor) return;
        setIsLoading(true);
        try {
            const res = await api.get(`/documentos?emisorId=${activeEmisor.id}`);
            setDocumentos(res.data);
        } catch (error) {
            console.error('Error fetching documentos', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocumentos();
    }, [activeEmisor]);

    const handleDownload = (url) => {
        if (!url) {
            showToast('Archivo no disponible aún.', 'info');
            return;
        }
        const baseUrl = (api.defaults.baseURL || 'http://localhost:4000/api').replace('/api', '');
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
        window.open(fullUrl, '_blank');
    };

    const handleDownloadActualizado = async (docId) => {
        setIsTimbrando(docId); // Reusamos el estado de carga para feedback visual
        try {
            const res = await api.get(`/documentos/${docId}/pdf`);
            if (res.data.success) {
                const baseUrl = (api.defaults.baseURL || 'http://localhost:4000/api').replace('/api', '');
                window.open(`${baseUrl}${res.data.pdfUrl}`, '_blank');
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
                            <p className="text-sm">No has emitido ninguna factura o comprobante aún para este emisor.</p>
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
                                    <th className="p-4 font-semibold text-center w-40">Acciones</th>
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
                                            <div className="text-[10px] text-slate-400 mt-1 uppercase">
                                                ID: {doc.id}
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
                                            <div className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200">
                                                {doc.tipo_comprobante === 'I' ? 'Ingreso' :
                                                    doc.tipo_comprobante === 'E' ? 'Egreso' :
                                                        doc.tipo_comprobante === 'P' ? 'Pago' :
                                                            doc.tipo_comprobante === 'N' ? 'Nómina' :
                                                                doc.tipo_comprobante === 'T' ? 'Traslado' : doc.tipo_comprobante}
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
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    Cancelado
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
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${doc.estado_pago === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200' :
                                                doc.estado_pago === 'Pago Parcial' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    doc.estado_pago === 'Vencido' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        'bg-slate-100 text-slate-500 border-slate-200'
                                                }`}>
                                                {doc.estado_pago}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleDownloadActualizado(doc.id)}
                                                    disabled={isTimbrando === doc.id}
                                                    className={`p-1.5 rounded transition-colors ${isTimbrando === doc.id ? 'opacity-50 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                    title="Descargar PDF (Diseño Actual)"
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

                                                {doc.estado_sat !== 'Timbrado' && (
                                                    <button
                                                        onClick={() => handleTimbrar(doc.id)}
                                                        disabled={isTimbrando === doc.id}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg text-[11px] font-bold transition-all border border-primary-100 uppercase"
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

                                                <div className="w-px h-4 bg-slate-200 mx-1"></div>

                                                <button
                                                    className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                                    title="Enviar por Correo"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
