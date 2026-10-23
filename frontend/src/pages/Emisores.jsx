import React, { useState, useEffect } from 'react';
import { Save, Upload, Building2, Key, FileText, CheckCircle2, Eye, Layout, Plus, Trash2, Hash, ArrowLeft, Globe, BadgeCheck, AlertTriangle, X, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

const PLANTILLAS_PDF = [
    { id: 'v1', name: 'Estándar' },
    { id: 'v2', name: 'Moderna' }, 
    { id: 'v3', name: 'Elegante' },
    { id: 'v4', name: 'Minimalista' },
    { id: 'v5', name: 'Corporativa' },
    { id: 'v6', name: 'Tecnológica' },
    { id: 'v7', name: 'Tradicional Pro' },
    { id: 'v8', name: 'Contemporánea' },
    { id: 'v9', name: 'Ejecutiva' },
    { id: 'v10', name: 'Gubernamental' },
    { id: 'v11', name: 'Industrial' },
    { id: 'v12', name: 'Premium Detail' }
];

export const Emisores = () => {
    const { 
        activeEmisor, 
        changeActiveEmisor, 
        activeEmpresa, 
        changeActiveEmpresa, 
        refreshActiveEmpresa, 
        user: currentUser 
    } = useAuth();
    const { showToast } = useToast();
    
    // Vista: 'list' (lista de emisores) o 'edit' (configuración de un emisor específico)
    const [view, setView] = useState('list');
    const [emisores, setEmisores] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [filtroEmpresa, setFiltroEmpresa] = useState('activa'); // 'activa' | 'todas'
    const [selectedEmisor, setSelectedEmisor] = useState(null);
    const [loadingList, setLoadingList] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);
    const [emisorToDelete, setEmisorToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);


    // Formulario de edición/configuración
    const [formData, setFormData] = useState({
        rfc: '',
        razon_social: '',
        regimen_fiscal: '601',
        codigo_postal: '',
        estado: '',
        municipio: '',
        colonia: '',
        modo_prueba: true,
        es_agapes: false,
        password_csd: ''
    });

    // Formulario de nuevo emisor
    const [newEmisorData, setNewEmisorData] = useState({
        rfc: '',
        razon_social: '',
        regimen_fiscal: '601',
        codigo_postal: '',
        estado: '',
        municipio: '',
        colonia: '',
        modo_prueba: true,
        es_agapes: false,
        empresa_id: ''
    });

    const [csdFiles, setCsdFiles] = useState({
        certificado: null,
        llave_privada: null
    });

    const [coloniasOpt, setColoniasOpt] = useState([]);
    const [coloniasNewOpt, setColoniasNewOpt] = useState([]);
    const [regimenesOpt, setRegimenesOpt] = useState([]);
    const [isFetchingCP, setIsFetchingCP] = useState(false);
    const [isFetchingNewCP, setIsFetchingNewCP] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [layoutId, setLayoutId] = useState('v1');
    const [series, setSeries] = useState([]);
    const [tiposDocOpt, setTiposDocOpt] = useState([]);
    const [newSerie, setNewSerie] = useState({ serie: '', ultimo_folio: 0, tipo_documento_id: '' });

    // Fetch emisores list
    const fetchEmisores = async () => {
        setLoadingList(true);
        try {
            const res = await api.get('/emisores');
            setEmisores(res.data);
        } catch (error) {
            console.error("Error fetching emisores list", error);
            showToast("Error al cargar la lista de emisores", "error");
        } finally {
            setLoadingList(false);
        }
    };

    // Fetch companies if Admin
    const fetchCompanies = async () => {
        if (currentUser.rol === 'Administrador') {
            try {
                const res = await api.get('/empresas');
                setEmpresas(res.data);
            } catch (error) {
                console.error("Error fetching companies", error);
            }
        }
    };


    // Fetch Global Catalogs on Mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const resRegimenes = await api.get('/catalogos/regimenes-fiscales');
                setRegimenesOpt(resRegimenes.data);
                
                try {
                    const resTipos = await api.get('/catalogos/tipos-documento');
                    if (resTipos.data && resTipos.data.length > 0) {
                        setTiposDocOpt(resTipos.data);
                    } else {
                        setTiposDocOpt([
                            { clave: 1, descripcion: 'FACTURA', tipo: 'I' },
                            { clave: 2, descripcion: 'RECIBO DE HONORARIOS', tipo: 'I' },
                            { clave: 3, descripcion: 'NOTA DE CRÉDITO', tipo: 'E' }
                        ]);
                    }
                } catch (e) {
                    setTiposDocOpt([
                        { clave: 1, descripcion: 'FACTURA', tipo: 'I' },
                        { clave: 2, descripcion: 'RECIBO DE HONORARIOS', tipo: 'I' },
                        { clave: 3, descripcion: 'NOTA DE CRÉDITO', tipo: 'E' }
                    ]);
                }
            } catch (error) {
                console.error("Error fetching global catalogs", error);
            }
        };
        
        fetchEmisores();
        fetchCompanies();
        fetchSettings();
    }, []);

    // Cargar detalles cuando se selecciona un emisor para editar
    useEffect(() => {
        if (selectedEmisor) {
            setFormData({
                rfc: selectedEmisor.rfc || '',
                razon_social: selectedEmisor.razon_social || '',
                regimen_fiscal: selectedEmisor.regimen_fiscal || '601',
                codigo_postal: selectedEmisor.codigo_postal || '',
                estado: selectedEmisor.estado || '',
                municipio: selectedEmisor.municipio || '',
                colonia: selectedEmisor.colonia || '',
                modo_prueba: selectedEmisor.modo_prueba !== false,
                es_agapes: selectedEmisor.es_agapes === true,
                password_csd: ''
            });
            setCsdFiles({ certificado: null, llave_privada: null });
            fetchEstilo(selectedEmisor.id);
            fetchSeries(selectedEmisor.id);
        }
    }, [selectedEmisor]);

    // SEPOMEX Autocomplete para formulario de configuración/edición
    useEffect(() => {
        const fetchSepomex = async () => {
            if (formData.codigo_postal && formData.codigo_postal.length === 5) {
                if (selectedEmisor &&
                    formData.codigo_postal === selectedEmisor.codigo_postal &&
                    formData.estado === selectedEmisor.estado &&
                    formData.municipio === selectedEmisor.municipio &&
                    formData.colonia === selectedEmisor.colonia &&
                    coloniasOpt.length === 0) {
                    try {
                        const res = await api.get(`/sepomex/cp/${formData.codigo_postal}`);
                        setColoniasOpt(res.data.colonias);
                        return;
                    } catch (e) { }
                }

                setIsFetchingCP(true);
                try {
                    const res = await api.get(`/sepomex/cp/${formData.codigo_postal}`);
                    setColoniasOpt(res.data.colonias);
                    if (res.data.colonias.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            estado: res.data.estado.nombre,
                            municipio: res.data.municipio.nombre,
                            colonia: prev.colonia && res.data.colonias.find(c => c.nombre === prev.colonia)
                                ? prev.colonia
                                : res.data.colonias[0].nombre
                        }));
                    }
                } catch (error) {
                    setColoniasOpt([]);
                    setFormData(prev => ({ ...prev, estado: '', municipio: '', colonia: '' }));
                } finally {
                    setIsFetchingCP(false);
                }
            } else if (!formData.codigo_postal || formData.codigo_postal.length < 5) {
                setColoniasOpt([]);
                if (formData.estado || formData.municipio || formData.colonia) {
                    setFormData(prev => ({ ...prev, estado: '', municipio: '', colonia: '' }));
                }
            }
        };
        fetchSepomex();
    }, [formData.codigo_postal, selectedEmisor]);

    // SEPOMEX Autocomplete para formulario de nuevo emisor
    useEffect(() => {
        const fetchNewSepomex = async () => {
            if (newEmisorData.codigo_postal && newEmisorData.codigo_postal.length === 5) {
                setIsFetchingNewCP(true);
                try {
                    const res = await api.get(`/sepomex/cp/${newEmisorData.codigo_postal}`);
                    setColoniasNewOpt(res.data.colonias);
                    if (res.data.colonias.length > 0) {
                        setNewEmisorData(prev => ({
                            ...prev,
                            estado: res.data.estado.nombre,
                            municipio: res.data.municipio.nombre,
                            colonia: res.data.colonias[0].nombre
                        }));
                    }
                } catch (error) {
                    setColoniasNewOpt([]);
                    setNewEmisorData(prev => ({ ...prev, estado: '', municipio: '', colonia: '' }));
                } finally {
                    setIsFetchingNewCP(false);
                }
            } else if (!newEmisorData.codigo_postal || newEmisorData.codigo_postal.length < 5) {
                setColoniasNewOpt([]);
                if (newEmisorData.estado || newEmisorData.municipio || newEmisorData.colonia) {
                    setNewEmisorData(prev => ({ ...prev, estado: '', municipio: '', colonia: '' }));
                }
            }
        };
        fetchNewSepomex();
    }, [newEmisorData.codigo_postal]);

    const fetchEstilo = async (emisorId) => {
        try {
            const { data } = await api.get(`/estilos/${emisorId}`);
            if (data && data.layout_id) {
                setLayoutId(data.layout_id);
            } else {
                setLayoutId('v1');
            }
        } catch (error) {
            setLayoutId('v1');
        }
    };

    const fetchSeries = async (emisorId) => {
        try {
            const { data } = await api.get(`/emisores/${emisorId}/series`);
            setSeries(data);
        } catch (error) {
            console.error("Error fetching series", error);
        }
    };

    const handlePreviewPdf = async () => {
        if (!selectedEmisor) return;
        setIsGeneratingPdf(true);
        try {
            const res = await api.post(`/emisores/${selectedEmisor.id}/preview-pdf`, { 
                layout_id: layoutId 
            });
            
            if (res.data && res.data.pdfUrl) {
                const baseUrl = (api.defaults.baseURL || '/api').replace('/api', '');
                const fullUrl = res.data.pdfUrl.startsWith('http') ? res.data.pdfUrl : `${baseUrl}${res.data.pdfUrl}`;
                
                const win = window.open(fullUrl, '_blank');
                if (!win) {
                    showToast('El navegador bloqueó la ventana emergente.', 'warning');
                }
            } else {
                throw new Error('No se recibió la URL del PDF');
            }
        } catch (error) {
            console.error('Error opening PDF preview', error);
            showToast(`Error al generar la vista previa: ${error.message}`, 'error');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleSave = async () => {
        if (!selectedEmisor) return;
        setSaving(true);
        try {
            const payload = { ...formData };
            if (!payload.password_csd) delete payload.password_csd;

            const resUpdate = await api.put(`/emisores/${selectedEmisor.id}`, payload);
            let updatedEmisor = resUpdate.data;

            if (csdFiles.certificado || csdFiles.llave_privada) {
                const formDataFiles = new FormData();
                if (csdFiles.certificado) formDataFiles.append('certificado', csdFiles.certificado);
                if (csdFiles.llave_privada) formDataFiles.append('llave_privada', csdFiles.llave_privada);
                if (formData.password_csd) formDataFiles.append('password_csd', formData.password_csd);

                const resFiles = await api.put(`/emisores/${selectedEmisor.id}/csd`, formDataFiles, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                updatedEmisor = resFiles.data.emisor;
            }

            await api.put(`/estilos/${selectedEmisor.id}`, { layout_id: layoutId });

            showToast('✅ Emisor y diseño actualizados con éxito');
            
            // Si el emisor editado es el emisor activo actual, actualizarlo en el AuthContext
            if (activeEmisor && activeEmisor.id === selectedEmisor.id) {
                changeActiveEmisor(updatedEmisor);
            }
            
            fetchEmisores();
            setView('list');
        } catch (error) {
            console.error('Error saving emisor', error);
            showToast(error.response?.data?.message || 'Error al guardar cambios', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateEmisor = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...newEmisorData };
            if (currentUser.rol === 'Administrador') {
                if (!payload.empresa_id && activeEmpresa?.id) {
                    payload.empresa_id = activeEmpresa.id;
                }
                if (!payload.empresa_id) {
                    showToast("Por favor selecciona una Empresa Destino para este emisor.", "error");
                    setSaving(false);
                    return;
                }
                payload.empresa_id = Number(payload.empresa_id);
            } else {
                delete payload.empresa_id; // El backend le asignará la empresa_id del usuario creador
            }


            const res = await api.post('/emisores', payload);
            showToast('✅ Emisor registrado correctamente');
            
            // Si no tiene emisor activo o se creó para la empresa activa, seleccionarlo
            if (!activeEmisor || activeEmpresa?.id === res.data.empresa_id) {
                changeActiveEmisor(res.data);
            }
            if (refreshActiveEmpresa) {
                await refreshActiveEmpresa();
            }

            setShowNewModal(false);
            setNewEmisorData({
                rfc: '', razon_social: '', regimen_fiscal: '601',
                codigo_postal: '', estado: '', municipio: '', colonia: '',
                modo_prueba: true, es_agapes: false, 
                empresa_id: activeEmpresa?.id ? String(activeEmpresa.id) : ''
            });
            fetchEmisores();
            fetchCompanies();
        } catch (error) {
            console.error('Error creating emisor', error);
            showToast(error.response?.data?.message || 'Error al registrar el emisor', 'error');
        } finally {
            setSaving(false);
        }
    };


    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            setCsdFiles(prev => ({ ...prev, [type]: file }));
        }
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleAddSerie = async () => {
        if (!newSerie.serie || !selectedEmisor) return;
        try {
            await api.post(`/emisores/${selectedEmisor.id}/series`, {
                ...newSerie,
                tipo_documento_id: newSerie.tipo_documento_id || null
            });
            showToast("✅ Serie agregada");
            setNewSerie({ serie: '', ultimo_folio: 0, tipo_documento_id: '' });
            fetchSeries(selectedEmisor.id);
        } catch (error) {
            showToast("No se pudo agregar la serie", "error");
        }
    };

    const handleDeleteSerie = async (serieId) => {
        if (!window.confirm('¿Eliminar esta serie?') || !selectedEmisor) return;
        try {
            await api.delete(`/emisores/${selectedEmisor.id}/series/${serieId}`);
            fetchSeries(selectedEmisor.id);
        } catch (error) {
            console.error("Error deleting serie", error);
        }
    };

    // Cambiar la empresa activa del sistema
    const handleSelectActive = (emisor) => {
        changeActiveEmisor(emisor);
        showToast(`Emisor activo cambiado a: ${emisor.razon_social}`);
    };

    const handleOpenNewModal = () => {
        setNewEmisorData({
            rfc: '', razon_social: '', regimen_fiscal: '601',
            codigo_postal: '', estado: '', municipio: '', colonia: '',
            modo_prueba: true, es_agapes: false,
            empresa_id: activeEmpresa?.id ? String(activeEmpresa.id) : ''
        });
        setShowNewModal(true);
    };

    // Filtrar emisores según el espacio activo seleccionado o todos
    const emisoresFiltrados = React.useMemo(() => {
        if (currentUser.rol === 'Administrador') {
            if (filtroEmpresa === 'activa' && activeEmpresa?.id) {
                return emisores.filter(e => e.empresa_id === activeEmpresa.id);
            }
        }
        return emisores;
    }, [emisores, filtroEmpresa, activeEmpresa, currentUser]);

    const canDelete = currentUser?.rol === 'Administrador' || currentUser?.rol === 'Usuario Empresarial';

    const handleConfirmDelete = async () => {
        if (!emisorToDelete) return;
        setIsDeleting(true);
        try {
            const res = await api.delete(`/emisores/${emisorToDelete.id}`);
            showToast(res.data?.message || 'Emisor eliminado con éxito');
            
            // Si el emisor eliminado era el activo, cambiar al siguiente emisor disponible o null
            if (activeEmisor?.id === emisorToDelete.id) {
                const remaining = emisores.filter(e => e.id !== emisorToDelete.id);
                const nextEmisor = remaining.find(e => !activeEmpresa?.id || e.empresa_id === activeEmpresa.id) || remaining[0] || null;
                changeActiveEmisor(nextEmisor);
            }
            
            if (refreshActiveEmpresa) {
                await refreshActiveEmpresa();
            }
            
            setEmisorToDelete(null);
            if (view === 'edit') {
                setView('list');
            }
            fetchEmisores();
            fetchCompanies();
        } catch (error) {
            console.error("Error al eliminar emisor:", error);
            showToast(error.response?.data?.message || 'Error al eliminar el emisor', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const renderDeleteModal = () => {
        if (!emisorToDelete) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100">
                    <div className="p-6">
                        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                            ¿Eliminar emisor fiscal?
                        </h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Estás a punto de eliminar al emisor <strong className="text-slate-800">{emisorToDelete.razon_social}</strong> (<span className="font-mono text-xs font-bold text-slate-700">{emisorToDelete.rfc}</span>).
                        </p>
                        
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2.5 mb-5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                                Si este emisor ya tiene comprobantes fiscales (CFDIs o pagos) emitidos, el sistema impedirá su eliminación para resguardar la validez contable y fiscal.
                            </span>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setEmisorToDelete(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm shadow-red-600/20 transition disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Eliminando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>Sí, eliminar emisor</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (view === 'list') {
        const emisoresDeEmpresaActivaCount = emisores.filter(e => e.empresa_id === activeEmpresa?.id).length;

        return (
            <div className="space-y-6 max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Emisores Facturación</h1>
                        <p className="text-slate-500 text-sm mt-1">Configura y administra las razones sociales y CSD de facturación.</p>
                    </div>
                    <button 
                        onClick={handleOpenNewModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 shadow-sm shadow-primary-500/20 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Emisor</span>
                    </button>
                </div>

                {/* Filtros de Espacio de Trabajo (Solo Administradores) */}
                {currentUser.rol === 'Administrador' && (
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                        <button
                            onClick={() => setFiltroEmpresa('activa')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                filtroEmpresa === 'activa' 
                                    ? 'bg-indigo-600 text-white shadow-xs' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Espacio Activo ({activeEmpresa?.nombre || 'Seleccionado'})</span>
                            <span className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                                filtroEmpresa === 'activa' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                                {emisoresDeEmpresaActivaCount}
                            </span>
                        </button>
                        <button
                            onClick={() => setFiltroEmpresa('todas')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                filtroEmpresa === 'todas' 
                                    ? 'bg-indigo-600 text-white shadow-xs' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <span>Todos los Espacios</span>
                            <span className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                                filtroEmpresa === 'todas' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                                {emisores.length}
                            </span>
                        </button>
                    </div>
                )}

                {/* Grid de Emisores */}
                {loadingList ? (
                    <div className="flex items-center justify-center h-64 text-slate-500 font-medium">
                        Cargando emisores...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {emisoresFiltrados.map(em => (
                            <div 
                                key={em.id} 
                                className={`bg-white rounded-xl border p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative ${
                                    activeEmisor?.id === em.id ? 'border-primary-500 ring-1 ring-primary-500/10' : 'border-slate-200'
                                }`}
                            >
                                {activeEmisor?.id === em.id && (
                                    <span className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
                                        <BadgeCheck className="w-3.5 h-3.5" /> Activo
                                    </span>
                                )}

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        {currentUser.rol === 'Administrador' && em.Empresa && (
                                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded max-w-[150px] truncate" title={em.Empresa.nombre}>
                                                🏢 {em.Empresa.nombre}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 leading-tight line-clamp-1 pr-16" title={em.razon_social}>
                                            {em.razon_social}
                                        </h3>
                                        <p className="text-xs text-slate-500 font-mono mt-0.5">{em.rfc}</p>
                                    </div>

                                    <div className="text-xs space-y-1 text-slate-600 pt-2">
                                        <p><span className="font-semibold text-slate-500">Régimen:</span> {em.regimen_fiscal}</p>
                                        <p><span className="font-semibold text-slate-500">Ubicación:</span> {em.municipio}, {em.estado}</p>
                                        <p className="flex items-center gap-1.5 mt-2">
                                            <span className={`w-2 h-2 rounded-full ${em.modo_prueba ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                                            <span className="font-semibold text-slate-500">Modo:</span> {em.modo_prueba ? 'Pruebas / Sandbox' : 'Producción'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100">
                                    <button 
                                        onClick={() => {
                                            setSelectedEmisor(em);
                                            setView('edit');
                                        }}
                                        className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition"
                                    >
                                        Configurar
                                    </button>
                                    {activeEmisor?.id !== em.id && (
                                        <button 
                                            onClick={() => handleSelectActive(em)}
                                            className="flex-1 py-1.5 bg-primary-50 hover:bg-primary-100/70 rounded-lg text-xs font-semibold text-primary-700 transition"
                                        >
                                            Seleccionar
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEmisorToDelete(em);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition"
                                            title="Eliminar este emisor"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Estado vacío cuando el espacio activo no tiene emisores */}
                        {emisoresFiltrados.length === 0 && currentUser.rol === 'Administrador' && filtroEmpresa === 'activa' && (
                            <div className="col-span-full bg-indigo-50/40 border-2 border-dashed border-indigo-200 rounded-xl p-10 text-center">
                                <Building2 className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
                                <h3 className="font-bold text-slate-800 text-base">
                                    El espacio "{activeEmpresa?.nombre || 'seleccionado'}" aún no tiene emisores
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                                    Registra el primer emisor fiscal (RFC, Razón Social, Certificados CSD) para este espacio empresarial para habilitar la facturación.
                                </p>
                                <button 
                                    onClick={handleOpenNewModal}
                                    className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95"
                                >
                                    + Registrar Emisor para {activeEmpresa?.nombre}
                                </button>
                            </div>
                        )}

                        {/* Estado vacío general si no hay emisores en el sistema */}
                        {emisoresFiltrados.length === 0 && (!currentUser.rol || currentUser.rol !== 'Administrador' || filtroEmpresa !== 'activa') && (
                            <div className="col-span-full bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
                                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <h3 className="font-bold text-slate-700">No hay emisores registrados</h3>
                                <p className="text-sm text-slate-500 mt-1">Registra tu primer emisor para comenzar a facturar en el sistema.</p>
                                <button 
                                    onClick={handleOpenNewModal}
                                    className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold rounded-lg transition"
                                >
                                    Agregar Emisor
                                </button>
                            </div>
                        )}
                    </div>
                )}


                {/* Modal de Nuevo Emisor */}
                {showNewModal && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                                <h3 className="font-bold text-slate-800">Agregar Nuevo Emisor</h3>
                                <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleCreateEmisor} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                                            RFC <span className="text-[10px] text-slate-400 font-normal">(Único para este emisor)</span>
                                        </label>
                                        <input required value={newEmisorData.rfc} onChange={e => setNewEmisorData({ ...newEmisorData, rfc: e.target.value.toUpperCase() })} type="text" maxLength="13" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm font-mono uppercase" placeholder="XAXX010101000" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Razón Social</label>
                                        <input required value={newEmisorData.razon_social} onChange={e => setNewEmisorData({ ...newEmisorData, razon_social: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm" placeholder="MI EMPRESA S.A. DE C.V." />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Régimen Fiscal</label>
                                        <select value={newEmisorData.regimen_fiscal} onChange={e => setNewEmisorData({ ...newEmisorData, regimen_fiscal: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm bg-white">
                                            {regimenesOpt.map(reg => (
                                                <option key={reg.clave} value={reg.clave}>{reg.clave} - {reg.descripcion}</option>
                                            ))}
                                            {regimenesOpt.length === 0 && <option value="601">601 - General de Ley Personas Morales</option>}
                                        </select>
                                    </div>

                                    {currentUser.rol === 'Administrador' && (
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa Destino</label>
                                            <select required value={newEmisorData.empresa_id} onChange={e => setNewEmisorData({ ...newEmisorData, empresa_id: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm bg-white">
                                                <option value="">Selecciona la empresa...</option>
                                                {empresas.map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Código Postal</label>
                                        <div className="relative">
                                            <input required value={newEmisorData.codigo_postal} onChange={e => setNewEmisorData({ ...newEmisorData, codigo_postal: e.target.value })} type="text" maxLength="5" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm" placeholder="26015" />
                                            {isFetchingNewCP && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Colonia</label>
                                        <select disabled={coloniasNewOpt.length === 0} value={newEmisorData.colonia} onChange={e => setNewEmisorData({ ...newEmisorData, colonia: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500">
                                            {coloniasNewOpt.length === 0 && <option value="">Ingresa el CP primero...</option>}
                                            {coloniasNewOpt.map(col => (
                                                <option key={col.id} value={col.nombre}>{col.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
                                        <input disabled value={newEmisorData.estado} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-medium" placeholder="Estado..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Municipio</label>
                                        <input disabled value={newEmisorData.municipio} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-medium" placeholder="Municipio..." />
                                    </div>

                                    <div className="col-span-2 flex items-center gap-3 bg-blue-50/50 p-4 rounded-lg border border-blue-100 mt-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={newEmisorData.modo_prueba} onChange={e => setNewEmisorData({ ...newEmisorData, modo_prueba: e.target.checked })} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">Modo de Pruebas (Sandbox)</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Permite emitir sin validez fiscal inmediata (SAT Sandbox).</p>
                                        </div>
                                    </div>

                                    <div className="col-span-2 flex items-center gap-3 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={newEmisorData.es_agapes} onChange={e => setNewEmisorData({ ...newEmisorData, es_agapes: e.target.checked })} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">Sector Primario (AGAPES)</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Activar si el emisor pertenece al sector primario. Exenta la retención de RESICO hasta alcanzar $900,000 MXN en el año fiscal.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
                                    <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors disabled:opacity-55">
                                        <Save className="w-4 h-4" /> Guardar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {renderDeleteModal()}
            </div>
        );
    }

    // configure/edit view
    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setView('list')}
                        className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"
                        title="Volver a la lista"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{selectedEmisor.razon_social}</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Edita la dirección fiscal, certificados CSD, diseños de PDF y foliadores.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    {canDelete && (
                        <button
                            type="button"
                            onClick={() => setEmisorToDelete(selectedEmisor)}
                            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 bg-white hover:bg-red-50 rounded-lg text-sm font-semibold transition"
                            title="Eliminar este emisor"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Eliminar</span>
                        </button>
                    )}
                    <button
                        onClick={handlePreviewPdf}
                        disabled={isGeneratingPdf}
                        className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
                    >
                        <Eye className={`w-4 h-4 ${isGeneratingPdf ? 'animate-pulse' : ''}`} />
                        <span className="hidden md:inline">{isGeneratingPdf ? 'Generando...' : 'Vista Previa PDF'}</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-500 shadow-sm shadow-primary-500/20 transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna Izquierda - Datos Fiscales */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            <h2 className="font-semibold text-slate-800">Datos Fiscales Generales</h2>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">RFC</label>
                                    <input name="rfc" value={formData.rfc} onChange={handleChange} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm font-mono uppercase bg-slate-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Razón Social</label>
                                    <input name="razon_social" value={formData.razon_social} onChange={handleChange} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="modo_prueba" checked={formData.modo_prueba} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Modo de Pruebas (Sandbox)</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Activa esta opción para certificar facturas sin valor fiscal frente al SAT a modo de práctica.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="es_agapes" checked={formData.es_agapes} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Sector Primario (AGAPES)</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Activar si perteneces al sector primario. Esto exenta la retención de RESICO hasta que tus facturas anuales superen el tope de $900,000.00 MXN.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Régimen Fiscal</label>
                                <select name="regimen_fiscal" value={formData.regimen_fiscal} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm bg-white">
                                    {regimenesOpt.map(reg => (
                                        <option key={reg.clave} value={reg.clave}>{reg.clave} - {reg.descripcion}</option>
                                    ))}
                                    {regimenesOpt.length === 0 && <option value="601">601 - General de Ley Personas Morales</option>}
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Domicilio de Expedición</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Código Postal</label>
                                        <div className="relative">
                                            <input name="codigo_postal" maxLength="5" value={formData.codigo_postal} onChange={handleChange} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
                                            {isFetchingCP && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>}
                                        </div>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Colonia</label>
                                        <select name="colonia" disabled={coloniasOpt.length === 0} value={formData.colonia} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-600">
                                            {coloniasOpt.length === 0 && <option value="">Seleccione al cargar CP...</option>}
                                            {coloniasOpt.map(col => (
                                                <option key={col.id} value={col.nombre}>{col.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Estado</label>
                                        <input disabled name="estado" value={formData.estado} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Municipio</label>
                                        <input disabled name="municipio" value={formData.municipio} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-medium" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Personalizar Diseño / Plantilla Global */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Palette className="w-5 h-5 text-primary-500" />
                                <h2 className="font-semibold text-slate-800">Personalizar Diseño</h2>
                            </div>
                            <span className="text-xs text-slate-500 hidden sm:inline">
                                Plantilla actual: <strong className="text-primary-700 font-bold">{PLANTILLAS_PDF.find(p => p.id === layoutId)?.name || 'Estándar'}</strong>
                            </span>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                Plantilla Global
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                {PLANTILLAS_PDF.map((v) => {
                                    const isSelected = layoutId === v.id;
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setLayoutId(v.id)}
                                            className={`p-3 border rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-1.5 shadow-2xs ${
                                                isSelected 
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold ring-2 ring-primary-100' 
                                                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Layout className={`w-4 h-4 mx-auto ${isSelected ? 'text-primary-600' : 'text-slate-600'}`} />
                                            <span>{v.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha - Certificados CSD */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Key className="w-5 h-5 text-slate-400" />
                                <h2 className="font-semibold text-slate-800">Certificado (CSD)</h2>
                            </div>
                            {selectedEmisor.certificado_path ? (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" /> Cargado
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="w-3 h-3" /> Faltante
                                </span>
                            )}
                        </div>

                        <div className="p-6 space-y-6">
                            <label className="text-center p-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer group block relative">
                                <input type="file" accept=".cer" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'certificado')} />
                                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2 group-hover:text-primary-500 transition-colors" />
                                <p className="text-xs font-semibold text-slate-700">Archivo CSD (.cer)</p>
                                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto truncate">
                                    {csdFiles.certificado ? `✔ ${csdFiles.certificado.name}` : (selectedEmisor.certificado_path ? 'Certificado en sistema' : 'Selecciona un archivo')}
                                </p>
                            </label>

                            <label className="text-center p-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer group block relative">
                                <input type="file" accept=".key" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'llave_privada')} />
                                <Key className="w-8 h-8 text-slate-400 mx-auto mb-2 group-hover:text-primary-500 transition-colors" />
                                <p className="text-xs font-semibold text-slate-700">Llave Privada (.key)</p>
                                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto truncate">
                                    {csdFiles.llave_privada ? `✔ ${csdFiles.llave_privada.name}` : (selectedEmisor.llave_privada_path ? 'Llave en sistema' : 'Selecciona un archivo')}
                                </p>
                            </label>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Contraseña del CSD</label>
                                <input type="password" name="password_csd" value={formData.password_csd} onChange={handleChange} placeholder="••••••••" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
                                <p className="text-[10px] text-slate-400 mt-1">Déjalo en blanco si no deseas actualizar la clave.</p>
                            </div>
                        </div>
                    </div>

                    {/* Foliadores por Tipo de Documento */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
                            <Hash className="w-5 h-5 text-slate-400" />
                            <h2 className="font-semibold text-slate-800">Foliadores por Tipo</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Serie</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ej. A"
                                            value={newSerie.serie}
                                            onChange={e => setNewSerie({...newSerie, serie: e.target.value.toUpperCase()})}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Folio</label>
                                        <input 
                                            type="number" 
                                            value={newSerie.ultimo_folio}
                                            onChange={e => setNewSerie({...newSerie, ultimo_folio: parseInt(e.target.value) || 0})}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Documento</label>
                                    <select 
                                        value={newSerie.tipo_documento_id}
                                        onChange={e => setNewSerie({...newSerie, tipo_documento_id: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                                    >
                                        <option value="">Cualquiera</option>
                                        {tiposDocOpt.map(t => (
                                            <option key={t.clave} value={t.clave}>{t.descripcion}</option>
                                        ))}
                                    </select>
                                </div>
                                <button 
                                    onClick={handleAddSerie}
                                    className="w-full flex items-center justify-center gap-2 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm shadow-primary-500/10"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Agregar Serie</span>
                                </button>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {series.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg group hover:border-slate-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center font-bold text-primary-600 text-xs">
                                                {s.serie}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">Folio: {s.ultimo_folio}</p>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase">
                                                    {tiposDocOpt.find(t => t.clave === s.tipo_documento_id)?.descripcion || 'General'}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteSerie(s.id)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {series.length === 0 && (
                                    <p className="text-center py-4 text-xs text-slate-400 italic">No hay series configuradas para este emisor.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {renderDeleteModal()}
        </div>
    );
};
