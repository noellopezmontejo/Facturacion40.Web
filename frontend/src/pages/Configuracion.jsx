import React, { useState, useEffect } from 'react';
import { 
    Building2, Save, Shield, Settings, Users, AlertCircle, 
    CheckCircle2, Plus, List, ArrowRight, Sparkles, Layers 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

export const Configuracion = () => {
    const { 
        user, 
        activeEmisor, 
        activeEmpresa, 
        changeActiveEmisor, 
        changeActiveEmpresa,
        refreshActiveEmpresa 
    } = useAuth();
    
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [empresa, setEmpresa] = useState({ id: null, nombre: '', activo: true });
    const [nuevoNombre, setNuevoNombre] = useState('');

    // Estados para la gestión de múltiples empresas (solo Administradores)
    const [empresas, setEmpresas] = useState([]);
    const [loadingEmpresas, setLoadingEmpresas] = useState(false);
    const [nombreNuevaEmpresa, setNombreNuevaEmpresa] = useState('');
    const [creandoEmpresa, setCreandoEmpresa] = useState(false);

    const fetchEmpresa = async () => {
        setLoading(true);
        try {
            const params = {};
            if (user?.rol === 'Administrador') {
                if (activeEmpresa?.id) {
                    params.empresa_id = activeEmpresa.id;
                } else if (activeEmisor?.id) {
                    params.emisor_id = activeEmisor.id;
                }
            }

            const { data } = await api.get('/empresas/mi-empresa', { params });
            setEmpresa(data);
            setNuevoNombre(data.nombre);
        } catch (error) {
            console.error("Error fetching empresa details:", error);
            showToast("No se pudieron obtener los detalles del espacio empresarial.", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchAllEmpresas = async () => {
        if (user?.rol !== 'Administrador') return;
        setLoadingEmpresas(true);
        try {
            const { data } = await api.get('/empresas');
            setEmpresas(data);
        } catch (error) {
            console.error("Error fetching all empresas:", error);
            showToast("No se pudo obtener la lista de espacios empresariales.", "error");
        } finally {
            setLoadingEmpresas(false);
        }
    };

    useEffect(() => {
        fetchEmpresa();
        if (user?.rol === 'Administrador') {
            fetchAllEmpresas();
        }
    }, [activeEmpresa?.id, activeEmisor?.id]);

    const handleCrearEmpresa = async (e) => {
        e.preventDefault();
        if (!nombreNuevaEmpresa.trim()) {
            showToast("El nombre del nuevo espacio es obligatorio.", "error");
            return;
        }
        setCreandoEmpresa(true);
        try {
            const { data } = await api.post('/empresas', { nombre: nombreNuevaEmpresa.trim() });
            showToast("✅ Espacio empresarial creado con éxito.");
            setNombreNuevaEmpresa('');
            
            // Activar automáticamente el nuevo espacio de trabajo
            changeActiveEmpresa(data);
            setEmpresa(data);
            setNuevoNombre(data.nombre);

            await fetchAllEmpresas();
        } catch (error) {
            console.error("Error creating new empresa:", error);
            const msg = error.response?.data?.message || "No se pudo crear el espacio empresarial.";
            showToast(msg, "error");
        } finally {
            setCreandoEmpresa(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!nuevoNombre.trim()) {
            showToast("El nombre del espacio no puede estar vacío.", "error");
            return;
        }

        setSaving(true);
        try {
            const params = {};
            const targetId = empresa.id || activeEmpresa?.id;
            if (user?.rol === 'Administrador' && targetId) {
                params.empresa_id = targetId;
            }

            const { data } = await api.put('/empresas/mi-empresa', { nombre: nuevoNombre.trim() }, { params });
            setEmpresa(data.empresa);
            
            // Sincronizar activeEmpresa en AuthContext para reflejar el cambio en toda la UI
            if (activeEmpresa?.id === data.empresa.id) {
                changeActiveEmpresa({ ...activeEmpresa, nombre: data.empresa.nombre });
            }

            showToast("✅ Nombre del espacio actualizado correctamente");
            if (user?.rol === 'Administrador') {
                fetchAllEmpresas();
            }
        } catch (error) {
            console.error("Error updating empresa:", error);
            showToast("No se pudo actualizar el espacio empresarial.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleCambiarEspacio = (targetEmp) => {
        changeActiveEmpresa(targetEmp);
        setEmpresa(targetEmp);
        setNuevoNombre(targetEmp.nombre);
        showToast(`Espacio de trabajo cambiado a: ${targetEmp.nombre}`);
    };

    if (loading && !empresa.id) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12">
            <div>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <Settings className="w-6 h-6 text-indigo-600" /> Configuración de Espacios de Trabajo
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Administra los parámetros generales, crea nuevos espacios (tenants) y conmuta entre ellos desde tu cuenta de Administrador.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Formulario Principal de Configuración */}
                <div className="md:col-span-2 space-y-6">
                    <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-indigo-500" /> Espacio de Trabajo Activo
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Modifica la denominación formal del espacio actualmente seleccionado.
                                </p>
                            </div>
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                                ESP-{empresa?.id ? String(empresa.id).padStart(4, '0') : '0000'}
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Nombre de la Empresa / Espacio
                                </label>
                                <input
                                    type="text"
                                    value={nuevoNombre}
                                    onChange={(e) => setNuevoNombre(e.target.value)}
                                    placeholder="Ej. Corporativo Demo S.A. de C.V."
                                    className="w-full px-4 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg text-sm transition-all outline-none bg-slate-50/30 font-medium text-slate-800"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <AlertCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                <span>Este nombre identifica tu espacio de trabajo. No altera el RFC ni los datos fiscales individuales de los emisores asociados.</span>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-bold shadow-sm shadow-indigo-600/10 transition-all active:scale-95"
                            >
                                <Save className="w-4 h-4" /> 
                                {saving ? 'Guardando...' : 'Guardar Nombre del Espacio'}
                            </button>
                        </div>
                    </form>

                    {/* Banner Informativo sobre Compartición de Clientes */}
                    <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-100 rounded-xl p-5 flex items-start gap-4">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-xs">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-indigo-950 text-sm">Aislamiento y Cartera Multitenant</h3>
                            <p className="text-xs text-indigo-800/80 mt-1 leading-relaxed">
                                Cada espacio de trabajo mantiene su propio catálogo de clientes, conceptos, comprobantes fiscales, cotizaciones y usuarios. Al cambiar de espacio, toda la información que visualices y emitas pertenecerá exclusivamente a ese entorno.
                            </p>
                        </div>
                    </div>

                    {/* Sección de Gestión de Espacios Empresariales (Solo Administrador Global) */}
                    {user?.rol === 'Administrador' && (
                        <div className="space-y-6">
                            {/* Listado de Espacios Existentes con Cambio Inmediato */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                                <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <List className="w-5 h-5 text-indigo-600" /> Espacios de Trabajo Registrados
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Selecciona cualquier espacio para manipular sus datos, emisores y facturas de inmediato.
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                                        {empresas.length} Espacios
                                    </span>
                                </div>

                                {loadingEmpresas ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                                        {empresas.map((emp) => {
                                            const isSelected = activeEmpresa?.id === emp.id;
                                            const emisoresCount = emp.Emisors ? emp.Emisors.length : 0;

                                            return (
                                                <div 
                                                    key={emp.id} 
                                                    className={`py-3.5 px-3 rounded-xl flex items-center justify-between transition-colors ${
                                                        isSelected ? 'bg-indigo-50/70 border border-indigo-200/80' : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 text-sm">
                                                                {emp.nombre}
                                                            </span>
                                                            {isSelected ? (
                                                                <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                                                                    ACTIVO AHORA
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                    Activo
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                                            <span className="font-mono">ID: ESP-{String(emp.id).padStart(4, '0')}</span>
                                                            <span>•</span>
                                                            <span className={emisoresCount > 0 ? 'text-slate-600 font-medium' : 'text-amber-600 font-semibold'}>
                                                                {emisoresCount === 1 ? '1 emisor asociado' : `${emisoresCount} emisores asociados`}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        {isSelected ? (
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-100/60 px-3 py-1.5 rounded-lg border border-indigo-200">
                                                                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                                                <span>Espacio en uso</span>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCambiarEspacio(emp)}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600 text-slate-700 rounded-lg text-xs font-bold transition shadow-xs active:scale-95"
                                                            >
                                                                <span>Manipular este Espacio</span>
                                                                <ArrowRight className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {empresas.length === 0 && (
                                            <div className="text-center py-6 text-slate-400 text-sm font-medium">
                                                No hay espacios empresariales registrados.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Formulario para Crear Nueva Empresa */}
                            <form onSubmit={handleCrearEmpresa} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                                <div className="border-b border-slate-100 pb-4">
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Plus className="w-5 h-5 text-indigo-600" /> Crear Nuevo Espacio de Trabajo
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Registra un nuevo inquilino / workspace empresarial en la plataforma. Se activará inmediatamente para su configuración.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            Nombre del Nuevo Espacio
                                        </label>
                                        <input
                                            type="text"
                                            value={nombreNuevaEmpresa}
                                            onChange={(e) => setNombreNuevaEmpresa(e.target.value)}
                                            placeholder="Ej. NET CONSULTORES S.A. DE C.V."
                                            className="w-full px-4 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg text-sm transition-all outline-none bg-slate-50/30 font-medium text-slate-800"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-slate-100">
                                    <button
                                        type="submit"
                                        disabled={creandoEmpresa}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-bold shadow-sm shadow-indigo-600/10 transition-all active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" /> 
                                        {creandoEmpresa ? 'Creando y Activando...' : 'Crear y Activar Espacio'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Panel Lateral de Información y Recursos */}
                <div className="space-y-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 sticky top-20">
                        <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-1.5">
                            <Shield className="w-4 h-4 text-indigo-600" /> Información del Workspace
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Espacio Seleccionado</span>
                                <p className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-2.5 py-1.5 mt-0.5">
                                    {empresa?.nombre || 'Ninguno'}
                                </p>
                            </div>

                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Identificador único</span>
                                <p className="text-xs font-mono bg-white border border-slate-200 rounded px-2 py-1 text-slate-600 mt-0.5">
                                    ESP-{empresa?.id ? String(empresa.id).padStart(4, '0') : '0000'}
                                </p>
                            </div>

                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tu Rol Actual</span>
                                <p className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2.5 py-1 inline-block mt-0.5">
                                    {user?.rol || 'Operador'}
                                </p>
                            </div>

                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Usuario Conectado</span>
                                <p className="text-xs font-semibold text-slate-700 mt-0.5">{user?.nombre}</p>
                                <p className="text-[10px] text-slate-500">{user?.email}</p>
                            </div>

                            <div className="pt-2 border-t border-slate-200">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Emisor Activo en este Espacio</span>
                                {activeEmisor ? (
                                    <div className="flex flex-col mt-0.5 bg-white border border-slate-200 rounded-lg p-2.5">
                                        <span className="text-xs font-bold text-slate-800 truncate leading-snug">{activeEmisor.razon_social}</span>
                                        <span className="text-[10px] text-slate-500 font-mono leading-none mt-0.5">{activeEmisor.rfc}</span>
                                    </div>
                                ) : (
                                    <div className="mt-1 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-800 text-xs">
                                        <p className="font-semibold">Sin emisor activo</p>
                                        <p className="text-[10px] text-amber-700 mt-0.5">Este espacio no tiene emisores registrados o seleccionados.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
