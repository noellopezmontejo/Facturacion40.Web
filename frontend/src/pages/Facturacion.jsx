import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Save, User, FileText, Search, X, Calculator, Trash2, UserPlus, PackagePlus, History, Eye, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import { ReceptorModal } from '../components/ReceptorModal';
import { ConceptoModal } from '../components/ConceptoModal';

export const NuevaFactura = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const location = useLocation();

    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const cotizacionIdParam = location.state?.cotizacionId || queryParams.get('cotizacionId');
    const ordenServicioIdParam = location.state?.ordenServicioId || queryParams.get('ordenServicioId');

    const [sourceCotizacion, setSourceCotizacion] = useState(null);
    const [sourceOrdenServicio, setSourceOrdenServicio] = useState(null);

    // Catalogs and Data
    const [receptores, setReceptores] = useState([]);
    const [conceptosCat, setConceptosCat] = useState([]);
    const [usosCfdiOpt, setUsosCfdiOpt] = useState([]);
    const [formasPagoOpt, setFormasPagoOpt] = useState([]);
    const [metodosPagoOpt, setMetodosPagoOpt] = useState([]);
    const [tiposDocOpt, setTiposDocOpt] = useState([]);

    // Selected / Form State
    const [selectedReceptorId, setSelectedReceptorId] = useState('');
    const [series, setSeries] = useState([]);
    const [facturaData, setFacturaData] = useState({
        tipo_documento_id: 1,
        uso_cfdi: '',
        forma_pago: '01',
        metodo_pago: 'PUE',
        moneda: 'MXN',
        tipo_cambio: '1',
        fecha: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        // CFDI 4.0
        es_global: false,
        periodicidad: '01',
        meses: new Date().toISOString().substring(5, 7),
        anio: new Date().getFullYear().toString(),
        tipo_relacion: '',
        uuids_relacionados: '',
        serie: 'A'
    });
    const [impuestosLocales, setImpuestosLocales] = useState({
        traslados: [],
        retenciones: []
    });

    const [partidas, setPartidas] = useState([]);
    const [showConceptoModal, setShowConceptoModal] = useState(false);
    const [conceptoSearch, setConceptoSearch] = useState('');
    const [showReceptorModal, setShowReceptorModal] = useState(false);
    const [showNuevoConceptoModal, setShowNuevoConceptoModal] = useState(false);
    const [descModal, setDescModal] = useState({ isOpen: false, idx: null, text: '', editable: false });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emittedDocument, setEmittedDocument] = useState(null);
    const [creditosDisponibles, setCreditosDisponibles] = useState({ creditos: 0, loading: true });
    const [showLocalTaxMenu, setShowLocalTaxMenu] = useState(false);
    const [catImpuestosLocales, setCatImpuestosLocales] = useState([]);

    const [totalAnualEmisor, setTotalAnualEmisor] = useState(0);
    const [preciosIncluyenIva, setPreciosIncluyenIva] = useState(true);

    const [ajusteManual, setAjusteManual] = useState(false);
    const [valoresManuales, setValoresManuales] = useState({
        subtotal: '0.00',
        total_impuestos_trasladados: '0.00',
        total_impuestos_retenidos: '0.00',
        total: '0.00'
    });

    const fetchData = async () => {
        if (!activeEmisor) return;
        try {
            const [
                resReceptores,
                resConceptos,
                resUsos,
                resFormas,
                resMetodos,
                resTipos,
                resSeries,
                resImpuestosLocales
            ] = await Promise.all([
                api.get(`/receptores/emisor/${activeEmisor.id}`),
                api.get(`/conceptos/emisor/${activeEmisor.id}`),
                api.get('/catalogos/usos-cfdi'),
                api.get('/catalogos/formas-pago'),
                api.get('/catalogos/metodos-pago'),
                api.get('/catalogos/tipos-documento'),
                api.get(`/emisores/${activeEmisor.id}/series`),
                api.get('/impuestos-locales')
            ]);

            setReceptores(resReceptores.data);
            setConceptosCat(resConceptos.data);
            setUsosCfdiOpt(resUsos.data);
            setFormasPagoOpt(resFormas.data);
            setMetodosPagoOpt(resMetodos.data);
            setTiposDocOpt(resTipos.data);
            setSeries(resSeries.data);
            setCatImpuestosLocales(resImpuestosLocales.data);
            
            // Consultar créditos por separado (puede tardar más por SOAP)
            setCreditosDisponibles(prev => ({ ...prev, loading: true }));
            api.get(`/emisores/${activeEmisor.id}/creditos`)
                .then(res => {
                    setCreditosDisponibles({ creditos: res.data.creditos || 0, loading: false });
                })
                .catch(err => {
                    console.error("Error fetching creditos", err);
                    setCreditosDisponibles({ creditos: 'Err', loading: false });
                });

            // Consultar total facturado anual para AGAPES
            api.get(`/emisores/${activeEmisor.id}/total-anual`)
                .then(res => {
                    setTotalAnualEmisor(res.data.total || 0);
                })
                .catch(err => {
                    console.error("Error fetching total anual", err);
                    setTotalAnualEmisor(0);
                });
        } catch (error) {
            console.error("Error fetching data", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeEmisor]);

    // Handle Receptor selection (auto fill uso_cfdi)
    useEffect(() => {
        if (selectedReceptorId) {
            const rec = receptores.find(r => r.id === parseInt(selectedReceptorId));
            if (rec && rec.uso_cfdi) {
                setFacturaData(prev => ({ ...prev, uso_cfdi: rec.uso_cfdi }));
            }
            setEmittedDocument(null); // Reset when receptor changes
        }
    }, [selectedReceptorId, receptores]);

    // Cargar Cotización u Orden de Servicio si viene referenciada
    useEffect(() => {
        const loadSourceDocument = async () => {
            if (!activeEmisor) return;

            if (cotizacionIdParam) {
                try {
                    const res = await api.get(`/cotizaciones/${cotizacionIdParam}`);
                    const cot = res.data;
                    if (cot) {
                        setSourceCotizacion(cot);

                        // Seleccionar receptor
                        if (cot.receptor_id) {
                            setSelectedReceptorId(cot.receptor_id.toString());
                            if (cot.Receptor) {
                                setReceptores(prev => {
                                    if (prev.some(r => r.id === cot.Receptor.id)) return prev;
                                    return [...prev, cot.Receptor];
                                });
                                if (cot.Receptor.uso_cfdi) {
                                    setFacturaData(prev => ({
                                        ...prev,
                                        uso_cfdi: cot.Receptor.uso_cfdi,
                                        moneda: cot.moneda || prev.moneda,
                                        tipo_cambio: cot.tipo_cambio || prev.tipo_cambio
                                    }));
                                }
                            }
                        }

                        // Precargar partidas
                        if (cot.detalles && cot.detalles.length > 0) {
                            const newPartidas = cot.detalles.map(det => {
                                const concepto = det.Concepto;
                                const hasImpuestos = concepto?.Impuestos && concepto.Impuestos.length > 0;
                                const impuestosArray = hasImpuestos
                                    ? concepto.Impuestos
                                    : (det.objeto_imp === '01' ? [] : [{
                                        id: 'default_iva',
                                        tipo: 'traslado',
                                        tasa_cuota: 0.16,
                                        descripcion: 'IVA Trasladado 16%'
                                    }]);

                                return {
                                    id: det.id,
                                    concepto_id: det.concepto_id,
                                    clave_prod_serv: det.clave_prod_serv || concepto?.clave_prod_serv || '01010101',
                                    clave_unidad: det.clave_unidad || concepto?.clave_unidad || 'H87',
                                    unidad: det.unidad || concepto?.unidad || 'Pieza',
                                    descripcion: det.descripcion || concepto?.descripcion || '',
                                    cantidad: parseFloat(det.cantidad) || 1,
                                    valor_unitario: parseFloat(det.valor_unitario) || 0,
                                    descuento: parseFloat(det.descuento) || 0,
                                    es_objeto_imp: det.objeto_imp || '02',
                                    cuenta_predial: '',
                                    retencion_isr: false,
                                    retencion_iva: false,
                                    retencion_isr_tasa: 0.10,
                                    Impuestos: impuestosArray,
                                    permitir_editar_descripcion: concepto?.permitir_editar_descripcion ?? true
                                };
                            });

                            setPartidas(newPartidas);
                            setPreciosIncluyenIva(false);
                            showToast(`📋 Cotización ${cot.folio || `#${cot.id}`} cargada con ${newPartidas.length} partidas`);
                        }
                    }
                } catch (err) {
                    console.error('Error cargando cotización en factura:', err);
                    showToast('No se pudo cargar la cotización seleccionada', 'error');
                }
            } else if (ordenServicioIdParam) {
                try {
                    const res = await api.get(`/ordenes-servicio/${ordenServicioIdParam}`);
                    const orden = res.data;
                    if (orden) {
                        setSourceOrdenServicio(orden);

                        if (orden.receptor_id) {
                            setSelectedReceptorId(orden.receptor_id.toString());
                            if (orden.Receptor) {
                                setReceptores(prev => {
                                    if (prev.some(r => r.id === orden.Receptor.id)) return prev;
                                    return [...prev, orden.Receptor];
                                });
                                if (orden.Receptor.uso_cfdi) {
                                    setFacturaData(prev => ({
                                        ...prev,
                                        uso_cfdi: orden.Receptor.uso_cfdi,
                                        moneda: orden.moneda || prev.moneda
                                    }));
                                }
                            }
                        }

                        if (orden.detalles && orden.detalles.length > 0) {
                            const newPartidas = orden.detalles.map(det => {
                                const concepto = det.Concepto;
                                const hasImpuestos = concepto?.Impuestos && concepto.Impuestos.length > 0;
                                const impuestosArray = hasImpuestos
                                    ? concepto.Impuestos
                                    : [{
                                        id: 'default_iva',
                                        tipo: 'traslado',
                                        tasa_cuota: 0.16,
                                        descripcion: 'IVA Trasladado 16%'
                                    }];

                                const equipoInfo = orden.equipo ? ` (${orden.equipo}${orden.marca ? ` ${orden.marca}` : ''}${orden.numero_serie ? ` S/N: ${orden.numero_serie}` : ''})` : '';

                                return {
                                    id: det.id,
                                    concepto_id: det.concepto_id,
                                    clave_prod_serv: det.clave_prod_serv || concepto?.clave_prod_serv || '81112300',
                                    clave_unidad: det.clave_unidad || concepto?.clave_unidad || 'E48',
                                    unidad: concepto?.unidad || 'Servicio',
                                    descripcion: `${det.descripcion}${equipoInfo}`,
                                    cantidad: parseFloat(det.cantidad) || 1,
                                    valor_unitario: parseFloat(det.valor_unitario) || 0,
                                    descuento: parseFloat(det.descuento) || 0,
                                    es_objeto_imp: '02',
                                    cuenta_predial: '',
                                    retencion_isr: false,
                                    retencion_iva: false,
                                    retencion_isr_tasa: 0.10,
                                    Impuestos: impuestosArray,
                                    permitir_editar_descripcion: true
                                };
                            });

                            setPartidas(newPartidas);
                            setPreciosIncluyenIva(false);
                            showToast(`💻 Orden de Servicio ${orden.folio || `#${orden.id}`} cargada con ${newPartidas.length} partidas`);
                        }
                    }
                } catch (err) {
                    console.error('Error cargando orden de servicio en factura:', err);
                    showToast('No se pudo cargar la orden de servicio', 'error');
                }
            }
        };

        loadSourceDocument();
    }, [activeEmisor, cotizacionIdParam, ordenServicioIdParam]);

    const resicoApplies = useMemo(() => {
        if (!activeEmisor || !selectedReceptorId) return false;
        // Solo Persona Física RESICO (RFC de 13 caracteres, régimen 626)
        if (activeEmisor.rfc.length !== 13 || activeEmisor.regimen_fiscal !== '626') return false;
        
        const rec = receptores.find(r => r.id === parseInt(selectedReceptorId));
        if (!rec || rec.rfc.length !== 12) return false;
        
        if (activeEmisor.es_agapes && totalAnualEmisor <= 900000) {
            return false;
        }
        
        return true;
    }, [activeEmisor, selectedReceptorId, receptores, totalAnualEmisor]);

    // Calcular Totales Reactivamente
    const totales = useMemo(() => {
        let subtotal = 0;
        let descuento = 0;
        let totalImpuestosTraslados = 0;
        let totalImpuestosRetenidos = 0;
        let totalTrasladosLocales = 0;
        let totalRetencionesLocales = 0;
        let desgloseTraslados = {};
        let desgloseRetenciones = {};

        partidas.forEach(p => {
            const qty = parseFloat(p.cantidad) || 0;
            const price = parseFloat(p.valor_unitario) || 0;
            const desc = parseFloat(p.descuento) || 0;

            let taxRate = 0;
            let hasTraslado = false;
            if (p.Impuestos && Array.isArray(p.Impuestos)) {
                p.Impuestos.forEach(imp => {
                    if (imp.tipo === 'traslado') {
                        taxRate += parseFloat(imp.tasa_cuota || 0);
                        hasTraslado = true;
                    }
                });
            }
            if (!hasTraslado) {
                taxRate = 0.16;
            }

            const netPrice = preciosIncluyenIva ? (price / (1 + taxRate)) : price;
            const netDesc = preciosIncluyenIva ? (desc / (1 + taxRate)) : desc;
            const baseAmount = (qty * netPrice) - netDesc;

            subtotal += (qty * netPrice);
            descuento += netDesc;

            if (p.Impuestos && Array.isArray(p.Impuestos)) {
                p.Impuestos.forEach(imp => {
                    const rate = parseFloat(imp.tasa_cuota);
                    const calcImp = Math.round(baseAmount * rate * 100) / 100;
                    const mapKey = `${imp.descripcion}`;
                    if (imp.tipo === 'traslado') {
                        totalImpuestosTraslados += calcImp;
                        desgloseTraslados[mapKey] = (desgloseTraslados[mapKey] || 0) + calcImp;
                    } else if (imp.tipo === 'retencion') {
                        totalImpuestosRetenidos += calcImp;
                        desgloseRetenciones[mapKey] = (desgloseRetenciones[mapKey] || 0) + calcImp;
                    }
                });
            }


            // Retenciones manuales o automáticas (RESICO)
            if (resicoApplies && (p.es_objeto_imp || '02') === '02') {
                const amt = Math.round(baseAmount * 0.0125 * 100) / 100;
                totalImpuestosRetenidos += amt;
                desgloseRetenciones['ISR RESICO (1.25%)'] = (desgloseRetenciones['ISR RESICO (1.25%)'] || 0) + amt;
            } else if (p.retencion_isr) {
                const tasa = parseFloat(p.retencion_isr_tasa || 0.10);
                const amt = Math.round(baseAmount * tasa * 100) / 100;
                totalImpuestosRetenidos += amt;
                desgloseRetenciones['ISR Retenido'] = (desgloseRetenciones['ISR Retenido'] || 0) + amt;
            }

            if (p.retencion_iva) {
                const amt = Math.round(baseAmount * 0.106667 * 100) / 100;
                totalImpuestosRetenidos += amt;
                desgloseRetenciones['IVA Retenido'] = (desgloseRetenciones['IVA Retenido'] || 0) + amt;
            }

        });

        // Sumar Impuestos Locales
        impuestosLocales.traslados.forEach(t => {
            totalTrasladosLocales += parseFloat(t.importe || 0);
        });
        impuestosLocales.retenciones.forEach(r => {
            totalRetencionesLocales += parseFloat(r.importe || 0);
        });

        return {
            subtotal,
            descuento,
            totalImpuestosTraslados,
            totalImpuestosRetenidos,
            totalTrasladosLocales,
            totalRetencionesLocales,
            desgloseTraslados,
            desgloseRetenciones,
            total: subtotal - descuento + totalImpuestosTraslados - totalImpuestosRetenidos + totalTrasladosLocales - totalRetencionesLocales
        };
    }, [partidas, impuestosLocales, resicoApplies, preciosIncluyenIva]);

    useEffect(() => {
        if (!ajusteManual) {
            setValoresManuales({
                subtotal: totales.subtotal.toFixed(2),
                total_impuestos_trasladados: totales.totalImpuestosTraslados.toFixed(2),
                total_impuestos_retenidos: totales.totalImpuestosRetenidos.toFixed(2),
                total: totales.total.toFixed(2)
            });
        }
    }, [totales, ajusteManual]);

    const isGlobalType = useMemo(() => {
        const docType = tiposDocOpt.find(t => t.clave === parseInt(facturaData.tipo_documento_id));
        return docType && docType.descripcion.toUpperCase().includes('GLOBAL');
    }, [facturaData.tipo_documento_id, tiposDocOpt]);

    const filteredSeries = useMemo(() => {
        const currentTypeId = parseInt(facturaData.tipo_documento_id);
        const list = series.filter(s => s.tipo_documento_id === currentTypeId || s.tipo_documento_id === null);
        
        // Deduplicar por nombre de serie: si hay una específica (tipo_documento_id !== null), preferirla
        const map = {};
        list.forEach(s => {
            if (!map[s.serie]) {
                map[s.serie] = s;
            } else {
                if (map[s.serie].tipo_documento_id === null && s.tipo_documento_id !== null) {
                    map[s.serie] = s;
                }
            }
        });
        return Object.values(map);
    }, [series, facturaData.tipo_documento_id]);

    // Auto-seleccionar serie cuando cambia el filtro
    useEffect(() => {
        if (filteredSeries.length > 0) {
            const exists = filteredSeries.find(s => s.serie === facturaData.serie);
            if (!exists) {
                const pred = filteredSeries.find(s => s.es_predeterminada) || filteredSeries[0];
                setFacturaData(prev => ({ ...prev, serie: pred.serie }));
            }
        }
    }, [filteredSeries]);

    const handleAddConcepto = (concepto) => {
        const isHonorarios = parseInt(facturaData.tipo_documento_id) === 2;
        setPartidas([...partidas, {
            ...concepto,
            cantidad: 1,
            descuento: 0,
            cuenta_predial: '',
            retencion_isr: isHonorarios,
            retencion_iva: isHonorarios,
            retencion_isr_tasa: 0.10
        }]);
        setShowConceptoModal(false);
        setConceptoSearch('');
        setEmittedDocument(null); // Reset when adding partidas
    };


    const handlePartidaChange = (index, field, value) => {
        const newPartidas = [...partidas];
        newPartidas[index][field] = value;
        setPartidas(newPartidas);
    };

    const handleRemovePartida = (index) => {
        setPartidas(partidas.filter((_, i) => i !== index));
    };

    const handleReceptorSaved = (newReceptor) => {
        setReceptores([...receptores, newReceptor]);
        setSelectedReceptorId(newReceptor.id.toString());
        setShowReceptorModal(false);
    };

    const handleConceptoSaved = (newConcepto) => {
        setConceptosCat([...conceptosCat, newConcepto]);
        handleAddConcepto(newConcepto);
    };

    const handleUpdateImpuestoLocal = (type, index, field, value) => {
        const newLocal = { ...impuestosLocales };
        newLocal[type][index][field] = field === 'tasa' || field === 'importe' ? parseFloat(value || 0) : value;
        setImpuestosLocales(newLocal);
    };

    const handleRemoveImpuestoLocal = (type, index) => {
        const newLocal = { ...impuestosLocales };
        newLocal[type] = newLocal[type].filter((_, i) => i !== index);
        setImpuestosLocales(newLocal);
    };

    const handlePreview = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                emisorId: activeEmisor.id,
                receptorId: selectedReceptorId,
                ...facturaData,
                subtotal: ajusteManual ? valoresManuales.subtotal : totales.subtotal,
                total: ajusteManual ? valoresManuales.total : totales.total,
                total_impuestos_trasladados: ajusteManual ? valoresManuales.total_impuestos_trasladados : totales.totalImpuestosTraslados,
                total_impuestos_retenidos: ajusteManual ? valoresManuales.total_impuestos_retenidos : totales.totalImpuestosRetenidos,
                ajuste_manual: ajusteManual,
                detalles: partidas.map(p => {
                    const price = parseFloat(p.valor_unitario) || 0;
                    const desc = parseFloat(p.descuento) || 0;
                    let taxRate = 0;
                    let hasTraslado = false;
                    if (p.Impuestos && Array.isArray(p.Impuestos)) {
                        p.Impuestos.forEach(imp => {
                            if (imp.tipo === 'traslado') {
                                taxRate += parseFloat(imp.tasa_cuota || 0);
                                hasTraslado = true;
                            }
                        });
                    }
                    if (!hasTraslado) {
                        taxRate = 0.16;
                    }
                    const netPrice = preciosIncluyenIva ? (price / (1 + taxRate)) : price;
                    const netDesc = preciosIncluyenIva ? (desc / (1 + taxRate)) : desc;
                    const netImporte = (parseFloat(p.cantidad) || 0) * netPrice - netDesc;
                    
                    return {
                        concepto_id: p.id,
                        cantidad: p.cantidad,
                        valor_unitario: netPrice,
                        descuento: netDesc,
                        importe: netImporte,
                        descripcion: p.descripcion,
                        unidad: p.unidad,
                        clave_unidad: p.clave_unidad,
                        clave_sat: p.clave_prod_serv,
                        es_objeto_imp: p.es_objeto_imp || '02',
                        cuenta_predial: p.cuenta_predial,
                        retencion_isr: resicoApplies ? true : p.retencion_isr,
                        retencion_iva: p.retencion_iva,
                        retencion_isr_tasa: resicoApplies ? 0.0125 : p.retencion_isr_tasa
                    };
                }),
                impuestosLocales
            };

            const response = await api.post('/documentos/preview', payload);
            if (response.data.success) {
                const baseUrl = (api.defaults.baseURL || '/api').replace('/api', '');
                const pdfUrl = `${baseUrl}${response.data.pdfUrl}`;
                
                // Intentar abrir, si falla por bloqueador, mostrar enlace
                const win = window.open(pdfUrl, '_blank');
                if (!win || win.closed || typeof win.closed === 'undefined') {
                    showToast('⚠️ Pop-up bloqueado. Haz clic aquí para ver PDF', 'info', { 
                        onClick: () => window.open(pdfUrl, '_blank'),
                        duration: 10000 
                    });
                } else {
                    showToast('✅ Vista previa generada');
                }
            }
        } catch (error) {
            console.error("Error al generar vista previa", error);
            const errMsg = error.response?.data?.message || 'Error al generar vista previa';
            const details = error.response?.data?.details;
            const fullMsg = details ? `${errMsg}: ${Array.isArray(details) ? details.join(', ') : details}` : errMsg;
            showToast(fullMsg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubirFactura = async (soloGuardar = false) => {
        setIsSubmitting(true);
        try {
            const payload = {
                emisorId: activeEmisor.id,
                receptorId: selectedReceptorId,
                ...facturaData,
                subtotal: ajusteManual ? valoresManuales.subtotal : totales.subtotal,
                total: ajusteManual ? valoresManuales.total : totales.total,
                total_impuestos_trasladados: ajusteManual ? valoresManuales.total_impuestos_trasladados : totales.totalImpuestosTraslados,
                total_impuestos_retenidos: ajusteManual ? valoresManuales.total_impuestos_retenidos : totales.totalImpuestosRetenidos,
                ajuste_manual: ajusteManual,
                soloGuardar,
                detalles: partidas.map(p => {
                    const price = parseFloat(p.valor_unitario) || 0;
                    const desc = parseFloat(p.descuento) || 0;
                    let taxRate = 0;
                    let hasTraslado = false;
                    if (p.Impuestos && Array.isArray(p.Impuestos)) {
                        p.Impuestos.forEach(imp => {
                            if (imp.tipo === 'traslado') {
                                taxRate += parseFloat(imp.tasa_cuota || 0);
                                hasTraslado = true;
                            }
                        });
                    }
                    if (!hasTraslado) {
                        taxRate = 0.16;
                    }
                    const netPrice = preciosIncluyenIva ? (price / (1 + taxRate)) : price;
                    const netDesc = preciosIncluyenIva ? (desc / (1 + taxRate)) : desc;
                    const netImporte = (parseFloat(p.cantidad) || 0) * netPrice - netDesc;
                    
                    return {
                        concepto_id: p.id,
                        cantidad: p.cantidad,
                        valor_unitario: netPrice,
                        descuento: netDesc,
                        importe: netImporte,
                        descripcion: p.descripcion,
                        unidad: p.unidad,
                        clave_unidad: p.clave_unidad,
                        clave_sat: p.clave_prod_serv,
                        es_objeto_imp: p.es_objeto_imp || '02',
                        cuenta_predial: p.cuenta_predial,
                        retencion_isr: resicoApplies ? true : p.retencion_isr,
                        retencion_iva: p.retencion_iva,
                        retencion_isr_tasa: resicoApplies ? 0.0125 : p.retencion_isr_tasa
                    };
                }),
                impuestosLocales
            };

            const response = await api.post('/documentos/emitir', payload);
            showToast(soloGuardar ? '✅ Guardado.' : `✅ Timbrado Correctamente`);
            
            setPartidas([]);
            setFacturaData({
                ...facturaData,
                es_global: false,
                tipo_relacion: '',
                uuids_relacionados: ''
            });
            setSelectedReceptorId('');
            if (!soloGuardar && response.data.documento) {
                setEmittedDocument(response.data.documento);
            }

            // Si proviene de Cotización u Orden de Servicio, actualizar su estado
            if (sourceCotizacion?.id) {
                try {
                    await api.put(`/cotizaciones/${sourceCotizacion.id}/estado`, {
                        estado: 'Facturada',
                        documento_id: response.data.documento?.id || null
                    });
                } catch (e) {
                    console.error('Error actualizando estado de cotización:', e);
                }
            } else if (sourceOrdenServicio?.id) {
                try {
                    await api.put(`/ordenes-servicio/${sourceOrdenServicio.id}/estado`, {
                        estado: 'Facturado',
                        documento_id: response.data.documento?.id || null
                    });
                } catch (e) {
                    console.error('Error actualizando estado de orden de servicio:', e);
                }
            }

            setSourceCotizacion(null);
            setSourceOrdenServicio(null);

            // Refrescar series para actualizar el folio en pantalla
            fetchData();
        } catch (error) {
            console.error("Error al emitir factura", error);
            const errMsg = error.response?.data?.message || 'Error al procesar la factura';
            const details = error.response?.data?.details;
            const fullMsg = details ? `${errMsg}: ${Array.isArray(details) ? details.join(', ') : details}` : errMsg;
            showToast(fullMsg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!activeEmisor) {
        return <div className="p-8 text-center text-slate-500">Selecciona un emisor para continuar.</div>;
    }

    const filteredConceptos = conceptosCat.filter(c => c.descripcion.toLowerCase().includes(conceptoSearch.toLowerCase()));

    return (
        <div className="max-w-6xl mx-auto pb-12">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nueva Factura</h1>
                    <p className="text-slate-500 text-sm mt-1">Generación de comprobante (CFDI 4.0)</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePreview}
                        disabled={partidas.length === 0 || !selectedReceptorId || isSubmitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-primary-600 border border-primary-200 rounded-lg font-medium hover:bg-primary-50 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? '...' : (
                            <>
                                <Eye className="w-4 h-4" />
                                Factura Previa
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => handleSubirFactura(true)}
                        disabled={partidas.length === 0 || !selectedReceptorId || isSubmitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? '...' : (
                            <>
                                <History className="w-4 h-4" />
                                Guardar Borrador
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            if (emittedDocument) {
                                const baseUrl = (api.defaults.baseURL || '/api').replace('/api', '');
                                window.open(`${baseUrl}${emittedDocument.pdf_url}`, '_blank');
                            } else {
                                handleSubirFactura(false);
                            }
                        }}
                        disabled={(partidas.length === 0 || !selectedReceptorId || isSubmitting) && !emittedDocument}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${emittedDocument ? 'bg-green-600 hover:bg-green-500 shadow-green-500/20 text-white' : 'bg-primary-600 text-white hover:bg-primary-500 shadow-primary-500/20'}`}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                Procesando...
                            </>
                        ) : emittedDocument ? (
                            <>
                                <Eye className="w-4 h-4" />
                                Imprimir Factura
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Generar Factura
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Banner de Vinculación con Cotización / Orden */}
            {sourceCotizacion && (
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-indigo-950 text-sm">
                                Facturando Cotización: <span className="font-mono">{sourceCotizacion.folio || `#${sourceCotizacion.id}`}</span>
                            </p>
                            <p className="text-xs text-indigo-700 mt-0.5">
                                Se precargaron el cliente ({sourceCotizacion.Receptor?.razon_social || 'Cliente'}) y sus partidas. Al emitir la factura, la cotización quedará marcada como facturada.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSourceCotizacion(null)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2.5 py-1 hover:bg-indigo-100/70 rounded-lg transition-colors"
                        title="Desvincular cotización"
                    >
                        Desvincular
                    </button>
                </div>
            )}

            {sourceOrdenServicio && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-purple-950 text-sm">
                                Facturando Orden de Servicio: <span className="font-mono">{sourceOrdenServicio.folio || `#${sourceOrdenServicio.id}`}</span>
                            </p>
                            <p className="text-xs text-purple-700 mt-0.5">
                                Se precargaron los datos del cliente, equipo ({sourceOrdenServicio.equipo || 'Equipo'}) y partidas técnicas.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSourceOrdenServicio(null)}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2.5 py-1 hover:bg-purple-100/70 rounded-lg transition-colors"
                        title="Desvincular orden"
                    >
                        Desvincular
                    </button>
                </div>
            )}

            <div className="space-y-6">

                {/* Datos Generales del Comprobante */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-slate-400" />
                                <h2 className="font-semibold text-slate-800">Datos Generales del Comprobante</h2>
                            </div>
                            <div className="flex gap-2">
                                <div className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-100 flex items-center gap-1">
                                    <span className="text-slate-400">Emisor:</span>
                                    <span className="text-slate-700 font-bold">{activeEmisor.rfc}</span>
                                </div>
                                <div className={`text-sm font-medium px-3 py-1 rounded-full border flex items-center gap-2 ${creditosDisponibles.creditos > 10 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                                    <PackagePlus className="w-4 h-4" />
                                    <span className="text-xs uppercase font-bold tracking-tight">Timbres:</span>
                                    <span className="font-bold">{creditosDisponibles.loading ? '...' : creditosDisponibles.creditos}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                {/* Comprobante */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Tipo de Factura / Comprobante</label>
                                    <select
                                        value={facturaData.tipo_documento_id}
                                        onChange={e => {
                                            const val = parseInt(e.target.value);
                                            const docType = tiposDocOpt.find(t => t.clave === val);

                                            // Lógica Anexo 20: Auto-configurar retenciones para Honorarios (ID 2)
                                            if (val === 2) {
                                                const newPartidas = partidas.map(p => ({
                                                    ...p,
                                                    retencion_isr: true,
                                                    retencion_iva: true,
                                                    retencion_isr_tasa: 0.10
                                                }));
                                                setPartidas(newPartidas);
                                                setFacturaData(prev => ({
                                                    ...prev,
                                                    tipo_documento_id: val,
                                                    tipo_comprobante: docType ? docType.tipo : 'I',
                                                    metodo_pago: 'PUE',
                                                    forma_pago: '03', // Transferencia común en honorarios
                                                    es_global: false // Reset global
                                                }));
                                            } else {
                                                setFacturaData({
                                                    ...facturaData,
                                                    tipo_documento_id: val,
                                                    tipo_comprobante: docType ? docType.tipo : 'I',
                                                    es_global: false // Reset global logic: default to false when changing type
                                                });
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white transition-all outline-none focus:ring-2 focus:ring-primary-500/20"
                                    >
                                        {tiposDocOpt
                                            .filter(t => t.clave !== 6 && t.clave !== 7)
                                            .map(t => (
                                                <option key={t.clave} value={t.clave}>{t.descripcion}</option>
                                            ))}
                                    </select>
                                </div>

                                {/* Fecha */}
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Fecha de Emisión</label>
                                    <input
                                        type="datetime-local"
                                        value={facturaData.fecha}
                                        onChange={e => setFacturaData({ ...facturaData, fecha: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm bg-white transition-all outline-none"
                                    />
                                </div>

                                {/* Serie y Folio */}
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block text-right">Serie y Folio</label>
                                    <div className="flex gap-1 items-center">
                                        <select
                                            value={facturaData.serie}
                                            onChange={e => setFacturaData({ ...facturaData, serie: e.target.value })}
                                            className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm bg-white transition-all outline-none"
                                        >
                                            {filteredSeries.map(s => (
                                                <option key={s.id} value={s.serie}>{s.serie}</option>
                                            ))}
                                            {filteredSeries.length === 0 && <option value="A">A</option>}
                                        </select>
                                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex-1 font-mono text-center font-bold">
                                            {(filteredSeries.find(s => s.serie === facturaData.serie)?.ultimo_folio || 0) + 1}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Fila 2: Receptor / Cliente */}
                            <div className="mb-6 pt-6 border-t border-slate-100">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Receptor / Cliente</label>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedReceptorId}
                                        onChange={e => setSelectedReceptorId(e.target.value)}
                                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm bg-white transition-all outline-none appearance-none"
                                    >
                                        <option value="">-- Seleccionar Cliente --</option>
                                        {receptores.map(r => (
                                            <option key={r.id} value={r.id}>{r.rfc} - {r.razon_social}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setShowReceptorModal(true)}
                                        className="px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                                        title="Nuevo Cliente"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Fila 2: Uso CFDI y Opciones Avanzadas */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6 pt-6 border-t border-slate-100">
                                <div className="md:col-span-8">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Uso de CFDI</label>
                                    <select
                                        value={facturaData.uso_cfdi}
                                        onChange={e => setFacturaData({ ...facturaData, uso_cfdi: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm bg-white transition-all outline-none"
                                    >
                                        <option value="">-- Seleccione el uso oficial del SAT --</option>
                                        {usosCfdiOpt.map(u => (
                                            <option key={u.clave} value={u.clave}>{u.clave} - {u.descripcion}</option>
                                        ))}
                                        {usosCfdiOpt.length === 0 && <option disabled>Cargando catálogos...</option>}
                                    </select>
                                </div>
                                <div className="md:col-span-4 flex items-end">
                                    <button
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${showAdvanced ? 'bg-primary-50 text-primary-700 border-primary-200 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                    >
                                        <FileText className="w-4 h-4" />
                                        {showAdvanced ? 'Manejar CFDI 4.0 Normal' : 'Complementos CFDI 4.0'}
                                    </button>
                                </div>
                            </div>

                            {/* Fila 3: Pago, Comprobante y Moneda */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Forma de Pago</label>
                                    <select
                                        value={facturaData.forma_pago}
                                        onChange={e => setFacturaData({ ...facturaData, forma_pago: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white transition-all outline-none"
                                    >
                                        {formasPagoOpt.map(f => (
                                            <option key={f.clave} value={f.clave}>{f.clave} - {f.descripcion}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Método de Pago</label>
                                    <select
                                        value={facturaData.metodo_pago}
                                        onChange={e => setFacturaData({ ...facturaData, metodo_pago: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white transition-all outline-none"
                                    >
                                        {metodosPagoOpt.map(m => (
                                            <option key={m.clave} value={m.clave}>{m.clave} - {m.descripcion}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    <div className="col-span-3">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Moneda</label>
                                        <select
                                            value={facturaData.moneda}
                                            onChange={e => setFacturaData({ ...facturaData, moneda: e.target.value })}
                                            className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                                        >
                                            <option value="MXN">MXN - Pesos</option>
                                            <option value="USD">USD - Dólar</option>
                                            <option value="EUR">EUR - Euro</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider text-center">T.C.</label>
                                        <input
                                            type="number" step="0.0001" value={facturaData.tipo_cambio}
                                            onChange={e => setFacturaData({ ...facturaData, tipo_cambio: e.target.value })}
                                            disabled={facturaData.moneda === 'MXN'}
                                            className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 disabled:text-slate-400 font-mono text-center outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                {/* Sección Avanzada (Global / Relacionados) */}
                {showAdvanced && (
                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 split-line-lg">
                            {/* Facturación Global (Condicional) */}
                            {isGlobalType && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-1">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${facturaData.es_global ? 'bg-primary-100 text-primary-600' : 'bg-slate-200 text-slate-400'}`}>
                                            <History className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="check-global"
                                                    checked={facturaData.es_global}
                                                    onChange={e => setFacturaData({ ...facturaData, es_global: e.target.checked })}
                                                    className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <label htmlFor="check-global" className="text-sm font-bold text-slate-700 cursor-pointer">Facturación Global (Público General)</label>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium">Habilitar requerimientos para ventas del día/mes</p>
                                        </div>
                                    </div>

                                    {facturaData.es_global && (
                                        <div className="grid grid-cols-3 gap-4 pt-2 animate-in zoom-in-95">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Periodicidad</label>
                                                <select
                                                    value={facturaData.periodicidad}
                                                    onChange={e => setFacturaData({ ...facturaData, periodicidad: e.target.value })}
                                                    className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-primary-400 outline-none shadow-sm"
                                                >
                                                    <option value="01">Diaria</option>
                                                    <option value="02">Semanal</option>
                                                    <option value="03">Quincenal</option>
                                                    <option value="04">Mensual</option>
                                                    <option value="05">Bimestral</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mes(es)</label>
                                                <select
                                                    value={facturaData.meses}
                                                    onChange={e => setFacturaData({ ...facturaData, meses: e.target.value })}
                                                    className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-primary-400 outline-none shadow-sm"
                                                >
                                                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                                                        <option key={i} value={(i + 1).toString().padStart(2, '0')}>{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Año</label>
                                                <input
                                                    type="text"
                                                    value={facturaData.anio}
                                                    onChange={e => setFacturaData({ ...facturaData, anio: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:border-primary-400 outline-none shadow-sm"
                                                    placeholder="2026"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CFDI Relacionados */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${facturaData.tipo_relacion ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                                        <History className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 block">Documentos Relacionados</label>
                                        <p className="text-[10px] text-slate-400 font-medium">Vincular con folios previos (Notas de Crédito, Sustitución)</p>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo de Relación</label>
                                        <select
                                            value={facturaData.tipo_relacion}
                                            onChange={e => setFacturaData({ ...facturaData, tipo_relacion: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-primary-400 outline-none shadow-sm"
                                        >
                                            <option value="">-- Ninguna / No aplica --</option>
                                            <option value="01">01 - Nota de crédito de los documentos relacionados</option>
                                            <option value="02">02 - Nota de débito de los documentos relacionados</option>
                                            <option value="03">03 - Devolución de mercancía sobre facturas previos</option>
                                            <option value="04">04 - Sustitución de los CFDI previos</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">UUIDs (Un folio por línea o separados por coma)</label>
                                        <textarea
                                            value={facturaData.uuids_relacionados}
                                            onChange={e => setFacturaData({ ...facturaData, uuids_relacionados: e.target.value })}
                                            rows="2"
                                            placeholder="Ej: C80A5886-..."
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-mono bg-white focus:border-primary-400 outline-none shadow-sm resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Partidas / Conceptos - AHORA A TODO LO ANCHO */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-slate-400" />
                            <h2 className="font-semibold text-slate-800">Partidas y Conceptos</h2>
                        </div>
                        <button
                            onClick={() => setShowConceptoModal(true)}
                            className="px-4 py-2 text-xs font-bold bg-primary-600 text-white hover:bg-primary-500 rounded-lg shadow-sm transition-all flex items-center gap-2 uppercase tracking-wider"
                        >
                            <Plus className="w-4 h-4" /> Agregar desde Catálogo
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        {partidas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-50/30">
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-inner mb-4">
                                    <Plus className="w-10 h-10 text-slate-200" />
                                </div>
                                <p className="font-bold text-slate-400 text-sm uppercase tracking-widest">Sin conceptos agregados</p>
                                <p className="text-slate-300 text-xs mt-1">Haga clic en el botón de arriba para iniciar.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                        <th className="px-4 py-3 w-32">Cve SAT</th>
                                        <th className="px-4 py-3">Detalle del Producto / Servicio</th>
                                        <th className="px-4 py-3 text-center w-36">Cant.</th>
                                        <th className="px-4 py-3 text-right w-36">P. Unitario</th>
                                        <th className="px-4 py-3 text-right w-32">Desc.</th>
                                        <th className="px-4 py-3 text-right w-32">Subtotal</th>
                                        <th className="px-4 py-3 text-center w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {partidas.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-primary-50/10 transition-colors group">
                                            <td className="px-4 py-4 align-top">
                                                <span className="font-mono text-[11px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md block text-center border border-slate-200/50">
                                                    {p.clave_prod_serv}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <div className="space-y-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="font-bold text-slate-700 text-sm leading-tight flex-1">
                                                            {p.descripcion.length > 80 ? p.descripcion.substring(0, 80) + '...' : p.descripcion}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDescModal({ isOpen: true, idx, text: p.descripcion, editable: p.permitir_editar_descripcion })}
                                                            className="shrink-0 text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded border border-primary-100 hover:bg-primary-100 transition-colors uppercase tracking-wider"
                                                        >
                                                            {p.permitir_editar_descripcion ? 'Editar' : 'Info'}
                                                        </button>
                                                    </div>

                                                    {/* Complementos por Partida */}
                                                    <div className="flex flex-wrap gap-4 items-center bg-slate-100/50 p-2.5 rounded-xl border border-slate-200/40">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-tighter">Cta. Predial</span>
                                                            <input
                                                                type="text"
                                                                placeholder="Ej: 1234AB"
                                                                value={p.cuenta_predial || ''}
                                                                onChange={e => handlePartidaChange(idx, 'cuenta_predial', e.target.value)}
                                                                className="px-2 py-1 border border-slate-200 rounded-lg w-28 bg-white text-[11px] font-mono focus:border-primary-400 outline-none"
                                                            />
                                                        </div>
                                                        <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-tighter">Imp. Retenidos</span>
                                                            <div className="flex gap-3">
                                                                {resicoApplies ? (
                                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                                        <span className="text-[9px] font-black uppercase tracking-tight">RESICO 1.25%</span>
                                                                    </div>
                                                                ) : (
                                                                    <label className="flex items-center gap-2 cursor-pointer select-none group/chk">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={p.retencion_isr}
                                                                            onChange={e => handlePartidaChange(idx, 'retencion_isr', e.target.checked)}
                                                                            className="w-4 h-4 rounded-md border-slate-300 text-primary-600 focus:ring-primary-500"
                                                                        />
                                                                        <span className="text-[10px] font-bold text-slate-600 group-hover/chk:text-primary-600 transition-colors">ISR 10%</span>
                                                                    </label>
                                                                )}
                                                                <label className="flex items-center gap-2 cursor-pointer select-none group/chk">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={p.retencion_iva}
                                                                        onChange={e => handlePartidaChange(idx, 'retencion_iva', e.target.checked)}
                                                                        className="w-4 h-4 rounded-md border-slate-300 text-primary-600 focus:ring-primary-500"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-slate-600 group-hover/chk:text-primary-600 transition-colors">IVA Ret.</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {p.Impuestos && p.Impuestos.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                            {p.Impuestos.map(imp => (
                                                                <span key={imp.id} className="text-[9px] font-bold bg-white text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">
                                                                    {imp.descripcion} ({(parseFloat(imp.tasa_cuota) * 100).toFixed(0)}%)
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-middle">
                                                <div className="flex items-center justify-center border border-slate-200 rounded-xl bg-slate-50/50 p-1 shadow-sm focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all w-28 mx-auto">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const current = parseFloat(p.cantidad) || 0;
                                                            if (current > 1) {
                                                                handlePartidaChange(idx, 'cantidad', (current - 1).toString());
                                                            } else if (current > 0.1) {
                                                                handlePartidaChange(idx, 'cantidad', (current - 0.1).toFixed(1));
                                                            }
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-primary-600 hover:shadow-sm active:scale-95 transition-all font-bold text-base select-none"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number" min="0.001" step="0.001"
                                                        value={p.cantidad}
                                                        onChange={e => handlePartidaChange(idx, 'cantidad', e.target.value)}
                                                        className="w-12 text-center border-0 bg-transparent text-sm font-extrabold text-slate-800 outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const current = parseFloat(p.cantidad) || 0;
                                                            if (current >= 1) {
                                                                handlePartidaChange(idx, 'cantidad', (current + 1).toString());
                                                            } else {
                                                                handlePartidaChange(idx, 'cantidad', (current + 0.1).toFixed(1));
                                                            }
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-primary-600 hover:shadow-sm active:scale-95 transition-all font-bold text-base select-none"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-middle">
                                                <div className="relative border border-slate-200 rounded-xl bg-white shadow-sm focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all w-32 ml-auto">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-xs">$</span>
                                                    <input
                                                        type="number" min="0" step="0.01"
                                                        value={p.valor_unitario}
                                                        onChange={e => handlePartidaChange(idx, 'valor_unitario', e.target.value)}
                                                        className="w-full pl-7 pr-3 py-2 text-right border-0 bg-transparent text-sm font-extrabold text-slate-800 focus:outline-none outline-none font-mono tracking-tight"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-middle text-right">
                                                <div className="relative border border-slate-200 rounded-xl bg-white shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all w-28 ml-auto">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-xs">$</span>
                                                    <input
                                                        type="number" min="0" step="0.01"
                                                        value={p.descuento}
                                                        onChange={e => handlePartidaChange(idx, 'descuento', e.target.value)}
                                                        className="w-full pl-6 pr-3 py-2 text-right border-0 bg-transparent text-sm font-extrabold text-emerald-600 focus:outline-none outline-none font-mono tracking-tight"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-middle text-right">
                                                <div className="py-2 px-1 font-black text-slate-800 text-sm font-mono tracking-tight">
                                                    ${((parseFloat(p.cantidad) || 0) * (parseFloat(p.valor_unitario) || 0) - (parseFloat(p.descuento) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-middle text-center">
                                                <button onClick={() => handleRemovePartida(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-95">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Totales y Resumen Final */}
                <div className="flex justify-end pt-4 mb-10">
                    <div className="w-full md:w-[450px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible relative">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-slate-400" /> Resumen y Totales
                            </h2>
                            <div className="relative">
                                <button
                                    onClick={() => setShowLocalTaxMenu(!showLocalTaxMenu)}
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10.5px] font-bold hover:bg-indigo-700 transition-all uppercase flex items-center gap-1.5 shadow-sm active:scale-95"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Impuestos Locales
                                </button>
                                {showLocalTaxMenu && (
                                    <div className="absolute right-0 mt-2 w-[calc(100vw-2.5rem)] sm:w-[420px] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-4 py-2 border-b border-slate-100 mb-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catálogo de Construcción</span>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto custom-scrollbar px-2 py-1">
                                            {catImpuestosLocales.map(imp => (
                                                <button
                                                    key={imp.id}
                                                    onClick={() => {
                                                        const base = totales.subtotal - totales.descuento;
                                                        const tasaDecimal = parseFloat(imp.tasa);
                                                        const importe = Math.round(base * tasaDecimal * 100) / 100;
                                                        const key = imp.tipo === 'traslado' ? 'traslados' : 'retenciones';
                                                        setImpuestosLocales({
                                                            ...impuestosLocales,
                                                            [key]: [...impuestosLocales[key], { impuesto: imp.nombre, tasa: tasaDecimal, importe }]
                                                        });
                                                        setShowLocalTaxMenu(false);
                                                    }}
                                                    className="w-full text-left px-2 py-2 hover:bg-slate-50 flex items-start gap-3 rounded-lg transition-colors group border-b border-slate-100/50 last:border-0"
                                                >
                                                    <div className={`flex-shrink-0 w-[72px] flex flex-col items-center justify-center py-1 rounded-md border text-center transition-all ${
                                                        imp.tipo === 'traslado'
                                                            ? 'bg-indigo-50 border-indigo-100 text-indigo-700 group-hover:bg-indigo-100 group-hover:border-indigo-200'
                                                            : 'bg-amber-50 border-amber-100 text-amber-700 group-hover:bg-amber-100 group-hover:border-amber-200'
                                                    }`}>
                                                        <span className="text-[11px] font-black tracking-tight leading-none">
                                                            {(parseFloat(imp.tasa) * 100).toFixed(2)}%
                                                        </span>
                                                        <span className="text-[8px] font-black uppercase tracking-wider mt-0.5 opacity-80 leading-none">
                                                            {imp.tipo}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center min-h-[28px]">
                                                        <span className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-900 transition-colors block leading-tight break-words">
                                                            {imp.nombre}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                            {catImpuestosLocales.length === 0 && (
                                                <div className="px-4 py-6 text-center text-xs text-slate-400">No hay impuestos configurados</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex flex-col gap-2 pb-2 mb-2 border-b border-slate-100">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={preciosIncluyenIva}
                                        onChange={(e) => setPreciosIncluyenIva(e.target.checked)}
                                        className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Precios incluyen IVA (Desglosar)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        id="ajusteManual"
                                        checked={ajusteManual}
                                        onChange={(e) => setAjusteManual(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Habilitar Ajuste Manual de Decimales</span>
                                </label>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Subtotal</span>
                                {ajusteManual ? (
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={valoresManuales.subtotal}
                                            onChange={(e) => setValoresManuales({ ...valoresManuales, subtotal: e.target.value })}
                                            onBlur={() => setValoresManuales(prev => ({ ...prev, subtotal: (parseFloat(valoresManuales.subtotal) || 0).toFixed(2) }))}
                                            className="w-32 px-2 py-1 border border-slate-200 rounded text-right text-xs font-semibold focus:ring-1 focus:ring-indigo-400 outline-none bg-white shadow-sm"
                                        />
                                    </div>
                                ) : (
                                    <span className="font-medium text-slate-800">${totales.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                )}
                            </div>

                            {totales.descuento > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span>Descuento</span>
                                    <span>- ${totales.descuento.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {ajusteManual ? (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Impuestos Trasladados (IVA)</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-400">+ $</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={valoresManuales.total_impuestos_trasladados}
                                            onChange={(e) => setValoresManuales({ ...valoresManuales, total_impuestos_trasladados: e.target.value })}
                                            onBlur={() => setValoresManuales(prev => ({ ...prev, total_impuestos_trasladados: (parseFloat(valoresManuales.total_impuestos_trasladados) || 0).toFixed(2) }))}
                                            className="w-32 px-2 py-1 border border-slate-200 rounded text-right text-xs font-semibold focus:ring-1 focus:ring-indigo-400 outline-none bg-white shadow-sm"
                                        />
                                    </div>
                                </div>
                            ) : (
                                Object.entries(totales.desgloseTraslados).map(([nombre, importe]) => (
                                    <div key={nombre} className="flex justify-between text-sm">
                                        <span className="text-slate-500">Traslado {nombre}</span>
                                        <span className="font-medium text-slate-700">+ ${importe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                ))
                            )}

                            {ajusteManual ? (
                                <div className="flex justify-between items-center text-sm text-red-600">
                                    <span>Impuestos Retenidos</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-400">- $</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={valoresManuales.total_impuestos_retenidos}
                                            onChange={(e) => setValoresManuales({ ...valoresManuales, total_impuestos_retenidos: e.target.value })}
                                            onBlur={() => setValoresManuales(prev => ({ ...prev, total_impuestos_retenidos: (parseFloat(valoresManuales.total_impuestos_retenidos) || 0).toFixed(2) }))}
                                            className="w-32 px-2 py-1 border border-slate-200 rounded text-right text-xs font-semibold focus:ring-1 focus:ring-indigo-400 outline-none bg-white shadow-sm text-red-700"
                                        />
                                    </div>
                                </div>
                            ) : (
                                Object.entries(totales.desgloseRetenciones).map(([nombre, importe]) => (
                                    <div key={nombre} className="flex justify-between text-sm text-red-600">
                                        <span>Retención {nombre}</span>
                                        <span>- ${importe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                ))
                            )}

                            {/* Listado editable de Impuestos Locales */}
                            {(impuestosLocales.traslados.length > 0 || impuestosLocales.retenciones.length > 0) && (
                                <div className="pt-2 mt-2 border-t border-slate-100 space-y-3">
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Impuestos Locales (Construcción)</p>
                                    
                                    {impuestosLocales.traslados.map((t, i) => (
                                        <div key={`tl-${i}`} className="flex items-center justify-between gap-4 group bg-indigo-50/30 p-2 rounded-lg border border-indigo-100/50">
                                            <div className="flex-1">
                                                <span className="text-[11px] font-bold text-slate-700 block leading-tight">{t.impuesto}</span>
                                                <span className="text-[9px] text-indigo-500 font-bold uppercase">Traslado Local ({(t.tasa * 100).toFixed(2)}%)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-xs">$</span>
                                                <input 
                                                    type="number" step="0.01"
                                                    value={t.importe}
                                                    onChange={(e) => handleUpdateImpuestoLocal('traslados', i, 'importe', e.target.value)}
                                                    className="w-24 px-2 py-1 border border-indigo-200 rounded text-right text-xs font-black focus:ring-1 focus:ring-indigo-400 outline-none bg-white shadow-sm"
                                                />
                                                <button onClick={() => handleRemoveImpuestoLocal('traslados', i)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><X className="w-3 h-3"/></button>
                                            </div>
                                        </div>
                                    ))}

                                    {impuestosLocales.retenciones.map((r, i) => (
                                        <div key={`rl-${i}`} className="flex items-center justify-between gap-4 group bg-orange-50/30 p-2 rounded-lg border border-orange-100/50">
                                            <div className="flex-1">
                                                <span className="text-[11px] font-bold text-slate-700 block leading-tight">{r.impuesto}</span>
                                                <span className="text-[9px] text-orange-500 font-bold uppercase">Retención Local ({(r.tasa * 100).toFixed(2)}%)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-xs">$</span>
                                                <input 
                                                    type="number" step="0.01"
                                                    value={r.importe}
                                                    onChange={(e) => handleUpdateImpuestoLocal('retenciones', i, 'importe', e.target.value)}
                                                    className="w-24 px-2 py-1 border border-orange-200 rounded text-right text-xs font-black focus:ring-1 focus:ring-orange-400 outline-none bg-white shadow-sm text-orange-700"
                                                />
                                                <button onClick={() => handleRemoveImpuestoLocal('retenciones', i)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><X className="w-3 h-3"/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-200">
                                <div className="flex flex-col gap-1">
                                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Gran Total</span>
                                    <div className="flex items-center gap-2">
                                        {ajusteManual ? (
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 text-lg">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={valoresManuales.total}
                                                    onChange={(e) => setValoresManuales({ ...valoresManuales, total: e.target.value })}
                                                    onBlur={() => setValoresManuales(prev => ({ ...prev, total: (parseFloat(valoresManuales.total) || 0).toFixed(2) }))}
                                                    className="w-40 px-2 py-1 border border-indigo-300 rounded text-right text-base font-black focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm text-primary-600"
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-4xl font-black text-primary-600">
                                                ${totales.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        )}
                                        <span className="text-sm font-bold text-slate-400">{facturaData.moneda}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Modal Buscador de Conceptos */}
            {showConceptoModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">Agregar Concepto al Comprobante</h3>
                            <button onClick={() => setShowConceptoModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-4 border-b border-slate-100 relative bg-white flex items-center justify-between gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar en tu catálogo..."
                                    value={conceptoSearch}
                                    onChange={e => setConceptoSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 text-sm bg-slate-50"
                                />
                            </div>
                            <button
                                onClick={() => setShowNuevoConceptoModal(true)}
                                className="px-3 py-2 text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg shadow-sm transition-colors flex items-center gap-1 whitespace-nowrap"
                            >
                                <PackagePlus className="w-4 h-4" /> Crear Nuevo
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {filteredConceptos.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm">No se encontraron conceptos.</div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredConceptos.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => handleAddConcepto(c)}
                                            className="w-full text-left p-3 hover:bg-slate-50 rounded-lg flex justify-between items-center group transition-colors border border-transparent hover:border-slate-200"
                                        >
                                            <div>
                                                <div className="font-medium text-slate-700">{c.descripcion}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 rounded">{c.clave_prod_serv}</span>
                                                    <span className="text-[10px] text-slate-400">UNIDAD: {c.clave_unidad}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold text-primary-600">${Number(c.valor_unitario).toFixed(2)}</div>
                                                <div className="text-xs text-slate-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Agregar +
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add Modals */}
            <ReceptorModal
                isOpen={showReceptorModal}
                onClose={() => setShowReceptorModal(false)}
                onSaved={handleReceptorSaved}
            />

            <ConceptoModal
                isOpen={showNuevoConceptoModal}
                onClose={() => setShowNuevoConceptoModal(false)}
                onSaved={handleConceptoSaved}
            />

            {/* Modal de Edición/Vista de Descripción */}
            {descModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-800">
                                {descModal.editable ? 'Editar Descripción del Concepto' : 'Descripción del Concepto'}
                            </h3>
                            <button onClick={() => setDescModal({ isOpen: false, idx: null, text: '', editable: false })} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            {descModal.editable ? (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">Descripción (hasta 1000 caracteres)</label>
                                    <textarea
                                        value={descModal.text}
                                        onChange={(e) => setDescModal({ ...descModal, text: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm min-h-[150px] resize-y"
                                        maxLength={1000}
                                        placeholder="Escribe la descripción detallada aquí..."
                                    />
                                    <div className="text-right text-xs text-slate-400 mt-1">
                                        {descModal.text.length} / 1000
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">Contenido de la Descripción</label>
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 whitespace-pre-wrap min-h-[100px] max-h-[300px] overflow-y-auto">
                                        {descModal.text}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 pb-6 px-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                            <button
                                type="button"
                                onClick={() => setDescModal({ isOpen: false, idx: null, text: '', editable: false })}
                                className="px-5 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-white transition-colors shadow-sm"
                            >
                                {descModal.editable ? 'Cancelar' : 'Cerrar'}
                            </button>
                            {descModal.editable && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        handlePartidaChange(descModal.idx, 'descripcion', descModal.text);
                                        setDescModal({ isOpen: false, idx: null, text: '', editable: false });
                                    }}
                                    className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 transition-all shadow-md shadow-primary-500/20 active:scale-95"
                                >
                                    <Save className="w-4 h-4" /> Guardar Descripción
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NuevaFactura;
