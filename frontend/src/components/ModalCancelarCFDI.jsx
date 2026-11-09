import React, { useState, useEffect } from 'react';
import { 
    AlertCircle, 
    AlertTriangle, 
    Ban, 
    CheckCircle2, 
    Clock, 
    FileText, 
    Info, 
    Layers, 
    Loader2, 
    RefreshCw, 
    ShieldAlert, 
    X, 
    XCircle 
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

export const ModalCancelarCFDI = ({ doc, isOpen, onClose, onCancelled }) => {
    const { showToast } = useToast();
    const [isLoadingPre, setIsLoadingPre] = useState(true);
    const [diagnostico, setDiagnostico] = useState(null);
    const [motivo, setMotivo] = useState('02');
    const [uuidSustitucion, setUuidSustitucion] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!isOpen || !doc) return;

        let isMounted = true;
        setIsLoadingPre(true);
        setErrorMsg('');
        setDiagnostico(null);

        api.get(`/documentos/${doc.id}/pre-cancelacion`)
            .then((res) => {
                if (!isMounted) return;
                const data = res.data;
                setDiagnostico(data);
                setMotivo(data.motivoSugerido || (doc.es_global ? '04' : '02'));
                setUuidSustitucion(data.uuidSustitucionSugerido || '');
            })
            .catch((err) => {
                if (!isMounted) return;
                console.error('Error al verificar pre-cancelación:', err);
                setErrorMsg(err.response?.data?.message || 'Error al analizar las reglas de cancelación del CFDI.');
            })
            .finally(() => {
                if (isMounted) setIsLoadingPre(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, doc]);

    if (!isOpen || !doc) return null;

    const tipoDocLabel = doc.tipo_comprobante === 'E'
        ? 'Nota de Crédito / Devolución'
        : doc.tipo_comprobante === 'P'
            ? 'Complemento de Pago (REP)'
            : doc.tipo_comprobante === 'T'
                ? 'Carta Porte / Traslado'
                : 'Factura de Ingreso';

    const folioStr = `${doc.serie || 'A'}-${doc.folio || doc.id}`;

    const handleConfirmarCancelacion = async (e) => {
        if (e) e.preventDefault();
        setErrorMsg('');

        if (motivo === '01') {
            const cleanUuid = uuidSustitucion.trim();
            if (!cleanUuid || cleanUuid.length < 32) {
                setErrorMsg('Para el motivo 01, es obligatorio indicar el UUID válido del CFDI que lo sustituye (36 caracteres).');
                return;
            }
            if (doc.uuid && cleanUuid.toLowerCase() === doc.uuid.toLowerCase()) {
                setErrorMsg('El UUID sustituto no puede ser igual al UUID del comprobante que estás cancelando.');
                return;
            }
        }

        setIsCancelling(true);
        try {
            const res = await api.post(`/documentos/${doc.id}/cancelar`, {
                motivoCancelacion: motivo,
                uuidSustitucion: motivo === '01' ? uuidSustitucion.trim() : ''
            });

            const satInfo = res.data?.sat || {};
            let toastMsg = res.data?.mensaje || '✅ CFDI cancelado exitosamente ante el SAT';
            if (satInfo.solicitud_aceptacion) {
                toastMsg = '⏳ Solicitud enviada al Buzón Tributario del receptor (requiere aceptación).';
            }

            showToast(toastMsg, satInfo.solicitud_aceptacion ? 'info' : 'success');
            if (onCancelled) onCancelled(res.data);
            onClose();
        } catch (err) {
            console.error('Error al cancelar CFDI:', err);
            const msg = err.response?.data?.message || err.message || 'Error al procesar la cancelación en el SAT';
            setErrorMsg(msg);
            showToast(`Error al cancelar: ${msg}`, 'error');
        } finally {
            setIsCancelling(false);
        }
    };

    const puedeCancelar = diagnostico ? diagnostico.puedeCancelar : false;
    const tieneBloqueos = diagnostico?.bloqueos && diagnostico.bloqueos.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300">
                            <Ban className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base flex items-center gap-2">
                                Cancelar Comprobante ante el SAT
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-400/30">
                                    CFDI 4.0
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400 font-mono">
                                {tipoDocLabel} {folioStr} • UUID: {doc.uuid ? `${doc.uuid.substring(0, 18)}...` : 'Sin Timbrar'}
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

                {/* Body scrollable */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Resumen del CFDI a cancelar */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Receptor</span>
                            <span className="font-bold text-slate-800 line-clamp-1" title={doc.Receptor?.razon_social}>
                                {doc.Receptor?.razon_social || 'Público en General'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">{doc.Receptor?.rfc}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Tipo / Método</span>
                            <span className="font-bold text-slate-800">
                                {doc.tipo_comprobante === 'E' ? 'Egreso' : doc.tipo_comprobante === 'P' ? 'Pago REP' : 'Ingreso'} ({doc.metodo_pago || 'PUE'})
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Monto Total</span>
                            <span className="font-black text-slate-900 text-sm">
                                ${parseFloat(doc.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {doc.moneda || 'MXN'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Estatus Fiscal</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] uppercase border ${
                                doc.estado_sat === 'Timbrado'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                                {doc.estado_sat}
                            </span>
                        </div>
                    </div>

                    {/* Estado de análisis */}
                    {isLoadingPre ? (
                        <div className="py-8 px-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700">Analizando reglas de validación del SAT...</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Verificando documentos relacionados, complementos de pago, buzón tributario y plazos legales.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ALERTA DE BLOQUEO POR RELACIONES VIGENTES */}
                            {tieneBloqueos && (
                                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-xs text-rose-900 shadow-sm animate-in fade-in">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-rose-100 rounded-lg text-rose-700 mt-0.5">
                                            <ShieldAlert className="w-5 h-5" />
                                        </div>
                                        <div className="space-y-1.5 flex-1">
                                            <h4 className="font-black text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                                                No Cancelable Directamente (Regla SAT 2.7.1.34)
                                            </h4>
                                            <p className="text-rose-800 text-[11px]">
                                                El SAT prohíbe cancelar un CFDI si existen otros comprobantes activos que dependen de él. Para poder cancelar esta factura, debes cancelar primero:
                                            </p>
                                            <div className="space-y-2 mt-2">
                                                {diagnostico.bloqueos.map((b, i) => {
                                                    const titulo = typeof b === 'string' ? b : (b.titulo || b.mensaje);
                                                    const mensaje = typeof b === 'object' ? b.mensaje : null;
                                                    const docs = typeof b === 'object' && Array.isArray(b.documentos) ? b.documentos : [];
                                                    return (
                                                        <div key={i} className="bg-white/80 p-2.5 rounded-lg border border-rose-200">
                                                            <p className="font-bold text-rose-950 text-xs">
                                                                • {titulo}
                                                            </p>
                                                            {mensaje && mensaje !== titulo && (
                                                                <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                                                                    {mensaje}
                                                                </p>
                                                            )}
                                                            {docs.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                                    {docs.map((d, dIdx) => (
                                                                        <span key={dIdx} className="px-2 py-0.5 bg-rose-100 text-rose-800 font-mono text-[10px] rounded border border-rose-200 font-semibold" title={d.uuid}>
                                                                            {d.serie || ''}{d.folio ? `${d.folio}` : (d.id ? `ID:${d.id}` : '')}
                                                                            {d.monto ? ` ($${parseFloat(d.monto).toFixed(2)})` : (d.total ? ` ($${parseFloat(d.total).toFixed(2)})` : '')}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] text-rose-700 italic mt-2">
                                                Tip: Abre la sección de <strong>Documentos Relacionados</strong> o el módulo de <strong>Cuentas por Cobrar</strong> para cancelar los pagos o notas de crédito primero.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ADVERTENCIA DE BUZÓN TRIBUTARIO / ACEPTACIÓN */}
                            {diagnostico?.advertenciasSat && diagnostico.advertenciasSat.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <div className="space-y-1">
                                            <span className="font-bold text-amber-900 uppercase tracking-wide text-[11px] block">
                                                Aceptación del Receptor en Buzón Tributario
                                            </span>
                                            {diagnostico.advertenciasSat.map((adv, idx) => {
                                                const texto = typeof adv === 'string' ? adv : (adv.mensaje || adv.tipo || '');
                                                return (
                                                    <p key={idx} className="text-amber-800 text-[11px] leading-relaxed">
                                                        {texto}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* EFECTOS CONTABLES / REVERSIÓN DE SALDOS */}
                            {diagnostico?.efectosContables && diagnostico.efectosContables.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900">
                                    <div className="flex items-start gap-2.5">
                                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div className="space-y-1">
                                            <span className="font-bold text-blue-900 uppercase tracking-wide text-[11px] block">
                                                Reversión Contable Automática
                                            </span>
                                            {diagnostico.efectosContables.map((ef, idx) => {
                                                const texto = typeof ef === 'string' ? ef : (ef.descripcion || ef.mensaje || `Factura ${ef.folio || ''}: Saldo restaurado $${ef.saldo_nuevo || ef.monto_reversado || ''}`);
                                                return (
                                                    <p key={idx} className="text-blue-800 text-[11px] leading-relaxed">
                                                        {texto}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MENSAJE DE ERROR DEL SERVIDOR */}
                            {errorMsg && (
                                <div className="bg-rose-100 border border-rose-300 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                                    <span className="flex-1">{errorMsg}</span>
                                </div>
                            )}

                            {/* FORMULARIO DE MOTIVOS SAT CFDI 4.0 */}
                            <form onSubmit={handleConfirmarCancelacion} className="space-y-4 pt-1">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                        Motivo de Cancelación SAT <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={motivo}
                                        onChange={(e) => setMotivo(e.target.value)}
                                        disabled={isCancelling || !puedeCancelar}
                                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                        <option value="02">02 - Comprobante emitido con errores sin relación</option>
                                        <option value="01">01 - Comprobante emitido con errores con relación (Requiere sustituto)</option>
                                        <option value="03">03 - No se llevó a cabo la operación</option>
                                        <option value="04">04 - Operación nominativa relacionada en una factura global</option>
                                    </select>
                                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                                        {motivo === '01' && (
                                            <span className="text-indigo-700 font-medium">
                                                📌 <strong>Regla SAT 01:</strong> Primero se debe emitir la nueva factura relacionando la original (Tipo de Relación 04 - Sustitución), y posteriormente cancelar la original ingresando aquí el folio fiscal (UUID) de la nueva.
                                            </span>
                                        )}
                                        {motivo === '02' && (
                                            <span>
                                                📌 <strong>Regla SAT 02:</strong> Aplica cuando la factura se emitió con error y no requiere sustituirse de inmediato, o se emitirá posteriormente sin relación previa.
                                            </span>
                                        )}
                                        {motivo === '03' && (
                                            <span>
                                                📌 <strong>Regla SAT 03:</strong> Aplica cuando la venta o servicio fue cancelado en su totalidad y nunca se llevó a cabo la transacción económica.
                                            </span>
                                        )}
                                        {motivo === '04' && (
                                            <span>
                                                📌 <strong>Regla SAT 04:</strong> Aplica cuando una venta del público en general incluida en la Factura Global del mes es solicitada de manera individual por un cliente.
                                            </span>
                                        )}
                                    </p>
                                </div>

                                {/* Campo UUID Sustitución si el motivo es 01 */}
                                {motivo === '01' && (
                                    <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5 space-y-2.5 animate-in fade-in">
                                        <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wide">
                                            UUID del Comprobante Sustituto <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={uuidSustitucion}
                                            onChange={(e) => setUuidSustitucion(e.target.value.trim())}
                                            placeholder="Ej: 12345678-ABCD-EF01-2345-6789ABCDEF01"
                                            disabled={isCancelling || !puedeCancelar}
                                            className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-xs font-mono text-slate-800 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none uppercase placeholder:text-slate-400 disabled:bg-slate-100"
                                        />

                                        {/* Comprobantes sustitutos candidatos detectados */}
                                        {diagnostico?.candidatosSustitucion && diagnostico.candidatosSustitucion.length > 0 && (
                                            <div className="space-y-1 pt-1">
                                                <span className="text-[10px] font-bold text-indigo-800 uppercase block">
                                                    Comprobantes recientes sugeridos para este cliente:
                                                </span>
                                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                                    {diagnostico.candidatosSustitucion.map((cand) => (
                                                        <button
                                                            key={cand.id}
                                                            type="button"
                                                            onClick={() => setUuidSustitucion(cand.uuid)}
                                                            className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                                                                uuidSustitucion.toLowerCase() === cand.uuid?.toLowerCase()
                                                                    ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                                                                    : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                                                            }`}
                                                            title={`Folio ${cand.serie || ''}${cand.folio || cand.id} • $${cand.total} • ${cand.uuid}`}
                                                        >
                                                            {cand.serie || 'A'}-{cand.folio || cand.id} ({cand.uuid.substring(0, 8)}...)
                                                            {cand.apunta_como_sustituto && ' ★'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </form>
                        </>
                    )}
                </div>

                {/* Footer Buttons */}
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
                        onClick={handleConfirmarCancelacion}
                        disabled={isCancelling || !puedeCancelar || isLoadingPre}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${
                            !puedeCancelar || isLoadingPre
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/20'
                        } disabled:opacity-50`}
                    >
                        {isCancelling ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Cancelando en el SAT...</span>
                            </>
                        ) : (
                            <>
                                <Ban className="w-4 h-4" />
                                <span>Confirmar Cancelación ante el SAT</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

