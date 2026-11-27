import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Play, Pause, RotateCcw, SkipBack, SkipForward,
    Volume2, VolumeX, Info
} from 'lucide-react';

// Adapta el texto a un guion hablado natural con vocabulario fiscal mexicano
// para que el sintetizador es-MX haga pausas naturales y pronuncie términos como un contador en México.
const buildMexicanNarrationScript = (step, idx, total) => {
    const cleanText = (str = '') =>
        str
            .replace(/^\d+\.\s*/, '')
            .replace(/\bCFDI 4\.0\b/g, 'CFDI cuatro punto cero')
            .replace(/\bCFDI\b/g, 'C F D I')
            .replace(/\bSAT\b/g, 'SAT')
            .replace(/\bPAC\b/g, 'PAC')
            .replace(/\bRFC\b/g, 'R F C')
            .replace(/\bCSD\b/g, 'Certificado de Sello Digital')
            .replace(/\bFIEL\b/g, 'Fiel')
            .replace(/\be\.firma\b/gi, 'e firma')
            .replace(/\bREP 2\.0\b/g, 'Complemento de Pago dos punto cero')
            .replace(/\bREP\b/g, 'Complemento de Pago')
            .replace(/\bUUID\b/g, 'folio fiscal U U I D')
            .replace(/\bXML\b/g, 'archivo X M L')
            .replace(/\bPDF\b/g, 'P D F')
            .replace(/\bPUE\b/g, 'P U E, pago en una sola exhibición,')
            .replace(/\bPPD\b/g, 'P P D, pago en parcialidades o diferido,')
            .replace(/\bIVA\b/g, 'IVA')
            .replace(/\bISR\b/g, 'I S R')
            .replace(/\bIEPS\b/g, 'IEPS')
            .replace(/\bISH\b/g, 'Impuesto Sobre Hospedaje')
            .replace(/\bRESICO\b/g, 'RESICO')
            .replace(/\bCP\b/g, 'código postal')
            .replace(/\bKM\b/gi, 'kilómetros')
            .replace(/\bKG\b/gi, 'kilogramos')
            .replace(/\bMXN\b/gi, 'pesos')
            .replace(/\bS\.?A\.?\s*de\s*C\.?V\.?/gi, 'S A de C V')
            .replace(/\bS\.?\s*de\s*R\.?L\.?/gi, 'S de R L')
            .replace(/\.cer\b/gi, ' punto cer')
            .replace(/\.key\b/gi, ' punto key')
            .replace(/\bClaveProdServ\b/g, 'clave de producto o servicio')
            .replace(/\bClaveUnidad\b/g, 'clave de unidad')
            .replace(/\//g, ' o ');

    const introConnectors = [
        'Primero,',
        'En el siguiente paso,',
        'A continuación,',
        'Después,',
        'Por último,'
    ];
    const connector =
        idx === 0
            ? introConnectors[0]
            : idx === total - 1 && total > 1
            ? introConnectors[4]
            : introConnectors[(idx % 3) + 1];

    const parts = [
        `${connector} ${cleanText(step.title)}.`,
        cleanText(step.detail),
        step.tip ? `Toma en cuenta esto: ${cleanText(step.tip)}` : ''
    ].filter(Boolean);

    return parts.join(' ... ');
};

// Clasifica y puntúa las voces del navegador priorizando español de México (es-MX)
const scoreVoiceForMexicanSpanish = (v) => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    let score = 0;

    if (lang === 'es-mx' || lang === 'es_mx') score += 100;
    else if (lang.includes('mx') || name.includes('mexic') || name.includes('méxic')) score += 90;
    else if (lang === 'es-419' || lang === 'es-us' || lang === 'es_us') score += 50;
    else if (lang.startsWith('es') && !lang.includes('es-es')) score += 30;
    else if (lang.startsWith('es')) score += 10;
    else return -1;

    // Voces neuronales mexicanas de Windows / Edge / Chrome / macOS
    if (name.includes('dalia') || name.includes('jorge')) score += 60; // Microsoft Edge/Windows Neural México
    if (name.includes('paulina') || name.includes('juan') || name.includes('carlos')) score += 50; // Apple / Windows México
    if (name.includes('sabina') || name.includes('raul') || name.includes('raúl')) score += 40; // Microsoft Desktop México
    if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 35;
    if (name.includes('google') && (lang.includes('mx') || lang.includes('us'))) score += 25;

    return score;
};

export const HelpDemoPlayer = ({ guide, compact = false }) => {
    const steps = guide?.steps || [];
    const [currentIdx, setCurrentIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speechRate, setSpeechRate] = useState(1);
    const [availableVoices, setAvailableVoices] = useState([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState('');

    const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const progressTimerRef = useRef(null);

    const stopSpeech = useCallback(() => {
        if (speechSupported) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
    }, [speechSupported]);

    // Cargar y ordenar las voces en español dando prioridad a México (es-MX)
    useEffect(() => {
        if (!speechSupported) return;

        const loadVoices = () => {
            const raw = window.speechSynthesis.getVoices() || [];
            const spanishVoices = raw
                .map(v => ({ voice: v, score: scoreVoiceForMexicanSpanish(v) }))
                .filter(item => item.score >= 0)
                .sort((a, b) => b.score - a.score)
                .map(item => item.voice);

            setAvailableVoices(spanishVoices);
            if (spanishVoices.length > 0 && !selectedVoiceURI) {
                setSelectedVoiceURI(spanishVoices[0].voiceURI);
            }
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, [speechSupported, selectedVoiceURI]);

    const advanceToNextStep = useCallback(() => {
        setCurrentIdx(curr => {
            if (curr + 1 < steps.length) {
                setProgress(0);
                return curr + 1;
            } else {
                setIsPlaying(false);
                setProgress(100);
                return curr;
            }
        });
    }, [steps.length]);

    useEffect(() => {
        setCurrentIdx(0);
        setProgress(0);
        setIsPlaying(true);
        return () => stopSpeech();
    }, [guide?.id, stopSpeech]);

    // Narración sincronizada con cada paso
    useEffect(() => {
        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }

        if (!isPlaying || steps.length === 0) {
            stopSpeech();
            return;
        }

        const step = steps[currentIdx] || steps[0];
        const fullScript = buildMexicanNarrationScript(step, currentIdx, steps.length);

        const estimatedMs = Math.max(5500, Math.round((fullScript.length * 68) / speechRate));
        const tickMs = 60;
        const increment = (100 * tickMs) / estimatedMs;

        if (!isMuted && speechSupported) {
            window.speechSynthesis.cancel();

            const utter = new SpeechSynthesisUtterance(fullScript);
            const chosenVoice =
                availableVoices.find(v => v.voiceURI === selectedVoiceURI) ||
                availableVoices[0] ||
                null;

            if (chosenVoice) {
                utter.voice = chosenVoice;
                utter.lang = chosenVoice.lang || 'es-MX';
            } else {
                utter.lang = 'es-MX';
            }

            // Cadencia y entonación ligeramente más cálida y natural
            utter.rate = speechRate * 0.98;
            utter.pitch = 1.02;

            let finishedByVoice = false;

            utter.onstart = () => setIsSpeaking(true);
            utter.onend = () => {
                finishedByVoice = true;
                setIsSpeaking(false);
                advanceToNextStep();
            };
            utter.onerror = () => {
                setIsSpeaking(false);
            };

            window.speechSynthesis.speak(utter);

            progressTimerRef.current = setInterval(() => {
                setProgress(prev => {
                    if (finishedByVoice) return 100;
                    return prev + increment < 96 ? prev + increment : 96;
                });
            }, tickMs);
        } else {
            stopSpeech();
            progressTimerRef.current = setInterval(() => {
                setProgress(prev => {
                    if (prev + increment >= 100) {
                        advanceToNextStep();
                        return 0;
                    }
                    return prev + increment;
                });
            }, tickMs);
        }

        return () => {
            if (progressTimerRef.current) {
                clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
            }
            if (speechSupported) {
                window.speechSynthesis.cancel();
            }
            setIsSpeaking(false);
        };
    }, [
        isPlaying,
        currentIdx,
        isMuted,
        speechRate,
        steps,
        speechSupported,
        availableVoices,
        selectedVoiceURI,
        advanceToNextStep,
        stopSpeech
    ]);

    if (!guide || steps.length === 0) return null;

    const currentStep = steps[currentIdx] || steps[0];

    const handleRestart = () => {
        stopSpeech();
        setCurrentIdx(0);
        setProgress(0);
        setIsPlaying(true);
    };

    const handlePrev = () => {
        stopSpeech();
        setCurrentIdx(prev => Math.max(0, prev - 1));
        setProgress(0);
    };

    const handleNext = () => {
        stopSpeech();
        if (currentIdx + 1 < steps.length) {
            setCurrentIdx(prev => prev + 1);
            setProgress(0);
        } else {
            setIsPlaying(false);
            setProgress(100);
        }
    };

    const cycleSpeed = () => {
        setSpeechRate(prev => (prev === 1 ? 1.15 : prev === 1.15 ? 0.9 : 1));
    };

    return (
        <div className="rounded-lg overflow-hidden bg-white border border-slate-300 shadow-sm">
            {/* Encabezado limpio estilo visor de procedimiento */}
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-700 truncate">
                        Guía narrada: {guide.module}
                    </span>
                    {isSpeaking && !isMuted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            <Volume2 className="w-3 h-3" />
                            <span>Audio activo</span>
                        </span>
                    )}
                </div>
                <span className="text-xs font-semibold text-slate-500 shrink-0">
                    Paso {currentIdx + 1} de {steps.length}
                </span>
            </div>

            {/* Barra de avance segmentada */}
            <div className="px-4 pt-3 bg-slate-50 flex items-center gap-1.5">
                {steps.map((_, idx) => {
                    const isPast = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                stopSpeech();
                                setCurrentIdx(idx);
                                setProgress(0);
                            }}
                            className="flex-1 h-1.5 rounded-sm bg-slate-200 overflow-hidden cursor-pointer"
                            title={`Ir al paso ${idx + 1}`}
                        >
                            <div
                                className={`h-full transition-all duration-75 ${
                                    isPast
                                        ? 'bg-slate-700 w-full'
                                        : isCurrent
                                        ? 'bg-primary-600'
                                        : 'w-0'
                                }`}
                                style={isCurrent ? { width: `${progress}%` } : undefined}
                            />
                        </button>
                    );
                })}
            </div>

            {/* Contenido del paso actual */}
            <div className={`bg-slate-50 ${compact ? 'p-4 min-h-[175px]' : 'p-5 min-h-[195px]'} flex flex-col justify-between`}>
                <div key={currentIdx} className="space-y-3">
                    <div className="flex items-baseline gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-800 text-white font-bold text-xs shrink-0">
                            {currentIdx + 1}
                        </span>
                        <h4 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-slate-900`}>
                            {currentStep.title.replace(/^\d+\.\s*/, '')}
                        </h4>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                        <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                            {currentStep.detail}
                        </p>

                        {currentStep.tip && (
                            <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50/80 border-l-2 border-amber-500 pl-3 py-1.5">
                                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                                <span><strong>Nota fiscal:</strong> {currentStep.tip}</span>
                            </div>
                        )}
                    </div>
                </div>

                {guide.example?.items?.[currentIdx % (guide.example?.items?.length || 1)] && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600">
                        <div className="truncate">
                            <span className="font-semibold text-slate-800">
                                {guide.example.items[currentIdx % guide.example.items.length].label}:{' '}
                            </span>
                            <span>
                                {guide.example.items[currentIdx % guide.example.items.length].value}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Barra de controles inferior */}
            <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setIsPlaying(p => !p)}
                        className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                    >
                        {isPlaying ? (
                            <>
                                <Pause className="w-3.5 h-3.5" />
                                <span>Pausar</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-3.5 h-3.5" />
                                <span>Continuar</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIdx === 0}
                        className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 transition"
                        title="Paso anterior"
                    >
                        <SkipBack className="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={currentIdx + 1 >= steps.length && progress >= 100}
                        className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 transition"
                        title="Siguiente paso"
                    >
                        <SkipForward className="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        onClick={handleRestart}
                        className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                        title="Reiniciar desde el paso 1"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Selector de voz mexicana y controles de audio */}
                {speechSupported && (
                    <div className="flex items-center gap-1.5">
                        {availableVoices.length > 1 && !compact && (
                            <select
                                value={selectedVoiceURI}
                                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                                className="max-w-[170px] px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-700 truncate outline-none focus:border-slate-400"
                                title="Voz en español (prioridad México)"
                            >
                                {availableVoices.slice(0, 6).map(v => (
                                    <option key={v.voiceURI} value={v.voiceURI}>
                                        {v.name.replace(/Microsoft |Google |Online \(Natural\) - /g, '')} ({v.lang})
                                    </option>
                                ))}
                            </select>
                        )}

                        <button
                            type="button"
                            onClick={cycleSpeed}
                            className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition"
                            title="Velocidad de lectura"
                        >
                            {speechRate}x
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsMuted(m => !m)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition border ${
                                !isMuted
                                    ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
                            }`}
                            title={isMuted ? 'Activar narración' : 'Silenciar narración'}
                        >
                            {!isMuted ? (
                                <>
                                    <Volume2 className="w-3.5 h-3.5 text-slate-700" />
                                    <span>Voz</span>
                                </>
                            ) : (
                                <>
                                    <VolumeX className="w-3.5 h-3.5" />
                                    <span>Mudo</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
