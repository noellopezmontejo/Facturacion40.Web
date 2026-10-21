import React, { useState, useEffect } from 'react';
import { CreditCard, Search, FileCheck2, AlertCircle, RefreshCw, Plus, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { PagoModal } from '../components/PagoModal';
import { CarteraModal } from '../components/CarteraModal';
import { useToast } from '../context/ToastContext';

export const ControlPagos = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const [pagos, setPagos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [showCarteraModal, setShowCarteraModal] = useState(false);

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

    const handleVerPDF = (item) => {
        const pdfUrl = item.DocumentoREP?.pdf_url || item.Documentos?.find(d => d.id === item.documento_rep_id)?.pdf_url;
        if (pdfUrl) {
            const url = `${api.defaults.baseURL.replace('/api', '')}${pdfUrl}`;
            window.open(url, '_blank');
        } else {
            showToast('El PDF aún no ha sido generado o no está disponible.', 'info');
        }
    };

    const handleReimprimirPDF = async (item) => {
        try {
            setLoading(true);
            const res = await api.get(`/documentos/${item.documento_rep_id}/pdf`);
            const url = `${api.defaults.baseURL.replace('/api', '')}${res.data.pdfUrl}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error("Error regenerando PDF", error);
            showToast("Error al regenerar el reporte PDF", "error");
        } finally {
            setLoading(false);
        }
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
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cuentas Por Cobrar</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium italic">Gestión de abonos de clientes y Complementos de Recepción de Pagos (REP).</p>
                </div>
                <button 
                    onClick={() => setShowPagoModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-500 shadow-lg shadow-primary-200 shadow-offset-2 transition-all group"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    <span>Registrar Nuevo Pago</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-primary-200 transition-colors">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cobrado Total</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">${stats.totalCobrado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
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
                                        ${parseFloat(item.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                                        <div className="flex items-center justify-end gap-2">
                                            {item.documento_rep_id ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest mb-1">Timbrado</span>
                                                    <div className="text-[8px] font-mono text-slate-400 max-w-[80px] truncate">
                                                        REP-{item.id}
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
                                                </>
                                            )}
                                            <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-transparent hover:border-slate-200" title="Ver Detalle">
                                                <FileCheck2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

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
        </div>
    );
};
