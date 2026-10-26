import React, { useState, useEffect } from 'react';
import { Save, Upload, Building2, Key, FileText, CheckCircle2, Eye, Layout, Plus, Trash2, Hash, ArrowLeft, Globe, BadgeCheck, AlertTriangle, X, Palette, Image as ImageIcon, Sparkles, Pipette, Check, RefreshCw, ShieldCheck, Zap, Server, Activity, Search, ExternalLink, HelpCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
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

    // Estados para Operaciones y Servicios PAC SAT (Profact)
    const [pacData, setPacData] = useState({
        timbres: null,
        loadingTimbres: false,
        registrando: false,
        asignando: false,
        probandoConexion: false,
        conexionResultado: null
    });
    const [foliosToAssign, setFoliosToAssign] = useState(100);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [satUuidQuery, setSatUuidQuery] = useState('');
    const [satStatusResult, setSatStatusResult] = useState(null);
    const [loadingSatStatus, setLoadingSatStatus] = useState(false);
    const [showSatModal, setShowSatModal] = useState(false);
    const [showPeticionesModal, setShowPeticionesModal] = useState(false);
    const [peticionesResult, setPeticionesResult] = useState(null);
    const [loadingPeticiones, setLoadingPeticiones] = useState(false);
    const [showConfirmPACRegModal, setShowConfirmPACRegModal] = useState(false);

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
            fetchPacFolios(selectedEmisor.id);
            setPacData(prev => ({ ...prev, conexionResultado: null }));
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
                const newUrl = res.data?.estilo?.logo_url || res.data?.logo_url;
                if (newUrl) setLogoUrl(newUrl);
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

    // Funciones de Operaciones PAC SAT (Profact)
    const fetchPacFolios = async (emisorId) => {
        if (!emisorId) return;
        setPacData(prev => ({ ...prev, loadingTimbres: true }));
        try {
            const res = await api.get(`/emisores/${emisorId}/pac/folios`);
            if (res.data) {
                setPacData(prev => ({
                    ...prev,
                    timbres: res.data,
                    loadingTimbres: false
                }));
                setSelectedEmisor(prev => prev ? ({
                    ...prev,
                    ultimos_folios_pac: res.data.disponibles ?? prev.ultimos_folios_pac
                }) : prev);
            }
        } catch (error) {
            console.error('Error al consultar folios PAC:', error);
            setPacData(prev => ({ ...prev, loadingTimbres: false }));
        }
    };

    const handleRegistrarPAC = async () => {
        if (!selectedEmisor) return;

        // Validar CSD
        const hasCer = selectedEmisor.certificado_path || csdFiles.certificado;
        const hasKey = selectedEmisor.llave_privada_path || csdFiles.llave_privada;

        if (!hasCer || !hasKey) {
            showToast('Para registrar el emisor en el PAC, debes cargar primero los archivos de Certificado (.cer) y Llave (.key)', 'error');
            return;
        }

        setPacData(prev => ({ ...prev, registrando: true }));
        try {
            const res = await api.post(`/emisores/${selectedEmisor.id}/pac/registrar`, {
                password_csd: formData.password_csd || undefined
            });
            showToast(res.data?.message || '✅ Emisor registrado y sincronizado en el PAC SAT con éxito');
            setSelectedEmisor(prev => prev ? ({
                ...prev,
                registrado_pac: true,
                fecha_registro_pac: new Date().toISOString()
            }) : prev);
            setShowConfirmPACRegModal(false);
            fetchPacFolios(selectedEmisor.id);
            fetchEmisores();
        } catch (error) {
            console.error('Error al registrar emisor en PAC:', error);
            const msg = error.response?.data?.message || error.response?.data?.error || 'Error al comunicar con el PAC SAT';
            showToast(`❌ ${msg}`, 'error');
        } finally {
            setPacData(prev => ({ ...prev, registrando: false }));
        }
    };

    const handleAsignarFoliosPAC = async (e) => {
        if (e) e.preventDefault();
        if (!selectedEmisor || !foliosToAssign || foliosToAssign <= 0) {
            showToast('Indica una cantidad de folios mayor a 0', 'warning');
            return;
        }
        setPacData(prev => ({ ...prev, asignando: true }));
        try {
            const res = await api.post(`/emisores/${selectedEmisor.id}/pac/asignar-folios`, {
                no_timbres: Number(foliosToAssign)
            });
            showToast(res.data?.message || `✅ Se asignaron ${foliosToAssign} folios exitosamente`);
            setShowAssignModal(false);
            fetchPacFolios(selectedEmisor.id);
            fetchEmisores();
        } catch (error) {
            console.error('Error al asignar folios PAC:', error);
            const msg = error.response?.data?.message || 'Error al asignar folios en el PAC';
            showToast(`❌ ${msg}`, 'error');
        } finally {
            setPacData(prev => ({ ...prev, asignando: false }));
        }
    };

    const handleTestConexionPAC = async () => {
        if (!selectedEmisor) return;
        setPacData(prev => ({ ...prev, probandoConexion: true, conexionResultado: null }));
        try {
            const res = await api.get(`/emisores/${selectedEmisor.id}/pac/test-conexion`);
            setPacData(prev => ({ ...prev, conexionResultado: res.data, probandoConexion: false }));
            if (res.data?.success) {
                showToast(`⚡ Conexión exitosa con el PAC (${res.data.latencia_ms} ms)`);
            } else {
                showToast(`⚠️ ${res.data?.message || 'Fallo de conexión'}`, 'warning');
            }
        } catch (error) {
            console.error('Error test conexion PAC:', error);
            const msg = error.response?.data?.message || 'Error al contactar PAC';
            setPacData(prev => ({ 
                ...prev, 
                probandoConexion: false, 
                conexionResultado: { success: false, message: msg } 
            }));
            showToast(`❌ ${msg}`, 'error');
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
            const res = await api.post(`/emisores/${selectedEmisor.id}/pac/consulta-sat`, {
                uuid: satUuidQuery.trim()
            });
            setSatStatusResult(res.data);
        } catch (error) {
            console.error('Error al consultar estatus SAT:', error);
            setSatStatusResult({
                success: false,
                error: error.response?.data?.message || 'No fue posible consultar el UUID'
            });
        } finally {
            setLoadingSatStatus(false);
        }
    };

    const handleConsultarPeticionesSAT = async () => {
        if (!selectedEmisor) return;
        setLoadingPeticiones(true);
        setPeticionesResult(null);
        setShowPeticionesModal(true);
        try {
            const res = await api.get(`/emisores/${selectedEmisor.id}/pac/peticiones-pendientes`);
            setPeticionesResult(res.data);
        } catch (error) {
            console.error('Error al consultar peticiones SAT:', error);
            setPeticionesResult({
                success: false,
                error: error.response?.data?.message || 'Error al consultar peticiones pendientes'
            });
        } finally {
            setLoadingPeticiones(false);
        }
    };


    const handlePreviewPdf = async () => {
        if (!selectedEmisor) return;
        setIsGeneratingPdf(true);
        try {
            const currentLogo = logoPreview || (logoUrl && !removeLogo ? logoUrl : null);
            const res = await api.post(`/emisores/${selectedEmisor.id}/preview-pdf`, { 
                layout_id: layoutId,
                color_primario: colorPrimario,
                color_secundario: colorSecundario,
                logo_url: currentLogo
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

    const renderPACModals = () => {
        return (
            <>
                {/* Modal Confirmación Registro PAC */}
                {showConfirmPACRegModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
                            <div className="p-6">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">
                                    {selectedEmisor?.registrado_pac ? 'Re-sincronizar CSD con PAC SAT' : 'Registrar Emisor en PAC SAT'}
                                </h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    Esta operación transmitirá los sellos digitales (CSD) de <strong className="text-slate-800">{selectedEmisor?.razon_social}</strong> (<span className="font-mono text-xs font-bold text-slate-700">{selectedEmisor?.rfc}</span>) al PAC autorizado para habilitar el timbrado oficial CFDI 4.0.
                                </p>

                                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">RFC a certificar:</span>
                                        <span className="font-mono font-bold text-slate-800">{selectedEmisor?.rfc}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Certificado CSD (.cer):</span>
                                        <span className="font-semibold text-emerald-700">
                                            {selectedEmisor?.certificado_path || csdFiles.certificado ? '✔ Disponible' : '❌ Falta archivo .cer'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Llave Privada (.key):</span>
                                        <span className="font-semibold text-emerald-700">
                                            {selectedEmisor?.llave_privada_path || csdFiles.llave_privada ? '✔ Disponible' : '❌ Falta archivo .key'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Ambiente PAC:</span>
                                        <span className={`font-bold px-2 py-0.5 rounded ${formData.modo_prueba ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                            {formData.modo_prueba ? 'Sandbox / Pruebas' : 'Producción Fiscal'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Contraseña de la Llave CSD
                                    </label>
                                    <input 
                                        type="password"
                                        placeholder="Ingresa la contraseña del CSD"
                                        value={formData.password_csd}
                                        onChange={handleChange}
                                        name="password_csd"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 bg-white"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Requerida para abrir el certificado en el PAC. Si ya la guardaste anteriormente, se usará la registrada.
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPACRegModal(false)}
                                        disabled={pacData.registrando}
                                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRegistrarPAC}
                                        disabled={pacData.registrando}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-600/20 transition disabled:opacity-50"
                                    >
                                        {pacData.registrando ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                <span>Registrando en PAC...</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>Confirmar y Enviar al PAC</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Asignar / Traspasar Timbres */}
                {showAssignModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
                            <div className="p-6">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">
                                    Asignar Timbres al Emisor
                                </h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    Transfiere un paquete de folios de timbrado desde la cuenta integradora al emisor <strong className="text-slate-800">{selectedEmisor?.rfc}</strong>.
                                </p>

                                <div className="space-y-3 mb-5">
                                    <label className="block text-xs font-semibold text-slate-700">
                                        Selecciona o escribe el número de timbres:
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[50, 100, 250, 500].map(amt => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setFoliosToAssign(amt)}
                                                className={`py-1.5 rounded-lg text-xs font-bold transition border ${
                                                    foliosToAssign === amt 
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                                }`}
                                            >
                                                +{amt}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={foliosToAssign}
                                            onChange={e => setFoliosToAssign(parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                            placeholder="Cantidad personalizada..."
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAssignModal(false)}
                                        disabled={pacData.asignando}
                                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAsignarFoliosPAC}
                                        disabled={pacData.asignando}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 transition disabled:opacity-50"
                                    >
                                        {pacData.asignando ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                <span>Asignando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                <span>Asignar {foliosToAssign} Folios</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Consultar Estatus SAT por UUID */}
                {showSatModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <Search className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">
                                                Verificar Estatus SAT (UUID)
                                            </h3>
                                            <p className="text-xs text-slate-500">Consulta en vivo en los servidores del SAT a través del PAC</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setShowSatModal(false);
                                            setSatStatusResult(null);
                                        }}
                                        className="text-slate-400 hover:text-slate-600 transition"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleConsultarSatUUID} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Folio Fiscal (UUID SAT) a verificar:
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej. 4E70B182-E7A9-4C35-8EF6-8FA485C1766C"
                                            value={satUuidQuery}
                                            onChange={e => setSatUuidQuery(e.target.value.trim().toUpperCase())}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono uppercase focus:ring-1 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loadingSatStatus}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                                    >
                                        {loadingSatStatus ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                <span>Consultando SAT...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Search className="w-4 h-4" />
                                                <span>Consultar Estatus en el SAT</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                {/* Resultado de Consulta SAT */}
                                {satStatusResult && (
                                    <div className="mt-5 p-4 rounded-xl border bg-slate-50 space-y-2.5 text-xs">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                            <span className="font-bold text-slate-700">Estatus del CFDI:</span>
                                            <span className={`font-bold px-2 py-0.5 rounded-full ${
                                                satStatusResult.Estado === 'Vigente' 
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                    : (satStatusResult.Estado === 'Cancelado' 
                                                        ? 'bg-red-100 text-red-800 border border-red-200' 
                                                        : 'bg-amber-100 text-amber-800 border border-amber-200')
                                            }`}>
                                                {satStatusResult.Estado || (satStatusResult.error ? 'Error' : 'Desconocido')}
                                            </span>
                                        </div>

                                        {satStatusResult.EsCancelable && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Cancelabilidad:</span>
                                                <span className="font-semibold text-slate-800">{satStatusResult.EsCancelable}</span>
                                            </div>
                                        )}

                                        {satStatusResult.EstatusCancelacion && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Estatus Cancelación:</span>
                                                <span className="font-semibold text-slate-800">{satStatusResult.EstatusCancelacion}</span>
                                            </div>
                                        )}

                                        {satStatusResult.CodigoEstatus && (
                                            <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                                                <span className="font-bold">Respuesta SAT: </span>
                                                {satStatusResult.CodigoEstatus}
                                            </div>
                                        )}

                                        {satStatusResult.error && (
                                            <div className="text-red-600 font-medium pt-1">
                                                {satStatusResult.error}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Peticiones de Cancelación SAT */}
                {showPeticionesModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                            <AlertCircle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">
                                                Peticiones de Cancelación SAT
                                            </h3>
                                            <p className="text-xs text-slate-500">Solicitudes entrantes de clientes receptores</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setShowPeticionesModal(false)}
                                        className="text-slate-400 hover:text-slate-600 transition"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {loadingPeticiones ? (
                                    <div className="py-8 text-center text-slate-500 space-y-2">
                                        <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        <p className="text-xs">Consultando peticiones pendientes con el PAC SAT...</p>
                                    </div>
                                ) : peticionesResult?.error ? (
                                    <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200">
                                        {peticionesResult.error}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {Array.isArray(peticionesResult?.peticiones) && peticionesResult.peticiones.length > 0 ? (
                                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                                                {peticionesResult.peticiones.map((pet, idx) => (
                                                    <div key={idx} className="p-3 bg-white hover:bg-slate-50 text-xs">
                                                        <p className="font-mono font-bold text-slate-800">{pet.uuid || pet}</p>
                                                        {pet.rfc_solicitante && (
                                                            <p className="text-[10px] text-slate-500 mt-0.5">Solicitado por: {pet.rfc_solicitante}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                                                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                                <p className="text-xs font-bold text-slate-700">Sin peticiones pendientes</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    No tienes solicitudes de cancelación de clientes en espera de respuesta.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowPeticionesModal(false)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
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
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            {em.registrado_pac ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full" title="Emisor registrado y certificado en el PAC SAT">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> PAC Activo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full" title="Falta sincronizar CSD con el PAC SAT">
                                                    <AlertCircle className="w-3 h-3 text-amber-500" /> PAC Pendiente
                                                </span>
                                            )}
                                            {em.ultimos_folios_pac !== null && em.ultimos_folios_pac !== undefined && em.ultimos_folios_pac > 0 && (
                                                <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full" title="Folios vigentes consultados">
                                                    {Number(em.ultimos_folios_pac).toLocaleString()} folios
                                                </span>
                                            )}
                                        </div>
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
                {renderPACModals()}
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

                                        {/* Renderizado de Maqueta Específica según la Plantilla Seleccionada (v1 a v12) */}
                                        {(() => {
                                            const logoSrc = logoPreview || (logoUrl && !removeLogo ? getFullLogoUrl(logoUrl) : null);
                                            const emisorName = selectedEmisor?.razon_social || 'MI EMPRESA S.A. DE C.V.';
                                            const emisorRfc = selectedEmisor?.rfc || 'XAXX010101000';
                                            const emisorCp = selectedEmisor?.codigo_postal || '29960';

                                            const renderLogo = (imgClass = "max-h-full max-w-full object-contain", fallbackClass = "w-5 h-5 text-slate-700") => {
                                                if (logoSrc) {
                                                    return (
                                                        <img
                                                            src={logoSrc}
                                                            alt="Logo preview"
                                                            className={imgClass}
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    );
                                                }
                                                return <Building2 className={fallbackClass} />;
                                            };

                                            switch (layoutId) {
                                                case 'v2':
                                                    /* Layout v2: Barra Lateral */
                                                    return (
                                                        <div className="flex rounded-lg overflow-hidden border border-slate-200 min-h-[220px]">
                                                            {/* Sidebar */}
                                                            <div className="w-1/3 p-3 text-white flex flex-col justify-between" style={{ backgroundColor: colorSecundario }}>
                                                                <div className="space-y-2">
                                                                    <div className="w-12 h-10 bg-white rounded p-1 flex items-center justify-center">
                                                                        {renderLogo("max-h-full max-w-full object-contain", "w-5 h-5 text-slate-700")}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-bold uppercase leading-tight">{emisorName}</p>
                                                                        <p className="text-[9px] opacity-80 font-mono mt-0.5">{emisorRfc}</p>
                                                                    </div>
                                                                    <div className="text-[8px] opacity-75 leading-tight pt-1 border-t border-white/20">
                                                                        <p>C.P. {emisorCp}</p>
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
                                                                        <p className="text-[8px] text-slate-400 font-mono">UUID: 4E70B182-E7A9-4C35-8EF6...</p>
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
                                                    );

                                                case 'v3':
                                                    /* Layout v3: Nórdica Clean (Minimalista Suizo) */
                                                    return (
                                                        <div className="space-y-3 bg-white p-3 border border-slate-200 rounded-lg">
                                                            <div className="flex justify-between items-start pb-2 border-b-2" style={{ borderColor: colorPrimario }}>
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-12 h-11 bg-slate-50 rounded p-1 border border-slate-100 flex items-center justify-center shrink-0">
                                                                        {renderLogo("max-h-full max-w-full object-contain", "w-5 h-5 text-slate-700")}
                                                                    </div>
                                                                    <div>
                                                                        <h2 className="text-xs font-bold text-slate-900 tracking-tight">{emisorName}</h2>
                                                                        <p className="text-[9px] text-slate-500 font-mono">RFC: {emisorRfc}</p>
                                                                        <p className="text-[8px] text-slate-400">C.P. {emisorCp} &bull; Régimen 601 General de Ley</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-xl font-light text-slate-800 tracking-tight block">FACTURA</span>
                                                                    <span className="text-xs font-bold font-mono block" style={{ color: colorPrimario }}>A - 1024</span>
                                                                    <span className="text-[8px] text-slate-400 font-mono">CFDI 4.0 &bull; INGRESO</span>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4 text-[8.5px] py-1 border-b border-slate-100">
                                                                <div className="space-y-0.5">
                                                                    <span className="text-[7.5px] uppercase font-bold text-slate-400 tracking-wider block">CLIENTE / RECEPTOR</span>
                                                                    <p className="font-bold text-slate-800">CORPORATIVO EMPRESARIAL DEL SURESTE</p>
                                                                    <p className="text-slate-500 font-mono">RFC: CES180420KM9 &bull; C.P. 06600</p>
                                                                </div>
                                                                <div className="space-y-0.5 text-right">
                                                                    <span className="text-[7.5px] uppercase font-bold text-slate-400 tracking-wider block">DETALLES FISCALES</span>
                                                                    <p className="text-slate-700">PUE &bull; Transferencia (03)</p>
                                                                    <p className="text-slate-500 font-mono text-[8px]">UUID: 4E70B182-E7A9-4C35-8EF6...</p>
                                                                </div>
                                                            </div>

                                                            <div className="text-[8.5px]">
                                                                <div className="flex justify-between py-1 border-b font-bold uppercase tracking-wider text-[8px]" style={{ borderColor: colorPrimario, color: colorPrimario }}>
                                                                    <span>CONCEPTO / DESCRIPCIÓN</span>
                                                                    <span>TOTAL</span>
                                                                </div>
                                                                <div className="py-2 border-b border-slate-100 flex justify-between items-start">
                                                                    <div>
                                                                        <p className="font-medium text-slate-800">Servicios Facturación Electrónica CFDI 4.0</p>
                                                                        <span className="text-[7.5px] text-slate-400 font-mono">SAT: 84111506 &bull; Cant: 1.00 &bull; IVA 16%</span>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">$1,500.00</span>
                                                                </div>
                                                                <div className="py-2 border-b border-slate-100 flex justify-between items-start">
                                                                    <div>
                                                                        <p className="font-medium text-slate-800">Licencia Timbrado Multi-Serie SAT</p>
                                                                        <span className="text-[7.5px] text-slate-400 font-mono">SAT: 43231500 &bull; Cant: 2.00 &bull; IVA 16%</span>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">$1,000.00</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-end pt-1">
                                                                <div className="text-right space-y-0.5 text-[8.5px]">
                                                                    <div className="text-slate-500">Subtotal: <span className="font-mono text-slate-700">$2,500.00</span> &bull; IVA: <span className="font-mono text-slate-700">$400.00</span></div>
                                                                    <div className="text-sm font-bold pt-1" style={{ color: colorPrimario }}>
                                                                        TOTAL: <span className="font-mono">$2,900.00 MXN</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v4':
                                                    /* Layout v4: Notarial Clásica (Instrumento Jurídico Formal) */
                                                    return (
                                                        <div className="p-3.5 space-y-2.5 bg-[#fefefc] border-4 border-double rounded" style={{ borderColor: colorSecundario }}>
                                                            <div className="text-center space-y-1 pb-2 border-b border-slate-300">
                                                                <div className="w-12 h-12 mx-auto bg-white rounded-full p-1 border-2 border-slate-300 flex items-center justify-center shadow-xs">
                                                                    {renderLogo("max-h-full max-w-full object-contain", "w-5 h-5 text-slate-700")}
                                                                </div>
                                                                <span className="text-[7.5px] font-serif uppercase tracking-widest text-slate-500 block">INSTRUMENTO PÚBLICO FISCAL DIGITAL</span>
                                                                <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-slate-900 leading-tight">{emisorName}</h2>
                                                                <div className="flex items-center justify-center gap-2 text-[8px] font-mono text-slate-600">
                                                                    <span>RFC: {emisorRfc}</span>
                                                                    <span>&bull;</span>
                                                                    <span>C.P. {emisorCp}</span>
                                                                    <span>&bull;</span>
                                                                    <span>FOLIO NOTARIAL A-1024</span>
                                                                </div>
                                                                <div className="text-[7.5px] text-slate-400 font-serif italic">❖ CERTIFICACIÓN OFICIAL DE COMPROBANTE FISCAL ❖</div>
                                                            </div>

                                                            <div className="border border-slate-300 p-2 text-[8.5px] bg-white grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <span className="text-[7.5px] font-serif uppercase font-bold text-slate-500 block">PARTE RECEPTORA:</span>
                                                                    <p className="font-bold font-serif text-slate-900">CORPORATIVO EMPRESARIAL DEL SURESTE</p>
                                                                    <p className="text-slate-600 font-mono text-[8px]">RFC: CES180420KM9 &bull; C.P. 06600</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[7.5px] font-serif uppercase font-bold text-slate-500 block">REGISTRO FISCAL:</span>
                                                                    <p className="text-slate-700 font-mono text-[8px]">UUID: 4E70B182-E7A9-4C35-8EF6...</p>
                                                                    <p className="text-slate-600">PUE &bull; Gastos en general (G03)</p>
                                                                </div>
                                                            </div>

                                                            <div className="border border-slate-300 text-[8.5px] bg-white">
                                                                <div className="bg-slate-100 border-b border-slate-300 py-1 px-2 font-serif font-bold text-[8px] uppercase flex justify-between text-slate-700">
                                                                    <span>Partida / Concepto Jurídico</span>
                                                                    <span>Importe Liquidable</span>
                                                                </div>
                                                                <div className="p-2 border-b border-slate-200 flex justify-between items-center">
                                                                    <div>
                                                                        <p className="font-serif font-semibold text-slate-900">Servicios Facturación Electrónica CFDI 4.0</p>
                                                                        <span className="text-[7.5px] text-slate-500 font-mono">Clave SAT 84111506 &bull; Unidad E48 &bull; Traslado IVA 16%</span>
                                                                    </div>
                                                                    <span className="font-serif font-bold text-slate-900">$1,500.00</span>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-slate-50/50">
                                                                    <div>
                                                                        <p className="font-serif font-semibold text-slate-900">Licencia Timbrado Multi-Serie SAT</p>
                                                                        <span className="text-[7.5px] text-slate-500 font-mono">Clave SAT 43231500 &bull; Unidad H87 &bull; Traslado IVA 16%</span>
                                                                    </div>
                                                                    <span className="font-serif font-bold text-slate-900">$1,000.00</span>
                                                                </div>
                                                            </div>

                                                            <div className="border border-slate-300 p-2 bg-slate-50 flex items-center justify-between text-[8px]">
                                                                <span className="font-serif italic text-slate-600">Doy fe de la validez fiscal conforme al Art. 29 y 29-A del CFF.</span>
                                                                <div className="text-right font-serif">
                                                                    <span className="text-[7.5px] text-slate-500 block">TOTAL LIQUIDADO:</span>
                                                                    <span className="text-xs font-bold text-slate-900" style={{ color: colorSecundario }}>$2,900.00 MXN</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v5':
                                                    /* Layout v5: Horizon Cards (Tarjetas Pro Modulares) */
                                                    return (
                                                        <div className="space-y-2.5">
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs border-t-3 space-y-1" style={{ borderTopColor: colorPrimario }}>
                                                                    <div className="w-8 h-7 bg-slate-50 rounded p-0.5 flex items-center justify-center">
                                                                        {renderLogo("max-h-full max-w-full object-contain", "w-4 h-4 text-slate-600")}
                                                                    </div>
                                                                    <p className="text-[9px] font-bold text-slate-800 uppercase truncate">{emisorName}</p>
                                                                    <p className="text-[7.5px] font-mono text-slate-500">{emisorRfc}</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs border-t-3 space-y-1" style={{ borderTopColor: colorSecundario }}>
                                                                    <span className="text-[7.5px] font-bold uppercase text-slate-400 block">COMPROBANTE</span>
                                                                    <p className="text-[10px] font-bold text-slate-800">SERIE A - 1024</p>
                                                                    <p className="text-[7.5px] text-slate-500 font-mono">CFDI 4.0 &bull; PUE</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs border-t-3 space-y-1" style={{ borderTopColor: colorPrimario }}>
                                                                    <span className="text-[7.5px] font-bold uppercase text-slate-400 block">RECEPTOR</span>
                                                                    <p className="text-[9px] font-bold text-slate-800 uppercase truncate">CORPORATIVO EMPRESARIAL</p>
                                                                    <p className="text-[7.5px] font-mono text-slate-500">CES180420KM9</p>
                                                                </div>
                                                            </div>

                                                            <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs space-y-1.5 text-[8.5px]">
                                                                <div className="flex justify-between items-center pb-1 border-b border-slate-100 text-[8px] font-bold uppercase text-slate-400">
                                                                    <span>Conceptos de Factura</span>
                                                                    <span>Importe</span>
                                                                </div>
                                                                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                                                    <div>
                                                                        <p className="font-semibold text-slate-800">Servicios Facturación Electrónica CFDI 4.0</p>
                                                                        <span className="text-[7.5px] text-slate-400">1.00 E48 &bull; SAT 84111506</span>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">$1,500.00</span>
                                                                </div>
                                                                <div className="flex justify-between items-center py-1">
                                                                    <div>
                                                                        <p className="font-semibold text-slate-800">Licencia Timbrado Multi-Serie SAT</p>
                                                                        <span className="text-[7.5px] text-slate-400">2.00 H87 &bull; SAT 43231500</span>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">$1,000.00</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-end">
                                                                <div className="rounded-lg p-2.5 text-white flex items-center justify-between gap-6 shadow-2xs" style={{ backgroundColor: colorPrimario }}>
                                                                    <div className="text-[8px] opacity-85">
                                                                        <p>Subtotal: $2,500.00</p>
                                                                        <p>IVA 16%: $400.00</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-[7.5px] uppercase opacity-75 block">Total Neto</span>
                                                                        <span className="text-xs font-bold">$2,900.00 MXN</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v6':
                                                    /* Layout v6: Industrial ERP (Gran Formato y Monospace) */
                                                    return (
                                                        <div className="space-y-1.5 font-mono text-[8px]">
                                                            <div className="bg-slate-900 text-white p-2 rounded-t flex items-center justify-between border-b-2" style={{ borderBottomColor: colorPrimario }}>
                                                                <div>
                                                                    <span className="text-[7px] text-slate-400 uppercase tracking-widest block">ORDEN DE FACTURACIÓN INDUSTRIAL - CFDI 4.0</span>
                                                                    <h3 className="text-[10px] font-bold text-white uppercase">{emisorName}</h3>
                                                                    <p className="text-[8px] text-slate-300">RFC: {emisorRfc} &bull; C.P. {emisorCp}</p>
                                                                </div>
                                                                <div className="w-10 h-9 bg-white rounded p-0.5 flex items-center justify-center">
                                                                    {renderLogo("max-h-full max-w-full object-contain", "w-4 h-4 text-slate-800")}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-4 border border-slate-300 bg-slate-100 divide-x divide-slate-300 text-[7.5px] p-1 text-center">
                                                                <div><span className="text-slate-500 block">FOLIO DOC</span><strong>A-1024</strong></div>
                                                                <div><span className="text-slate-500 block">PLANTA C.P.</span><strong>{emisorCp}</strong></div>
                                                                <div><span className="text-slate-500 block">MONEDA</span><strong>MXN (1.0)</strong></div>
                                                                <div><span className="text-slate-500 block">CONDICIÓN</span><strong>PUE CONTADO</strong></div>
                                                            </div>

                                                            <div className="border border-slate-300 text-[8px]">
                                                                <div className="bg-slate-800 text-white font-bold uppercase grid grid-cols-12 p-1 text-[7.5px]">
                                                                    <span className="col-span-2">SKU / SAT</span>
                                                                    <span className="col-span-1">CANT</span>
                                                                    <span className="col-span-6">DESCRIPCIÓN DE PARTIDA</span>
                                                                    <span className="col-span-3 text-right">IMPORTE</span>
                                                                </div>
                                                                <div className="grid grid-cols-12 p-1 border-b border-slate-200 bg-white items-center">
                                                                    <span className="col-span-2 text-slate-600 font-bold">84111506</span>
                                                                    <span className="col-span-1">1.00</span>
                                                                    <span className="col-span-6 truncate font-sans text-slate-800">Servicios Facturación CFDI 4.0</span>
                                                                    <span className="col-span-3 text-right font-bold">$1,500.00</span>
                                                                </div>
                                                                <div className="grid grid-cols-12 p-1 border-b border-slate-200 bg-slate-50 items-center">
                                                                    <span className="col-span-2 text-slate-600 font-bold">43231500</span>
                                                                    <span className="col-span-1">2.00</span>
                                                                    <span className="col-span-6 truncate font-sans text-slate-800">Licencia Timbrado Multi-Serie SAT</span>
                                                                    <span className="col-span-3 text-right font-bold">$1,000.00</span>
                                                                </div>
                                                            </div>

                                                            <div className="border border-slate-300 bg-slate-50 p-1.5 flex justify-between items-center text-[8px]">
                                                                <div className="text-slate-500 text-[7px]">UUID: 4E70B182-E7A9-4C35-8EF6-8FA485C1766C</div>
                                                                <div className="text-right space-y-0.5">
                                                                    <div className="text-slate-600">SUBTOTAL: $2,500.00 | IVA (16%): $400.00</div>
                                                                    <div className="font-bold text-[9px] text-slate-900" style={{ color: colorPrimario }}>TOTAL NETO: $2,900.00 MXN</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v7':
                                                    /* Layout v7: Tradicional Pro (SAT Clásico Modernizado) */
                                                    return (
                                                        <div className="space-y-2 text-[8.5px]">
                                                            <div className="grid grid-cols-12 gap-1.5">
                                                                <div className="col-span-5 border border-slate-300 rounded overflow-hidden">
                                                                    <div className="px-2 py-0.5 text-white font-bold text-[7.5px] uppercase" style={{ backgroundColor: colorPrimario }}>DATOS DEL EMISOR</div>
                                                                    <div className="p-1.5 bg-white space-y-0.5">
                                                                        <p className="font-bold text-slate-900 leading-tight uppercase truncate">{emisorName}</p>
                                                                        <p className="font-mono text-slate-600 text-[8px]">RFC: {emisorRfc}</p>
                                                                        <p className="text-slate-500 text-[7.5px]">C.P. {emisorCp} &bull; Régimen 601</p>
                                                                    </div>
                                                                </div>
                                                                <div className="col-span-4 border border-slate-300 rounded overflow-hidden">
                                                                    <div className="px-2 py-0.5 text-white font-bold text-[7.5px] uppercase" style={{ backgroundColor: colorSecundario }}>FOLIO FISCAL Y DATOS</div>
                                                                    <div className="p-1.5 bg-white space-y-0.5 font-mono text-[7.5px]">
                                                                        <p className="font-bold text-slate-800">SERIE A &bull; FOLIO 1024</p>
                                                                        <p className="text-slate-500 truncate">UUID: 4E70B182...</p>
                                                                        <p className="text-slate-600 font-sans">Tipo: I - Ingreso</p>
                                                                    </div>
                                                                </div>
                                                                <div className="col-span-3 border border-slate-300 rounded p-1 bg-white flex items-center justify-center">
                                                                    {renderLogo("max-h-11 max-w-full object-contain", "w-5 h-5 text-slate-700")}
                                                                </div>
                                                            </div>

                                                            <div className="border border-slate-300 rounded overflow-hidden">
                                                                <div className="bg-slate-100 border-b border-slate-300 px-2 py-0.5 font-bold uppercase text-[7.5px] text-slate-700">DATOS DEL RECEPTOR</div>
                                                                <div className="p-1.5 bg-white grid grid-cols-2 gap-2 text-[8px]">
                                                                    <div>
                                                                        <p className="font-bold text-slate-800">CORPORATIVO EMPRESARIAL DEL SURESTE</p>
                                                                        <p className="font-mono text-slate-600">RFC: CES180420KM9 &bull; C.P. 06600</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-slate-700">Uso CFDI: G03 Gastos en general</p>
                                                                        <p className="text-slate-700">Forma: 03 Transferencia &bull; Método: PUE</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="border border-slate-300 rounded overflow-hidden text-[8px]">
                                                                <div className="text-white font-bold uppercase grid grid-cols-12 py-1 px-2" style={{ backgroundColor: colorPrimario }}>
                                                                    <span className="col-span-2">CANT / CLAVE</span>
                                                                    <span className="col-span-7">DESCRIPCIÓN DE LA PARTIDA</span>
                                                                    <span className="col-span-3 text-right">IMPORTE</span>
                                                                </div>
                                                                <div className="grid grid-cols-12 py-1.5 px-2 border-b border-slate-200 bg-white items-center">
                                                                    <span className="col-span-2 font-mono">1.00 - 84111506</span>
                                                                    <span className="col-span-7 font-semibold text-slate-800">Servicios Facturación Electrónica CFDI 4.0</span>
                                                                    <span className="col-span-3 text-right font-mono font-bold">$1,500.00</span>
                                                                </div>
                                                                <div className="grid grid-cols-12 py-1.5 px-2 bg-slate-50 items-center">
                                                                    <span className="col-span-2 font-mono">2.00 - 43231500</span>
                                                                    <span className="col-span-7 font-semibold text-slate-800">Licencia Timbrado Multi-Serie SAT</span>
                                                                    <span className="col-span-3 text-right font-mono font-bold">$1,000.00</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-end">
                                                                <div className="border border-slate-300 rounded bg-white p-2 text-right text-[8px] space-y-0.5 w-48">
                                                                    <div className="flex justify-between text-slate-600"><span>SUBTOTAL:</span><span>$2,500.00</span></div>
                                                                    <div className="flex justify-between text-slate-600"><span>IVA 16%:</span><span>$400.00</span></div>
                                                                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-0.5 text-[9px]">
                                                                        <span>TOTAL:</span><span style={{ color: colorPrimario }}>$2,900.00 MXN</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v8':
                                                    /* Layout v8: Contemporánea (SaaS / FinTech con Chips Dinámicos) */
                                                    return (
                                                        <div className="space-y-2.5 text-[9px]">
                                                            <div className="rounded-2xl p-3 text-white flex items-center justify-between shadow-xs transition-colors"
                                                                style={{ background: `linear-gradient(135deg, ${colorPrimario} 0%, ${colorSecundario} 100%)` }}>
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs font-bold uppercase">{emisorName}</span>
                                                                    </div>
                                                                    <p className="text-[9px] opacity-90 font-mono">RFC: {emisorRfc} &bull; FOLIO A-1024</p>
                                                                    <div className="flex items-center gap-1.5 pt-0.5">
                                                                        <span className="text-[7.5px] bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full font-bold">CFDI 4.0</span>
                                                                        <span className="text-[7.5px] bg-emerald-400/30 text-emerald-100 px-2 py-0.5 rounded-full font-bold">Ingreso Vigente</span>
                                                                        <span className="text-[7.5px] bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full font-bold">PUE</span>
                                                                    </div>
                                                                </div>
                                                                <div className="w-12 h-11 bg-white rounded-xl p-1 flex items-center justify-center shrink-0 shadow-xs">
                                                                    {renderLogo("max-h-full max-w-full object-contain", "w-5 h-5 text-slate-700")}
                                                                </div>
                                                            </div>

                                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs border-l-4 grid grid-cols-2 gap-2 text-[8.5px]"
                                                                style={{ borderLeftColor: colorPrimario }}>
                                                                <div>
                                                                    <span className="text-[7.5px] font-bold text-slate-400 uppercase block">CLIENTE FISCAL:</span>
                                                                    <p className="font-bold text-slate-800">CORPORATIVO EMPRESARIAL DEL SURESTE</p>
                                                                    <p className="text-slate-500 font-mono text-[8px]">CES180420KM9 &bull; C.P. 06600</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[7.5px] font-bold text-slate-400 uppercase block">CONDICIONES:</span>
                                                                    <p className="text-slate-700">03 Transferencia &bull; G03 Gastos</p>
                                                                    <p className="text-slate-400 font-mono text-[7.5px]">UUID: 4E70B182-E7A9-4C35-8EF6...</p>
                                                                </div>
                                                            </div>

                                                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white text-[8.5px] divide-y divide-slate-100">
                                                                <div className="p-2 flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                                        <div>
                                                                            <p className="font-semibold text-slate-800">Servicios Facturación Electrónica CFDI 4.0</p>
                                                                            <span className="text-[7.5px] text-slate-400">1.00 E48 &bull; SAT 84111506 &bull; IVA 16%</span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">$1,500.00</span>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-slate-50/40">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                        <div>
                                                                            <p className="font-semibold text-slate-800">Licencia Timbrado Multi-Serie SAT</p>
                                                                            <span className="text-[7.5px] text-slate-400">2.00 H87 &bull; SAT 43231500 &bull; IVA 16%</span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">$1,000.00</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-end">
                                                                <div className="rounded-xl px-4 py-2 text-white flex items-center justify-between gap-5 shadow-xs"
                                                                    style={{ background: `linear-gradient(135deg, ${colorSecundario} 0%, ${colorPrimario} 100%)` }}>
                                                                    <div className="text-[8px] opacity-85">
                                                                        <span>Sub: $2,500</span> &bull; <span>IVA: $400</span>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-[7.5px] opacity-75 uppercase block">Total Pagar</span>
                                                                        <span className="text-xs font-bold">$2,900.00 MXN</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v9':
                                                    /* Layout v9: Prestige Gold (Ejecutiva Top & Luxury) */
                                                    return (
                                                        <div className="p-3 bg-[#0a0f1d] text-slate-100 rounded-xl space-y-2.5 border border-amber-500/40 shadow-md">
                                                            <div className="flex items-center justify-between pb-2 border-b border-amber-400/40">
                                                                <div className="space-y-0.5">
                                                                    <span className="text-[7px] text-amber-400 uppercase tracking-widest font-mono font-bold block">CFDI PRESTIGE ENTERPRISE &bull; SERIE A-1024</span>
                                                                    <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-amber-200">{emisorName}</h2>
                                                                    <p className="text-[8px] font-mono text-slate-400">RFC: {emisorRfc} &bull; C.P. {emisorCp} &bull; RÉGIMEN 601</p>
                                                                </div>
                                                                <div className="w-12 h-11 bg-white/10 rounded-lg p-1 border border-amber-400/50 flex items-center justify-center shrink-0">
                                                                    {renderLogo("max-h-full max-w-full object-contain brightness-110", "w-5 h-5 text-amber-400")}
                                                                </div>
                                                            </div>

                                                            <div className="border border-amber-500/30 bg-white/5 rounded px-2.5 py-1 flex items-center justify-between text-[7.5px] font-mono text-amber-300">
                                                                <span>FOLIO FISCAL (UUID): 4E70B182-E7A9-4C35-8EF6-8FA485C1766C</span>
                                                                <span className="text-slate-400">TIMBRADO SAT</span>
                                                            </div>

                                                            <div className="border border-white/10 bg-white/5 p-2 rounded-lg grid grid-cols-2 gap-2 text-[8px]">
                                                                <div>
                                                                    <span className="text-[7px] text-amber-400/80 uppercase font-mono block">RECEPTOR CORPORATIVO</span>
                                                                    <p className="font-serif font-bold text-slate-200">CORPORATIVO EMPRESARIAL DEL SURESTE</p>
                                                                    <p className="text-slate-400 font-mono text-[7.5px]">RFC: CES180420KM9 &bull; C.P. 06600</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[7px] text-amber-400/80 uppercase font-mono block">CONDICIÓN DE PAGO</span>
                                                                    <p className="text-slate-300">Forma: 03 Transferencia &bull; PUE Contado</p>
                                                                    <p className="text-slate-400">Uso: G03 Gastos en general &bull; MXN</p>
                                                                </div>
                                                            </div>

                                                            <div className="border border-amber-500/20 rounded-lg overflow-hidden bg-black/20 text-[8px]">
                                                                <div className="px-2 py-1 bg-amber-400/10 border-b border-amber-500/30 font-bold uppercase text-[7.5px] text-amber-300 flex justify-between">
                                                                    <span>Partida / Concepto Exclusivo</span>
                                                                    <span>Importe</span>
                                                                </div>
                                                                <div className="p-2 border-b border-white/5 flex justify-between items-center">
                                                                    <div>
                                                                        <p className="font-semibold text-slate-200">Servicios Facturación Electrónica CFDI 4.0</p>
                                                                        <span className="text-[7px] text-slate-400 font-mono">Clave SAT 84111506 &bull; IVA 16% (+$240.00)</span>
                                                                    </div>
                                                                    <span className="font-mono font-bold text-amber-200">$1,500.00</span>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center">
                                                                    <div>
                                                                        <p className="font-semibold text-slate-200">Licencia Timbrado Multi-Serie SAT</p>
                                                                        <span className="text-[7px] text-slate-400 font-mono">Clave SAT 43231500 &bull; IVA 16% (+$160.00)</span>
                                                                    </div>
                                                                    <span className="font-mono font-bold text-amber-200">$1,000.00</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-end pt-0.5">
                                                                <div className="border border-amber-400/60 bg-gradient-to-r from-amber-500/20 to-amber-600/30 rounded-lg px-4 py-2 text-right">
                                                                    <span className="text-[7px] text-amber-300 uppercase tracking-widest font-mono block">TOTAL LIQUIDADO MXN</span>
                                                                    <span className="text-sm font-serif font-black text-amber-200">$2,900.00 MXN</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v10':
                                                    /* Layout v10: Gubernamental (Estricto SAT & Matriz Institucional Sector Público) */
                                                    return (
                                                        <div className="space-y-2 text-[8px] font-sans">
                                                            {/* Barra Superior Institucional Sector Público */}
                                                            <div className="bg-slate-900 text-white text-[8px] font-bold uppercase tracking-wider py-1 px-2.5 flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                                    <span>ESTADOS UNIDOS MEXICANOS &bull; COMPROBANTE FISCAL DIGITAL SECTOR PÚBLICO</span>
                                                                </div>
                                                                <span className="font-mono text-[7px] text-slate-400">NORMATIVA SAT ANEXO 20</span>
                                                            </div>

                                                            {/* Recuadro Rígido de 3 Celdas Tabulares (Sin redondeo) */}
                                                            <div className="border border-slate-800 grid grid-cols-12 bg-white">
                                                                {/* Celda 1: Logotipo */}
                                                                <div className="col-span-3 border-r border-slate-800 p-2 flex items-center justify-center bg-white min-h-[64px]">
                                                                    {renderLogo("max-h-12 max-w-full object-contain", "w-6 h-6 text-slate-700")}
                                                                </div>
                                                                {/* Celda 2: Datos del Emisor / Ente */}
                                                                <div className="col-span-6 border-r border-slate-800 p-2 space-y-0.5">
                                                                    <span className="text-[7.5px] font-bold uppercase text-slate-500 block">ENTE FISCAL EMISOR:</span>
                                                                    <h3 className="text-[10px] font-extrabold uppercase text-slate-900 leading-tight">{emisorName}</h3>
                                                                    <p className="text-[8.5px] font-mono text-slate-700 font-bold">RFC: {emisorRfc}</p>
                                                                    <p className="text-[7.5px] text-slate-600">C.P. {emisorCp} &bull; Régimen: 601 General de Ley Personas Morales</p>
                                                                </div>
                                                                {/* Celda 3: Datos del Comprobante Fiscal */}
                                                                <div className="col-span-3 p-2 bg-slate-100 text-center flex flex-col justify-center space-y-0.5">
                                                                    <span className="text-[7.5px] font-extrabold text-slate-700 uppercase">CFDI 4.0 INGRESO</span>
                                                                    <span className="text-sm font-black tracking-tight" style={{ color: colorPrimario }}>A - 1024</span>
                                                                    <span className="text-[7px] font-mono text-slate-500">EXPEDICIÓN: C.P. {emisorCp}</span>
                                                                </div>
                                                            </div>

                                                            {/* Folio Fiscal SAT Rígido */}
                                                            <div className="border border-slate-800 bg-slate-50 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono">
                                                                <span><strong className="text-slate-700">FOLIO FISCAL (UUID):</strong> 4E70B182-E7A9-4C35-8EF6-8FA485C1766C</span>
                                                                <span className="text-slate-500">CERT. SAT: 00001000000509846663</span>
                                                            </div>

                                                            {/* 2 Paneles de Requisitos con Ribete Oscuro */}
                                                            <div className="grid grid-cols-2 gap-2 text-[8px]">
                                                                <div>
                                                                    <div className="bg-slate-800 text-white text-[7.5px] font-bold uppercase px-2 py-0.5 tracking-wider">
                                                                        DATOS DEL RECEPTOR / ENTE PÚBLICO
                                                                    </div>
                                                                    <div className="border border-t-0 border-slate-800 p-2 space-y-0.5 bg-white">
                                                                        <p className="font-bold text-slate-900 uppercase">CORPORATIVO EMPRESARIAL DEL SURESTE</p>
                                                                        <p className="font-mono text-slate-700 font-bold">RFC: CES180420KM9 &bull; C.P. 06600</p>
                                                                        <p className="text-slate-500">Régimen: 601 &bull; Domicilio Fiscal: CDMX</p>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="bg-slate-800 text-white text-[7.5px] font-bold uppercase px-2 py-0.5 tracking-wider">
                                                                        DATOS FISCALES DEL COMPROBANTE
                                                                    </div>
                                                                    <div className="border border-t-0 border-slate-800 p-2 space-y-0.5 bg-white">
                                                                        <p><strong className="text-slate-900">Método de Pago:</strong> PUE Pago en una sola exhibición</p>
                                                                        <p><strong className="text-slate-900">Forma de Pago:</strong> 03 Transferencia electrónica</p>
                                                                        <p><strong className="text-slate-900">Uso CFDI:</strong> G03 Gastos en general &bull; Moneda: MXN</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Matriz Tabular Estricta (Bordes rígidos 1px) */}
                                                            <div className="border border-slate-800 text-[8px] bg-white">
                                                                <div
                                                                    className="text-white font-bold uppercase grid grid-cols-12 py-1 px-2 border-b border-slate-800"
                                                                    style={{ backgroundColor: colorPrimario }}
                                                                >
                                                                    <span className="col-span-1">Cant</span>
                                                                    <span className="col-span-2">Clave SAT</span>
                                                                    <span className="col-span-7">Concepto / Partida Presupuestal Fiscal</span>
                                                                    <span className="col-span-2 text-right">Importe</span>
                                                                </div>
                                                                <div className="border-b border-slate-300 py-1.5 px-2 grid grid-cols-12 items-center bg-white">
                                                                    <span className="col-span-1 font-mono font-bold">1.00</span>
                                                                    <span className="col-span-2 font-mono text-slate-600">84111506 E48</span>
                                                                    <div className="col-span-7">
                                                                        <span className="font-semibold text-slate-800">SERVICIOS PROFESIONALES DE FACTURACIÓN CFDI 4.0</span>
                                                                        <span className="ml-2 font-mono text-[7px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">IVA 16% (+$240.00)</span>
                                                                    </div>
                                                                    <span className="col-span-2 text-right font-mono font-bold text-slate-900">$1,500.00</span>
                                                                </div>
                                                                <div className="border-b border-slate-300 py-1.5 px-2 grid grid-cols-12 items-center bg-slate-50">
                                                                    <span className="col-span-1 font-mono font-bold">2.00</span>
                                                                    <span className="col-span-2 font-mono text-slate-600">43231500 H87</span>
                                                                    <div className="col-span-7">
                                                                        <span className="font-semibold text-slate-800">LICENCIA DE TIMBRADO SAT MULTI-SERIE</span>
                                                                        <span className="ml-2 font-mono text-[7px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">IVA 16% (+$160.00)</span>
                                                                    </div>
                                                                    <span className="col-span-2 text-right font-mono font-bold text-slate-900">$1,000.00</span>
                                                                </div>
                                                            </div>

                                                            {/* Recuadro de Totales y Retenciones Gubernamentales */}
                                                            <div className="border border-slate-800 bg-slate-50 p-2 grid grid-cols-2 gap-2 text-[8px]">
                                                                <div>
                                                                    <span className="font-bold text-slate-700 block uppercase text-[7.5px]">DESGLOSE IMPUESTOS Y RETENCIONES:</span>
                                                                    <div className="text-[7.5px] text-slate-600 space-y-0.5 mt-0.5">
                                                                        <p>&bull; TRASLADO IVA (16.00%): $400.00 MXN</p>
                                                                        <p>&bull; RETENCIÓN IVA (0.00%): $0.00 MXN</p>
                                                                        <p>&bull; RETENCIÓN ISR (0.00%): $0.00 MXN</p>
                                                                    </div>
                                                                </div>
                                                                <div className="border border-slate-800 bg-white p-1.5 space-y-0.5">
                                                                    <div className="flex justify-between text-slate-700">
                                                                        <span>SUBTOTAL:</span>
                                                                        <span className="font-mono font-semibold">$2,500.00</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-slate-700">
                                                                        <span>IMPUESTOS TRASLADADOS:</span>
                                                                        <span className="font-mono font-semibold">$400.00</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-slate-900 font-bold border-t border-slate-800 pt-0.5 text-[9px]">
                                                                        <span style={{ color: colorPrimario }}>TOTAL LIQUIDABLE:</span>
                                                                        <span className="font-mono font-black">$2,900.00 MXN</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v11':
                                                    /* Layout v11: Split Dynamic (Bicolor Asimétrico 50/50) */
                                                    return (
                                                        <div className="space-y-2.5 text-[9px]">
                                                            <div className="rounded-xl overflow-hidden border border-slate-200 grid grid-cols-2 shadow-2xs">
                                                                <div className="p-3 bg-white space-y-1">
                                                                    <div className="w-10 h-9 bg-slate-50 rounded p-1 border border-slate-200 flex items-center justify-center">
                                                                        {renderLogo("max-h-full max-w-full object-contain", "w-4 h-4 text-slate-700")}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-[10px] font-bold text-slate-900 uppercase leading-tight">{emisorName}</h3>
                                                                        <p className="text-[8px] font-mono text-slate-500">RFC: {emisorRfc}</p>
                                                                        <p className="text-[7.5px] text-slate-400">C.P. {emisorCp} &bull; Régimen 601</p>
                                                                    </div>
                                                                </div>
                                                                <div className="p-3 text-white flex flex-col justify-between" style={{ backgroundColor: colorPrimario }}>
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="text-[8px] font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded">CFDI 4.0</span>
                                                                        <span className="text-xs font-bold font-mono">SERIE A-1024</span>
                                                                    </div>
                                                                    <div className="bg-white rounded-lg p-2 text-slate-900 text-right mt-2 shadow-xs">
                                                                        <span className="text-[7px] uppercase font-bold text-slate-400 block">TOTAL A PAGAR</span>
                                                                        <span className="text-xs font-black" style={{ color: colorPrimario }}>$2,900.00 MXN</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 text-[8.5px]">
                                                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-0.5">
                                                                    <span className="text-[7.5px] font-bold text-slate-400 uppercase block">RECEPTOR</span>
                                                                    <p className="font-bold text-slate-800">CORPORATIVO EMPRESARIAL</p>
                                                                    <p className="text-slate-500 font-mono text-[7.5px]">RFC: CES180420KM9 &bull; C.P. 06600</p>
                                                                </div>
                                                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-0.5">
                                                                    <span className="text-[7.5px] font-bold text-slate-400 uppercase block">CONDICIONES</span>
                                                                    <p className="text-slate-700">PUE &bull; 03 Transferencia &bull; G03</p>
                                                                    <p className="text-slate-500 font-mono text-[7.5px] truncate">UUID: 4E70B182-E7A9...</p>
                                                                </div>
                                                            </div>

                                                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white text-[8.5px]">
                                                                <div className="px-2.5 py-1 text-white text-[8px] font-bold uppercase flex justify-between" style={{ backgroundColor: colorSecundario }}>
                                                                    <span>Partida Fiscal</span>
                                                                    <span>Importe</span>
                                                                </div>
                                                                <div className="p-2 border-b border-slate-100 flex justify-between items-center">
                                                                    <div>
                                                                        <p className="font-semibold text-slate-800">Servicios Facturación Electrónica CFDI 4.0</p>
                                                                        <span className="text-[7.5px] text-slate-400 font-mono">1.00 E48 &bull; SAT 84111506</span>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">$1,500.00</span>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-slate-50/50">
                                                                    <div>
                                                                        <p className="font-semibold text-slate-800">Licencia Timbrado Multi-Serie SAT</p>
                                                                        <span className="text-[7.5px] text-slate-400 font-mono">2.00 H87 &bull; SAT 43231500</span>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">$1,000.00</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v12':
                                                    /* Layout v12: Compact Express (Multi-partidas y Micro Formato) */
                                                    return (
                                                        <div className="space-y-1.5 text-[8px] font-sans">
                                                            <div className="p-1.5 bg-slate-100 rounded border border-slate-200 grid grid-cols-12 items-center gap-2">
                                                                <div className="col-span-2 w-8 h-8 bg-white rounded p-0.5 flex items-center justify-center border border-slate-200">
                                                                    {renderLogo("max-h-full max-w-full object-contain", "w-3.5 h-3.5 text-slate-700")}
                                                                </div>
                                                                <div className="col-span-4 leading-tight">
                                                                    <p className="font-bold text-slate-900 uppercase truncate">{emisorName}</p>
                                                                    <p className="font-mono text-slate-500 text-[7px]">RFC: {emisorRfc}</p>
                                                                </div>
                                                                <div className="col-span-3 leading-tight border-l border-slate-200 pl-2">
                                                                    <p className="font-bold text-slate-800 truncate">CORP. EMPRESARIAL</p>
                                                                    <p className="font-mono text-slate-500 text-[7px]">CES180420KM9</p>
                                                                </div>
                                                                <div className="col-span-3 text-right border-l border-slate-200 pl-2">
                                                                    <p className="font-bold font-mono text-slate-700">A-1024</p>
                                                                    <p className="font-bold text-[9px]" style={{ color: colorPrimario }}>$2,900.00</p>
                                                                </div>
                                                            </div>

                                                            <div className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded flex justify-between text-[7px] font-mono text-slate-500">
                                                                <span>UUID: 4E70B182-E7A9-4C35-8EF6-8FA485C1766C</span>
                                                                <span>PUE &bull; G03</span>
                                                            </div>

                                                            <div className="border border-slate-200 rounded overflow-hidden text-[7.5px] bg-white">
                                                                <div className="px-2 py-0.5 text-white font-bold uppercase grid grid-cols-12" style={{ backgroundColor: colorPrimario }}>
                                                                    <span className="col-span-1">CANT</span>
                                                                    <span className="col-span-2">SAT</span>
                                                                    <span className="col-span-6">DESCRIPCIÓN MULTI-PARTIDA</span>
                                                                    <span className="col-span-3 text-right">IMPORTE</span>
                                                                </div>
                                                                <div className="grid grid-cols-12 px-2 py-1 border-b border-slate-100 items-center">
                                                                    <span className="col-span-1 font-mono">1.00</span>
                                                                    <span className="col-span-2 font-mono text-slate-500">84111506</span>
                                                                    <span className="col-span-6 truncate font-medium">Servicios Facturación CFDI 4.0</span>
                                                                    <span className="col-span-3 text-right font-bold">$1,500.00</span>
                                                                </div>
                                                                <div className="grid grid-cols-12 px-2 py-1 border-b border-slate-100 items-center bg-slate-50/50">
                                                                    <span className="col-span-1 font-mono">2.00</span>
                                                                    <span className="col-span-2 font-mono text-slate-500">43231500</span>
                                                                    <span className="col-span-6 truncate font-medium">Licencia Timbrado Multi-Serie SAT</span>
                                                                    <span className="col-span-3 text-right font-bold">$1,000.00</span>
                                                                </div>
                                                                <div className="grid grid-cols-12 px-2 py-1 items-center">
                                                                    <span className="col-span-1 font-mono">1.00</span>
                                                                    <span className="col-span-2 font-mono text-slate-500">81112000</span>
                                                                    <span className="col-span-6 truncate font-medium">Soporte y Respaldo en la Nube SAT</span>
                                                                    <span className="col-span-3 text-right font-bold">$400.00</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-between items-center p-1.5 bg-slate-50 rounded border border-slate-200 text-[7.5px]">
                                                                <span className="text-slate-500">SON: DOS MIL NOVECIENTOS PESOS 00/100 M.N.</span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-slate-600">Sub: $2,500.00</span>
                                                                    <span className="text-slate-600">IVA: $400.00</span>
                                                                    <span className="font-bold text-[8.5px]" style={{ color: colorPrimario }}>TOTAL: $2,900.00 MXN</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );

                                                case 'v1':
                                                default:
                                                    /* Layout v1: Estándar Ejecutiva (Signature Corporativo) */
                                                    return (
                                                        <div className="space-y-2.5">
                                                            {/* Header Mockup */}
                                                            <div
                                                                className="rounded-lg p-3 text-white flex items-center justify-between transition-colors shadow-2xs"
                                                                style={{ backgroundColor: colorPrimario }}
                                                            >
                                                                <div className="space-y-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-bold uppercase">{emisorName}</span>
                                                                        <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded font-bold">CFDI 4.0</span>
                                                                    </div>
                                                                    <p className="text-[10px] opacity-90 font-mono">RFC: {emisorRfc} &bull; SERIE A &bull; FOLIO 1024</p>
                                                                    <p className="text-[8.5px] opacity-75">Lugar de Expedición: C.P. {emisorCp} &bull; Régimen: 601</p>
                                                                </div>
                                                                <div className="w-12 h-11 bg-white rounded-md p-1 flex items-center justify-center shrink-0 shadow-xs">
                                                                    {renderLogo()}
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
                                                    );
                                            }
                                        })()}
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

                    {/* Panel de Operaciones y Servicios PAC (Timbrado SAT) */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-xs">
                                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-sm text-white flex items-center gap-1.5">
                                        Operaciones PAC SAT
                                        <span className="text-[10px] font-semibold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/20">
                                            Profact CFDI 4.0
                                        </span>
                                    </h2>
                                    <p className="text-[11px] text-slate-300">Proveedor Autorizado de Certificación SAT</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchPacFolios(selectedEmisor.id)}
                                disabled={pacData.loadingTimbres}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition disabled:opacity-50"
                                title="Refrescar folios disponibles en vivo"
                            >
                                <RefreshCw className={`w-4 h-4 ${pacData.loadingTimbres ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Folios Vigentes Counter Banner */}
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50/80 via-slate-50 to-blue-50/70 border border-indigo-100 p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                                            Timbres / Folios Vigentes
                                        </span>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                                                {pacData.loadingTimbres ? (
                                                    <span className="inline-block w-24 h-8 bg-slate-200 animate-pulse rounded"></span>
                                                ) : (
                                                    (pacData.timbres?.disponibles !== undefined 
                                                        ? pacData.timbres.disponibles.toLocaleString() 
                                                        : (selectedEmisor.ultimos_folios_pac !== undefined && selectedEmisor.ultimos_folios_pac !== null
                                                            ? Number(selectedEmisor.ultimos_folios_pac).toLocaleString() 
                                                            : '—'))
                                                )}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-500">disponibles</span>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                            formData.modo_prueba 
                                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${formData.modo_prueba ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                            {formData.modo_prueba ? 'Modo Sandbox' : 'Modo Producción'}
                                        </span>
                                        {pacData.timbres?.latencia_ms ? (
                                            <p className="text-[10px] font-mono text-slate-400 mt-1 flex items-center justify-end gap-1">
                                                <Zap className="w-3 h-3 text-amber-500" /> {pacData.timbres.latencia_ms} ms
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                {pacData.timbres && (
                                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-indigo-100/70 text-xs">
                                        <div className="bg-white/80 rounded-lg p-2 border border-slate-100 shadow-2xs">
                                            <span className="text-[10px] text-slate-500 block">Timbres Utilizados:</span>
                                            <span className="font-mono font-bold text-slate-700">
                                                {(pacData.timbres.utilizados || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="bg-white/80 rounded-lg p-2 border border-slate-100 shadow-2xs">
                                            <span className="text-[10px] text-slate-500 block">Total en Cuenta:</span>
                                            <span className="font-mono font-bold text-slate-700">
                                                {(pacData.timbres.totales || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Estado de Registro en el PAC */}
                            <div className={`p-4 rounded-xl border ${
                                selectedEmisor.registrado_pac 
                                    ? 'bg-emerald-50/50 border-emerald-200' 
                                    : 'bg-amber-50/50 border-amber-200'
                            }`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        {selectedEmisor.registrado_pac ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800">
                                                {selectedEmisor.registrado_pac 
                                                    ? 'Emisor Registrado y Autorizado en PAC' 
                                                    : 'Emisor Pendiente de Alta en PAC SAT'}
                                            </h4>
                                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                                {selectedEmisor.registrado_pac 
                                                    ? `El CSD está cargado y registrado en el PAC para timbrado oficial CFDI 4.0.${selectedEmisor.fecha_registro_pac ? ` (Alta: ${new Date(selectedEmisor.fecha_registro_pac).toLocaleDateString()})` : ''}`
                                                    : 'Para certificar facturas ante el SAT, registra este emisor con sus archivos CSD (.cer y .key) en el PAC.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPACRegModal(true)}
                                        disabled={pacData.registrando}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 ${
                                            selectedEmisor.registrado_pac 
                                                ? 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700' 
                                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        }`}
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>
                                            {pacData.registrando 
                                                ? 'Registrando en PAC...' 
                                                : (selectedEmisor.registrado_pac ? 'Re-sincronizar CSD con PAC' : 'Registrar Emisor en PAC SAT')}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Acciones Rápidas del PAC */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Herramientas y Consultas PAC
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAssignModal(true)}
                                        className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-indigo-700 transition"
                                    >
                                        <Plus className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Asignar Timbres</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleTestConexionPAC}
                                        disabled={pacData.probandoConexion}
                                        className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition disabled:opacity-50"
                                    >
                                        <Activity className={`w-3.5 h-3.5 text-blue-600 ${pacData.probandoConexion ? 'animate-spin' : ''}`} />
                                        <span>{pacData.probandoConexion ? 'Probando...' : 'Diagnóstico (Ping)'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowSatModal(true)}
                                        className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-emerald-700 transition"
                                    >
                                        <Search className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Estatus SAT (UUID)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleConsultarPeticionesSAT}
                                        className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-amber-700 transition"
                                    >
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Peticiones SAT</span>
                                    </button>
                                </div>

                                {/* Resultado de Diagnóstico PAC si se ejecutó */}
                                {pacData.conexionResultado && (
                                    <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                                        pacData.conexionResultado.success 
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                            : 'bg-red-50 border-red-200 text-red-800'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            {pacData.conexionResultado.success ? (
                                                <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                                            )}
                                            <span className="font-medium">{pacData.conexionResultado.message}</span>
                                        </div>
                                        {pacData.conexionResultado.latencia_ms ? (
                                            <span className="font-mono font-bold text-[10px] bg-white/70 px-2 py-0.5 rounded border border-emerald-200">
                                                {pacData.conexionResultado.latencia_ms} ms
                                            </span>
                                        ) : null}
                                    </div>
                                )}
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
            {renderPACModals()}
        </div>
    );
};
