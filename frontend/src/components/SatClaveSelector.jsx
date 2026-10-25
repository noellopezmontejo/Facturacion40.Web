import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Check, Tag, Sparkles, Filter, ExternalLink } from 'lucide-react';
import satClaves from '../data/satClavesProdServ.json';

// Utilidad para normalizar texto eliminando acentos y espacios extra
const normalizeText = (text = '') => {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

export const SatClaveSelector = ({
    value = '',
    onChange,
    onUnitSuggested,
    required = false,
    placeholder = 'Ej. 84111506 o Timbres'
}) => {
    const [searchTerm, setSearchTerm] = useState(value);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalSearch, setModalSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const containerRef = useRef(null);

    // Sincronizar searchTerm si el valor externo cambia
    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    // Encontrar la clave actual seleccionada en el catálogo
    const currentItem = useMemo(() => {
        if (!value) return null;
        return satClaves.find(c => c.clave === value.trim());
    }, [value]);

    // Categorías únicas disponibles en el catálogo
    const categories = useMemo(() => {
        const set = new Set();
        satClaves.forEach(c => {
            if (c.categoria) set.add(c.categoria);
        });
        return ['Todas', ...Array.from(set)];
    }, []);

    // Claves rápidas frecuentes
    const popularClaves = useMemo(() => {
        const popularCodes = ['84111506', '43231500', '81111508', '84111500', '78101800', '15101514', '01010101'];
        return satClaves.filter(c => popularCodes.includes(c.clave));
    }, []);

    // Filtrar resultados rápidos para el dropdown del input
    const quickResults = useMemo(() => {
        const query = normalizeText(searchTerm);
        if (!query) return satClaves.slice(0, 8);

        return satClaves.filter(c => {
            const claveNorm = normalizeText(c.clave);
            const descNorm = normalizeText(c.desc);
            const keywordsNorm = normalizeText(c.palabrasClave || '');
            return claveNorm.includes(query) || descNorm.includes(query) || keywordsNorm.includes(query);
        }).slice(0, 8);
    }, [searchTerm]);

    // Filtrar resultados detallados para el Modal avanzado
    const modalResults = useMemo(() => {
        const query = normalizeText(modalSearch);
        return satClaves.filter(c => {
            const matchesCat = selectedCategory === 'Todas' || c.categoria === selectedCategory;
            if (!matchesCat) return false;
            if (!query) return true;

            const claveNorm = normalizeText(c.clave);
            const descNorm = normalizeText(c.desc);
            const keywordsNorm = normalizeText(c.palabrasClave || '');
            return claveNorm.includes(query) || descNorm.includes(query) || keywordsNorm.includes(query);
        });
    }, [modalSearch, selectedCategory]);

    // Cerrar dropdown al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectClave = (item) => {
        setSearchTerm(item.clave);
        setShowDropdown(false);
        setShowModal(false);
        if (onChange) {
            onChange(item.clave, item);
        }
        if (onUnitSuggested && item.unidadSugerida) {
            onUnitSuggested(item.unidadSugerida);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Input con Botón de Búsqueda Integrado */}
            <div className="relative flex items-center">
                <input
                    type="text"
                    required={required}
                    value={searchTerm}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSearchTerm(val);
                        if (onChange) onChange(val, null);
                        setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-3 pr-20 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm font-mono transition-all"
                    placeholder={placeholder}
                    autoComplete="off"
                />
                
                {/* Botón Explorador / Modal */}
                <button
                    type="button"
                    onClick={() => {
                        setModalSearch(searchTerm && !currentItem ? searchTerm : '');
                        setShowModal(true);
                    }}
                    className="absolute right-1 px-2.5 py-1.5 bg-slate-100 hover:bg-primary-50 text-slate-600 hover:text-primary-600 rounded-md text-xs font-semibold flex items-center gap-1 transition-all border border-slate-200"
                    title="Abrir Buscador Avanzado de Claves SAT"
                >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Buscar</span>
                </button>
            </div>

            {/* Placa descriptiva cuando hay una clave válida reconocida */}
            {currentItem && (
                <div className="mt-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 truncate">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-semibold text-emerald-900 truncate">{currentItem.desc}</span>
                        {currentItem.categoria && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                {currentItem.categoria}
                            </span>
                        )}
                    </div>
                    {currentItem.unidadSugerida && (
                        <span className="text-[10px] text-emerald-600 font-mono ml-2 flex-shrink-0">
                            Unidad: <strong>{currentItem.unidadSugerida}</strong>
                        </span>
                    )}
                </div>
            )}

            {/* Dropdown de Autocompletado Rápido */}
            {showDropdown && (
                <div className="absolute z-20 w-[140%] min-w-[320px] left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto animate-in fade-in duration-100 divide-y divide-slate-100">
                    <div className="p-2 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center sticky top-0 z-10 border-b border-slate-200">
                        <span>Sugerencias SAT ({quickResults.length})</span>
                        <button
                            type="button"
                            onClick={() => {
                                setShowDropdown(false);
                                setModalSearch(searchTerm);
                                setShowModal(true);
                            }}
                            className="text-primary-600 hover:text-primary-700 text-xs normal-case font-bold flex items-center gap-0.5"
                        >
                            Ver catálogo completo <ExternalLink className="w-3 h-3" />
                        </button>
                    </div>

                    {quickResults.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                            No se encontraron claves con "{searchTerm}".
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDropdown(false);
                                    setShowModal(true);
                                }}
                                className="block mx-auto mt-2 text-primary-600 font-bold hover:underline"
                            >
                                Abrir catálogo avanzado
                            </button>
                        </div>
                    ) : (
                        quickResults.map(item => (
                            <div
                                key={item.clave}
                                onClick={() => handleSelectClave(item)}
                                className="p-2.5 hover:bg-primary-50/70 cursor-pointer transition-colors flex items-start justify-between gap-2 group"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded">
                                            {item.clave}
                                        </span>
                                        {item.categoria && (
                                            <span className="text-[10px] text-slate-400 font-medium truncate">
                                                {item.categoria}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-700 font-medium mt-1 group-hover:text-primary-900 leading-tight">
                                        {item.desc}
                                    </p>
                                </div>
                                {item.unidadSugerida && (
                                    <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                        {item.unidadSugerida}
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal Avanzado de Exploración y Búsqueda SAT */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Cabecera del Modal */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center">
                                    <Search className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">Catálogo Oficial SAT (CFDI 4.0)</h3>
                                    <p className="text-xs text-slate-400">Búsqueda rápida por clave, nombre de producto o actividad (Ej. Timbres, Software, Fletes)</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-white hover:bg-slate-700/50 p-2 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Barra de Búsqueda y Filtros */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    autoFocus
                                    value={modalSearch}
                                    onChange={(e) => setModalSearch(e.target.value)}
                                    placeholder="Buscar por clave SAT, descripción o palabras clave (ej: timbres, contabilidad, software, flete)..."
                                    className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm bg-white shadow-sm"
                                />
                                {modalSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setModalSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Categorías Rápidas */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                                            selectedCategory === cat
                                                ? 'bg-slate-900 text-white shadow-sm'
                                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Accesos Rápidos Populares */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                                <span className="font-semibold text-slate-400 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Frecuentes:
                                </span>
                                {popularClaves.map(p => (
                                    <button
                                        key={p.clave}
                                        type="button"
                                        onClick={() => handleSelectClave(p)}
                                        className="px-2 py-0.5 bg-slate-200/70 hover:bg-primary-100 hover:text-primary-800 text-slate-700 rounded-md font-mono text-[11px] transition-colors"
                                        title={`${p.clave} - ${p.desc}`}
                                    >
                                        {p.clave} ({p.desc.split(' ')[0]})
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Listado de Resultados */}
                        <div className="overflow-y-auto p-4 flex-1 divide-y divide-slate-100">
                            {modalResults.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Search className="w-6 h-6" />
                                    </div>
                                    <p className="text-slate-600 font-semibold text-sm">No se encontraron claves SAT</p>
                                    <p className="text-slate-400 text-xs mt-1">Intenta con otro término o selecciona "Todas" en las categorías.</p>
                                </div>
                            ) : (
                                modalResults.map(item => (
                                    <div
                                        key={item.clave}
                                        className="py-3 px-3 hover:bg-slate-50 rounded-xl flex items-center justify-between gap-4 transition-colors group"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs font-bold text-primary-700 bg-primary-100/80 px-2 py-0.5 rounded-md">
                                                    {item.clave}
                                                </span>
                                                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    {item.categoria || 'General'}
                                                </span>
                                                {item.unidadSugerida && (
                                                    <span className="text-[11px] text-slate-400 font-mono">
                                                        Unidad sug: <strong>{item.unidadSugerida}</strong>
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-sm font-semibold text-slate-800 mt-1 leading-snug group-hover:text-primary-700">
                                                {item.desc}
                                            </h4>
                                            {item.palabrasClave && (
                                                <p className="text-xs text-slate-400 mt-0.5 truncate">
                                                    Sinónimos: {item.palabrasClave}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleSelectClave(item)}
                                            className="px-4 py-2 bg-slate-900 hover:bg-primary-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex-shrink-0"
                                        >
                                            Seleccionar
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pie del modal */}
                        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
                            <span>Mostrando {modalResults.length} claves disponibles</span>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-white font-medium"
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
