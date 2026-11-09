import React from 'react';
import { Download, FileCheck, FileText, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const ModalAcuseSAT = ({ doc, isOpen, onClose }) => {
    const { showToast } = useToast();

    if (!isOpen || !doc) return null;

    const folioStr = `${doc.serie || 'A'}-${doc.folio || doc.id}`;
    const acuseContent = doc.acuse_cancelacion || '';

    const handleDownloadAcuse = () => {
        if (!acuseContent) return;
        const blob = new Blob([acuseContent], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Acuse_Cancelacion_${doc.uuid || folioStr}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Acuse de cancelación descargado.');
    };

    const handleCopyAcuse = () => {
        navigator.clipboard.writeText(acuseContent);
        showToast('Acuse copiado al portapapeles.');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                            <FileCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base">Acuse Oficial de Cancelación SAT</h3>
                            <p className="text-xs text-slate-400 font-mono">
                                Comprobante {folioStr} • UUID: {doc.uuid || 'N/A'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Fecha de Cancelación</span>
                            <span className="font-bold text-slate-800">
                                {doc.fecha_cancelacion ? new Date(doc.fecha_cancelacion).toLocaleString('es-MX') : 'Cancelado'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Motivo SAT</span>
                            <span className="font-bold text-slate-800">
                                {doc.motivo_cancelacion ? `Motivo ${doc.motivo_cancelacion}` : '02'}
                            </span>
                        </div>
                        {doc.uuid_sustitucion && (
                            <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">UUID Sustituto</span>
                                <span className="font-mono text-slate-700 text-[10px]">{doc.uuid_sustitucion.substring(0, 12)}...</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                Contenido del Acuse XML Timbrado por el SAT:
                            </label>
                            <button
                                onClick={handleCopyAcuse}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                            >
                                Copiar Contenido
                            </button>
                        </div>
                        <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono max-h-72 overflow-auto border border-slate-800 leading-relaxed whitespace-pre-wrap break-all">
                            {acuseContent || 'No se recibió un XML acuse extendido para este comprobante (cancelación directa o local).'}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                    >
                        Cerrar
                    </button>
                    {acuseContent && (
                        <button
                            onClick={handleDownloadAcuse}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            <span>Descargar Acuse XML</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

