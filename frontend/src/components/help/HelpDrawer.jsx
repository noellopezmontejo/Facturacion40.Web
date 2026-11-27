import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    X, Search, Volume2, CheckCircle2, Circle,
    ChevronRight, ArrowLeft, ExternalLink
} from 'lucide-react';
import { HELP_GUIDES } from '../../data/helpGuides';
import { HelpDemoPlayer } from './HelpDemoPlayer';

const STORAGE_KEY = 'facturacion40_help_progress_v1';

export const HelpDrawer = ({ isOpen, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [selectedGuideId, setSelectedGuideId] = useState(null);
    const [showVideo, setShowVideo] = useState(false);

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

    const contextualGuide = useMemo(() => {
        const path = location.pathname;
        return (
            HELP_GUIDES.find(g => g.routes.includes(path)) ||
            HELP_GUIDES.find(g => g.routes.some(r => r !== '/' && path.startsWith(r))) ||
            HELP_GUIDES[0]
        );
    }, [location.pathname]);

    useEffect(() => {
        if (isOpen) {
            setSelectedGuideId(contextualGuide.id);
            setShowVideo(false);
        }
    }, [isOpen, contextualGuide.id]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    const activeGuide = useMemo(
        () => HELP_GUIDES.find(g => g.id === selectedGuideId) || contextualGuide,
        [selectedGuideId, contextualGuide]
    );

    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return HELP_GUIDES.filter(g =>
            g.title.toLowerCase().includes(q) ||
            g.module.toLowerCase().includes(q) ||
            g.summary.toLowerCase().includes(q) ||
            g.steps.some(s => s.title.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q)) ||
            (g.commonErrors && g.commonErrors.some(e => e.code.toLowerCase().includes(q) || e.solution.toLowerCase().includes(q)))
        );
    }, [search]);

    const toggleStep = (guideId, idx) => {
        const key = `${guideId}-${idx}`;
        setCompletedSteps(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const goToRoute = (route) => {
        onClose();
        navigate(route);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className="fixed inset-0 bg-slate-900/35 transition-opacity"
                onClick={onClose}
            />

            <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
                {/* Encabezado sobrio */}
                <div className="bg-slate-900 px-5 py-4 text-white shrink-0">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold tracking-tight truncate">
                                Guía de Operación
                            </h2>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                Módulo actual: <span className="text-white font-semibold">{contextualGuide.module}</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                            title="Cerrar (Esc)"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="relative mt-3">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar procedimiento o error SAT..."
                            className="w-full pl-8 pr-8 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder:text-slate-400 outline-none focus:border-slate-500"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Cuerpo */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {search.trim() ? (
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Resultados ({searchResults.length})
                            </p>
                            {searchResults.length === 0 ? (
                                <div className="p-6 text-center bg-slate-50 rounded-lg text-xs text-slate-500">
                                    Sin coincidencias para "{search}".
                                </div>
                            ) : searchResults.map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedGuideId(g.id);
                                        setSearch('');
                                        setShowVideo(false);
                                    }}
                                    className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-bold uppercase text-slate-500">{g.module}</span>
                                        <p className="text-xs font-bold text-slate-900 truncate">{g.title}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <>
                            {activeGuide.id !== contextualGuide.id && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedGuideId(contextualGuide.id);
                                        setShowVideo(false);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span>Volver a {contextualGuide.module}</span>
                                </button>
                            )}

                            {/* Resumen del módulo */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <span className="text-[11px] font-bold uppercase text-slate-500 block">
                                    {activeGuide.module}
                                </span>
                                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{activeGuide.title}</h3>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{activeGuide.summary}</p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowVideo(v => !v)}
                                        className="flex-1 py-1.5 px-3 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                                    >
                                        <Volume2 className="w-3.5 h-3.5" />
                                        <span>{showVideo ? 'Ocultar guía con voz' : 'Escuchar guía paso a paso'}</span>
                                    </button>

                                    {activeGuide.primaryRoute && location.pathname !== activeGuide.primaryRoute && (
                                        <button
                                            type="button"
                                            onClick={() => goToRoute(activeGuide.primaryRoute)}
                                            className="py-1.5 px-3 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                                        >
                                            <span>Abrir</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {showVideo && (
                                <HelpDemoPlayer guide={activeGuide} compact />
                            )}

                            {/* Lista de pasos */}
                            <div className="space-y-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    Pasos del procedimiento
                                </p>

                                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                                    {activeGuide.steps.map((step, idx) => {
                                        const done = !!completedSteps[`${activeGuide.id}-${idx}`];
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => toggleStep(activeGuide.id, idx)}
                                                className={`w-full text-left p-3.5 transition flex items-start gap-3 ${
                                                    done
                                                        ? 'bg-slate-50'
                                                        : 'bg-white hover:bg-slate-50/70'
                                                }`}
                                            >
                                                <div className="mt-0.5 shrink-0">
                                                    {done ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    ) : (
                                                        <Circle className="w-4 h-4 text-slate-300" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-bold ${done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                                        {step.title}
                                                    </p>
                                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                                        {step.detail}
                                                    </p>
                                                    {step.tip && (
                                                        <div className="mt-2 text-[11px] text-slate-700 bg-amber-50/80 border-l-2 border-amber-500 pl-2.5 py-1">
                                                            <strong>Nota:</strong> {step.tip}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Errores frecuentes */}
                            {activeGuide.commonErrors && activeGuide.commonErrors.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                        Rechazos comunes y solución
                                    </p>
                                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                                        {activeGuide.commonErrors.map((err, i) => (
                                            <div key={i} className="p-3 bg-white space-y-1">
                                                <p className="text-xs font-bold text-rose-800">{err.code}</p>
                                                <p className="text-[11px] text-slate-600">{err.cause}</p>
                                                <p className="text-[11px] text-slate-800 pt-0.5">
                                                    <strong>Solución:</strong> {err.solution}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Referencia rápida */}
                            {activeGuide.example && (
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-800">
                                        {activeGuide.example.title}
                                    </div>
                                    <div className="divide-y divide-slate-200 bg-white">
                                        {activeGuide.example.items.map((item, idx) => (
                                            <div key={idx} className="px-3.5 py-2 flex flex-col gap-0.5">
                                                <span className="text-[11px] font-bold text-slate-800">{item.label}</span>
                                                <span className="text-[11px] text-slate-600">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Acceso al manual completo */}
                            <div className="pt-2 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => goToRoute('/ayuda')}
                                    className="w-full py-2 px-3 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                                >
                                    <span>Ver Manual Completo y Consultas SAT</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Pie */}
                <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                    <span>Tecla rápida: <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">F1</kbd></span>
                    <span>Cerrar: <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Esc</kbd></span>
                </div>
            </aside>
        </div>
    );
};
