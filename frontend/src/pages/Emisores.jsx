import React, { useState, useEffect } from 'react';
import { Save, Upload, Building2, Key, FileText, CheckCircle2, Eye, Layout, Plus, Trash2, Hash, ArrowLeft, Globe, BadgeCheck, AlertTriangle, X, Palette, Image as ImageIcon, Sparkles, Pipette, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import { extractColorsFromImage, getDefaultPalettes } from '../utils/colorExtractor';

const PLANTILLAS_PDF = [
    { id: 'v1', name: 'Estándar Ejecutiva', tag: 'Corporativa', desc: 'Net Consultores Signature con tarjetas y desglose SAT' },
    { id: 'v2', name: 'Barra Lateral', tag: 'Moderna', desc: 'Sidebar corporativo elegante con QR y sellos ordenados' }, 
    { id: 'v3', name: 'Nórdica Clean', tag: 'Minimalista', desc: 'Estilo suizo minimalista con tipografía nítida y líneas finas' },
    { id: 'v4', name: 'Notarial Clásica', tag: 'Certificado', desc: 'Marco institucional formal para despachos y corporativos' },
    { id: 'v5', name: 'Horizon Cards', tag: 'Tarjetas Pro', desc: 'Tarjetas flotantes modernas con acentos en color primario' },
    { id: 'v6', name: 'Industrial ERP', tag: 'Gran Formato', desc: 'Alta densidad con código SKU y desglose de partidas' },
    { id: 'v7', name: 'Tradicional Pro', tag: 'SAT Clásico', desc: 'Formato tradicional SAT modernizado con recuadros limpios' },
    { id: 'v8', name: 'Contemporánea', tag: 'SaaS / FinTech', desc: 'Estilo fintech con chips dinámicos y degradados sutiles' },
    { id: 'v9', name: 'Prestige Gold', tag: 'Ejecutiva Top', desc: 'Acento corporativo profundo de alto prestigio y distinción' },
    { id: 'v10', name: 'Gubernamental', tag: 'Estricto SAT', desc: 'Matriz estricta de cumplimiento normativo y proveedores' },
    { id: 'v11', name: 'Split Dynamic', tag: 'Bicolor', desc: 'Encabezado asimétrico audaz con totales de alto contraste' },
    { id: 'v12', name: 'Compact Express', tag: 'Multi-partidas', desc: 'Optimizado para múltiples conceptos con máxima claridad' }
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
    const [colorPrimario, setColorPrimario] = useState('#004481');
    const [colorSecundario, setColorSecundario] = useState('#123247');
    const [suggestedPalettes, setSuggestedPalettes] = useState(getDefaultPalettes());
    const [dominantColors, setDominantColors] = useState([]);
    const [isExtractingColors, setIsExtractingColors] = useState(false);
    const [logoUrl, setLogoUrl] = useState(null);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [removeLogo, setRemoveLogo] = useState(false);
    const [newEmisorLogoFile, setNewEmisorLogoFile] = useState(null);
    const [newEmisorLogoPreview, setNewEmisorLogoPreview] = useState(null);
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
            setLogoFile(null);
            setLogoPreview(null);
            setRemoveLogo(false);
            fetchEstilo(selectedEmisor.id);
            fetchSeries(selectedEmisor.id);
        }
    }, [selectedEmisor]);

    // SEPOMEX Autocomplete para formulario de configuración/edición
    useEffect(() => {
        const fetchSepomex = async () => {
            if (formData.codigo_postal && formData.codigo_postal.length === 5) {
                setIsFetchingCP(true);
                try {
                    const res = await api.get(`/sepomex/cp/${formData.codigo_postal}`);
                    const cols = res.data.colonias || [];
                    setColoniasOpt(cols);

                    const estadoNombre = typeof res.data.estado === 'object'
                        ? (res.data.estado?.nombre || '')
                        : (res.data.estado || '');
                    const municipioNombre = typeof res.data.municipio === 'object'
                        ? (res.data.municipio?.nombre || '')
                        : (res.data.municipio || '');

                    setFormData(prev => {
                        const hasMatchingCol = prev.colonia && cols.find(c => c.nombre === prev.colonia);
                        return {
                            ...prev,
                            estado: estadoNombre || prev.estado,
                            municipio: municipioNombre || prev.municipio,
                            colonia: hasMatchingCol ? prev.colonia : (cols[0]?.nombre || prev.colonia || '')
                        };
                    });
                } catch (error) {
                    console.error("Error al consultar CP en emisor:", error);
                } finally {
                    setIsFetchingCP(false);
                }
            } else if (!formData.codigo_postal || formData.codigo_postal.length < 5) {
                setColoniasOpt([]);
            }
        };
        fetchSepomex();
    }, [formData.codigo_postal]);

    // SEPOMEX Autocomplete para formulario de nuevo emisor
    useEffect(() => {
        const fetchNewSepomex = async () => {
            if (newEmisorData.codigo_postal && newEmisorData.codigo_postal.length === 5) {
                setIsFetchingNewCP(true);
                try {
                    const res = await api.get(`/sepomex/cp/${newEmisorData.codigo_postal}`);
                    const cols = res.data.colonias || [];
                    setColoniasNewOpt(cols);

                    const estadoNombre = typeof res.data.estado === 'object'
                        ? (res.data.estado?.nombre || '')
                        : (res.data.estado || '');
                    const municipioNombre = typeof res.data.municipio === 'object'
                        ? (res.data.municipio?.nombre || '')
                        : (res.data.municipio || '');

                    setNewEmisorData(prev => {
                        const hasMatchingCol = prev.colonia && cols.find(c => c.nombre === prev.colonia);
                        return {
                            ...prev,
                            estado: estadoNombre || prev.estado,
                            municipio: municipioNombre || prev.municipio,
                            colonia: hasMatchingCol ? prev.colonia : (cols[0]?.nombre || prev.colonia || '')
                        };
                    });
                } catch (error) {
                    console.error("Error al consultar CP para nuevo emisor:", error);
                } finally {
                    setIsFetchingNewCP(false);
                }
            } else if (!newEmisorData.codigo_postal || newEmisorData.codigo_postal.length < 5) {
                setColoniasNewOpt([]);
            }
        };
        fetchNewSepomex();
    }, [newEmisorData.codigo_postal]);

    const fetchEstilo = async (emisorId) => {
        try {
            const { data } = await api.get(`/estilos/${emisorId}`);
            if (data) {
                setLayoutId(data.layout_id || 'v1');
                const savedLogoUrl = data.logo_url || null;
                setLogoUrl(savedLogoUrl);
                const pri = data.color_primario || '#004481';
                const sec = data.color_secundario || '#123247';
                setColorPrimario(pri);
                setColorSecundario(sec);

                if (savedLogoUrl) {
                    analyzeLogoColors(getFullLogoUrl(savedLogoUrl), pri, sec);
                } else {
                    setSuggestedPalettes(getDefaultPalettes());
                    setDominantColors([]);
                }
            }
        } catch (error) {
            setLayoutId('v1');
            setLogoUrl(null);
            setColorPrimario('#004481');
            setColorSecundario('#123247');
            setSuggestedPalettes(getDefaultPalettes());
            setDominantColors([]);
        }
    };

    const getFullLogoUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const baseUrl = (api.defaults.baseURL || '/api').replace('/api', '');
        return `${baseUrl}${url}`;
    };

    const analyzeLogoColors = async (imgSrc, currentPri, currentSec) => {
        const src = imgSrc || logoPreview || (logoUrl && !removeLogo ? getFullLogoUrl(logoUrl) : null);
        if (!src) {
            setSuggestedPalettes(getDefaultPalettes());
            setDominantColors([]);
            return;
        }
        setIsExtractingColors(true);
        try {
            const result = await extractColorsFromImage(src);
            setDominantColors(result.dominant || []);
            setSuggestedPalettes(result.palettes || []);

            // Si los colores actuales son los por defecto (#004481), pre-seleccionar la paleta armónica recomendada
            if (result.palettes && result.palettes.length > 0) {
                if (!currentPri || currentPri === '#004481') {
                    const rec = result.palettes[0];
                    setColorPrimario(rec.primary);
                    setColorSecundario(rec.secondary);
                }
            }
        } catch (err) {
            console.error('Error al analizar paleta del logo:', err);
            setSuggestedPalettes(getDefaultPalettes());
        } finally {
            setIsExtractingColors(false);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('El archivo debe ser una imagen válida (PNG, JPG, SVG, WEBP)', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast('El tamaño de la imagen no debe superar 5 MB', 'error');
            return;
        }

        setLogoFile(file);
        setRemoveLogo(false);
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            setLogoPreview(dataUrl);
            // Analizar y generar de inmediato paletas armónicas y de contraste desde la imagen
            analyzeLogoColors(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
        setRemoveLogo(true);
        setSuggestedPalettes(getDefaultPalettes());
        setDominantColors([]);
    };

    const handleSaveLogoQuick = async () => {
        if (!selectedEmisor) return;
        if (!logoFile && !removeLogo) {
            showToast('Selecciona una imagen para actualizar el logotipo.', 'warning');
            return;
        }
        setIsUploadingLogo(true);
        try {
            if (logoFile) {
                const formDataLogo = new FormData();
                formDataLogo.append('logo', logoFile);
                formDataLogo.append('layout_id', layoutId);
                formDataLogo.append('color_primario', colorPrimario);
                formDataLogo.append('color_secundario', colorSecundario);
                const res = await api.put(`/estilos/${selectedEmisor.id}`, formDataLogo, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                const newUrl = res.data?.estilo?.logo_url;
                setLogoUrl(newUrl);
                setLogoFile(null);
                setLogoPreview(null);
                showToast('✅ Logotipo y colores del emisor actualizados correctamente.');
                fetchEmisores();
            } else if (removeLogo) {
                await api.put(`/estilos/${selectedEmisor.id}`, { 
                    remove_logo: true, 
                    layout_id: layoutId,
                    color_primario: colorPrimario,
                    color_secundario: colorSecundario
                });
                setLogoUrl(null);
                setRemoveLogo(false);
                showToast('✅ Logotipo del emisor eliminado.');
                fetchEmisores();
            }
        } catch (err) {
            console.error('Error al guardar logo:', err);
            showToast(err.response?.data?.message || 'Error al guardar el logotipo', 'error');
        } finally {
            setIsUploadingLogo(false);
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
                layout_id: layoutId,
                color_primario: colorPrimario,
                color_secundario: colorSecundario
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
            const msg = error.response?.data?.message || error.response?.data?.error || error.message;
            showToast(`Error al generar la vista previa: ${msg}`, 'error');
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

            // Guardar estilo, logotipo y colores corporativos
            if (logoFile) {
                const formDataLogo = new FormData();
                formDataLogo.append('logo', logoFile);
                formDataLogo.append('layout_id', layoutId);
                formDataLogo.append('color_primario', colorPrimario);
                formDataLogo.append('color_secundario', colorSecundario);
                await api.put(`/estilos/${selectedEmisor.id}`, formDataLogo, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else if (removeLogo) {
                await api.put(`/estilos/${selectedEmisor.id}`, { 
                    remove_logo: true, 
                    layout_id: layoutId,
                    color_primario: colorPrimario,
                    color_secundario: colorSecundario
                });
            } else {
                await api.put(`/estilos/${selectedEmisor.id}`, { 
                    layout_id: layoutId,
                    color_primario: colorPrimario,
                    color_secundario: colorSecundario
                });
            }

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

            // Si se seleccionó un logotipo al registrar el emisor, subirlo a su configuración de estilo
            if (newEmisorLogoFile && res.data?.id) {
                try {
                    const formDataLogo = new FormData();
                    formDataLogo.append('logo', newEmisorLogoFile);
                    formDataLogo.append('layout_id', 'v1');
                    await api.put(`/estilos/${res.data.id}`, formDataLogo, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                } catch (logoErr) {
                    console.error('Error al subir logo del nuevo emisor:', logoErr);
                }
            }

            showToast('✅ Emisor registrado correctamente');
            
            // Si no tiene emisor activo o se creó para la empresa activa, seleccionarlo
            if (!activeEmisor || activeEmpresa?.id === res.data.empresa_id) {
                changeActiveEmisor(res.data);
            }
            if (refreshActiveEmpresa) {
                await refreshActiveEmpresa();
            }

            setShowNewModal(false);
            setNewEmisorLogoFile(null);
            setNewEmisorLogoPreview(null);
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
        setNewEmisorLogoFile(null);
        setNewEmisorLogoPreview(null);
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
                                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center p-1 shrink-0 shadow-2xs">
                                            {em.estilo?.logo_url ? (
                                                <img 
                                                    src={getFullLogoUrl(em.estilo.logo_url)} 
                                                    alt={em.razon_social} 
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <Building2 className="w-6 h-6 text-slate-400" />
                                            )}
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
                                        <input value={newEmisorData.estado} onChange={e => setNewEmisorData({ ...newEmisorData, estado: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 font-medium focus:ring-1 focus:ring-primary-500" placeholder="Estado..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Municipio / Ciudad</label>
                                        <input value={newEmisorData.municipio} onChange={e => setNewEmisorData({ ...newEmisorData, municipio: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 font-medium focus:ring-1 focus:ring-primary-500" placeholder="Municipio..." />
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

                                    {/* Logotipo Opcional para nuevo emisor */}
                                    <div className="col-span-2 p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Logotipo del Emisor <span className="text-[10px] text-slate-400 font-normal">(Opcional, para facturas PDF)</span>
                                        </label>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="w-14 h-14 rounded-lg bg-white border border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                                                {newEmisorLogoPreview ? (
                                                    <img src={newEmisorLogoPreview} alt="Logo preview" className="w-full h-full object-contain p-1" />
                                                ) : (
                                                    <ImageIcon className="w-6 h-6 text-slate-300" />
                                                )}
                                            </div>
                                            <div className="space-y-1 flex-1">
                                                <input
                                                    type="file"
                                                    id="new-emisor-logo-input"
                                                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        if (!file.type.startsWith('image/')) {
                                                            showToast('El archivo debe ser una imagen válida', 'error');
                                                            return;
                                                        }
                                                        if (file.size > 5 * 1024 * 1024) {
                                                            showToast('El tamaño no debe superar 5 MB', 'error');
                                                            return;
                                                        }
                                                        setNewEmisorLogoFile(file);
                                                        const reader = new FileReader();
                                                        reader.onload = () => setNewEmisorLogoPreview(reader.result);
                                                        reader.readAsDataURL(file);
                                                    }}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <label
                                                        htmlFor="new-emisor-logo-input"
                                                        className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition"
                                                    >
                                                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>{newEmisorLogoFile ? 'Cambiar imagen' : 'Seleccionar logo'}</span>
                                                    </label>
                                                    {newEmisorLogoFile && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNewEmisorLogoFile(null);
                                                                setNewEmisorLogoPreview(null);
                                                            }}
                                                            className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium transition"
                                                        >
                                                            Quitar
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400">PNG, JPG o WEBP con fondo transparente recomendado.</p>
                                            </div>
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
                                        <select name="colonia" value={formData.colonia || ''} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm bg-white">
                                            {coloniasOpt.length === 0 ? (
                                                <option value={formData.colonia || ''}>{formData.colonia || 'Ingrese CP para cargar colonias...'}</option>
                                            ) : (
                                                <>
                                                    <option value="">-- Seleccionar Colonia --</option>
                                                    {coloniasOpt.map(col => (
                                                        <option key={col.id} value={col.nombre}>{col.nombre}</option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Estado</label>
                                        <input name="estado" value={formData.estado || ''} onChange={handleChange} placeholder="Estado" type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 font-medium focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Municipio / Ciudad</label>
                                        <input name="municipio" value={formData.municipio || ''} onChange={handleChange} placeholder="Municipio o Ciudad" type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 font-medium focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Personalizar Diseño / Plantilla Global y Colores */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Palette className="w-5 h-5 text-primary-600" />
                                <div>
                                    <h2 className="font-semibold text-slate-800">Personalizar Diseño & Colores de Factura</h2>
                                    <p className="text-xs text-slate-500">Adecua o contrasta los tonos de tus CFDIs automáticamente con el logotipo de la empresa.</p>
                                </div>
                            </div>
                            <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full font-medium shadow-2xs">
                                Plantilla actual: <strong className="text-primary-700 font-bold">{PLANTILLAS_PDF.find(p => p.id === layoutId)?.name || 'Estándar'}</strong>
                            </span>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Selector de Plantilla */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                                    1. Selecciona el Modelo / Plantilla Global
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {PLANTILLAS_PDF.map((v) => {
                                        const isSelected = layoutId === v.id;
                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => setLayoutId(v.id)}
                                                className={`p-3 border rounded-xl text-left transition-all flex flex-col justify-between gap-2 shadow-2xs ${
                                                    isSelected 
                                                        ? 'border-primary-500 bg-primary-50/70 text-primary-900 ring-2 ring-primary-200 shadow-sm' 
                                                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        isSelected ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {v.tag}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-slate-400 font-bold">{v.id.toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold leading-tight text-slate-800">{v.name}</div>
                                                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{v.desc}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sección de Colores vinculados al Logotipo */}
                            <div className="pt-5 border-t border-slate-200/80 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                            2. Colores Corporativos (Armonizados o Contrastados con el Logo)
                                        </label>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Elige una paleta calculada directamente de la imagen de tu logotipo o personaliza los tonos a tu gusto.
                                        </p>
                                    </div>

                                    {(logoPreview || (logoUrl && !removeLogo)) ? (
                                        <button
                                            type="button"
                                            onClick={() => analyzeLogoColors()}
                                            disabled={isExtractingColors}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition active:scale-95 disabled:opacity-50 shrink-0"
                                        >
                                            {isExtractingColors ? (
                                                <>
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Analizando logo...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                                    <span>Re-sincronizar con logotipo</span>
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md shrink-0">
                                            💡 Sube un logo a la derecha para auto-adaptar colores
                                        </span>
                                    )}
                                </div>

                                {/* Chips de tonos extraídos del logotipo si existen */}
                                {dominantColors.length > 0 && (
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
                                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                                            <Pipette className="w-3.5 h-3.5 text-primary-600" /> Tonos detectados en el logotipo:
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {dominantColors.map((hex, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    title={`Usar ${hex} como color primario`}
                                                    onClick={() => setColorPrimario(hex)}
                                                    className="group flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 hover:border-primary-400 rounded-lg text-[11px] font-mono shadow-2xs transition"
                                                >
                                                    <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs group-hover:scale-110 transition-transform" style={{ backgroundColor: hex }} />
                                                    <span className="text-slate-700">{hex}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tarjetas de Paletas Inteligentes (Armonía, Contraste, etc.) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {suggestedPalettes.map((pal, idx) => {
                                        const isSelected = colorPrimario.toLowerCase() === pal.primary.toLowerCase() &&
                                                           colorSecundario.toLowerCase() === pal.secondary.toLowerCase();
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    setColorPrimario(pal.primary);
                                                    setColorSecundario(pal.secondary);
                                                }}
                                                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between relative group ${
                                                    isSelected
                                                        ? 'border-primary-500 bg-primary-50/50 shadow-sm ring-2 ring-primary-500/20'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60 shadow-2xs'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-slate-800 group-hover:text-primary-700 transition-colors">
                                                            {pal.title}
                                                        </span>
                                                        {pal.badge && (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                pal.isContrast 
                                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                                    : 'bg-primary-100 text-primary-800 border border-primary-200'
                                                            }`}>
                                                                {pal.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                                                        {pal.desc}
                                                    </p>
                                                </div>

                                                {/* Muestra visual de colores primario y secundario */}
                                                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-5 rounded-md flex items-center justify-center text-[10px] font-mono text-white font-semibold shadow-2xs" style={{ backgroundColor: pal.primary }}>
                                                            {pal.primary}
                                                        </div>
                                                        <div className="w-16 h-5 rounded-md flex items-center justify-center text-[10px] font-mono text-white font-semibold shadow-2xs" style={{ backgroundColor: pal.secondary }}>
                                                            {pal.secondary}
                                                        </div>
                                                        {isSelected && (
                                                            <div className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
                                                                <Check className="w-3 h-3 stroke-[3]" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between text-[9px] text-slate-400 font-medium px-0.5">
                                                        <span>Primario (Encabezados)</span>
                                                        <span>Secundario (Acento)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Ajuste fino manual de colores con color pickers */}
                                <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-semibold text-slate-700">Ajuste Fino Manual de Tonos</span>
                                        <span className="text-[10px] text-slate-400">Puedes escribir el código hexadecimal o usar el selector de color</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Color Primario */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                                Color Primario <span className="font-normal text-slate-400">(Banners, títulos de columnas, marcos)</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={colorPrimario}
                                                    onChange={(e) => setColorPrimario(e.target.value)}
                                                    className="w-10 h-10 p-1 rounded-lg border border-slate-300 cursor-pointer bg-white"
                                                />
                                                <input
                                                    type="text"
                                                    value={colorPrimario}
                                                    onChange={(e) => setColorPrimario(e.target.value)}
                                                    maxLength={7}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase bg-white focus:ring-1 focus:ring-primary-500"
                                                    placeholder="#004481"
                                                />
                                            </div>
                                        </div>

                                        {/* Color Secundario */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                                Color Secundario / Acento <span className="font-normal text-slate-400">(Totales, foliadores, líneas)</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={colorSecundario}
                                                    onChange={(e) => setColorSecundario(e.target.value)}
                                                    className="w-10 h-10 p-1 rounded-lg border border-slate-300 cursor-pointer bg-white"
                                                />
                                                <input
                                                    type="text"
                                                    value={colorSecundario}
                                                    onChange={(e) => setColorSecundario(e.target.value)}
                                                    maxLength={7}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase bg-white focus:ring-1 focus:ring-primary-500"
                                                    placeholder="#123247"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Miniatura de Previsualización en Vivo de la Factura */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Previsualización del Estilo en la Factura</span>
                                        <button
                                            type="button"
                                            onClick={handlePreviewPdf}
                                            disabled={isGeneratingPdf}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
                                        >
                                            <Eye className={`w-3.5 h-3.5 ${isGeneratingPdf ? 'animate-pulse' : ''}`} />
                                            <span>{isGeneratingPdf ? 'Generando PDF...' : 'Ver PDF Completo'}</span>
                                        </button>
                                    </div>

                                    {/* Mockup visual dinámico premium */}
                                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3 font-sans">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px]">
                                            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorPrimario }} />
                                                <span>Plantilla: <strong>{PLANTILLAS_PDF.find(p => p.id === layoutId)?.name || 'Estándar'}</strong></span>
                                                <span className="text-[10px] text-primary-700 font-bold bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                                                    {PLANTILLAS_PDF.find(p => p.id === layoutId)?.tag}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-400">CFDI v4.0 &bull; Ingreso</span>
                                        </div>

                                        {layoutId === 'v2' ? (
                                            /* Layout v2: Barra Lateral */
                                            <div className="flex rounded-lg overflow-hidden border border-slate-200 min-h-[220px]">
                                                {/* Sidebar */}
                                                <div className="w-1/3 p-3 text-white flex flex-col justify-between" style={{ backgroundColor: colorSecundario }}>
                                                    <div className="space-y-2">
                                                        <div className="w-12 h-10 bg-white rounded p-1 flex items-center justify-center">
                                                             {(logoPreview || (logoUrl && !removeLogo)) ? (
                                                                 <img src={logoPreview || getFullLogoUrl(logoUrl)} alt="Logo" className="max-h-full max-w-full object-contain" />
                                                             ) : (
                                                                 <Building2 className="w-5 h-5 text-slate-700" />
                                                             )}
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase leading-tight">{selectedEmisor?.razon_social || 'MI EMPRESA S.A. DE C.V.'}</p>
                                                            <p className="text-[9px] opacity-80 font-mono mt-0.5">{selectedEmisor?.rfc || 'XAXX010101000'}</p>
                                                        </div>
                                                        <div className="text-[8px] opacity-75 leading-tight pt-1 border-t border-white/20">
                                                            <p>C.P. {selectedEmisor?.codigo_postal || '29960'}</p>
                                                            <p>Régimen: 601 General Ley</p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white/10 rounded p-1.5 text-center text-[8px] font-mono">
                                                        QR SAT &bull; TIMBRADO
                                                    </div>
                                                </div>
                                                {/* Content */}
                                                <div className="w-2/3 p-3 bg-slate-50/50 flex flex-col justify-between space-y-2">
                                                    <div className="flex justify-between items-start border-b border-slate-200 pb-1.5">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-slate-800">FACTURA A-1024</span>
                                                            <p className="text-[8px] text-slate-400">UUID: 4E70B182-E7A9-4C35-8EF6...</p>
                                                        </div>
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: colorPrimario }}>PUE</span>
                                                    </div>
                                                    <div className="bg-white p-2 rounded border border-slate-200 text-[9px] space-y-0.5">
                                                         <p className="font-bold text-slate-800">CLIENTE: CORPORATIVO EMPRESARIAL DEL SURESTE</p>
                                                         <p className="text-[8px] text-slate-500">RFC: CES180420KM9 &bull; Uso: G03 Gastos en general</p>
                                                    </div>
                                                    <div className="bg-white rounded border border-slate-200 text-[8.5px] divide-y divide-slate-100">
                                                         <div className="p-1.5 flex justify-between">
                                                             <span>Servicios Facturación Electrónica CFDI 4.0</span>
                                                             <span className="font-bold text-slate-800">$1,500.00</span>
                                                         </div>
                                                         <div className="p-1.5 flex justify-between">
                                                             <span>Licencia Timbrado Multi-Serie SAT</span>
                                                             <span className="font-bold text-slate-800">$1,000.00</span>
                                                         </div>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                         <div className="text-right px-3 py-1 rounded text-white" style={{ backgroundColor: colorPrimario }}>
                                                             <span className="text-[8px] opacity-80 uppercase block">Total a Pagar</span>
                                                             <span className="text-xs font-bold">$2,900.00 MXN</span>
                                                         </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Layout Estándar / Corporativo / Horizon / Notarial */
                                            <div className="space-y-2.5">
                                                {/* Header Mockup */}
                                                <div
                                                    className="rounded-lg p-3 text-white flex items-center justify-between transition-colors shadow-2xs"
                                                    style={{ backgroundColor: colorPrimario }}
                                                >
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold uppercase">{selectedEmisor?.razon_social || 'MI EMPRESA S.A. DE C.V.'}</span>
                                                            <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded font-bold">CFDI 4.0</span>
                                                        </div>
                                                        <p className="text-[10px] opacity-90 font-mono">RFC: {selectedEmisor?.rfc || 'XAXX010101000'} &bull; SERIE A &bull; FOLIO 1024</p>
                                                        <p className="text-[8.5px] opacity-75">Lugar de Expedición: C.P. {selectedEmisor?.codigo_postal || '29960'} &bull; Régimen: 601</p>
                                                    </div>
                                                    <div className="w-12 h-11 bg-white rounded-md p-1 flex items-center justify-center shrink-0 shadow-xs">
                                                        {(logoPreview || (logoUrl && !removeLogo)) ? (
                                                            <img
                                                                src={logoPreview || getFullLogoUrl(logoUrl)}
                                                                alt="Logo preview"
                                                                className="max-h-full max-w-full object-contain"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <Building2 className="w-5 h-5 text-slate-700" />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* UUID Bar */}
                                                <div className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 flex items-center justify-between text-[9px]">
                                                    <span className="text-slate-500 font-bold uppercase text-[8px]">Folio Fiscal (UUID SAT):</span>
                                                    <span className="font-mono font-bold text-slate-800">4E70B182-E7A9-4C35-8EF6-8FA485C1766C</span>
                                                </div>

                                                {/* Receptor Info Card */}
                                                <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200 text-[9px] grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase block">Receptor:</span>
                                                        <p className="font-bold text-slate-800">CORPORATIVO EMPRESARIAL DEL SURESTE</p>
                                                        <p className="text-slate-500">RFC: CES180420KM9 &bull; C.P. 06600</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase block">Condiciones Fiscales:</span>
                                                        <p className="text-slate-700">Forma: 03 Transferencia &bull; Método: PUE</p>
                                                        <p className="text-slate-500">Uso: G03 Gastos en general &bull; Moneda: MXN</p>
                                                    </div>
                                                </div>

                                                {/* Concepts Table */}
                                                <div className="rounded-lg overflow-hidden border border-slate-200 bg-white text-[9.5px]">
                                                    <div
                                                        className="px-3 py-1.5 font-bold uppercase text-white flex justify-between transition-colors text-[8.5px]"
                                                        style={{ backgroundColor: colorPrimario }}
                                                    >
                                                        <span>Concepto / Partida & Desglose Fiscal SAT</span>
                                                        <span>Importe</span>
                                                    </div>
                                                    <div className="p-2 border-b border-slate-100 flex justify-between items-start">
                                                        <div>
                                                            <p className="font-semibold text-slate-800">1.00 E48 - SERVICIOS FACTURACIÓN ELECTRÓNICA CFDI 4.0</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5 text-[8px] text-slate-500">
                                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">SAT 84111506</span>
                                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded">IVA 16% (+$240.00)</span>
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-slate-800">$1,500.00</span>
                                                    </div>
                                                    <div className="p-2 flex justify-between items-start bg-slate-50/40">
                                                        <div>
                                                            <p className="font-semibold text-slate-800">2.00 H87 - LICENCIA DE TIMBRADO SAT MULTI-SERIE</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5 text-[8px] text-slate-500">
                                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">SAT 43231500</span>
                                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded">IVA 16% (+$160.00)</span>
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-slate-800">$1,000.00</span>
                                                    </div>
                                                </div>

                                                {/* Amount in words & Totals */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                                                    <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[8.5px]">
                                                        <span className="text-[7.5px] font-bold text-slate-400 uppercase block">Importe con Letra:</span>
                                                        <span className="font-bold text-slate-700">SON: DOS MIL NOVECIENTOS PESOS 00/100 M.N.</span>
                                                    </div>

                                                    <div className="flex justify-end">
                                                         <div
                                                             className="px-4 py-2 rounded-lg text-white text-right space-y-0.5 shadow-2xs transition-colors w-full sm:w-auto"
                                                             style={{ backgroundColor: colorSecundario }}
                                                         >
                                                             <div className="flex justify-between gap-4 text-[8.5px] opacity-85">
                                                                 <span>Subtotal: $2,500.00</span>
                                                                 <span>IVA (16%): $400.00</span>
                                                             </div>
                                                             <div className="text-sm font-bold flex justify-between gap-4 pt-0.5 border-t border-white/20">
                                                                 <span>TOTAL NETO:</span>
                                                                 <span>$2,900.00 MXN</span>
                                                             </div>
                                                         </div>
                                                     </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha - Logotipo y Certificados CSD */}
                <div className="space-y-6">
                    {/* Logotipo del Emisor */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-primary-600" />
                                <h2 className="font-semibold text-slate-800">Logotipo del Emisor</h2>
                            </div>
                            {(logoPreview || (logoUrl && !removeLogo)) ? (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" /> Configurado
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="w-3 h-3" /> Sin logo
                                </span>
                            )}
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Preview Container */}
                            <div className="w-full h-36 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center p-3 relative overflow-hidden group">
                                {logoPreview ? (
                                    <img
                                        src={logoPreview}
                                        alt="Nuevo logotipo"
                                        className="max-h-full max-w-full object-contain"
                                    />
                                ) : (logoUrl && !removeLogo) ? (
                                    <img
                                        src={getFullLogoUrl(logoUrl)}
                                        alt={selectedEmisor.razon_social}
                                        className="max-h-full max-w-full object-contain"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <div className="text-center text-slate-400">
                                        <ImageIcon className="w-10 h-10 mx-auto mb-1 opacity-40" />
                                        <p className="text-xs font-medium text-slate-600">Sin logotipo asignado</p>
                                        <p className="text-[10px] text-slate-400">Aparecerá en el encabezado de las facturas PDF</p>
                                    </div>
                                )}
                            </div>

                            {/* Buttons / Actions */}
                            <div className="space-y-2">
                                <input
                                    type="file"
                                    id="emisor-logo-upload-input"
                                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                    className="hidden"
                                    onChange={handleLogoChange}
                                />
                                <div className="flex items-center gap-2">
                                    <label
                                        htmlFor="emisor-logo-upload-input"
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>{(logoPreview || (logoUrl && !removeLogo)) ? 'Cambiar Logotipo' : 'Subir Logotipo'}</span>
                                    </label>

                                    {(logoPreview || (logoUrl && !removeLogo)) && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveLogo}
                                            className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition"
                                            title="Quitar logotipo"
                                        >
                                            Quitar
                                        </button>
                                    )}
                                </div>

                                {(logoFile || removeLogo) && (
                                    <button
                                        type="button"
                                        onClick={handleSaveLogoQuick}
                                        disabled={isUploadingLogo}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                                    >
                                        {isUploadingLogo ? (
                                            <>
                                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                <span>Guardando logotipo...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-3.5 h-3.5" />
                                                <span>Guardar Logotipo Inmediatamente</span>
                                            </>
                                        )}
                                    </button>
                                )}

                                <p className="text-[10px] text-slate-400 text-center">
                                    Formatos recomendados: PNG o JPG con fondo transparente (máx. 5 MB).
                                </p>
                            </div>
                        </div>
                    </div>

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
