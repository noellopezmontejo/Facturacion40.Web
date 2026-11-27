import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, CheckCircle2, Circle, AlertTriangle, ArrowRight,
    Volume2, ChevronDown, ChevronUp, RotateCcw, ExternalLink, Check
} from 'lucide-react';
import { HELP_CATEGORIES, HELP_GUIDES, HELP_FAQS } from '../data/helpGuides';
import { HelpDemoPlayer } from '../components/help/HelpDemoPlayer';

const STORAGE_KEY = 'facturacion40_help_progress_v1';

export const CentroAyuda = () => {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('guias'); // 'guias' | 'consultas' | 'errores' | 'faq'
    const [selectedCategory, setSelectedCategory] = useState('todos');
    const [search, setSearch] = useState('');
    const [selectedGuideId, setSelectedGuideId] = useState(HELP_GUIDES[1]?.id || HELP_GUIDES[0].id);
    const [showVideo, setShowVideo] = useState(false);
    const [openFaqId, setOpenFaqId] = useState(HELP_FAQS[0]?.id || null);

    const [completedSteps, setCompletedSteps] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(completedSteps));
        } catch {
            // ignore
        }
    }, [completedSteps]);

    // Consulta 1: PUE vs PPD
    const [simPagoMomento, setSimPagoMomento] = useState('hoy');
    const [simMedioPago, setSimMedioPago] = useState('03');

    // Consulta 2: Motivo de Cancelación SAT
    const [simCancelCase, setSimCancelCase] = useState('error_corregir');

    // Consulta 3: Verificador de datos Receptor 4.0
    const [valRfc, setValRfc] = useState('');
    const [valNombre, setValNombre] = useState('');
    const [valCp, setValCp] = useState('');

    const toggleStep = (guideId, idx) => {
        const key = `${guideId}-${idx}`;
        setCompletedSteps(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const resetGuideProgress = (guideId) => {
        setCompletedSteps(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => {
                if (k.startsWith(`${guideId}-`)) delete next[k];
            });
            return next;
        });
    };

    const filteredGuides = useMemo(() => {
        const q = search.trim().toLowerCase();
        return HELP_GUIDES.filter(g => {
            const matchCat = selectedCategory === 'todos' || g.category === selectedCategory;
            if (!matchCat) return false;
            if (!q) return true;
            return (
                g.title.toLowerCase().includes(q) ||
                g.module.toLowerCase().includes(q) ||
                g.summary.toLowerCase().includes(q) ||
                g.steps.some(s => s.title.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q)) ||
                (g.commonErrors && g.commonErrors.some(e =>
                    e.code.toLowerCase().includes(q) ||
                    e.cause.toLowerCase().includes(q) ||
                    e.solution.toLowerCase().includes(q)
                ))
            );
        });
    }, [selectedCategory, search]);

    const activeGuide = useMemo(() => {
        return (
            filteredGuides.find(g => g.id === selectedGuideId) ||
            filteredGuides[0] ||
            HELP_GUIDES.find(g => g.id === selectedGuideId) ||
            HELP_GUIDES[0]
        );
    }, [filteredGuides, selectedGuideId]);

    const allErrors = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = [];
        HELP_GUIDES.forEach(g => {
            (g.commonErrors || []).forEach(err => {
                list.push({
                    ...err,
                    module: g.module,
                    guideId: g.id,
                    primaryRoute: g.primaryRoute
                });
            });
        });
        if (!q) return list;
        return list.filter(e =>
            e.code.toLowerCase().includes(q) ||
            e.cause.toLowerCase().includes(q) ||
            e.solution.toLowerCase().includes(q) ||
            e.module.toLowerCase().includes(q)
        );
    }, [search]);

    const filteredFaqs = useMemo(() => {
        const q = search.trim().toLowerCase();
        return HELP_FAQS.filter(f => {
            const matchCat = selectedCategory === 'todos' || f.category === selectedCategory;
            if (!matchCat) return false;
            if (!q) return true;
            return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
        });
    }, [selectedCategory, search]);

    const receptorChecks = useMemo(() => {
        const rfcClean = valRfc.trim().toUpperCase();
        const nombreClean = valNombre.trim();
        const cpClean = valCp.trim();

        const hasSocietario = /\b(S\.?A\.?\s*DE\s*C\.?V\.?|S\.?\s*DE\s*R\.?L\.?|S\.?C\.?|S\.?A\.?P\.?I\.?|A\.?C\.?)\b/i.test(nombreClean);
        const rfcValid = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfcClean);
        const cpValid = /^\d{5}$/.test(cpClean);

        return {
            rfcClean,
            rfcValid,
            isMoral: rfcValid && rfcClean.length === 12,
            isFisica: rfcValid && rfcClean.length === 13,
            isGeneric: rfcClean === 'XAXX010101000' || rfcClean === 'XEXX010101000',
            hasSocietario,
            cpValid,
            nombreCleanResult: nombreClean
                .toUpperCase()
                .replace(/,?\s*\b(S\.?A\.?\s*DE\s*C\.?V\.?|S\.?\s*DE\s*R\.?L\.?(\s*DE\s*C\.?V\.?)?|S\.?A\.?P\.?I\.?(\s*DE\s*C\.?V\.?)?|S\.?C\.?|A\.?C\.?)\.?$/i, '')
                .trim()
        };
    }, [valRfc, valNombre, valCp]);

    return (
        <div className="space-y-6 pb-10">
            {/* Encabezado sobrio alineado con el resto del sistema */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Manual de Operación y Criterios SAT (CFDI 4.0)
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Documentación práctica por módulo, consultas rápidas de facturación y catálogo de rechazos de timbrado.
                        </p>
                    </div>

                    {/* Buscador directo */}
                    <div className="relative w-full md:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar procedimiento o código SAT..."
                            className="w-full pl-9 pr-14 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-primary-600"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {/* Pestañas sobrias con borde inferior */}
                <div className="mt-6 border-b border-slate-200 flex flex-wrap gap-6">
                    {[
                        { id: 'guias', label: 'Procedimientos por Módulo' },
                        { id: 'consultas', label: 'Consultas Rápidas SAT (PUE/PPD y Cancelación)' },
                        { id: 'errores', label: `Catálogo de Errores de Timbrado (${allErrors.length})` },
                        { id: 'faq', label: `Preguntas Frecuentes (${HELP_FAQS.length})` }
                    ].map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 text-xs font-bold border-b-2 transition-colors ${
                                    active
                                        ? 'border-primary-600 text-primary-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filtro de áreas */}
            {(activeTab === 'guias' || activeTab === 'faq') && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {HELP_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition shrink-0 ${
                                selectedCategory === cat.id
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            )}

            {/* SECCIÓN 1: PROCEDIMIENTOS POR MÓDULO */}
            {activeTab === 'guias' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Índice lateral de módulos */}
                    <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Índice de Módulos ({filteredGuides.length})
                            </span>
                        </div>

                        {filteredGuides.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-500">
                                Sin resultados para "{search}".
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredGuides.map(g => {
                                    const isSelected = activeGuide?.id === g.id;
                                    const guideDoneCount = g.steps.filter((_, idx) => completedSteps[`${g.id}-${idx}`]).length;

                                    return (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedGuideId(g.id);
                                                setShowVideo(false);
                                            }}
                                            className={`w-full text-left px-4 py-3.5 transition flex items-start justify-between gap-3 ${
                                                isSelected
                                                    ? 'bg-slate-100 border-l-4 border-primary-600'
                                                    : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[11px] font-bold text-slate-500 block">
                                                    {g.module}
                                                </span>
                                                <p className={`text-xs font-bold mt-0.5 line-clamp-1 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                                                    {g.title}
                                                </p>
                                            </div>
                                            {guideDoneCount > 0 && (
                                                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold shrink-0">
                                                    {guideDoneCount}/{g.steps.length}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Contenido del procedimiento seleccionado */}
                    {activeGuide && (
                        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                            {/* Cabecera del documento */}
                            <div className="p-6 border-b border-slate-200 bg-slate-50/60">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Módulo: {activeGuide.module} · Tiempo estimado: {activeGuide.duration}
                                    </span>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowVideo(v => !v)}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                                                showVideo
                                                    ? 'bg-slate-200 border-slate-300 text-slate-900'
                                                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            <Volume2 className="w-3.5 h-3.5 text-slate-700" />
                                            <span>{showVideo ? 'Cerrar guía con audio' : 'Escuchar guía paso a paso'}</span>
                                        </button>

                                        {activeGuide.primaryRoute && (
                                            <button
                                                type="button"
                                                onClick={() => navigate(activeGuide.primaryRoute)}
                                                className="px-3.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                                            >
                                                <span>{activeGuide.actionLabel || 'Abrir pantalla'}</span>
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <h2 className="text-lg font-bold text-slate-900 mt-2">
                                    {activeGuide.title}
                                </h2>
                                <p className="text-xs md:text-sm text-slate-600 mt-1 leading-relaxed">
                                    {activeGuide.summary}
                                </p>

                                {showVideo && (
                                    <div className="mt-4">
                                        <HelpDemoPlayer guide={activeGuide} />
                                    </div>
                                )}
                            </div>

                            {/* Cuerpo del procedimiento */}
                            <div className="p-6 space-y-6">
                                {/* Pasos */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                            Procedimiento de operación
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => resetGuideProgress(activeGuide.id)}
                                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            <span>Desmarcar pasos</span>
                                        </button>
                                    </div>

                                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                                        {activeGuide.steps.map((step, idx) => {
                                            const done = !!completedSteps[`${activeGuide.id}-${idx}`];
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => toggleStep(activeGuide.id, idx)}
                                                    className={`p-4 cursor-pointer transition flex items-start gap-3.5 ${
                                                        done
                                                            ? 'bg-slate-50/90'
                                                            : 'bg-white hover:bg-slate-50/50'
                                                    }`}
                                                >
                                                    <div className="mt-0.5 shrink-0">
                                                        {done ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                        ) : (
                                                            <Circle className="w-4 h-4 text-slate-300" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-bold ${done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                                            {step.title}
                                                        </p>
                                                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                                            {step.detail}
                                                        </p>
                                                        {step.tip && (
                                                            <div className="mt-2.5 text-xs text-slate-700 bg-amber-50/70 border-l-2 border-amber-500 pl-3 py-1.5">
                                                                <strong>Criterio fiscal:</strong> {step.tip}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Tabla de referencia rápida */}
                                {activeGuide.example && (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200">
                                            <span className="text-xs font-bold text-slate-800">
                                                Referencia rápida: {activeGuide.example.title}
                                            </span>
                                        </div>
                                        <div className="divide-y divide-slate-200 bg-white">
                                            {activeGuide.example.items.map((item, idx) => (
                                                <div key={idx} className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                                    <span className="font-bold text-slate-800">{item.label}</span>
                                                    <span className="md:col-span-2 text-slate-600">{item.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Rechazos o incidencias frecuentes en este módulo */}
                                {activeGuide.commonErrors && activeGuide.commonErrors.length > 0 && (
                                    <div className="space-y-2.5 pt-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                            Motivos de rechazo frecuentes en este módulo
                                        </h3>
                                        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                                            {activeGuide.commonErrors.map((err, i) => (
                                                <div key={i} className="p-4 bg-white space-y-1 text-xs">
                                                    <p className="font-bold text-rose-800">{err.code}</p>
                                                    <p className="text-slate-600">
                                                        <strong>Causa:</strong> {err.cause}
                                                    </p>
                                                    <p className="text-slate-800 pt-1">
                                                        <strong>Solución:</strong> {err.solution}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* SECCIÓN 2: CONSULTAS RÁPIDAS DE CRITERIOS SAT */}
            {activeTab === 'consultas' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* HERRAMIENTA 1: PUE vs PPD */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-5">
                        <div className="space-y-4">
                            <div className="border-b border-slate-200 pb-3">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">Consulta 1</span>
                                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                                    Criterio de Método y Forma de Pago (PUE / PPD)
                                </h3>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-700">
                                    1. Condición de cobro de la operación:
                                </label>
                                <div className="space-y-1.5">
                                    {[
                                        { id: 'hoy', label: 'Contado (ya cobrado o se cobra antes de fin de mes)' },
                                        { id: 'credito', label: 'Crédito (se cobrará posteriormente)' },
                                        { id: 'parcialidades', label: 'En parcialidades o varios abonos' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setSimPagoMomento(opt.id)}
                                            className={`w-full text-left px-3 py-2 rounded border text-xs transition flex items-center justify-between ${
                                                simPagoMomento === opt.id
                                                    ? 'bg-slate-100 border-slate-400 text-slate-900 font-bold'
                                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{opt.label}</span>
                                            {simPagoMomento === opt.id && <Check className="w-3.5 h-3.5 text-slate-800 shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {simPagoMomento === 'hoy' && (
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700">
                                        2. Medio con el que se recibió el pago:
                                    </label>
                                    <select
                                        value={simMedioPago}
                                        onChange={(e) => setSimMedioPago(e.target.value)}
                                        className="w-full px-3 py-2 rounded border border-slate-300 text-xs font-medium text-slate-800 bg-white"
                                    >
                                        <option value="03">03 - Transferencia electrónica de fondos</option>
                                        <option value="01">01 - Efectivo</option>
                                        <option value="04">04 - Tarjeta de crédito</option>
                                        <option value="28">28 - Tarjeta de débito</option>
                                        <option value="02">02 - Cheque nominativo</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                            <span className="text-[11px] font-bold uppercase text-slate-500">
                                Claves SAT que debes capturar:
                            </span>
                            {simPagoMomento === 'hoy' ? (
                                <>
                                    <p className="text-xs text-slate-800">
                                        <strong>Método de Pago:</strong> PUE (Pago en una sola exhibición)
                                    </p>
                                    <p className="text-xs text-slate-800">
                                        <strong>Forma de Pago:</strong> Clave {simMedioPago}
                                    </p>
                                    <p className="text-[11px] text-slate-600 pt-1">
                                        No requiere emitir Complemento de Pago (REP).
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-slate-800">
                                        <strong>Método de Pago:</strong> PPD (Pago en parcialidades o diferido)
                                    </p>
                                    <p className="text-xs text-slate-800">
                                        <strong>Forma de Pago:</strong> 99 - Por definir
                                    </p>
                                    <p className="text-[11px] text-slate-600 pt-1">
                                        Al recibir cada abono es obligatorio timbrar un Complemento de Pago (REP 2.0) en Cuentas por Cobrar.
                                    </p>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => navigate('/facturas/nueva')}
                                className="mt-2 w-full py-2 px-3 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                            >
                                <span>Ir a Generar Factura</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* HERRAMIENTA 2: Motivo de cancelación */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-5">
                        <div className="space-y-4">
                            <div className="border-b border-slate-200 pb-3">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">Consulta 2</span>
                                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                                    Selección de Motivo de Cancelación SAT
                                </h3>
                            </div>

                            <div className="space-y-1.5">
                                {[
                                    {
                                        id: 'error_corregir',
                                        label: 'El CFDI tiene errores y deseo cancelarlo antes de emitir el nuevo'
                                    },
                                    {
                                        id: 'error_ya_emitida',
                                        label: 'Ya emití primero la factura nueva que sustituye a la errónea'
                                    },
                                    {
                                        id: 'no_se_hizo',
                                        label: 'La operación comercial se canceló y no se llevará a cabo'
                                    },
                                    {
                                        id: 'global_nominativa',
                                        label: 'Reexpedición de venta incluida en una Factura Global'
                                    }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setSimCancelCase(opt.id)}
                                        className={`w-full text-left px-3 py-2 rounded border text-xs transition flex items-center justify-between gap-2 ${
                                            simCancelCase === opt.id
                                                ? 'bg-slate-100 border-slate-400 text-slate-900 font-bold'
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span>{opt.label}</span>
                                        {simCancelCase === opt.id && <Check className="w-3.5 h-3.5 text-slate-800 shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                            <span className="text-[11px] font-bold uppercase text-slate-500">
                                Clave de cancelación aplicable:
                            </span>
                            {simCancelCase === 'error_corregir' && (
                                <>
                                    <p className="text-xs font-bold text-slate-900">
                                        Clave 02 - Comprobante emitido con errores sin relación
                                    </p>
                                    <p className="text-[11px] text-slate-600">
                                        Cancela directamente con clave 02 (no solicita UUID sustituto). Posteriormente emite la factura correcta.
                                    </p>
                                </>
                            )}
                            {simCancelCase === 'error_ya_emitida' && (
                                <>
                                    <p className="text-xs font-bold text-slate-900">
                                        Clave 01 - Comprobante emitido con errores con relación
                                    </p>
                                    <p className="text-[11px] text-slate-600">
                                        Exige capturar el folio fiscal (UUID) de la factura nueva que sustituye al comprobante a cancelar.
                                    </p>
                                </>
                            )}
                            {simCancelCase === 'no_se_hizo' && (
                                <>
                                    <p className="text-xs font-bold text-slate-900">
                                        Clave 03 - No se llevó a cabo la operación
                                    </p>
                                    <p className="text-[11px] text-slate-600">
                                        Se utiliza cuando la venta o prestación de servicio no se concretó. No requiere UUID relacionado.
                                    </p>
                                </>
                            )}
                            {simCancelCase === 'global_nominativa' && (
                                <>
                                    <p className="text-xs font-bold text-slate-900">
                                        Clave 04 - Operación nominativa relacionada en factura global
                                    </p>
                                    <p className="text-[11px] text-slate-600">
                                        Aplica para cancelar la factura global y emitir por separado la factura solicitada por el cliente.
                                    </p>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => navigate('/documentos')}
                                className="mt-2 w-full py-2 px-3 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                            >
                                <span>Ir a Documentos Emitidos</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* HERRAMIENTA 3: Verificador de Receptor CFDI 4.0 */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-5">
                        <div className="space-y-4">
                            <div className="border-b border-slate-200 pb-3">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">Consulta 3</span>
                                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                                    Formateador de Razón Social y RFC 4.0
                                </h3>
                            </div>

                            <div className="space-y-2.5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">RFC del Receptor</label>
                                    <input
                                        type="text"
                                        value={valRfc}
                                        onChange={(e) => setValRfc(e.target.value.toUpperCase())}
                                        placeholder="Ej. CNO980115AB1"
                                        maxLength={13}
                                        className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs font-mono uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre o Razón Social (con o sin S.A. de C.V.)</label>
                                    <input
                                        type="text"
                                        value={valNombre}
                                        onChange={(e) => setValNombre(e.target.value)}
                                        placeholder="Pegar nombre de la Constancia..."
                                        className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Código Postal Fiscal</label>
                                    <input
                                        type="text"
                                        value={valCp}
                                        onChange={(e) => setValCp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                        placeholder="5 dígitos"
                                        className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
                            <span className="text-[11px] font-bold uppercase text-slate-500">
                                Validación de formato SAT:
                            </span>
                            <ul className="space-y-1 text-[11px] text-slate-700">
                                <li>
                                    • <strong>RFC:</strong>{' '}
                                    {receptorChecks.rfcValid
                                        ? receptorChecks.isGeneric
                                            ? 'Genérico válido (Régimen 616 / Uso S01)'
                                            : receptorChecks.isMoral
                                            ? 'Persona Moral (12 caracteres)'
                                            : 'Persona Física (13 caracteres)'
                                        : 'Pendiente de capturar (12 o 13 caracteres)'}
                                </li>
                                <li>
                                    • <strong>Régimen societario:</strong>{' '}
                                    {receptorChecks.hasSocietario
                                        ? 'Se eliminó automáticamente el sufijo societario'
                                        : valNombre.trim()
                                        ? 'Correcto (sin régimen societario)'
                                        : 'Pendiente'}
                                </li>
                                <li>
                                    • <strong>Código Postal:</strong>{' '}
                                    {receptorChecks.cpValid ? `${valCp} (Válido)` : 'Debe contener 5 dígitos'}
                                </li>
                            </ul>

                            {receptorChecks.nombreCleanResult && (
                                <div className="pt-2 border-t border-slate-200">
                                    <span className="text-[10px] text-slate-500 block">Denominación lista para copiar en CFDI 4.0:</span>
                                    <code className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded select-all block mt-1">
                                        {receptorChecks.nombreCleanResult}
                                    </code>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => navigate('/receptores')}
                                className="mt-2 w-full py-2 px-3 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                            >
                                <span>Ir al Catálogo de Receptores</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SECCIÓN 3: CATÁLOGO DE ERRORES DE TIMBRADO SAT */}
            {activeTab === 'errores' && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <h2 className="text-base font-bold text-slate-900">
                            Catálogo de Códigos de Rechazo PAC / SAT
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Causas técnicas y procedimiento de corrección para los errores más frecuentes al timbrar o cancelar.
                        </p>
                    </div>

                    {allErrors.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500">
                            No se encontraron códigos que coincidan con "{search}".
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {allErrors.map((err, idx) => (
                                <div key={idx} className="p-5 hover:bg-slate-50/60 transition flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="space-y-1.5 max-w-3xl">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                                                {err.module}
                                            </span>
                                            <h3 className="text-sm font-bold text-rose-800">{err.code}</h3>
                                        </div>
                                        <p className="text-xs text-slate-600">
                                            <strong>Causa del rechazo:</strong> {err.cause}
                                        </p>
                                        <p className="text-xs text-slate-800">
                                            <strong>Acción correctiva:</strong> {err.solution}
                                        </p>
                                    </div>
                                    {err.primaryRoute && (
                                        <button
                                            type="button"
                                            onClick={() => navigate(err.primaryRoute)}
                                            className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 shrink-0"
                                        >
                                            <span>Ir a {err.module}</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* SECCIÓN 4: PREGUNTAS FRECUENTES */}
            {activeTab === 'faq' && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <h2 className="text-base font-bold text-slate-900">
                            Preguntas Frecuentes sobre Operación y Criterios Fiscales
                        </h2>
                    </div>

                    {filteredFaqs.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500">
                            No hay preguntas que coincidan con tu búsqueda.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {filteredFaqs.map(faq => {
                                const isOpen = openFaqId === faq.id;
                                return (
                                    <div key={faq.id}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                                            className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition"
                                        >
                                            <span className="text-xs md:text-sm font-bold text-slate-900">
                                                {faq.question}
                                            </span>
                                            {isOpen ? (
                                                <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                            )}
                                        </button>
                                        {isOpen && (
                                            <div className="px-6 pb-4 pt-1 text-xs md:text-sm text-slate-600 leading-relaxed bg-slate-50/70">
                                                {faq.answer}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
