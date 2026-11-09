import React, { useState } from 'react';
import { 
    AlertCircle, 
    Ban, 
    CreditCard, 
    FileText, 
    Info, 
    Loader2, 
    ShieldAlert, 
    X 
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

export const ModalCancelarPago = ({ pago, isOpen, onClose, onCancelled }) => {
    const { showToast } = useToast();
    const [motivo, setMotivo] = useState('02');
    const [uuidSustitucion, setUuidSustitucion] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen || !pago) return null;

    const rep = pago.DocumentoREP;
    const tieneRepTimbrado = rep && rep.estado_sat === 'Timbrado' && Boolean(rep.uuid);
    const montoFormatted = parseFloat(pago.monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleConfirmar = async (e) => {
        if (e) e.preventDefault();
        setErrorMsg('');

        if (tieneRepTimbrado && motivo === '01') {
            const clean = uuidSustitucion.trim();
            if (!clean || clean.length < 32) {
                setErrorMsg('Para el motivo 01, es obligatorio ingresar el UUID del REP que lo sustituye (36 caracteres).');
                return;
            }
            if (rep.uuid && clean.toLowerCase() === rep.uuid.toLowerCase()) {
                setErrorMsg('El UUID sustituto no puede ser el mismo UUID del complemento que estás cancelando.');
                return;
            }
        }

        setIsCancelling(true);
        try {
            const res = await api.post(`/pagos/${pago.id}/cancelar`, {
                motivoCancelacion: motivo,
                uuidSustitucion: motivo === '01' ? uuidSustitucion.trim() : ''
            });

            showToast(res.data?.message || '✅ Pago y Complemento REP cancelados exitosamente');
            if (onCancelled) onCancelled(res.data);
            onClose();
        } catch (err) {
            console.error('Error al cancelar pago:', err);
            const msg = err.response?.data?.message || err.message || 'Error al cancelar el pago';
            setErrorMsg(msg);
            showToast(`Error: ${msg}`, 'error');
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300">
                            <Ban className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base flex items-center gap-2">
                                Cancelar Pago / Complemento REP
                            </h3>
                            <p className="text-xs text-slate-400 font-mono">
                                Pago #{pago.id} • {new Date(pago.fecha_pago).toLocaleDateString('es-MX')} • ${montoFormatted} MXN
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isCancelling}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Resumen */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Cliente</span>
                            <span className="font-bold text-slate-800 line-clamp-1">{pago.Receptor?.razon_social}</span>
                            <span className="text-[10px] font-mono text-slate-500">{pago.Receptor?.rfc}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Monto y Forma</span>
                            <span className="font-black text-slate-900 text-sm">${montoFormatted} MXN</span>
                            <span className="text-[10px] text-slate-500 block">Forma: {pago.forma_pago}</span>
                        </div>
                    </div>

                    {/* Aviso de REP timbrado o pago administrativo */}
                    {tieneRepTimbrado ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                            <span className="font-bold text-amber-950 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4 text-amber-600" />
                                CFDI REP Timbrado ante el SAT
                            </span>
                            <p className="text-amber-800 text-[11px]">
                                Este pago cuenta con un Complemento de Recepción de Pagos oficial (Folio: <strong>{rep.serie || 'P'}-{rep.folio || rep.id}</strong>, UUID: <span className="font-mono text-[10px]">{rep.uuid}</span>).
                            </p>
                            <p className="text-amber-800 text-[11px]">
                                Al confirmar, se emitirá la <strong>solicitud de cancelación directa ante el SAT</strong> a través del PAC y se revertirá el saldo insoluto en las facturas asociadas.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
                            <span className="font-bold text-blue-950 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                                <Info className="w-4 h-4 text-blue-600" />
                                Cancelación Administrativa de Pago
                            </span>
                            <p className="text-blue-800 text-[11px]">
                                Este pago no cuenta con timbre fiscal ante el SAT. Al cancelarlo, se anulará su registro en el sistema y se restaurará el saldo original de las facturas que cubría.
                            </p>
                        </div>
                    )}

                    {/* Facturas cuyo saldo será restaurado */}
                    {pago.Documentos && pago.Documentos.length > 0 && (
                        <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                Facturas que recuperarán saldo insoluto:
                            </span>
                            <div className="space-y-1.5">
                                {pago.Documentos.filter(d => d.tipo_comprobante === 'I').map((fac) => {
                                    const pd = fac.PagoDocumento || {};
                                    return (
                                        <div key={fac.id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                                            <div>
                                                <span className="font-bold text-slate-800">
                                                    Factura {fac.serie || 'A'}-{fac.folio || fac.id}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono block">
                                                    UUID: {fac.uuid ? `${fac.uuid.substring(0, 13)}...` : 'Sin Timbrar'}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-emerald-700 font-bold block">
                                                    +${parseFloat(pd.imp_pagado || pago.monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                                                </span>
                                                <span className="text-[10px] text-slate-500">Saldo a restaurar</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Error Msg */}
                    {errorMsg && (
                        <div className="bg-rose-100 border border-rose-300 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                            <span className="flex-1">{errorMsg}</span>
                        </div>
                    )}

                    {/* Formulario SAT para el REP si aplica */}
                    {tieneRepTimbrado && (
                        <form onSubmit={handleConfirmar} className="space-y-3 pt-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                    Motivo de Cancelación SAT CFDI 4.0 <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    disabled={isCancelling}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:border-rose-500 outline-none"
                                >
                                    <option value="02">02 - Comprobante emitido con errores sin relación</option>
                                    <option value="01">01 - Comprobante emitido con errores con relación (Requiere sustituto)</option>
                                    <option value="03">03 - No se llevó a cabo la operación</option>
                                </select>
                            </div>

                            {motivo === '01' && (
                                <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 space-y-1.5 animate-in fade-in">
                                    <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wide">
                                        UUID del Complemento de Pago Sustituto <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={uuidSustitucion}
                                        onChange={(e) => setUuidSustitucion(e.target.value.trim())}
                                        placeholder="Ej: 12345678-ABCD-EF01-2345-6789ABCDEF01"
                                        disabled={isCancelling}
                                        className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-xs font-mono text-slate-800 bg-white focus:border-indigo-600 outline-none uppercase"
                                    />
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isCancelling}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
                    >
                        Regresar
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirmar}
                        disabled={isCancelling}
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-rose-600/20 disabled:opacity-50"
                    >
                        {isCancelling ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Cancelando...</span>
                            </>
                        ) : (
                            <>
                                <Ban className="w-4 h-4" />
                                <span>Confirmar Cancelación de Pago</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

