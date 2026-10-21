import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Bell, Search, ChevronDown, Check, LogOut, Building2, 
    AlertTriangle, Plus, Layers, ShieldCheck, Sparkles 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

export const Topbar = () => {
    const { 
        user, 
        activeEmisor, 
        activeEmpresa, 
        changeActiveEmisor, 
        changeActiveEmpresa, 
        logout 
    } = useAuth();
    
    const navigate = useNavigate();

    const [empresas, setEmpresas] = useState([]);
    const [empresaSearch, setEmpresaSearch] = useState('');
    const [isEmpresasDropdownOpen, setIsEmpresasDropdownOpen] = useState(false);
    const [isEmisoresDropdownOpen, setIsEmisoresDropdownOpen] = useState(false);

    const empresasRef = useRef(null);
    const emisoresRef = useRef(null);

    // Cerrar dropdowns al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (empresasRef.current && !empresasRef.current.contains(event.target)) {
                setIsEmpresasDropdownOpen(false);
            }
            if (emisoresRef.current && !emisoresRef.current.contains(event.target)) {
                setIsEmisoresDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cargar datos según el rol
    useEffect(() => {
        if (!user) return;

        if (user.rol === 'Administrador') {
            fetchEmpresasAdmin();
        } else {
            fetchEmisoresRegular();
        }
    }, [user]);

    const fetchEmpresasAdmin = async () => {
        try {
            const { data } = await api.get('/empresas');
            setEmpresas(data);

            if (data.length > 0) {
                // Si ya tenemos un activeEmpresa guardado, asegurarnos de que siga existiendo y actualizar sus emisores
                const currentEmpresa = data.find(e => e.id === activeEmpresa?.id) || data[0];

                if (!activeEmpresa || activeEmpresa.id !== currentEmpresa.id) {
                    changeActiveEmpresa(currentEmpresa);
                } else {
                    // Sincronizar emisores de la empresa activa
                    const emisoresDeEmpresa = currentEmpresa.Emisors || [];
                    const stillValid = emisoresDeEmpresa.find(e => e.id === activeEmisor?.id);
                    if (!stillValid && emisoresDeEmpresa.length > 0) {
                        changeActiveEmisor(emisoresDeEmpresa[0]);
                    } else if (emisoresDeEmpresa.length === 0) {
                        changeActiveEmisor(null);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching empresas topbar", error);
        }
    };

    const fetchEmisoresRegular = async () => {
        try {
            const { data } = await api.get('/emisores');
            if (data.length > 0 && !activeEmisor) {
                changeActiveEmisor(data[0]);
            }
        } catch (error) {
            console.error("Error fetching emisores topbar", error);
        }
    };

    // Emisores disponibles para la empresa activa
    const currentWorkspaceEmisores = React.useMemo(() => {
        if (user?.rol === 'Administrador') {
            const current = empresas.find(e => e.id === activeEmpresa?.id);
            return current?.Emisors || [];
        }
        return [];
    }, [empresas, activeEmpresa, user]);

    // Filtrar empresas para búsqueda rápida
    const filteredEmpresas = empresas.filter(e => 
        e.nombre.toLowerCase().includes(empresaSearch.toLowerCase())
    );

    const handleSelectEmpresa = (emp) => {
        changeActiveEmpresa(emp);
        setIsEmpresasDropdownOpen(false);
    };

    const handleSelectEmisor = (em) => {
        changeActiveEmisor(em);
        setIsEmisoresDropdownOpen(false);
    };

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
            <div className="flex items-center flex-1">
                <div className="relative w-80 hidden lg:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar en el sistema..."
                        className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg text-xs transition-all outline-none"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* SELECTOR DE ESPACIO DE TRABAJO (SOLO ADMINISTRADOR) */}
                {user?.rol === 'Administrador' && (
                    <div className="relative" ref={empresasRef}>
                        <button
                            type="button"
                            onClick={() => {
                                setIsEmpresasDropdownOpen(!isEmpresasDropdownOpen);
                                setIsEmisoresDropdownOpen(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-all ${
                                isEmpresasDropdownOpen 
                                    ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-200/50' 
                                    : 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-100/60'
                            }`}
                            title="Cambiar Espacio de Trabajo / Tenant"
                        >
                            <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                <Building2 className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider leading-none">
                                    Espacio de Trabajo
                                </span>
                                <span className="text-xs font-bold text-slate-800 leading-tight max-w-[170px] truncate mt-0.5">
                                    {activeEmpresa ? activeEmpresa.nombre : 'Seleccionar...'}
                                </span>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-indigo-500 transition-transform ${isEmpresasDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown de Espacios de Trabajo */}
                        {isEmpresasDropdownOpen && (
                            <div className="absolute top-12 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-indigo-500" /> Espacios ({empresas.length})
                                    </span>
                                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                        Administrador
                                    </span>
                                </div>

                                {/* Buscador rápido */}
                                <div className="p-2 border-b border-slate-100">
                                    <input
                                        type="text"
                                        placeholder="Filtrar espacios..."
                                        value={empresaSearch}
                                        onChange={(e) => setEmpresaSearch(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-indigo-500"
                                        autoFocus
                                    />
                                </div>

                                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                                    {filteredEmpresas.map(emp => {
                                        const count = emp.Emisors ? emp.Emisors.length : 0;
                                        const isSelected = activeEmpresa?.id === emp.id;

                                        return (
                                            <div
                                                key={emp.id}
                                                onClick={() => handleSelectEmpresa(emp)}
                                                className={`px-3.5 py-2.5 hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition-colors ${
                                                    isSelected ? 'bg-indigo-50/80' : ''
                                                }`}
                                            >
                                                <div className="space-y-0.5 flex-1 pr-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-800 line-clamp-1">
                                                            {emp.nombre}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="text-[9px] font-black bg-indigo-600 text-white px-1.5 py-0.2 rounded">
                                                                ACTIVO
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span>ID: ESP-{String(emp.id).padStart(4, '0')}</span>
                                                        <span>•</span>
                                                        <span className={count > 0 ? 'text-slate-600 font-medium' : 'text-amber-600 font-semibold'}>
                                                            {count === 1 ? '1 emisor' : `${count} emisores`}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                                            </div>
                                        );
                                    })}

                                    {filteredEmpresas.length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400">
                                            No se encontraron espacios con ese nombre.
                                        </div>
                                    )}
                                </div>

                                <div className="p-2 border-t border-slate-100 bg-slate-50">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEmpresasDropdownOpen(false);
                                            navigate('/configuracion');
                                        }}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-lg text-xs font-bold text-slate-600 transition shadow-xs"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Crear o Administrar Espacios</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SELECTOR DE EMISOR FISCAL */}
                <div className="relative" ref={emisoresRef}>
                    {user?.rol === 'Administrador' ? (
                        currentWorkspaceEmisores.length > 0 ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEmisoresDropdownOpen(!isEmisoresDropdownOpen);
                                    setIsEmpresasDropdownOpen(false);
                                }}
                                className={`flex items-center bg-slate-50 border rounded-lg px-3 py-1.5 cursor-pointer transition ${
                                    isEmisoresDropdownOpen 
                                        ? 'border-indigo-400 bg-indigo-50/30 ring-2 ring-indigo-100' 
                                        : 'border-slate-200 hover:bg-slate-100'
                                }`}
                                title="Seleccionar Emisor de este Espacio"
                            >
                                <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-black mr-2">
                                    {activeEmisor?.razon_social ? activeEmisor.razon_social.charAt(0) : 'E'}
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-xs font-semibold text-slate-800 leading-none max-w-[140px] truncate">
                                        {activeEmisor?.razon_social || 'Seleccionar Emisor'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono leading-tight mt-0.5">
                                        {activeEmisor?.rfc || 'Sin RFC'}
                                    </span>
                                </div>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-2" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => navigate('/emisores')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition shadow-xs animate-pulse"
                                title="Este espacio no tiene ningún emisor. Haz clic para registrar uno."
                            >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Sin Emisores</span>
                                <span className="underline ml-0.5">+ Registrar</span>
                            </button>
                        )
                    ) : (
                        // Para Usuario Empresarial / Operador
                        activeEmisor ? (
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                                <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold mr-2">
                                    {activeEmisor.razon_social ? activeEmisor.razon_social.charAt(0) : 'E'}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-slate-700 leading-none max-w-[150px] truncate">
                                        {activeEmisor.razon_social}
                                    </span>
                                    <span className="text-[10px] text-slate-500 leading-tight">
                                        {activeEmisor.rfc}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 px-3 py-1.5">No hay emisores asignados</div>
                        )
                    )}

                    {/* Dropdown de Emisores */}
                    {isEmisoresDropdownOpen && currentWorkspaceEmisores.length > 0 && (
                        <div className="absolute top-12 right-0 w-72 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                            <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                                    Emisores de este Espacio
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {currentWorkspaceEmisores.length} total
                                </span>
                            </div>
                            <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                                {currentWorkspaceEmisores.map(em => (
                                    <div
                                        key={em.id}
                                        className={`px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors ${
                                            activeEmisor?.id === em.id ? 'bg-emerald-50/60' : ''
                                        }`}
                                        onClick={() => handleSelectEmisor(em)}
                                    >
                                        <div className="flex flex-col pr-2">
                                            <span className="text-xs font-bold text-slate-800 line-clamp-1">{em.razon_social}</span>
                                            <span className="text-[11px] font-mono text-slate-500">{em.rfc}</span>
                                        </div>
                                        {activeEmisor?.id === em.id && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                                    </div>
                                ))}
                            </div>
                            <div className="p-2 border-t border-slate-100 bg-slate-50">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEmisoresDropdownOpen(false);
                                        navigate('/emisores');
                                    }}
                                    className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Gestionar Emisores del Espacio</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-6 w-px bg-slate-200 mx-1"></div>

                <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Notificaciones">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="flex items-center gap-2.5 ml-1">
                    <img
                        src={`https://ui-avatars.com/api/?name=${user?.nombre || 'Usuario'}&background=4F46E5&color=fff&bold=true`}
                        alt="User avatar"
                        className="w-8 h-8 rounded-full shadow-xs border border-slate-200"
                    />
                    <div className="hidden md:block text-sm">
                        <p className="font-bold text-slate-800 text-xs leading-none">{user?.nombre || 'Usuario'}</p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{user?.rol || 'Rol'}</p>
                    </div>

                    <button
                        onClick={logout}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                        title="Cerrar sesión"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
};
