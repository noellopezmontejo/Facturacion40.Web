import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CheckCircle2, ChevronRight, ChevronLeft, MapPinned, Save, AlertTriangle } from 'lucide-react';
import api from '../api/axios';

const STEPS = ['Generales', 'Rutas', 'Mercancías', 'Autotransporte', 'Operadores', 'Resumen'];

const CartaPorteWizard = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const emisorId = activeEmisor?.id;
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Catalogos
    const [receptores, setReceptores] = useState([]);
    const [vehiculos, setVehiculos] = useState([]);
    const [choferes, setChoferes] = useState([]);
    const [conceptos, setConceptos] = useState([]);
    
    // Sepomex State for Ubicaciones
    const [coloniasOptions, setColoniasOptions] = useState({});
    const [fetchingCpIdx, setFetchingCpIdx] = useState(null);
    const [showReceptorModal, setShowReceptorModal] = useState(false);
    const [activeUbiIdxForModal, setActiveUbiIdxForModal] = useState(null);
    const [usosCfdiOpt, setUsosCfdiOpt] = useState([]);
    const [regimenesOpt, setRegimenesOpt] = useState([]);
    const [receptorFormData, setReceptorFormData] = useState({
        rfc: '', razon_social: '', uso_cfdi: 'S01', regimen_fiscal: '601', codigo_postal: '', estado: '', municipio: '', colonia: '',
        calle: '', no_exterior: '', no_interior: ''
    });
    const [isFetchingModalCP, setIsFetchingModalCP] = useState(false);
    const [modalColonias, setModalColonias] = useState([]);

    // Concepto Modal State
    const [showConceptoModal, setShowConceptoModal] = useState(false);
    const [activeMercIdxForModal, setActiveMercIdxForModal] = useState(null);
    const [conceptoFormData, setConceptoFormData] = useState({
        clave_prod_serv: '', descripcion: '', clave_unidad: 'H87', unidad: 'PIEZA', valor_unitario: 0
    });

    // Vehiculo Modal State
    const [showVehiculoModal, setShowVehiculoModal] = useState(false);
    const [vehiculoFormData, setVehiculoFormData] = useState({
        id: null, nombre_interno: '', permiso_sct: 'TPAF01', num_permiso_sct: '', config_vehicular: 'VL', placa: '', anio_modelo: new Date().getFullYear(), asegura_resp_civil: '', poliza_resp_civil: '', subtipo_remolque: '', placa_remolque: ''
    });

    // Chofer Modal State
    const [showChoferModal, setShowChoferModal] = useState(false);
    const [choferFormData, setChoferFormData] = useState({
        id: null, rfc_figura: '', num_licencia: '', nombre_figura: '', codigo_postal: '', estado: '', municipio: '', localidad: '', colonia: '', calle: '', numero_exterior: '', numero_interior: ''
    });

    // Master Payload State
    const [payload, setPayload] = useState({
        emisor_id: emisorId || '',
        receptor_id: '',
        tipo_comprobante: 'T', // T = Traslado, I = Ingreso
        forma_pago: '03',
        metodo_pago: 'PUE',
        uso_cfdi: 'S01',
        detalles: [],
        cartaPorte: {
            transp_internac: 'No',
            total_dist_rec: 0,
            peso_bruto_total: 0,
            peso_neto_total: 0,
            ubicaciones: [
                { tipo_ubicacion: 'Origen', rfc_remitente_destinatario: '', nombre_remitente_destinatario: '', fecha_hora_salida_llegada: new Date().toISOString().slice(0,16), distancia_recorrida: 0, calle: '', numero_exterior: '', numero_interior: '', colonia: '', localidad: '', municipio: '', municipio_desc: '', codigo_postal: '', estado: '', estado_desc: '' },
                { tipo_ubicacion: 'Destino', rfc_remitente_destinatario: '', nombre_remitente_destinatario: '', fecha_hora_salida_llegada: new Date().toISOString().slice(0,16), distancia_recorrida: 0, calle: '', numero_exterior: '', numero_interior: '', colonia: '', localidad: '', municipio: '', municipio_desc: '', codigo_postal: '', estado: '', estado_desc: '' }
            ],
            mercancias: [],
            autotransporte: null,
            figuras: []
        }
    });

    useEffect(() => {
        if (emisorId) {
            Promise.all([
                api.get(`/receptores/emisor/${emisorId}`),
                api.get(`/vehiculos?emisor_id=${emisorId}`),
                api.get(`/choferes?emisor_id=${emisorId}`),
                api.get(`/conceptos/emisor/${emisorId}`),
                api.get('/catalogos/usos-cfdi'),
                api.get('/catalogos/regimenes-fiscales')
            ]).then(([resRec, resVeh, resChof, resCon, resUso, resReg]) => {
                setReceptores(resRec.data); 
                setVehiculos(resVeh.data); 
                setChoferes(resChof.data); 
                setConceptos(resCon.data);
                setUsosCfdiOpt(resUso.data);
                setRegimenesOpt(resReg.data);
            }).catch(e => showToast('Error cargando catálogos para Carta Porte', 'error'));
        }
    }, [emisorId]);

    // SEPOMEX for Modal
    useEffect(() => {
        const fetchSepomex = async () => {
            if (receptorFormData.codigo_postal.length === 5) {
                setIsFetchingModalCP(true);
                try {
                    const res = await api.get(`/sepomex/cp/${receptorFormData.codigo_postal}`);
                    setModalColonias(res.data.colonias);
                    if (res.data.colonias.length > 0) {
                        setReceptorFormData(prev => ({
                            ...prev,
                            estado: res.data.estado.nombre,
                            municipio: res.data.municipio.nombre,
                            colonia: res.data.colonias[0].nombre
                        }));
                    }
                } catch (error) {
                    setModalColonias([]);
                } finally {
                    setIsFetchingModalCP(false);
                }
            }
        };
        fetchSepomex();
    }, [receptorFormData.codigo_postal]);

    // SEPOMEX for Chofer Modal
    useEffect(() => {
        const fetchChoferCP = async () => {
            if (choferFormData.codigo_postal?.length === 5) {
                try {
                    const res = await api.get(`/sepomex/cp/${choferFormData.codigo_postal}`);
                    if (res.data.colonias.length > 0) {
                        setChoferFormData(prev => ({
                            ...prev,
                            estado: res.data.estado.c_estado,
                            municipio: res.data.municipio.c_municipio,
                            colonia: prev.colonia || res.data.colonias[0].c_colonia
                        }));
                    }
                } catch (error) {
                    console.error("Error fetching CP for Chofer", error);
                }
            }
        };
        fetchChoferCP();
    }, [choferFormData.codigo_postal]);


    const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    const submitCP = async () => {
        setLoading(true);
        try {
            // Recalculate weights and distances
            let total_dist = 0;
            payload.cartaPorte.ubicaciones.forEach(u => { if(u.tipo_ubicacion==='Destino') total_dist += parseFloat(u.distancia_recorrida||0); });
            
            // Si el usuario no ingresó un peso bruto, calcularlo de las mercancías
            let total_peso = parseFloat(payload.cartaPorte.peso_bruto_total) || 0;
            if (total_peso <= 0) {
                payload.cartaPorte.mercancias.forEach(m => total_peso += parseFloat(m.peso_en_kg||0));
            }

            const finalPayload = { 
                ...payload, 
                cartaPorte: { ...payload.cartaPorte, total_dist_rec: total_dist, peso_bruto_total: total_peso }
            };


            const res = await api.post('/carta-porte/emitir', finalPayload);
            showToast('Carta Porte Timbrada con éxito: ' + res.data.uuid, 'success');
            // Reset or Redirect
            window.location.href = '/documentos';
        } catch (error) {
            showToast(error.response?.data?.message || 'Error timbrando Carta Porte', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- STEP COMPONENTS RENDERING ---
    const renderStepGenerales = () => (
        <div className="space-y-6 animate-fadeIn">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Datos del Comprobante</h2>
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Emisión</label>
                    <div className="flex gap-4">
                        <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-colors ${payload.tipo_comprobante === 'T' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                            <input type="radio" className="hidden" checked={payload.tipo_comprobante === 'T'} onChange={() => setPayload({...payload, tipo_comprobante: 'T', detalles: [{concepto_id: null, cantidad: 1, valor_unitario: 0, descuento: 0, es_objeto_imp: '01'}]})} />
                            <span className="block font-bold text-slate-800">CFDI Traslado</span>
                            <span className="text-xs text-slate-500">Muevo mercancía propia. Total $0</span>
                        </label>
                        <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-colors ${payload.tipo_comprobante === 'I' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                            <input type="radio" className="hidden" checked={payload.tipo_comprobante === 'I'} onChange={() => setPayload({...payload, tipo_comprobante: 'I'})} />
                            <span className="block font-bold text-slate-800">CFDI Ingreso</span>
                            <span className="text-xs text-slate-500">Cobro flete a un cliente. Total {'>'}0</span>
                        </label>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Receptor (Destinatario / Cliente)</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg" value={payload.receptor_id} onChange={(e) => setPayload({...payload, receptor_id: e.target.value})}>
                        <option value="">Seleccione Receptor...</option>
                        {receptores.map(r => <option key={r.id} value={r.id}>{r.razon_social} ({r.rfc})</option>)}
                    </select>
                </div>
            </div>
            
            {payload.tipo_comprobante === 'I' && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-4">
                    <h3 className="font-bold text-orange-800 text-sm flex items-center gap-2"><AlertTriangle size={16}/> CFDI Ingreso - Detalle de Cobro (Flete)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Concepto Flete</label>
                            <select className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" onChange={(e) => {
                                const c = conceptos.find(x => x.id == e.target.value);
                                if(c) setPayload({...payload, detalles: [{concepto_id: c.id, cantidad: 1, valor_unitario: c.valor_unitario, descuento: 0, es_objeto_imp: '02', retencion_iva: true, retencion_isr: false}]});
                            }}>
                                <option value="">Seleccione concepto de cobro...</option>
                                {conceptos.map(c => <option key={c.id} value={c.id}>{c.descripcion} - ${c.valor_unitario}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Precio Cobrado</label>
                            <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={payload.detalles[0]?.valor_unitario || 0} onChange={(e) => {
                                const d = [...payload.detalles]; if(d[0]) d[0].valor_unitario = parseFloat(e.target.value); setPayload({...payload, detalles: d});
                            }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const updateUbicacion = (idx, field, val) => {
        const ubs = [...payload.cartaPorte.ubicaciones];
        ubs[idx][field] = val;
        setPayload({...payload, cartaPorte: {...payload.cartaPorte, ubicaciones: ubs}});
    };

    const handleCpChange = async (idx, cp) => {
        updateUbicacion(idx, 'codigo_postal', cp);
        if (cp.length === 5) {
            setFetchingCpIdx(idx);
            try {
                const res = await api.get(`/sepomex/cp/${cp}`);
                const cols = res.data.colonias || [];
                setColoniasOptions(prev => ({...prev, [idx]: cols}));
                if (cols.length > 0) {
                    const ubs = [...payload.cartaPorte.ubicaciones];
                    ubs[idx].codigo_postal = cp;
                    ubs[idx].estado = res.data.estado.c_estado;
                    ubs[idx].estado_desc = res.data.estado.nombre;
                    ubs[idx].municipio = res.data.municipio.c_municipio;
                    ubs[idx].municipio_desc = res.data.municipio.nombre;
                    ubs[idx].colonia = cols[0].c_colonia;
                    setPayload({...payload, cartaPorte: {...payload.cartaPorte, ubicaciones: ubs}});
                }
            } catch (error) {
                setColoniasOptions(prev => ({...prev, [idx]: []}));
            } finally {
                setFetchingCpIdx(null);
            }
        }
    };

    const handleSelectReceptor = (idx, receptorId) => {
        const r = receptores.find(x => x.id == receptorId);
        if (!r) return;
        
        const ubs = [...payload.cartaPorte.ubicaciones];
        ubs[idx].rfc_remitente_destinatario = r.rfc;
        ubs[idx].nombre_remitente_destinatario = r.razon_social;
        ubs[idx].calle = r.calle || ubs[idx].calle;
        ubs[idx].numero_exterior = r.no_exterior || ubs[idx].numero_exterior;
        ubs[idx].numero_interior = r.no_interior || ubs[idx].numero_interior;
        ubs[idx].codigo_postal = r.codigo_postal;
        
        // Trigger CP change to fetch geodata
        handleCpChange(idx, r.codigo_postal);
        
        setPayload({...payload, cartaPorte: {...payload.cartaPorte, ubicaciones: ubs}});
    };

    const handleSaveNewReceptor = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/receptores', { ...receptorFormData, emisor_id: emisorId });
            const newReceptor = res.data;
            setReceptores([...receptores, newReceptor]);
            showToast('✅ Receptor registrado correctamente');
            
            if (activeUbiIdxForModal !== null) {
                handleSelectReceptor(activeUbiIdxForModal, newReceptor.id);
            }
            
            setShowReceptorModal(false);
            setReceptorFormData({ 
                rfc: '', razon_social: '', uso_cfdi: 'S01', regimen_fiscal: '601', 
                codigo_postal: '', estado: '', municipio: '', colonia: '',
                calle: '', no_exterior: '', no_interior: ''
            });
        } catch (error) {
            showToast('Error al registrar receptor', 'error');
        }
    };

    const handleSelectConcepto = (idx, conceptoId) => {
        const c = conceptos.find(x => x.id == conceptoId);
        if (!c) return;
        updateMerc(idx, 'bienes_transp', c.clave_prod_serv);
        updateMerc(idx, 'descripcion', c.descripcion);
        updateMerc(idx, 'clave_unidad', c.clave_unidad);
        updateMerc(idx, 'unidad', c.unidad);
        updateMerc(idx, 'valor_mercancia', c.valor_unitario);
    };

    const handleSaveNewConcepto = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/conceptos', { ...conceptoFormData, emisor_id: emisorId });
            const newConcepto = res.data;
            setConceptos([...conceptos, newConcepto]);
            showToast('✅ Concepto registrado correctamente');
            
            if (activeMercIdxForModal !== null) {
                handleSelectConcepto(activeMercIdxForModal, newConcepto.id);
            }
            
            setShowConceptoModal(false);
            setConceptoFormData({ clave_prod_serv: '', descripcion: '', clave_unidad: 'H87', unidad: 'PIEZA', valor_unitario: 0 });
        } catch (error) {
            showToast('Error al registrar concepto', 'error');
        }
    };

    const handleSaveVehiculo = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (vehiculoFormData.id) {
                res = await api.put(`/vehiculos/${vehiculoFormData.id}`, vehiculoFormData);
                setVehiculos(vehiculos.map(v => v.id === vehiculoFormData.id ? res.data : v));
                showToast('✅ Vehículo actualizado');
            } else {
                res = await api.post('/vehiculos', { ...vehiculoFormData, emisor_id: emisorId });
                setVehiculos([...vehiculos, res.data]);
                showToast('✅ Vehículo registrado');
            }
            // Auto-select
            setPayload({...payload, cartaPorte: {...payload.cartaPorte, autotransporte: {
                permiso_sct: res.data.permiso_sct, num_permiso_sct: res.data.num_permiso_sct,
                config_vehicular: res.data.config_vehicular, placa_vm: res.data.placa, anio_modelo_vm: res.data.anio_modelo,
                asegura_resp_civil: res.data.asegura_resp_civil, poliza_resp_civil: res.data.poliza_resp_civil,
                subtipo_remolque: res.data.subtipo_remolque, placa_remolque: res.data.placa_remolque
            }}});
            setShowVehiculoModal(false);
        } catch (error) {
            showToast('Error al guardar vehículo', 'error');
        }
    };

    const handleSaveChofer = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (choferFormData.id) {
                res = await api.put(`/choferes/${choferFormData.id}`, choferFormData);
                setChoferes(choferes.map(c => c.id === choferFormData.id ? res.data : c));
                showToast('✅ Operador actualizado');
            } else {
                res = await api.post('/choferes', { ...choferFormData, emisor_id: emisorId });
                setChoferes([...choferes, res.data]);
                showToast('✅ Operador registrado');
            }
            // Auto-select
            setPayload({...payload, cartaPorte: {...payload.cartaPorte, figuras: [{
                tipo_figura: '01', rfc_figura: res.data.rfc_figura, num_licencia: res.data.num_licencia, nombre_figura: res.data.nombre_figura,
                codigo_postal: res.data.codigo_postal, estado: res.data.estado, municipio: res.data.municipio, colonia: res.data.colonia, calle: res.data.calle, numero_exterior: res.data.numero_exterior, numero_interior: res.data.numero_interior
            }]}});
            setShowChoferModal(false);
        } catch (error) {
            showToast('Error al guardar operador', 'error');
        }
    };

    const renderStepRutas = () => (
        <div className="space-y-6 animate-fadeIn">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Ruta de Viaje (Origen y Destino)</h2>
            {payload.cartaPorte.ubicaciones.map((u, idx) => (
                <div key={idx} className={`p-4 rounded-xl border-l-4 shadow-sm ${u.tipo_ubicacion === 'Origen' ? 'bg-blue-50 border-blue-500' : 'bg-emerald-50 border-emerald-500'}`}>
                    <h3 className={`font-bold pb-2 ${u.tipo_ubicacion === 'Origen' ? 'text-blue-800' : 'text-emerald-800'}`}>
                        {u.tipo_ubicacion === 'Origen' ? 'Punto de Salida (Origen)' : 'Punto de Llegada (Destino)'}
                    </h3>
                    <div className="grid grid-cols-4 gap-4 mb-3 items-end">
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1 flex justify-between items-center">
                                <span>Seleccionar Catálogo</span>
                            </label>
                            <select className="w-full p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium" onChange={(e) => handleSelectReceptor(idx, e.target.value)}>
                                <option value="">-- Buscar Receptor --</option>
                                {receptores.map(r => <option key={r.id} value={r.id}>{r.razon_social}</option>)}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">RFC {u.tipo_ubicacion === 'Origen' ? 'Remitente' : 'Destinatario'}</label>
                            <div className="flex gap-1">
                                <input type="text" maxLength="13" className="w-full p-2 bg-white border border-slate-200 rounded-lg uppercase text-sm" value={u.rfc_remitente_destinatario} onChange={(e) => updateUbicacion(idx, 'rfc_remitente_destinatario', e.target.value)} placeholder="AAA000000XXX"/>
                                <button onClick={() => { setActiveUbiIdxForModal(idx); setShowReceptorModal(true); }} className="px-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700" title="Registrar nuevo receptor">+</button>
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre (Opcional)</label>
                            <input type="text" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.nombre_remitente_destinatario} onChange={(e) => updateUbicacion(idx, 'nombre_remitente_destinatario', e.target.value)} placeholder="Ej. Empresa SA de CV"/>
                        </div>
                        <div className="col-span-1">
                            {u.tipo_ubicacion === 'Origen' ? (
                                <>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha y Hora</label>
                                    <input type="datetime-local" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.fecha_hora_salida_llegada} onChange={(e) => updateUbicacion(idx, 'fecha_hora_salida_llegada', e.target.value)} />
                                </>
                            ) : (
                                <>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Distancia Recorrida (Km)</label>
                                    <input type="number" step="0.1" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.distancia_recorrida} onChange={(e) => updateUbicacion(idx, 'distancia_recorrida', e.target.value)} />
                                </>
                            )}
                        </div>
                    </div>
                    {u.tipo_ubicacion === 'Destino' && (
                        <div className="mb-3">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha y Hora de Llegada</label>
                            <input type="datetime-local" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.fecha_hora_salida_llegada} onChange={(e) => updateUbicacion(idx, 'fecha_hora_salida_llegada', e.target.value)} />
                        </div>
                    )}
                    <div className="grid grid-cols-6 gap-3 mb-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Calle</label>
                            <input type="text" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.calle} onChange={(e) => updateUbicacion(idx, 'calle', e.target.value)} placeholder="Av. Principal"/>
                        </div>
                        <div className="col-span-1 grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Exterior</label>
                                <input type="text" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.numero_exterior} onChange={(e) => updateUbicacion(idx, 'numero_exterior', e.target.value)} placeholder="123"/>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Interior</label>
                                <input type="text" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.numero_interior} onChange={(e) => updateUbicacion(idx, 'numero_interior', e.target.value)} placeholder="A"/>
                            </div>
                        </div>
                        <div className="col-span-1 relative">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">C.P.</label>
                            <input type="text" maxLength="5" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.codigo_postal} onChange={(e) => handleCpChange(idx, e.target.value)} placeholder="00000"/>
                            {fetchingCpIdx === idx && <div className="absolute right-3 top-[28px] w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Colonia</label>
                            {coloniasOptions[idx] && coloniasOptions[idx].length > 0 ? (
                                <select className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={u.colonia} onChange={(e) => updateUbicacion(idx, 'colonia', e.target.value)}>
                                    {coloniasOptions[idx].map(col => <option key={col.id} value={col.c_colonia}>{col.c_colonia} - {col.nombre}</option>)}
                                </select>
                            ) : (
                                <input type="text" maxLength="4" className="w-full p-2 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-sm" value={u.colonia} onChange={(e) => updateUbicacion(idx, 'colonia', e.target.value)} placeholder="0001 (Clave)"/>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-2">
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Municipio</label>
                            <input type="text" disabled className="w-full p-2 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-sm cursor-not-allowed" value={u.municipio_desc ? `${u.municipio} - ${u.municipio_desc}` : u.municipio} placeholder="001 (Clave)" title={u.municipio_desc || "Clave de MUNICIPIO SAT"}/>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Localidad (Op)</label>
                            <input type="text" maxLength="2" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm uppercase" value={u.localidad} onChange={(e) => updateUbicacion(idx, 'localidad', e.target.value)} placeholder="01 (Clave)"/>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
                            <input type="text" disabled className="w-full p-2 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-sm cursor-not-allowed" value={u.estado_desc ? `${u.estado} - ${u.estado_desc}` : u.estado} placeholder="Ej. ROO" title={u.estado_desc || "Clave de ESTADO SAT"}/>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    const addMercancia = () => {
        setPayload({...payload, cartaPorte: {...payload.cartaPorte, mercancias: [...payload.cartaPorte.mercancias, {
            bienes_transp: '', descripcion: '', cantidad: 1, clave_unidad: 'H87', unidad: '', peso_en_kg: 0, valor_mercancia: 0, moneda: 'MXN', material_peligroso: 'No', cve_material_peligroso: '', embalaje: ''
        }]}});
    };

    const updateMerc = (idx, field, val) => {
        const ms = [...payload.cartaPorte.mercancias]; ms[idx][field] = val;
        setPayload({...payload, cartaPorte: {...payload.cartaPorte, mercancias: ms}});
    };

    const renderStepMercancias = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-end border-b pb-2">
                <h2 className="text-xl font-bold text-slate-800">Mercancías Cargadas</h2>
                <button onClick={addMercancia} className="px-3 py-1 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">+ Añadir Bien</button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-1">Peso Bruto Total (KG)</label>
                    <input type="number" step="0.001" className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm font-semibold" value={payload.cartaPorte.peso_bruto_total} onChange={(e) => setPayload({...payload, cartaPorte: {...payload.cartaPorte, peso_bruto_total: e.target.value}})} placeholder="0.000" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-1">Peso Neto Total (KG)</label>
                    <input type="number" step="0.001" className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm font-semibold" value={payload.cartaPorte.peso_neto_total} onChange={(e) => setPayload({...payload, cartaPorte: {...payload.cartaPorte, peso_neto_total: e.target.value}})} placeholder="0.000 (Opcional)" />
                </div>
            </div>
            {payload.cartaPorte.mercancias.map((m, idx) => (
                <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm relative">
                    <button onClick={() => { const ms = [...payload.cartaPorte.mercancias]; ms.splice(idx,1); setPayload({...payload, cartaPorte:{...payload.cartaPorte, mercancias: ms}}) }} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded">X</button>
                    
                    <div className="grid grid-cols-4 gap-4 mb-3 items-end">
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Seleccionar de Catálogo</label>
                            <select className="w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-medium" onChange={(e) => handleSelectConcepto(idx, e.target.value)}>
                                <option value="">-- Buscar Concepto --</option>
                                {conceptos.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Clave SAT (Bienes)</label>
                            <div className="flex gap-1">
                                <input type="text" maxLength="8" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={m.bienes_transp} onChange={(e) => updateMerc(idx, 'bienes_transp', e.target.value)} placeholder="12345678" />
                                <button onClick={() => { setActiveMercIdxForModal(idx); setShowConceptoModal(true); }} className="px-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700" title="Registrar nuevo concepto">+</button>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción de la Mercancía</label>
                            <input type="text" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={m.descripcion} onChange={(e) => updateMerc(idx, 'descripcion', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Cantidad</label>
                            <input type="number" step="0.01" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={m.cantidad} onChange={(e) => updateMerc(idx, 'cantidad', e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Clave Unidad</label>
                            <input type="text" maxLength="3" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm uppercase" value={m.clave_unidad} onChange={(e) => updateMerc(idx, 'clave_unidad', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Peso Estimado (KG)</label>
                            <input type="number" step="0.01" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={m.peso_en_kg} onChange={(e) => updateMerc(idx, 'peso_en_kg', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Valor Comercial ($)</label>
                            <div className="flex gap-2">
                                <input type="number" step="0.01" className="w-2/3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm, w-full" value={m.valor_mercancia} onChange={(e) => updateMerc(idx, 'valor_mercancia', e.target.value)} placeholder="0.00" />
                                <input type="text" maxLength="3" className="w-1/3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm uppercase" value={m.moneda} onChange={(e) => updateMerc(idx, 'moneda', e.target.value)} placeholder="MXN" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-3 p-3 bg-red-50/50 rounded-lg border border-red-100">
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Mat. Peligroso</label>
                            <select className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={m.material_peligroso} onChange={(e) => updateMerc(idx, 'material_peligroso', e.target.value)}>
                                <option value="No">No</option>
                                <option value="Sí">Sí</option>
                            </select>
                        </div>
                        {m.material_peligroso === 'Sí' && (
                            <>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Clave Material (Peligroso)</label>
                                    <input type="text" maxLength="4" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={m.cve_material_peligroso} onChange={(e) => updateMerc(idx, 'cve_material_peligroso', e.target.value)} placeholder="Ej. 1075"/>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Embalaje</label>
                                    <input type="text" maxLength="5" className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" value={m.embalaje} onChange={(e) => updateMerc(idx, 'embalaje', e.target.value)} placeholder="Ej. 1H1"/>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ))}
            {payload.cartaPorte.mercancias.length === 0 && <div className="text-center p-8 text-slate-400 italic">No hay mercancías. Haga clic en Añadir Bien.</div>}
        </div>
    );

    const renderStepAutotransporte = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-end border-b pb-2">
                <h2 className="text-xl font-bold text-slate-800">Selección de Autotransporte (Vehículo)</h2>
                <button onClick={() => { setVehiculoFormData({ id: null, nombre_interno: '', permiso_sct: 'TPAF01', num_permiso_sct: '', config_vehicular: 'VL', placa: '', anio_modelo: 2024, asegura_resp_civil: '', poliza_resp_civil: '', subtipo_remolque: '', placa_remolque: '' }); setShowVehiculoModal(true); }} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">+ Nuevo Vehículo</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {vehiculos.map(v => (
                    <div key={v.id} className={`p-4 rounded-xl border-2 flex items-center justify-between transition-colors ${payload.cartaPorte.autotransporte?.placa_vm === v.placa ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                        <label className="flex items-center gap-4 cursor-pointer flex-1">
                            <input type="radio" name="vehiculo" className="hidden" checked={payload.cartaPorte.autotransporte?.placa_vm === v.placa} onChange={() => {
                                setPayload({...payload, cartaPorte: {...payload.cartaPorte, autotransporte: {
                                    permiso_sct: v.permiso_sct, num_permiso_sct: v.num_permiso_sct,
                                    config_vehicular: v.config_vehicular, placa_vm: v.placa, anio_modelo_vm: v.anio_modelo,
                                    asegura_resp_civil: v.asegura_resp_civil, poliza_resp_civil: v.poliza_resp_civil,
                                    subtipo_remolque: v.subtipo_remolque, placa_remolque: v.placa_remolque
                                }}});
                            }} />
                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-600 font-bold text-xs"><span className="text-[10px] text-slate-400 leading-none">PLACA</span>{v.placa}</div>
                            <div>
                                <p className="font-bold text-slate-800">{v.nombre_interno}</p>
                                <p className="text-xs text-slate-500">Mod. {v.anio_modelo} | {v.config_vehicular}</p>
                                {v.subtipo_remolque && <p className="text-[10px] text-indigo-600 font-bold">Rem: {v.subtipo_remolque} - {v.placa_remolque}</p>}
                            </div>
                        </label>
                        <button onClick={() => { setVehiculoFormData(v); setShowVehiculoModal(true); }} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg" title="Editar Vehículo">
                            <Save size={16} className="rotate-180" /> {/* Simulating edit icon */}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderStepOperadores = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-end border-b pb-2">
                <h2 className="text-xl font-bold text-slate-800">Operador Asignado (Figura Transporte)</h2>
                <button onClick={() => { setChoferFormData({ id: null, rfc_figura: '', num_licencia: '', nombre_figura: '', codigo_postal: '', estado: '', municipio: '', localidad: '', colonia: '', calle: '', numero_exterior: '', numero_interior: '' }); setShowChoferModal(true); }} className="px-3 py-1 bg-fuchsia-600 text-white rounded text-sm hover:bg-fuchsia-700">+ Nuevo Operador</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {choferes.map(c => (
                    <div key={c.id} className={`p-4 rounded-xl border-2 flex items-center justify-between transition-colors ${payload.cartaPorte.figuras[0]?.rfc_figura === c.rfc_figura ? 'border-fuchsia-600 bg-fuchsia-50 shadow-sm' : 'border-slate-200 bg-white hover:border-fuchsia-200'}`}>
                        <label className="flex items-center gap-4 cursor-pointer flex-1">
                            <input type="radio" name="chofer" className="hidden" checked={payload.cartaPorte.figuras[0]?.rfc_figura === c.rfc_figura} onChange={() => {
                                setPayload({...payload, cartaPorte: {...payload.cartaPorte, figuras: [{
                                    tipo_figura: '01', rfc_figura: c.rfc_figura, num_licencia: c.num_licencia, nombre_figura: c.nombre_figura,
                                    codigo_postal: c.codigo_postal, estado: c.estado, municipio: c.municipio, colonia: c.colonia, calle: c.calle, numero_exterior: c.numero_exterior, numero_interior: c.numero_interior
                                }]}});
                            }} />
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200">{c.nombre_figura.charAt(0)}</div>
                            <div>
                                <p className="font-bold text-slate-800">{c.nombre_figura}</p>
                                <p className="text-xs text-slate-500 font-mono">{c.rfc_figura} | Lic: {c.num_licencia}</p>
                                {c.codigo_postal && <p className="text-[10px] text-fuchsia-600 font-bold truncate max-w-[200px]">CP: {c.codigo_postal} - {c.municipio}, {c.estado}</p>}
                            </div>
                        </label>
                        <button onClick={() => { setChoferFormData(c); setShowChoferModal(true); }} className="p-2 text-fuchsia-600 hover:bg-fuchsia-100 rounded-lg" title="Editar Operador">
                            <Save size={16} className="rotate-180" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderStepResumen = () => (
        <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-black text-emerald-600 border-b pb-2 flex items-center gap-2"><CheckCircle2 /> Revisión Final y Timbrado</h2>
            
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Comprobante y Ruta</h3>
                    <p className="text-sm"><strong>Tipo:</strong> CFDI {payload.tipo_comprobante === 'I' ? 'Ingreso' : 'Traslado'}</p>
                    <p className="text-sm"><strong>Puntos Control:</strong> {payload.cartaPorte.ubicaciones.length} Ubicaciones</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Carga y Logística</h3>
                    <p className="text-sm"><strong>Mercancías:</strong> {payload.cartaPorte.mercancias.length} items</p>
                    <p className="text-sm"><strong>Vehículo:</strong> {payload.cartaPorte.autotransporte ? payload.cartaPorte.autotransporte.placa_vm : 'No seleccionado'}</p>
                    <p className="text-sm"><strong>Operador:</strong> {payload.cartaPorte.figuras[0] ? payload.cartaPorte.figuras[0].nombre_figura : 'No seleccionado'}</p>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-sm text-blue-800 flex items-start gap-3">
                <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
                <p>Al hacer clic en Emitir, esta Carta Porte se enviará al SAT y se descontará un folio de su bolsa. <strong>Esta acción es irreversible y genera obligaciones fiscales.</strong></p>
            </div>
        </div>
    );

    const CurrentComponent = [renderStepGenerales, renderStepRutas, renderStepMercancias, renderStepAutotransporte, renderStepOperadores, renderStepResumen][currentStep];

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <MapPinned className="text-indigo-600" size={32} />
                    Asistente Carta Porte 3.1
                </h1>
                <p className="text-slate-500 mt-2">Cumple al instante con el estándar logístico del SAT Anexo 20.</p>
            </div>

            {/* Stepper Header */}
            <div className="flex items-center justify-between mb-8 overflow-hidden relative border border-slate-200 bg-white rounded-2xl p-2 shadow-sm">
                {STEPS.map((step, idx) => (
                    <div key={idx} className={`flex-1 text-center py-2 px-1 relative z-10 font-bold text-xs uppercase tracking-wider transition-colors duration-300 ${currentStep === idx ? 'text-white' : (currentStep > idx ? 'text-slate-700' : 'text-slate-400')}`}>
                        {step}
                    </div>
                ))}
                {/* Active pill background */}
                <div className="absolute top-2 bottom-2 bg-indigo-600 rounded-xl transition-all duration-300 ease-in-out" style={{ left: `calc(${currentStep * (100 / STEPS.length)}% + 4px)`, width: `calc(${100 / STEPS.length}% - 8px)` }}/>
            </div>

            {/* Form Body */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 mb-6 min-h-[400px]">
                {CurrentComponent()}
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center">
                <button onClick={handlePrev} disabled={currentStep === 0 || loading} className={`px-6 py-3 font-bold rounded-xl flex items-center gap-2 transition-colors ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed hidden' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'}`}>
                    <ChevronLeft size={20} /> Anterior
                </button>
                
                {currentStep < STEPS.length - 1 ? (
                    <button onClick={handleNext} className="ml-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 transition-colors shadow-md hover:shadow-lg">
                        Continuar <ChevronRight size={20} />
                    </button>
                ) : (
                    <button onClick={submitCP} disabled={loading} className="ml-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50">
                        {loading ? 'Timbrando CFDI...' : <>Emitir CFDI <Save size={20} /></>}
                    </button>
                )}
            </div>

            {/* Receptor Registration Modal */}
            {showReceptorModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-zoomIn">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-slate-800">Registrar Nuevo Receptor</h3>
                                <p className="text-xs text-slate-500">Añade un cliente al catálogo para uso futuro.</p>
                            </div>
                            <button onClick={() => setShowReceptorModal(false)} className="text-slate-400 hover:text-slate-600 p-2">
                                <ChevronRight className="rotate-90" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNewReceptor} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RFC</label>
                                    <input required value={receptorFormData.rfc} onChange={e => setReceptorFormData({ ...receptorFormData, rfc: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono uppercase" placeholder="XAXX010101000" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Razón Social</label>
                                    <input required value={receptorFormData.razon_social} onChange={e => setReceptorFormData({ ...receptorFormData, razon_social: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm uppercase" placeholder="Nombre completo o Empresa" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">C.P.</label>
                                    <div className="relative">
                                        <input required value={receptorFormData.codigo_postal} onChange={e => setReceptorFormData({ ...receptorFormData, codigo_postal: e.target.value })} type="text" maxLength="5" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" placeholder="64000" />
                                        {isFetchingModalCP && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Colonia</label>
                                    <select value={receptorFormData.colonia} onChange={e => setReceptorFormData({ ...receptorFormData, colonia: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm bg-white">
                                        {modalColonias.map(col => <option key={col.id} value={col.nombre}>{col.nombre}</option>)}
                                        {modalColonias.length === 0 && <option value="">CP Requerido</option>}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Calle</label>
                                    <input value={receptorFormData.calle} onChange={e => setReceptorFormData({ ...receptorFormData, calle: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm uppercase" placeholder="AV. PRINCIPAL" />
                                </div>
                                <div className="col-span-1 flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Ext</label>
                                        <input value={receptorFormData.no_exterior} onChange={e => setReceptorFormData({ ...receptorFormData, no_exterior: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" placeholder="123" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Int</label>
                                        <input value={receptorFormData.no_interior} onChange={e => setReceptorFormData({ ...receptorFormData, no_interior: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" placeholder="A" />
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado</label>
                                    <input disabled value={receptorFormData.estado} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Municipio</label>
                                    <input disabled value={receptorFormData.municipio} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowReceptorModal(false)} className="px-6 py-2 text-slate-500 font-bold text-sm hover:text-slate-700">Cancelar</button>
                                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all text-sm">
                                    REGISTRAR RECEPTOR
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Concepto Registration Modal */}
            {showConceptoModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-zoomIn">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-slate-800">Registrar Nuevo Concepto</h3>
                                <p className="text-xs text-slate-500">Añade un producto/servicio al catálogo.</p>
                            </div>
                            <button onClick={() => setShowConceptoModal(false)} className="text-slate-400 hover:text-slate-600 p-2">
                                <ChevronRight className="rotate-90" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNewConcepto} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Clave SAT (8 Dígitos)</label>
                                    <input required value={conceptoFormData.clave_prod_serv} onChange={e => setConceptoFormData({ ...conceptoFormData, clave_prod_serv: e.target.value })} type="text" maxLength="8" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" placeholder="01010101" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor Unitario (Base)</label>
                                    <input required value={conceptoFormData.valor_unitario} onChange={e => setConceptoFormData({ ...conceptoFormData, valor_unitario: e.target.value })} type="number" step="0.01" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" placeholder="0.00" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descripción</label>
                                    <input required value={conceptoFormData.descripcion} onChange={e => setConceptoFormData({ ...conceptoFormData, descripcion: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm uppercase" placeholder="NOMBRE DEL PRODUCTO" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Clave Unidad</label>
                                    <input required value={conceptoFormData.clave_unidad} onChange={e => setConceptoFormData({ ...conceptoFormData, clave_unidad: e.target.value.toUpperCase() })} type="text" maxLength="3" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" placeholder="H87" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unidad</label>
                                    <input required value={conceptoFormData.unidad} onChange={e => setConceptoFormData({ ...conceptoFormData, unidad: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" placeholder="PIEZA" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowConceptoModal(false)} className="px-6 py-2 text-slate-500 font-bold text-sm hover:text-slate-700">Cancelar</button>
                                <button type="submit" className="px-8 py-2 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all text-sm">
                                    REGISTRAR CONCEPTO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Vehiculo Registration Modal */}
            {showVehiculoModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-zoomIn">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-slate-800">{vehiculoFormData.id ? 'Editar' : 'Registrar'} Vehículo</h3>
                                <p className="text-xs text-slate-500">Configuración para el transporte de mercancías.</p>
                            </div>
                            <button onClick={() => setShowVehiculoModal(false)} className="text-slate-400 hover:text-slate-600 p-2">
                                <ChevronRight className="rotate-90" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveVehiculo} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Interno (Ej. Unidad 01)</label>
                                    <input required value={vehiculoFormData.nombre_interno} onChange={e => setVehiculoFormData({ ...vehiculoFormData, nombre_interno: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm uppercase" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Placa</label>
                                    <input required value={vehiculoFormData.placa} onChange={e => setVehiculoFormData({ ...vehiculoFormData, placa: e.target.value.replace(/-/g,'').toUpperCase() })} type="text" maxLength="7" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono uppercase" placeholder="ABC1234" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Año Modelo</label>
                                    <input required value={vehiculoFormData.anio_modelo} onChange={e => setVehiculoFormData({ ...vehiculoFormData, anio_modelo: e.target.value })} type="number" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Configuración Vehicular</label>
                                    <select value={vehiculoFormData.config_vehicular} onChange={e => setVehiculoFormData({ ...vehiculoFormData, config_vehicular: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm bg-white">
                                        <option value="VL">VL - Vehículo Ligero</option>
                                        <option value="C2">C2 - Camión 2 ejes</option>
                                        <option value="C3">C3 - Camión 3 ejes</option>
                                        <option value="T3S2">T3S2 - Trailer</option>
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Permiso SICT</label>
                                    <input required value={vehiculoFormData.permiso_sct} onChange={e => setVehiculoFormData({ ...vehiculoFormData, permiso_sct: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" placeholder="TPAF01" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Num. Permiso SICT</label>
                                    <input required value={vehiculoFormData.num_permiso_sct} onChange={e => setVehiculoFormData({ ...vehiculoFormData, num_permiso_sct: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subtipo Remolque (Opcional)</label>
                                    <input value={vehiculoFormData.subtipo_remolque || ''} onChange={e => setVehiculoFormData({ ...vehiculoFormData, subtipo_remolque: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" placeholder="CTR004" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Placa Remolque</label>
                                    <input value={vehiculoFormData.placa_remolque || ''} onChange={e => setVehiculoFormData({ ...vehiculoFormData, placa_remolque: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" placeholder="REM1234" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Aseguradora (Nombre)</label>
                                    <input required value={vehiculoFormData.asegura_resp_civil} onChange={e => setVehiculoFormData({ ...vehiculoFormData, asegura_resp_civil: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm uppercase" placeholder="QUALITAS" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Póliza Seguros</label>
                                    <input required value={vehiculoFormData.poliza_resp_civil} onChange={e => setVehiculoFormData({ ...vehiculoFormData, poliza_resp_civil: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowVehiculoModal(false)} className="px-6 py-2 text-slate-500 font-bold text-sm hover:text-slate-700">Cancelar</button>
                                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all text-sm">
                                    {vehiculoFormData.id ? 'ACTUALIZAR' : 'REGISTRAR'} VEHÍCULO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Chofer Registration Modal */}
            {showChoferModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-zoomIn">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-slate-800">{choferFormData.id ? 'Editar' : 'Registrar'} Operador</h3>
                                <p className="text-xs text-slate-500">Datos del chofer para la figura de transporte.</p>
                            </div>
                            <button onClick={() => setShowChoferModal(false)} className="text-slate-400 hover:text-slate-600 p-2">
                                <ChevronRight className="rotate-90" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveChofer} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                                    <input required value={choferFormData.nombre_figura} onChange={e => setChoferFormData({ ...choferFormData, nombre_figura: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/20 outline-none text-sm uppercase" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RFC Operador</label>
                                    <input required value={choferFormData.rfc_figura} onChange={e => setChoferFormData({ ...choferFormData, rfc_figura: e.target.value.toUpperCase() })} type="text" maxLength="13" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/20 outline-none text-sm font-mono uppercase" placeholder="XAXX010101000" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Licencia</label>
                                    <input required value={choferFormData.num_licencia} onChange={e => setChoferFormData({ ...choferFormData, num_licencia: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/20 outline-none text-sm" />
                                </div>
                                <div className="col-span-2 pt-2 border-t border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-700">Domicilio del Operador</h4>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">C.P.</label>
                                    <input value={choferFormData.codigo_postal} onChange={e => setChoferFormData({ ...choferFormData, codigo_postal: e.target.value })} type="text" maxLength="5" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/20 outline-none text-sm" placeholder="00000" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Colonia</label>
                                    <input value={choferFormData.colonia} onChange={e => setChoferFormData({ ...choferFormData, colonia: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/20 outline-none text-sm uppercase" />
                                </div>
                                <div className="col-span-2 grid grid-cols-4 gap-2">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Calle</label>
                                        <input value={choferFormData.calle} onChange={e => setChoferFormData({ ...choferFormData, calle: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/20 outline-none text-sm uppercase" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Ext</label>
                                        <input value={choferFormData.numero_exterior} onChange={e => setChoferFormData({ ...choferFormData, numero_exterior: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/20 outline-none text-sm" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Int</label>
                                        <input value={choferFormData.numero_interior} onChange={e => setChoferFormData({ ...choferFormData, numero_interior: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/20 outline-none text-sm" />
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado</label>
                                    <input disabled value={choferFormData.estado} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm" placeholder="Auto" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Municipio</label>
                                    <input disabled value={choferFormData.municipio} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm" placeholder="Auto" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowChoferModal(false)} className="px-6 py-2 text-slate-500 font-bold text-sm hover:text-slate-700">Cancelar</button>
                                <button type="submit" className="px-8 py-2 bg-fuchsia-600 text-white font-black rounded-xl hover:bg-fuchsia-700 shadow-lg shadow-fuchsia-500/20 transition-all text-sm">
                                    {choferFormData.id ? 'ACTUALIZAR' : 'REGISTRAR'} OPERADOR
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CartaPorteWizard;
