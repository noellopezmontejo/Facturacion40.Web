import React, { useState, useEffect } from 'react';
import { X, Wallet, Search, Filter, ArrowUpRight, TrendingUp, Calendar, User } from 'lucide-react';
import api from '../api/axios';

export const CarteraModal = ({ isOpen, onClose, emisorId }) => {
    const [cartera, setCartera] = useState({ totalDeuda: 0, count: 0, documentos: [] });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchCartera = async () => {
        if (!emisorId) return;
        setLoading(true);
        try {
            const res = await api.get(`/pagos/cartera?emisor_id=${emisorId}`);
            setCartera(res.data);
        } catch (error) {
            console.error("Error fetching cartera", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchCartera();
    }, [isOpen, emisorId]);

    const filteredDocs = cartera.documentos.filter(d => 
        d.Receptor?.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.Receptor?.rfc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.folio.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-200 ring-4 ring-amber-50">
                            <Wallet className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestión de Cartera</h2>
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                Cuentas por Cobrar (Facturas PPD)
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200">
                        <X className="w-7 h-7 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Sidebar Stats */}
                    <div className="w-full md:w-80 bg-slate-50 p-8 border-r border-slate-100 space-y-8">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total por Cobrar</p>
                            <p className="text-4xl font-black text-slate-900 tracking-tighter">
                                ${cartera.totalDeuda.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl w-fit text-xs font-black">
                                <ArrowUpRight className="w-4 h-4" />
                                <span>{cartera.count} Facturas Pendientes</span>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-200">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por cliente o folio..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 focus:border-amber-500 focus:ring-0 rounded-2xl text-xs transition-all outline-none bg-white font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen de Antigüedad</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 italic transition-all hover:border-amber-200">
                                    <span className="text-xs text-slate-500">Módulo funcional para seguimiento de abonos y saldos remanentes.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main List */}
                    <div className="flex-1 overflow-y-auto p-8">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-slate-400 gap-3 font-bold animate-pulse">
                                <TrendingUp className="w-6 h-6" />
                                Cargando información de cartera...
                            </div>
                        ) : filteredDocs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <Search className="w-10 h-10" />
                                </div>
                                <p className="font-black uppercase tracking-widest text-sm text-slate-400">No se encontraron facturas con saldo</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredDocs.map(doc => {
                                    const saldo = parseFloat(doc.saldo_insoluto !== null ? doc.saldo_insoluto : doc.total);
                                    const porcentajePagado = ((doc.total - saldo) / doc.total) * 100;
                                    
                                    return (
                                        <div key={doc.id} className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-100/50 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                                                        <User className="w-6 h-6 text-slate-400 group-hover:text-amber-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-800 tracking-tight">{doc.Receptor?.razon_social}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[10px] font-mono text-slate-400">{doc.Receptor?.rfc}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" /> {new Date(doc.fecha).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Pendiente</p>
                                                    <p className="text-xl font-black text-amber-600 tracking-tighter">${saldo.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex justify-between items-end">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase border border-slate-200">
                                                            {doc.serie}{doc.folio}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-mono truncate max-w-[150px]">{doc.uuid}</span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500">
                                                        Avance de Pago: <span className="text-slate-800">{porcentajePagado.toFixed(0)}%</span>
                                                    </p>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                                    <div 
                                                        className="h-full bg-amber-500 transition-all duration-500 shadow-sm"
                                                        style={{ width: `${porcentajePagado}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
