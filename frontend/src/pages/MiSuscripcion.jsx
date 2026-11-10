import React, { useState, useEffect } from 'react';
import { 
    Sparkles, ShieldCheck, CreditCard, Building2, Copy, Check, 
    Upload, FileText, ArrowRight, ExternalLink, AlertTriangle, 
    CheckCircle2, Clock, XCircle, RefreshCw, Calendar, Zap, 
    Download, Info
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const MiSuscripcion = () => {
    const { user, activeEmpresa } = useAuth();
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [subData, setSubData] = useState(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    
    // Configuración del pago seleccionado
    const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mensual'); // 'mensual' | 'anual'
    const [metodoSeleccionado, setMetodoSeleccionado] = useState('banorte'); // 'banorte' | 'mercadopago'
    
    // Formulario de transferencia Banorte
    const [comprobanteFile, setComprobanteFile] = useState(null);
    const [referenciaRastreo, setReferenciaRastreo] = useState('');
    const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

    // Estado Mercado Pago
    const [isProcessingMP, setIsProcessingMP] = useState(false);
    const [mpSimulationInfo, setMpSimulationInfo] = useState(null);

    // Control de copiado al portapapeles
    const [copiedField, setCopiedField] = useState(null);

    const fetchSuscripcion = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/planes/mi-suscripcion');
            setSubData(data);
            if (data.empresa?.periodo_suscripcion) {
                setPeriodoSeleccionado(data.empresa.periodo_suscripcion);
            }
        } catch (error) {
            console.error('Error al cargar mi suscripción:', error);
            addToast('Error al cargar los datos de la suscripción.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuscripcion();
    }, [activeEmpresa]);

    const handleCopy = (text, fieldName) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        addToast(`Copiado: ${text}`, 'info');
        setTimeout(() => setCopiedField(null), 2500);
    };

    // Calcular monto según período
    const calcularMontoPagar = () => {
        if (!subData) return 0;
        const { empresa, plan } = subData;
        if (empresa.es_personalizado) {
            const precioBase = parseFloat(empresa.precio_personalizado);
            return periodoSeleccionado === 'anual' ? Math.round(precioBase * 10) : precioBase;
        }
        if (plan) {
            return periodoSeleccionado === 'anual' ? parseFloat(plan.precio_anual) : parseFloat(plan.precio_mensual);
        }
        return periodoSeleccionado === 'anual' ? 3490 : 349;
    };

    const handleReportarTransferencia = async (e) => {
        e.preventDefault();
        if (!comprobanteFile) {
            addToast('Por favor adjunta el comprobante de la transferencia.', 'warning');
            return;
        }

        try {
            setIsSubmittingTransfer(true);
            const formData = new FormData();
            formData.append('comprobante', comprobanteFile);
            formData.append('plan_codigo', subData?.empresa?.plan_codigo || 'negocio');
            formData.append('periodo', periodoSeleccionado);
            formData.append('monto', calcularMontoPagar());
            formData.append('referencia_pago', referenciaRastreo || subData?.datos_bancarios?.referencia_sugerida);

            const { data } = await api.post('/planes/reportar-transferencia', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            addToast(data.message || 'Comprobante recibido exitosamente.', 'success');
            setComprobanteFile(null);
            setReferenciaRastreo('');
            setIsPaymentModalOpen(false);
            fetchSuscripcion();
        } catch (error) {
            console.error('Error al reportar transferencia:', error);
            addToast(error.response?.data?.message || 'Error al enviar comprobante.', 'error');
        } finally {
            setIsSubmittingTransfer(false);
        }
    };

    const handlePagarMercadoPago = async () => {
        try {
            setIsProcessingMP(true);
            const { data } = await api.post('/planes/crear-preferencia-mp', {
                periodo: periodoSeleccionado,
                plan_codigo: subData?.empresa?.plan_codigo || 'negocio'
            });

            if (data.modo_simulacion) {
                setMpSimulationInfo(data);
                addToast('Integración Mercado Pago lista. Consulta los detalles en pantalla.', 'info');
            } else if (data.init_point) {
                // Redirigir a checkout oficial de Mercado Pago
                window.location.href = data.init_point;
            }
        } catch (error) {
            console.error('Error creando preferencia MP:', error);
            addToast(error.response?.data?.message || 'Error al iniciar pago con Mercado Pago.', 'error');
        } finally {
            setIsProcessingMP(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
                <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mb-3" />
                <p className="text-sm font-medium">Cargando información de suscripción...</p>
            </div>
        );
    }

    const { empresa, plan, datos_bancarios, historial_pagos } = subData || {};
    const diasRestantes = empresa?.dias_restantes;
    const estado = empresa?.estado_suscripcion || 'activa';
    const montoPagar = calcularMontoPagar();

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-16">
            {/* Banner de Estado de Suscripción */}
            {diasRestantes !== null && (
                <div>
                    {diasRestantes <= 0 ? (
                        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl flex items-start justify-between shadow-xs">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-bold text-rose-800">
                                        {estado === 'periodo_gracia' ? 'Suscripción en Período de Gracia' : 'Suscripción Vencida'}
                                    </h3>
                                    <p className="text-xs text-rose-700 mt-1">
                                        Tu período de servicio concluyó {Math.abs(diasRestantes)} días atrás. Realiza tu renovación para mantener activos los folios de timbrado y servicios fiscales.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm shrink-0 transition"
                            >
                                Renovar Ahora
                            </button>
                        </div>
                    ) : diasRestantes <= 5 ? (
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex items-start justify-between shadow-xs">
                            <div className="flex items-start gap-3">
                                <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-bold text-amber-800">
                                        Tu suscripción vence en {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}
                                    </h3>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Evita interrupciones en la emisión de tus comprobantes CFDI 4.0 renovando tu plan con anticipación.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm shrink-0 transition"
                            >
                                Pagar Renovación
                            </button>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Header Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                            Espacio: {empresa?.nombre}
                        </span>
                        {empresa?.es_personalizado && (
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-200">
                                <Sparkles className="w-3 h-3" /> Tarifa Preferencial Asignada
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        Mi Suscripción y Estado de Cuenta
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Administra la vigencia de tu plan, folios asignados y métodos de pago disponibles.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
                    >
                        <CreditCard className="w-4 h-4" />
                        <span>Pagar / Renovar Plan</span>
                    </button>
                </div>
            </div>

            {/* Tarjetas de Resumen de Plan y Vigencia */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tarjeta Plan Actual */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Sparkles className="w-5 h-5" />
                            </span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                estado === 'activa' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                estado === 'periodo_gracia' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                                {estado === 'activa' ? 'Suscripción Activa' : estado === 'periodo_gracia' ? 'En Gracia' : 'Vencida'}
                            </span>
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Plan Asignado</h3>
                        <p className="text-xl font-black text-slate-900 mt-1">{plan?.nombre || 'Plan PyME'}</p>
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{plan?.descripcion}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                            <span className="text-xs text-slate-400 block font-medium">Tarifa del servicio</span>
                            <span className="text-2xl font-black text-slate-900">
                                ${Number(empresa?.precio_actual || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs font-bold text-slate-500 ml-1">
                                MXN / {empresa?.periodo_suscripcion === 'anual' ? 'año' : 'mes'}
                            </span>
                        </div>
                        {empresa?.es_personalizado && (
                            <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
                                Tarifa Especial
                            </span>
                        )}
                    </div>
                </div>

                {/* Tarjeta Vigencia y Días */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                                <Calendar className="w-5 h-5" />
                            </span>
                            <span className="text-xs text-slate-400 font-medium">Ciclo de facturación</span>
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Fecha de Vencimiento</h3>
                        <p className="text-xl font-black text-slate-900 mt-1">
                            {empresa?.fecha_vencimiento 
                                ? new Date(empresa.fecha_vencimiento).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
                                : 'Sin fecha registrada'}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                            {diasRestantes !== null 
                                ? diasRestantes > 0 
                                    ? `Te restan ${diasRestantes} días de cobertura activa.` 
                                    : `Venció hace ${Math.abs(diasRestantes)} días.`
                                : 'Vigencia permanente o ilimitada.'}
                        </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Estado de renovación:</span>
                        <span className={`text-xs font-bold ${diasRestantes <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {diasRestantes > 5 ? 'Al corriente' : diasRestantes > 0 ? 'Por vencer' : 'Requiere pago'}
                        </span>
                    </div>
                </div>

                {/* Tarjeta Folios y Módulos */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                <Zap className="w-5 h-5" />
                            </span>
                            <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                Timbrado Fiscal
                            </span>
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Folios CFDI Incluidos</h3>
                        <p className="text-xl font-black text-slate-900 mt-1">
                            {empresa?.folios_incluidos || plan?.folios_mensuales || 200} folios
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                            Disponibles para timbrado de Facturas 4.0, Notas de Crédito, Recibos de Pago REP y Nómina.
                        </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Emisores permitidos:</span>
                        <span className="font-bold text-slate-800">{plan?.max_emisores || 1} RFC(s)</span>
                    </div>
                </div>
            </div>

            {/* Módulos Habilitados en este Plan */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Características y Módulos de tu Suscripción
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${plan?.permite_cotizaciones ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                        {plan?.permite_cotizaciones ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="text-xs font-semibold">Cotizaciones</span>
                    </div>
                    <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${plan?.permite_ordenes_servicio ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                        {plan?.permite_ordenes_servicio ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="text-xs font-semibold">Órdenes de Servicio</span>
                    </div>
                    <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${plan?.permite_carta_porte ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                        {plan?.permite_carta_porte ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="text-xs font-semibold">Carta Porte 3.1</span>
                    </div>
                    <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${plan?.permite_recurrentes ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                        {plan?.permite_recurrentes ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="text-xs font-semibold">Facturación Recurrente</span>
                    </div>
                    <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${plan?.permite_descarga_sat ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                        {plan?.permite_descarga_sat ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="text-xs font-semibold">Descarga SAT</span>
                    </div>
                </div>
            </div>

            {/* Historial de Pagos de la Empresa */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Historial de Pagos y Comprobantes</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Registro de transacciones de renovación y comprobantes subidos</p>
                    </div>
                    <button
                        onClick={fetchSuscripcion}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        title="Actualizar historial"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {historial_pagos?.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">Aún no hay registros de pagos en este espacio.</p>
                        <p className="text-xs mt-1">Al pagar en línea o subir una transferencia Banorte aparecerán aquí.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">Fecha</th>
                                    <th className="py-3 px-4">Método</th>
                                    <th className="py-3 px-4">Período</th>
                                    <th className="py-3 px-4">Monto</th>
                                    <th className="py-3 px-4">Referencia</th>
                                    <th className="py-3 px-4">Estado</th>
                                    <th className="py-3 px-4 text-right">Comprobante</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {historial_pagos.map((pago) => (
                                    <tr key={pago.id} className="hover:bg-slate-50/60 transition">
                                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                            {new Date(pago.createdAt || pago.fecha_pago).toLocaleDateString('es-MX', {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                                            {pago.metodo_pago === 'transferencia_banorte' ? (
                                                <span className="flex items-center gap-1.5 text-red-700">
                                                    <Building2 className="w-3.5 h-3.5" /> Transferencia Banorte
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-sky-700">
                                                    <CreditCard className="w-3.5 h-3.5" /> Mercado Pago
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 capitalize text-slate-700 font-medium">
                                            {pago.periodo}
                                        </td>
                                        <td className="py-3 px-4 font-bold text-slate-900">
                                            ${Number(pago.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                                        </td>
                                        <td className="py-3 px-4 font-mono text-slate-500">
                                            {pago.referencia_pago || '-'}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            {pago.estado === 'aprobado' ? (
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Aprobado
                                                </span>
                                            ) : pago.estado === 'pendiente' ? (
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                    En Validación
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title={pago.notas_admin}>
                                                    Rechazado
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                            {pago.comprobante_url ? (
                                                <a
                                                    href={pago.comprobante_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                                                >
                                                    <FileText className="w-3.5 h-3.5" /> Ver Archivo
                                                </a>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL DE CHECKOUT Y PAGO */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header del Modal */}
                        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Checkout de Renovación</span>
                                <h3 className="text-lg font-black mt-0.5">Pagar Suscripción - {empresa?.nombre}</h3>
                            </div>
                            <button
                                onClick={() => {
                                    setIsPaymentModalOpen(false);
                                    setMpSimulationInfo(null);
                                }}
                                className="p-2 text-slate-400 hover:text-white rounded-lg transition"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Contenido del Modal */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Paso 1: Elegir Período */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                                    1. Selecciona la Vigencia de Renovación
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div
                                        onClick={() => setPeriodoSeleccionado('mensual')}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                                            periodoSeleccionado === 'mensual'
                                                ? 'border-indigo-600 bg-indigo-50/40 text-slate-900'
                                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase">Mensual (30 días)</span>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${periodoSeleccionado === 'mensual' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                                                {periodoSeleccionado === 'mensual' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <span className="text-xl font-black">
                                                ${Number(empresa?.precio_mensual || 349).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-xs text-slate-500 font-semibold ml-1">MXN / mes</span>
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => setPeriodoSeleccionado('anual')}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between relative overflow-hidden ${
                                            periodoSeleccionado === 'anual'
                                                ? 'border-indigo-600 bg-indigo-50/40 text-slate-900'
                                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                                        }`}
                                    >
                                        <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                                            Ahorra 2 Meses
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase">Anual (365 días)</span>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${periodoSeleccionado === 'anual' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                                                {periodoSeleccionado === 'anual' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <span className="text-xl font-black text-emerald-700">
                                                ${Number(empresa?.precio_anual || 3490).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-xs text-slate-500 font-semibold ml-1">MXN / año</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen Total */}
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-slate-500 font-medium">Total a pagar:</span>
                                    <p className="text-xs font-bold text-slate-700">
                                        Plan {plan?.nombre} ({periodoSeleccionado.toUpperCase()})
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-indigo-700">
                                        ${montoPagar.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 ml-1">MXN</span>
                                </div>
                            </div>

                            {/* Paso 2: Selección de Método de Pago */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                                    2. Selecciona la Forma de Pago
                                </label>
                                <div className="flex rounded-xl bg-slate-100 p-1 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setMetodoSeleccionado('banorte')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                                            metodoSeleccionado === 'banorte'
                                                ? 'bg-white text-slate-900 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <Building2 className="w-4 h-4 text-red-600" />
                                        <span>Transferencia BANORTE / SPEI</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMetodoSeleccionado('mercadopago')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                                            metodoSeleccionado === 'mercadopago'
                                                ? 'bg-white text-slate-900 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <CreditCard className="w-4 h-4 text-sky-600" />
                                        <span>Mercado Pago (Tarjetas, OXXO, SPEI)</span>
                                    </button>
                                </div>

                                {/* Pestaña BANORTE */}
                                {metodoSeleccionado === 'banorte' && (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-red-50/50 border border-red-200 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between border-b border-red-100 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-red-800 text-sm tracking-wide">BANORTE</span>
                                                    <span className="text-[10px] bg-red-200 text-red-900 font-bold px-1.5 py-0.5 rounded">SPEI</span>
                                                </div>
                                                <span className="text-xs text-red-700 font-medium">Net Consultores</span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <span className="text-slate-500 block text-[11px]">Beneficiario:</span>
                                                    <div className="flex items-center justify-between font-bold text-slate-800 bg-white p-2 rounded-lg border border-red-100 mt-0.5">
                                                        <span>{datos_bancarios?.beneficiario}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleCopy(datos_bancarios?.beneficiario, 'beneficiario')}
                                                            className="text-slate-400 hover:text-slate-700"
                                                        >
                                                            {copiedField === 'beneficiario' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <span className="text-slate-500 block text-[11px]">CLABE Interbancaria (18 dígitos):</span>
                                                    <div className="flex items-center justify-between font-mono font-bold text-slate-800 bg-white p-2 rounded-lg border border-red-100 mt-0.5">
                                                        <span>{datos_bancarios?.clabe}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleCopy(datos_bancarios?.clabe, 'clabe')}
                                                            className="text-slate-400 hover:text-slate-700"
                                                        >
                                                            {copiedField === 'clabe' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <span className="text-slate-500 block text-[11px]">Concepto o Referencia:</span>
                                                    <div className="flex items-center justify-between font-mono font-bold text-slate-800 bg-white p-2 rounded-lg border border-red-100 mt-0.5">
                                                        <span className="text-indigo-700">{datos_bancarios?.referencia_sugerida}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleCopy(datos_bancarios?.referencia_sugerida, 'referencia')}
                                                            className="text-slate-400 hover:text-slate-700"
                                                        >
                                                            {copiedField === 'referencia' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <span className="text-slate-500 block text-[11px]">Importe Exacto:</span>
                                                    <div className="flex items-center justify-between font-bold text-emerald-700 bg-white p-2 rounded-lg border border-red-100 mt-0.5">
                                                        <span>${montoPagar.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleCopy(montoPagar.toString(), 'monto')}
                                                            className="text-slate-400 hover:text-slate-700"
                                                        >
                                                            {copiedField === 'monto' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Formulario para Subir Comprobante */}
                                        <form onSubmit={handleReportarTransferencia} className="space-y-4 pt-2">
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                                    Adjuntar Comprobante de Transferencia (PDF, JPG, PNG) *
                                                </label>
                                                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 transition relative">
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp,application/pdf"
                                                        onChange={(e) => setComprobanteFile(e.target.files[0])}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        required
                                                    />
                                                    <div className="flex flex-col items-center justify-center">
                                                        <Upload className="w-6 h-6 text-indigo-600 mb-1" />
                                                        {comprobanteFile ? (
                                                            <p className="text-xs font-bold text-indigo-700">
                                                                Archivo seleccionado: {comprobanteFile.name}
                                                            </p>
                                                        ) : (
                                                            <>
                                                                <p className="text-xs font-medium text-slate-600">
                                                                    Haz clic o arrastra tu comprobante aquí
                                                                </p>
                                                                <span className="text-[10px] text-slate-400">PDF, PNG o JPG (Máx. 10MB)</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                                    Clave de Rastreo o Folio SPEI (Opcional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={referenciaRastreo}
                                                    onChange={(e) => setReferenciaRastreo(e.target.value)}
                                                    placeholder="Ej: 202611090123456789"
                                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-indigo-500 font-mono"
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isSubmittingTransfer || !comprobanteFile}
                                                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                                            >
                                                {isSubmittingTransfer ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Upload className="w-4 h-4" />
                                                )}
                                                <span>Enviar Comprobante de Transferencia</span>
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {/* Pestaña MERCADO PAGO */}
                                {metodoSeleccionado === 'mercadopago' && (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="w-5 h-5 text-sky-600" />
                                                <h4 className="text-sm font-bold text-sky-900">Pago en Línea Seguro con Mercado Pago</h4>
                                            </div>
                                            <p className="text-xs text-sky-800 leading-relaxed">
                                                Acreditación automática e inmediata de tu suscripción. Acepta todas las tarjetas de débito/crédito mexicanas, transferencia SPEI sin espera y depósitos en OXXO Pay.
                                            </p>
                                        </div>

                                        {mpSimulationInfo ? (
                                            <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-2 text-xs">
                                                <div className="flex items-center gap-2 font-bold text-slate-800">
                                                    <Info className="w-4 h-4 text-indigo-600" />
                                                    <span>{mpSimulationInfo.message}</span>
                                                </div>
                                                <p className="text-slate-600">
                                                    Referencia generada: <span className="font-mono font-bold">{mpSimulationInfo.referencia}</span>
                                                </p>
                                                <p className="text-slate-600">
                                                    Monto a liquidar: <span className="font-bold">${mpSimulationInfo.monto} MXN</span>
                                                </p>
                                                <div className="pt-2 text-[11px] text-slate-500">
                                                    Para activar el cobro real por tarjeta, solo agrega tu <code className="bg-white px-1 py-0.5 rounded border border-slate-300 text-indigo-600">MERCADOPAGO_ACCESS_TOKEN</code> en el archivo <code>.env</code> de tu servidor.
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handlePagarMercadoPago}
                                                disabled={isProcessingMP}
                                                className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
                                            >
                                                {isProcessingMP ? (
                                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <CreditCard className="w-5 h-5" />
                                                )}
                                                <span>Pagar ${montoPagar.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN con Mercado Pago</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPaymentModalOpen(false);
                                    setMpSimulationInfo(null);
                                }}
                                className="px-5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-lg transition"
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
