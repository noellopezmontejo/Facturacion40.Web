import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
    Building2, Save, Shield, Settings, Users, AlertCircle, 
    CheckCircle2, Plus, List, ArrowRight, Sparkles, Layers,
    Zap, Activity, Search, RefreshCw, FileText, Check, ShieldCheck, 
    History, ArrowUpRight, Filter, AlertTriangle, ExternalLink, Calendar, Hash, Key
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

    const isAdmin = user?.rol === 'Administrador';

    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') === 'pac' && isAdmin) ? 'pac' : 'espacios';
    const [activeTab, setActiveTab] = useState(initialTab);
    
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

    // Estados para Gestión y Servicios PAC SAT
    const [pacResumen, setPacResumen] = useState(null);
    const [loadingPac, setLoadingPac] = useState(false);
    const [emisoresList, setEmisoresList] = useState([]);
    const [historialFolios, setHistorialFolios] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [filtroEmisorHistorial, setFiltroEmisorHistorial] = useState('todos');

    // Modales de Servicios PAC
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [emisorToAssign, setEmisorToAssign] = useState(null);
    const [foliosToAssign, setFoliosToAssign] = useState(100);
    const [notasAsignacion, setNotasAsignacion] = useState('');
    const [asignandoFolios, setAsignandoFolios] = useState(false);

    const [probandoPing, setProbandoPing] = useState(false);
    const [pingResultado, setPingResultado] = useState(null);

    const [showSatModal, setShowSatModal] = useState(false);
    const [satUuidQuery, setSatUuidQuery] = useState('');
    const [satStatusResult, setSatStatusResult] = useState(null);
    const [loadingSatStatus, setLoadingSatStatus] = useState(false);

    const [showPeticionesModal, setShowPeticionesModal] = useState(false);
    const [emisorPeticiones, setEmisorPeticiones] = useState(null);
    const [peticionesResult, setPeticionesResult] = useState(null);
    const [loadingPeticiones, setLoadingPeticiones] = useState(false);

    // Modal de Credenciales PAC
    const [showCredencialesModal, setShowCredencialesModal] = useState(false);
    const [credencialesForm, setCredencialesForm] = useState({
        rfc_integrador: 'LOMC791127F35',
        usuario_integrador: '4cIoBiE1v5day42PhbSKxA==',
        password_integrador: '4cIoBiE1v5day42PhbSKxA==',
        modo_entorno: 'production'
    });
    const [guardandoCredenciales, setGuardandoCredenciales] = useState(false);

    // Forzar fallback a 'espacios' si el usuario no es Administrador y tiene seleccionada la pestaña 'pac'
    useEffect(() => {
        if (!isAdmin && activeTab === 'pac') {
            setActiveTab('espacios');
            setSearchParams({});
        }
    }, [isAdmin, activeTab]);

    // Actualizar URL cuando cambia la pestaña (solo permite 'pac' a administradores)
    const handleTabChange = (tabId) => {
        if (tabId === 'pac' && !isAdmin) return;
        setActiveTab(tabId);
        setSearchParams(tabId === 'pac' ? { tab: 'pac' } : {});
    };

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

    // Consultas globales de PAC SAT
    const fetchPacResumen = async () => {
        setLoadingPac(true);
        try {
            const { data } = await api.get('/pac/resumen-integrador');
            setPacResumen(data);
        } catch (error) {
            console.error("Error al consultar cuenta PAC:", error);
        } finally {
            setLoadingPac(false);
        }
    };

    const fetchEmisores = async () => {
        try {
            const { data } = await api.get('/emisores');
            setEmisoresList(data || []);
        } catch (error) {
            console.error("Error al cargar emisores:", error);
        }
    };

    const fetchHistorial = async () => {
        setLoadingHistorial(true);
        try {
            const { data } = await api.get('/pac/historial-folios');
            setHistorialFolios(data || []);
        } catch (error) {
            console.error("Error al cargar historial de folios:", error);
        } finally {
            setLoadingHistorial(false);
        }
    };

    useEffect(() => {
        fetchEmpresa();
        if (isAdmin) {
            fetchAllEmpresas();
            fetchPacResumen();
            fetchHistorial();
        }
        fetchEmisores();
    }, [activeEmpresa?.id, activeEmisor?.id, isAdmin]);

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
            await fetchEmisores();
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

    // Funciones PAC
    const handleDiagnosticoPing = async () => {
        setProbandoPing(true);
        setPingResultado(null);
        try {
            const { data } = await api.get('/pac/test-conexion');
            setPingResultado(data);
            if (data.success) {
                showToast(`⚡ Diagnóstico PAC exitoso (${data.latencia_ms} ms)`, 'success');
            } else {
                showToast(`⚠️ ${data.mensaje || 'Error en respuesta PAC'}`, 'warning');
            }
        } catch (error) {
            const msg = error.response?.data?.mensaje || error.response?.data?.message || 'Error de conexión';
            setPingResultado({ success: false, message: msg });
            showToast(`❌ ${msg}`, 'error');
        } finally {
            setProbandoPing(false);
        }
    };

    const handleAbrirAsignacion = (emisor = null) => {
        const em = emisor || (emisoresList.length > 0 ? emisoresList[0] : null);
        setEmisorToAssign(em);
        setFoliosToAssign(100);
        setNotasAsignacion('');
        setShowAssignModal(true);
    };

    const handleConfirmarAsignacion = async (e) => {
        if (e) e.preventDefault();
        if (!emisorToAssign || !foliosToAssign || foliosToAssign <= 0) {
            showToast('Selecciona un emisor e indica una cantidad de folios mayor a 0', 'warning');
            return;
        }

        setAsignandoFolios(true);
        try {
            const { data } = await api.post('/pac/asignar-folios', {
                emisor_id: emisorToAssign.id,
                no_timbres: Number(foliosToAssign),
                notas: notasAsignacion.trim() || undefined
            });

            showToast(data.mensaje || data.message || `✅ Se asignaron ${foliosToAssign} folios con éxito`);
            setShowAssignModal(false);

            // Refrescar saldos, emisores e historial
            await fetchPacResumen();
            await fetchEmisores();
            await fetchHistorial();
        } catch (error) {
            console.error('Error al asignar folios:', error);
            const msg = error.response?.data?.mensaje || error.response?.data?.message || error.response?.data?.error || 'Error al asignar folios en el PAC';
            showToast(`❌ ${msg}`, 'error');
        } finally {
            setAsignandoFolios(false);
        }
    };

    const handleConsultarSatUUID = async (e) => {
        if (e) e.preventDefault();
        if (!satUuidQuery || satUuidQuery.trim().length < 10) {
            showToast('Ingresa un UUID fiscal SAT válido (36 caracteres)', 'warning');
            return;
        }
        setLoadingSatStatus(true);
        setSatStatusResult(null);
        try {
            const { data } = await api.post('/pac/consulta-sat', {
                uuid: satUuidQuery.trim()
            });
            setSatStatusResult(data);
        } catch (error) {
            console.error('Error al consultar estatus SAT:', error);
            setSatStatusResult({
                success: false,
                error: error.response?.data?.mensaje || error.response?.data?.message || 'No fue posible consultar el UUID'
            });
        } finally {
            setLoadingSatStatus(false);
        }
    };

    const handleConsultarPeticiones = async (emisor) => {
        const target = emisor || (emisoresList.length > 0 ? emisoresList[0] : null);
        if (!target) {
            showToast('No hay emisores registrados para consultar peticiones', 'warning');
            return;
        }
        setEmisorPeticiones(target);
        setLoadingPeticiones(true);
        setPeticionesResult(null);
        setShowPeticionesModal(true);
        try {
            const { data } = await api.get(`/pac/peticiones-pendientes/${target.id}`);
            setPeticionesResult(data);
        } catch (error) {
            console.error('Error consultando peticiones SAT:', error);
            setPeticionesResult({
                success: false,
                error: error.response?.data?.mensaje || error.response?.data?.message || 'Error al consultar peticiones SAT'
            });
        } finally {
            setLoadingPeticiones(false);
        }
    };

    const handleAbrirCredencialesModal = async () => {
        try {
            const { data } = await api.get('/pac/credenciales');
            if (data.success) {
                setCredencialesForm({
                    rfc_integrador: data.rfc_integrador || 'LOMC791127F35',
                    usuario_integrador: data.usuario_integrador || '4cIoBiE1v5day42PhbSKxA==',
                    password_integrador: data.password_integrador || '4cIoBiE1v5day42PhbSKxA==',
                    modo_entorno: data.modo_entorno || 'production'
                });
            }
        } catch (e) {
            console.error('Error cargando credenciales PAC:', e);
        }
        setShowCredencialesModal(true);
    };

    const handleGuardarCredenciales = async (e) => {
        if (e) e.preventDefault();
        setGuardandoCredenciales(true);
        try {
            const { data } = await api.post('/pac/credenciales', credencialesForm);
            if (data.success) {
                showToast('✅ Credenciales del PAC guardadas y sincronizadas');
                setShowCredencialesModal(false);
                fetchPacResumen();
            } else {
                showToast(data.message || 'Error al guardar credenciales', 'error');
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Error al guardar credenciales PAC', 'error');
        } finally {
            setGuardandoCredenciales(false);
        }
    };

    // Emisores correspondientes al espacio empresarial actualmente activo
    const emisoresDelEspacioActivo = emisoresList.filter(em => 
        !empresa?.id || em.empresa_id === empresa.id
    );

    // Historial filtrado
    const historialFiltrado = historialFolios.filter(item => {
        if (filtroEmisorHistorial === 'todos') return true;
        return String(item.emisor_id) === String(filtroEmisorHistorial);
    });

    if (loading && !empresa.id) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16">
            {/* Encabezado Principal y Pestañas de Navegación */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Settings className="w-6 h-6 text-indigo-600" /> Configuración Global del Sistema
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {isAdmin 
                            ? 'Administra espacios empresariales (tenants), asigna folios del PAC y supervisa las herramientas SAT.'
                            : 'Administra la información y denominación de tu espacio de trabajo empresarial.'}
                    </p>
                </div>

                {/* Tabs */}
                {isAdmin ? (
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => handleTabChange('espacios')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'espacios'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Layers className="w-4 h-4" />
                            <span>Espacios de Trabajo</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('pac')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'pac'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span>Servicios y Folios PAC SAT</span>
                            {pacResumen?.creditos_disponibles !== undefined && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                    {Number(pacResumen.creditos_disponibles).toLocaleString()}
                                </span>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-indigo-700 self-start sm:self-auto">
                        <Layers className="w-4 h-4" />
                        <span>Espacio de Trabajo</span>
                    </div>
                )}
            </div>

            {/* PESTAÑA 1: GESTIÓN DE ESPACIOS EMPRESARIALES (TENANTS) */}
            {activeTab === 'espacios' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
                    <div className="md:col-span-2 space-y-6">
                        <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
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

                        {/* Listado de Espacios Registrados */}
                        {user?.rol === 'Administrador' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                                    <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <List className="w-5 h-5 text-indigo-600" /> Espacios de Trabajo Registrados
                                            </h2>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Selecciona cualquier espacio para manipular sus datos, emisores y folios de inmediato.
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
                                                                    <span>Activar y Gestionar</span>
                                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Formulario para Crear Nuevo Espacio */}
                                <form onSubmit={handleCrearEmpresa} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                                    <div className="border-b border-slate-100 pb-4">
                                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <Plus className="w-5 h-5 text-indigo-600" /> Crear Nuevo Espacio de Trabajo
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Registra un nuevo espacio empresarial en la plataforma. Se activará inmediatamente para su configuración y asignación de folios.
                                        </p>
                                    </div>

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

                    {/* Panel Lateral Informativo */}
                    <div className="space-y-6">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 sticky top-20">
                            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-1.5">
                                <Shield className="w-4 h-4 text-indigo-600" /> Resumen del Workspace
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

                                <div className="pt-2 border-t border-slate-200">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Emisores en este Espacio</span>
                                    <div className="mt-1 space-y-1.5">
                                        {emisoresDelEspacioActivo.map(em => (
                                            <div key={em.id} className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                                                <div className="overflow-hidden">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{em.razon_social}</p>
                                                    <p className="text-[10px] font-mono text-slate-400">{em.rfc}</p>
                                                </div>
                                                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
                                                    {Number(em.ultimos_folios_pac || 0).toLocaleString()} folios
                                                </span>
                                            </div>
                                        ))}
                                        {emisoresDelEspacioActivo.length === 0 && (
                                            <p className="text-xs text-slate-400 italic">No hay emisores en este espacio.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 2: SERVICIOS Y FOLIOS PAC SAT (PROFACT) - EXCLUSIVO SUPERUSUARIO / ADMINISTRADOR */}
            {isAdmin && activeTab === 'pac' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Tarjeta Resumen de Cuenta Integradora */}
                    <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-700/40 relative overflow-hidden">
                        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
                                        <Zap className="w-3 h-3 fill-current" /> Cuenta Integradora PAC
                                    </span>
                                    <span className="text-xs text-indigo-200/80 font-mono">PROFACT SAT No. 58073</span>
                                    {pacResumen?.rfc_cuenta && (
                                        <span className="text-[11px] font-mono font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10 text-amber-200">
                                            RFC: {pacResumen.rfc_cuenta}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-2xl font-black tracking-tight">
                                    Bolsa Maestra de Timbres Fiscales SAT
                                </h2>
                                <p className="text-sm text-indigo-200/80 mt-1 max-w-xl">
                                    Supervisa la disponibilidad de folios de tu cuenta integradora y transfiérelos a los emisores de cada espacio empresarial según lo requieran.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={fetchPacResumen}
                                    disabled={loadingPac}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/10 backdrop-blur-xs disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPac ? 'animate-spin' : ''}`} />
                                    <span>Sincronizar Saldo</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAbrirCredencialesModal}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/10 backdrop-blur-xs"
                                    title="Configurar credenciales del PAC"
                                >
                                    <Key className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Credenciales PAC</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAbrirAsignacion()}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition shadow-lg shadow-amber-400/20 active:scale-95"
                                >
                                    <Plus className="w-4 h-4 stroke-[3]" />
                                    <span>Asignar Timbres</span>
                                </button>
                            </div>
                        </div>

                        {/* Métricas del PAC */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-indigo-700/50">
                            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
                                <span className="text-[11px] text-indigo-200/80 block">Disponibles Asignación</span>
                                <span className="text-2xl font-black tracking-tight text-white block mt-0.5">
                                    {pacResumen ? Number(pacResumen.creditos_disponibles || 0).toLocaleString() : '—'}
                                </span>
                                <span className="text-[10px] text-emerald-400 font-bold mt-1 inline-flex items-center gap-1">
                                    ✔ Listos para transferir
                                </span>
                            </div>

                            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
                                <span className="text-[11px] text-indigo-200/80 block">Folios en Emisores</span>
                                <span className="text-2xl font-black tracking-tight text-amber-300 block mt-0.5">
                                    {pacResumen?.estadisticas_locales ? Number(pacResumen.estadisticas_locales.total_folios_en_emisores || 0).toLocaleString() : '—'}
                                </span>
                                <span className="text-[10px] text-indigo-200/70 mt-1 block">
                                    Repartidos en {pacResumen?.estadisticas_locales?.total_emisores || 0} emisores
                                </span>
                            </div>

                            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
                                <span className="text-[11px] text-indigo-200/80 block">Timbres Contratados</span>
                                <span className="text-2xl font-black tracking-tight text-white block mt-0.5">
                                    {pacResumen ? Number(pacResumen.creditos_totales || 0).toLocaleString() : '—'}
                                </span>
                                <span className="text-[10px] text-indigo-200/70 mt-1 block">
                                    Consumidos: {pacResumen ? Number(pacResumen.creditos_utilizados || 0).toLocaleString() : '0'}
                                </span>
                            </div>

                            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
                                <span className="text-[11px] text-indigo-200/80 block">Latencia & Entorno</span>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span className="text-sm font-bold text-white font-mono">
                                        {pacResumen?.latencia_ms ? `${pacResumen.latencia_ms} ms` : 'Online'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-indigo-200/70 mt-1 block">
                                    {pacResumen?.modo_prueba ? 'Ambiente Sandbox' : 'Ambiente Productivo'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE HERRAMIENTAS Y CONSULTAS PAC (4 BOTONES) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                                    Herramientas y Consultas PAC
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Acciones de diagnóstico, sincronización y consulta oficial directa ante el SAT y el proveedor PAC.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* 1. Asignar Timbres */}
                            <button
                                type="button"
                                onClick={() => handleAbrirAsignacion()}
                                className="group flex flex-col justify-between p-5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all shadow-xs hover:shadow-sm text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition mb-3">
                                    <Plus className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-900 transition">
                                        Asignar Timbres
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Transfiere folios de la cuenta integradora a cualquier emisor del sistema.
                                    </p>
                                </div>
                            </button>

                            {/* 2. Diagnóstico (Ping) */}
                            <button
                                type="button"
                                onClick={handleDiagnosticoPing}
                                disabled={probandoPing}
                                className="group flex flex-col justify-between p-5 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl transition-all shadow-xs hover:shadow-sm text-left disabled:opacity-50"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition mb-3">
                                    <Activity className={`w-5 h-5 ${probandoPing ? 'animate-spin' : ''}`} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-900 transition flex items-center gap-1.5">
                                        <span>Diagnóstico (Ping)</span>
                                        {pingResultado && (
                                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-bold">
                                                {pingResultado.latencia_ms}ms
                                            </span>
                                        )}
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Comprueba la conectividad y tiempo de respuesta en milisegundos con los servidores SOAP del PAC.
                                    </p>
                                </div>
                            </button>

                            {/* 3. Estatus SAT (UUID) */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSatStatusResult(null);
                                    setSatUuidQuery('');
                                    setShowSatModal(true);
                                }}
                                className="group flex flex-col justify-between p-5 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-all shadow-xs hover:shadow-sm text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition mb-3">
                                    <Search className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-emerald-900 transition">
                                        Estatus SAT (UUID)
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Verifica la vigencia oficial de cualquier factura directamente ante los servidores del SAT.
                                    </p>
                                </div>
                            </button>

                            {/* 4. Peticiones SAT */}
                            <button
                                type="button"
                                onClick={() => handleConsultarPeticiones()}
                                className="group flex flex-col justify-between p-5 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200 rounded-xl transition-all shadow-xs hover:shadow-sm text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-amber-50 group-hover:bg-amber-100 text-amber-600 flex items-center justify-center transition mb-3">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-amber-900 transition">
                                        Peticiones SAT
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Revisa solicitudes de cancelación de clientes pendientes de autorización o rechazo.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* SECCIÓN: EMISORES DEL ESPACIO GESTIONADO */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-indigo-600" />
                                    <span>Emisores en: </span>
                                    <span className="text-indigo-600">{empresa?.nombre || 'Espacio General'}</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Selecciona cualquier emisor de este espacio para agregarle folios de inmediato o inspeccionar su saldo.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleTabChange('espacios')}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 self-start sm:self-auto"
                            >
                                <span>Cambiar de Espacio</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {emisoresDelEspacioActivo.map((em) => (
                                <div 
                                    key={em.id} 
                                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-3 flex flex-col justify-between shadow-2xs"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-mono font-bold bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                                {em.rfc}
                                            </span>
                                            {em.registrado_pac ? (
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> PAC Activo
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Sin Alta PAC
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="font-bold text-slate-800 text-sm mt-2 line-clamp-1" title={em.razon_social}>
                                            {em.razon_social}
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {em.municipio ? `${em.municipio}, ` : ''}{em.estado || 'México'}
                                        </p>
                                    </div>

                                    <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Folios Disponibles</span>
                                            <span className="text-lg font-black text-slate-800 font-mono">
                                                {Number(em.ultimos_folios_pac || 0).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFiltroEmisorHistorial(String(em.id));
                                                    showToast(`Filtrando bitácora por ${em.rfc}`);
                                                }}
                                                className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition"
                                                title="Filtrar bitácora histórica de este emisor"
                                            >
                                                <History className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAbrirAsignacion(em)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs active:scale-95"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Asignar</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {emisoresDelEspacioActivo.length === 0 && (
                                <div className="col-span-full py-8 text-center text-slate-400">
                                    <Building2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                    <p className="text-sm font-semibold">No hay emisores dados de alta en este espacio.</p>
                                    <p className="text-xs mt-0.5">Ve al menú "Emisores" para registrar el primer RFC de este espacio.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECCIÓN: BITÁCORA / REGISTRO HISTÓRICO DE FOLIOS */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <History className="w-5 h-5 text-indigo-600" />
                                    <span>Bitácora de Asignación de Folios</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Registro inmutable de cuándo y cuántos folios se le agregaron a cada emisor.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                                    <select
                                        value={filtroEmisorHistorial}
                                        onChange={(e) => setFiltroEmisorHistorial(e.target.value)}
                                        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="todos">Todos los Emisores</option>
                                        {emisoresList.map(em => (
                                            <option key={em.id} value={String(em.id)}>
                                                {em.rfc} - {em.razon_social}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={fetchHistorial}
                                    disabled={loadingHistorial}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                                    title="Refrescar bitácora"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHistorial ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {loadingHistorial ? (
                            <div className="py-12 text-center text-slate-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                <span className="text-xs">Cargando bitácora de folios...</span>
                            </div>
                        ) : historialFiltrado.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="pb-3 font-semibold">Fecha y Hora</th>
                                            <th className="pb-3 font-semibold">Emisor (RFC)</th>
                                            <th className="pb-3 font-semibold">Espacio</th>
                                            <th className="pb-3 font-semibold text-center">Folios Agregados</th>
                                            <th className="pb-3 font-semibold">Saldo Anterior ➔ Nuevo</th>
                                            <th className="pb-3 font-semibold">Asignado por</th>
                                            <th className="pb-3 font-semibold">Notas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {historialFiltrado.map((h) => (
                                            <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="py-3 font-mono text-slate-600">
                                                    <span className="font-bold text-slate-800 block">
                                                        {new Date(h.createdAt).toLocaleDateString()}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <span className="font-bold text-slate-800 block line-clamp-1" title={h.Emisor?.razon_social}>
                                                        {h.Emisor?.razon_social || 'Emisor #' + h.emisor_id}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-indigo-600">
                                                        {h.Emisor?.rfc}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-slate-600">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium">
                                                        {h.Empresa?.nombre || 'General'}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-center">
                                                    <span className="inline-flex items-center gap-1 font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs">
                                                        +{Number(h.cantidad).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 font-mono text-slate-600">
                                                    <span className="text-slate-400">{Number(h.saldo_anterior).toLocaleString()}</span>
                                                    <span className="text-slate-300 mx-1.5">➔</span>
                                                    <span className="font-bold text-indigo-700">{Number(h.saldo_nuevo).toLocaleString()}</span>
                                                </td>
                                                <td className="py-3 text-slate-600">
                                                    <span className="font-medium text-slate-700 block">
                                                        {h.Usuario?.nombre || 'Sistema'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        {h.Usuario?.email || 'Admin'}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-slate-500 max-w-xs truncate" title={h.notas}>
                                                    {h.notas || 'Asignación PAC'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-10 text-center text-slate-400">
                                <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                <p className="text-sm font-semibold">No hay registros de folios asignados todavía.</p>
                                <p className="text-xs mt-0.5">Usa el botón "Asignar Timbres" para transferir los primeros folios a un emisor.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 1: ASIGNAR TIMBRES A EMISOR (SOLO ADMIN) */}
            {isAdmin && showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
                        <form onSubmit={handleConfirmarAsignacion} className="p-6 space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
                                        <Plus className="w-5 h-5 stroke-[3]" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base">Asignar Timbres al Emisor</h3>
                                        <p className="text-xs text-slate-400">Transferencia desde la Cuenta Integradora</p>
                                    </div>
                                </div>
                            </div>

                            {/* Selector de Emisor */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Emisor Destinatario
                                </label>
                                <select
                                    value={emisorToAssign?.id || ''}
                                    onChange={(e) => {
                                        const found = emisoresList.find(em => String(em.id) === e.target.value);
                                        setEmisorToAssign(found || null);
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none"
                                    required
                                >
                                    {emisoresList.map(em => (
                                        <option key={em.id} value={em.id}>
                                            {em.rfc} - {em.razon_social} (Actual: {Number(em.ultimos_folios_pac || 0).toLocaleString()} folios)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Cantidad de Timbres */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Cantidad de Timbres / Folios
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={foliosToAssign}
                                        onChange={(e) => setFoliosToAssign(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-base font-bold font-mono text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none"
                                        required
                                    />
                                    <span className="absolute right-3 top-3 text-xs text-slate-400 font-semibold">folios</span>
                                </div>

                                <div className="flex gap-2 mt-2">
                                    {[50, 100, 250, 500, 1000].map(cnt => (
                                        <button
                                            key={cnt}
                                            type="button"
                                            onClick={() => setFoliosToAssign(cnt)}
                                            className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-md border border-slate-200 transition"
                                        >
                                            +{cnt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notas / Referencia */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Motivo / Notas de la Asignación (Opcional)
                                </label>
                                <textarea
                                    value={notasAsignacion}
                                    onChange={(e) => setNotasAsignacion(e.target.value)}
                                    placeholder="Ej. Recarga mensual o paquete contratado"
                                    rows="2"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                                />
                            </div>

                            {/* Resumen del Saldo */}
                            {emisorToAssign && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 font-mono">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Saldo actual:</span>
                                        <span className="font-bold">{Number(emisorToAssign.ultimos_folios_pac || 0).toLocaleString()} folios</span>
                                    </div>
                                    <div className="flex justify-between text-emerald-600 font-bold">
                                        <span>A transferir:</span>
                                        <span>+{Number(foliosToAssign).toLocaleString()} folios</span>
                                    </div>
                                    <div className="flex justify-between text-slate-800 font-bold pt-1.5 border-t border-slate-200 text-sm">
                                        <span>Nuevo saldo emisor:</span>
                                        <span className="text-indigo-600">
                                            {(Number(emisorToAssign.ultimos_folios_pac || 0) + Number(foliosToAssign || 0)).toLocaleString()} folios
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    disabled={asignandoFolios}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={asignandoFolios}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
                                >
                                    {asignandoFolios ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            <span>Asignando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 stroke-[3]" />
                                            <span>Confirmar Asignación</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: ESTATUS SAT (UUID) (SOLO ADMIN) */}
            {isAdmin && showSatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                                        <Search className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base">Consulta de Estatus Oficial SAT</h3>
                                        <p className="text-xs text-slate-400">Verifica la validez fiscal de cualquier CFDI</p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleConsultarSatUUID} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                        Folio Fiscal (UUID del SAT)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. 12345678-ABCD-1234-ABCD-1234567890AB"
                                        value={satUuidQuery}
                                        onChange={(e) => setSatUuidQuery(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 uppercase outline-none focus:ring-2 focus:ring-emerald-100"
                                        required
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={loadingSatStatus}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
                                    >
                                        <Search className="w-3.5 h-3.5" />
                                        <span>{loadingSatStatus ? 'Consultando SAT...' : 'Consultar en SAT'}</span>
                                    </button>
                                </div>
                            </form>

                            {satStatusResult && (
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                        <span className="font-bold text-slate-700">Estado SAT:</span>
                                        <span className={`font-bold px-2.5 py-0.5 rounded-full ${
                                            satStatusResult.estado === 'Vigente'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-rose-100 text-rose-800'
                                        }`}>
                                            {satStatusResult.estado || 'No Encontrado'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Es Cancelable:</span>
                                        <span className="font-bold">{satStatusResult.es_cancelable || 'No'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Estatus Cancelación:</span>
                                        <span className="font-mono">{satStatusResult.estatus_cancelacion || 'Ninguno'}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowSatModal(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: PETICIONES SAT PENDIENTES (SOLO ADMIN) */}
            {isAdmin && showPeticionesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base">Peticiones de Cancelación SAT</h3>
                                        <p className="text-xs text-slate-400">Solicitudes que requieren autorización</p>
                                    </div>
                                </div>
                            </div>

                            {/* Selector de emisor para consultar */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Emisor a consultar
                                </label>
                                <select
                                    value={emisorPeticiones?.id || ''}
                                    onChange={(e) => {
                                        const found = emisoresList.find(em => String(em.id) === e.target.value);
                                        if (found) handleConsultarPeticiones(found);
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 bg-white"
                                >
                                    {emisoresList.map(em => (
                                        <option key={em.id} value={em.id}>
                                            {em.rfc} - {em.razon_social}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {loadingPeticiones ? (
                                <div className="py-8 text-center text-slate-400">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mx-auto mb-2"></div>
                                    <span className="text-xs">Consultando peticiones pendientes ante el SAT...</span>
                                </div>
                            ) : peticionesResult?.peticiones && peticionesResult.peticiones.length > 0 ? (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {peticionesResult.peticiones.map((p, idx) => (
                                        <div key={idx} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                                            <p className="font-mono font-bold text-slate-800">{p.uuid || p}</p>
                                            <p className="text-[11px] text-slate-600">Requiere aceptación o rechazo fiscal.</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center bg-slate-50 border border-slate-100 rounded-xl">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-700">Sin peticiones pendientes</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Este emisor no tiene solicitudes de cancelación SAT por responder.</p>
                                </div>
                            )}

                            <div className="flex justify-end pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowPeticionesModal(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIGURACIÓN CREDENCIALES PAC (SOLO ADMIN) */}
            {isAdmin && showCredencialesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
                        <form onSubmit={handleGuardarCredenciales} className="p-6 space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Key className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base">
                                            Credenciales de Cuenta PAC
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            PROFACT SAT Autorizado No. 58073
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCredencialesModal(false)}
                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                                >
                                    ✕
                                </button>
                            </div>

                            <p className="text-xs text-slate-500">
                                Configura la cuenta integradora que gestiona la bolsa maestra de timbres fiscales. Estos datos se aplicarán inmediatamente en el servidor.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        RFC de la Cuenta Integradora
                                    </label>
                                    <input
                                        type="text"
                                        value={credencialesForm.rfc_integrador}
                                        onChange={(e) => setCredencialesForm({ ...credencialesForm, rfc_integrador: e.target.value.toUpperCase() })}
                                        placeholder="Ej. LOMC791127F35"
                                        required
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Usuario / Token Integrador
                                    </label>
                                    <input
                                        type="text"
                                        value={credencialesForm.usuario_integrador}
                                        onChange={(e) => setCredencialesForm({ ...credencialesForm, usuario_integrador: e.target.value })}
                                        placeholder="Token Base64 o Usuario PAC"
                                        required
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Contraseña de Integrador
                                    </label>
                                    <input
                                        type="password"
                                        value={credencialesForm.password_integrador}
                                        onChange={(e) => setCredencialesForm({ ...credencialesForm, password_integrador: e.target.value })}
                                        placeholder="Contraseña del integrador"
                                        required
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Entorno del PAC
                                    </label>
                                    <select
                                        value={credencialesForm.modo_entorno}
                                        onChange={(e) => setCredencialesForm({ ...credencialesForm, modo_entorno: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="production">Producción Fiscal (Servidor oficial de timbrado)</option>
                                        <option value="sandbox">Sandbox / Pruebas (Servidor de pruebas)</option>
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Para consultar los timbres comprados y timbrar con validez fiscal SAT, selecciona <strong>Producción Fiscal</strong>.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCredencialesModal(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardandoCredenciales}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                                >
                                    {guardandoCredenciales ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            <span>Guardando y Verificando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-3.5 h-3.5" />
                                            <span>Guardar y Probar Conexión</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
