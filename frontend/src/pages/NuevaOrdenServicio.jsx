import React, { useState, useEffect, useMemo } from 'react';
import { Save, FileText, Search, X, Laptop, UserPlus, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import { ReceptorModal } from '../components/ReceptorModal';
import { ConceptoModal } from '../components/ConceptoModal';

export const NuevaOrdenServicio = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();

    // Catalogs and Data
    const [receptores, setReceptores] = useState([]);
    const [conceptosCat, setConceptosCat] = useState([]);

    // Selected / Form State
    const [selectedReceptorId, setSelectedReceptorId] = useState('');
    const [ordenData, setOrdenData] = useState({
        fecha_ingreso: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        fecha_entrega_estimada: '',
        folio: '',
        equipo: '',
        marca: '',
        modelo: '',
        numero_serie: '',
        contrasena_equipo: '',
        accesorios_incluidos: '',
        falla_reportada: '',
        diagnostico_tecnico: '',
        moneda: 'MXN'
    });

    const [partidas, setPartidas] = useState([]);
    const [showConceptoModal, setShowConceptoModal] = useState(false);
    const [conceptoSearch, setConceptoSearch] = useState('');
    const [showReceptorModal, setShowReceptorModal] = useState(false);
    const [showNuevoConceptoModal, setShowNuevoConceptoModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [preciosIncluyenIva, setPreciosIncluyenIva] = useState(true);

    const fetchData = async () => {
        if (!activeEmisor) return;
        try {
            const [resReceptores, resConceptos] = await Promise.all([
                api.get(`/receptores/emisor/${activeEmisor.id}`),
                api.get(`/conceptos/emisor/${activeEmisor.id}`)
            ]);
            setReceptores(resReceptores.data);
            setConceptosCat(resConceptos.data);
            
            // Generar folio sugerido basado en la fecha
            const fDate = new Date();
            const sugerido = `OS-${fDate.getFullYear()}${String(fDate.getMonth() + 1).padStart(2, '0')}${String(fDate.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`;
            setOrdenData(prev => ({ ...prev, folio: sugerido }));
        } catch (error) {
            console.error("Error fetching data", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeEmisor]);

    // Calcular Totales Reactivamente
    const totales = useMemo(() => {
        let subtotal = 0;
        let descuento = 0;
        let totalImpuestosTraslados = 0;
        let totalImpuestosRetenidos = 0;

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
            if (!hasTraslado) taxRate = 0.16;

            const netPrice = preciosIncluyenIva ? (price / (1 + taxRate)) : price;
            const netDesc = preciosIncluyenIva ? (desc / (1 + taxRate)) : desc;
            const baseAmount = (qty * netPrice) - netDesc;

            subtotal += (qty * netPrice);
            descuento += netDesc;

            if (p.Impuestos && Array.isArray(p.Impuestos)) {
                p.Impuestos.forEach(imp => {
                    const rate = parseFloat(imp.tasa_cuota);
                    const calcImp = Math.round(baseAmount * rate * 100) / 100;
                    if (imp.tipo === 'traslado') {
                        totalImpuestosTraslados += calcImp;
                    } else if (imp.tipo === 'retencion') {
                        totalImpuestosRetenidos += calcImp;
                    }
                });
            }
        });

        return {
            subtotal,
            descuento,
            totalImpuestosTraslados,
            totalImpuestosRetenidos,
            total: subtotal - descuento + totalImpuestosTraslados - totalImpuestosRetenidos
        };
    }, [partidas, preciosIncluyenIva]);

    const handleAddConcepto = (concepto, tipoDetalle = 'Refaccion') => {
        setPartidas([...partidas, {
            ...concepto,
            tipo_detalle: tipoDetalle,
            cantidad: 1,
            descuento: 0
        }]);
        setShowConceptoModal(false);
        setConceptoSearch('');
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

    const handleGuardarOrden = async () => {
        if (!ordenData.equipo || !ordenData.falla_reportada) {
            showToast('El Equipo y la Falla Reportada son obligatorios.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                emisor_id: activeEmisor.id,
                receptor_id: selectedReceptorId,
                ...ordenData,
                fecha_entrega_estimada: ordenData.fecha_entrega_estimada ? ordenData.fecha_entrega_estimada : null,
                subtotal: totales.subtotal,
                descuento: totales.descuento,
                total_impuestos_trasladados: totales.totalImpuestosTraslados,
                total_impuestos_retenidos: totales.totalImpuestosRetenidos,
                total: totales.total,
                estado: 'Recibido',
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
                    if (!hasTraslado) taxRate = 0.16;
                    
                    const netPrice = preciosIncluyenIva ? (price / (1 + taxRate)) : price;
                    const netDesc = preciosIncluyenIva ? (desc / (1 + taxRate)) : desc;
                    const netImporte = (parseFloat(p.cantidad) || 0) * netPrice - netDesc;
                    
                    return {
                        concepto_id: p.id,
                        tipo_detalle: p.tipo_detalle,
                        clave_prod_serv: p.clave_prod_serv,
                        cantidad: p.cantidad,
                        clave_unidad: p.clave_unidad,
                        descripcion: p.descripcion,
                        valor_unitario: netPrice,
                        importe: netImporte,
                        descuento: netDesc
                    };
                })
            };

            await api.post('/ordenes-servicio', payload);
            showToast('✅ Orden de Servicio Creada');
            
            setTimeout(() => {
                window.location.href = '/ordenes-servicio';
            }, 1000);

        } catch (error) {
            console.error("Error al guardar orden", error);
            const errMsg = error.response?.data?.message || 'Error al guardar';
            showToast(errMsg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!activeEmisor) {
        return <div className="p-8 text-center text-slate-500">Selecciona un emisor para continuar.</div>;
    }

    const filteredConceptos = conceptosCat.filter(c => c.descripcion.toLowerCase().includes(conceptoSearch.toLowerCase()));

    return (
        <div className="max-w-6xl mx-auto pb-12 p-6">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nueva Orden de Servicio</h1>
                    <p className="text-slate-500 text-sm mt-1">Recepción de equipos para diagnóstico y reparación</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleGuardarOrden}
                        disabled={!selectedReceptorId || isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-500 shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Procesando...' : (
                            <>
                                <Save className="w-4 h-4" />
                                Guardar Orden
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="space-y-6">

                {/* Cliente y Fechas */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <h2 className="font-semibold text-slate-800">Datos Generales</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Folio</label>
                            <input
                                type="text"
                                value={ordenData.folio}
                                onChange={e => setOrdenData({ ...ordenData, folio: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Fecha de Ingreso</label>
                            <input
                                type="datetime-local"
                                value={ordenData.fecha_ingreso}
                                onChange={e => setOrdenData({ ...ordenData, fecha_ingreso: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block text-indigo-600">Fecha Estimada Entrega</label>
                            <input
                                type="datetime-local"
                                value={ordenData.fecha_entrega_estimada}
                                onChange={e => setOrdenData({ ...ordenData, fecha_entrega_estimada: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Moneda Cotización</label>
                                <select
                                    value={ordenData.moneda}
                                    onChange={e => setOrdenData({ ...ordenData, moneda: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary-500"
                                >
                                    <option value="MXN">MXN</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 pb-6 border-t border-slate-100 pt-6">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cliente</label>
                        <div className="flex gap-2">
                            <select
                                value={selectedReceptorId}
                                onChange={e => setSelectedReceptorId(e.target.value)}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 text-sm bg-white"
                            >
                                <option value="">-- Seleccionar Cliente --</option>
                                {receptores.map(r => (
                                    <option key={r.id} value={r.id}>{r.razon_social} ({r.rfc})</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setShowReceptorModal(true)}
                                className="px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <UserPlus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Detalles del Equipo */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                        <Laptop className="w-5 h-5 text-slate-400" />
                        <h2 className="font-semibold text-slate-800">Detalles del Equipo</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Equipo <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                placeholder="Ej. Laptop Dell Inspiron, PC Ensamblada, Impresora Epson..."
                                value={ordenData.equipo}
                                onChange={e => setOrdenData({ ...ordenData, equipo: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Marca</label>
                                <input
                                    type="text"
                                    value={ordenData.marca}
                                    onChange={e => setOrdenData({ ...ordenData, marca: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Modelo</label>
                                <input
                                    type="text"
                                    value={ordenData.modelo}
                                    onChange={e => setOrdenData({ ...ordenData, modelo: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Número de Serie</label>
                            <input
                                type="text"
                                value={ordenData.numero_serie}
                                onChange={e => setOrdenData({ ...ordenData, numero_serie: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Contraseña / PIN de acceso</label>
                            <input
                                type="text"
                                value={ordenData.contrasena_equipo}
                                onChange={e => setOrdenData({ ...ordenData, contrasena_equipo: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary-500"
                            />
                        </div>
                        
                        <div className="md:col-span-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Falla Reportada por el Cliente <span className="text-red-500">*</span></label>
                            <textarea
                                rows="3"
                                value={ordenData.falla_reportada}
                                onChange={e => setOrdenData({ ...ordenData, falla_reportada: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                            ></textarea>
                        </div>
                        
                        <div className="md:col-span-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Accesorios Incluidos (Cargador, fundas, etc.)</label>
                            <textarea
                                rows="2"
                                value={ordenData.accesorios_incluidos}
                                onChange={e => setOrdenData({ ...ordenData, accesorios_incluidos: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                            ></textarea>
                        </div>
                        
                        <div className="md:col-span-2 pt-4 border-t border-slate-100">
                            <label className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-2 block">Diagnóstico Técnico (Opcional en recepción)</label>
                            <textarea
                                rows="3"
                                value={ordenData.diagnostico_tecnico}
                                onChange={e => setOrdenData({ ...ordenData, diagnostico_tecnico: e.target.value })}
                                placeholder="Se llenará una vez que el técnico revise el equipo..."
                                className="w-full p-3 border border-indigo-100 bg-indigo-50/30 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            ></textarea>
                        </div>
                    </div>
                </div>

                {/* Conceptos (Mano de obra y refacciones) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-slate-400" />
                            <h2 className="font-semibold text-slate-800">Refacciones y Mano de Obra (Opcional)</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                                <input 
                                    type="checkbox" 
                                    checked={preciosIncluyenIva}
                                    onChange={(e) => setPreciosIncluyenIva(e.target.checked)}
                                    className="rounded border-slate-300 text-primary-600"
                                />
                                Precios con IVA incluido
                            </label>
                            <button
                                onClick={() => setShowConceptoModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Agregar Concepto
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-slate-200">
                                    <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">Tipo</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16">Cant</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descripción</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right w-32">Precio Unit.</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right w-32">Importe</th>
                                    <th className="py-3 px-4 text-center w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {partidas.map((partida, idx) => {
                                    let taxRate = 0;
                                    if (partida.Impuestos && Array.isArray(partida.Impuestos)) {
                                        partida.Impuestos.forEach(imp => {
                                            if (imp.tipo === 'traslado') taxRate += parseFloat(imp.tasa_cuota || 0);
                                        });
                                    }
                                    if(taxRate === 0) taxRate = 0.16;

                                    const priceBase = parseFloat(partida.valor_unitario) || 0;
                                    const netPrice = preciosIncluyenIva ? (priceBase / (1 + taxRate)) : priceBase;
                                    const qty = parseFloat(partida.cantidad) || 0;
                                    const importe = (qty * netPrice);

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                            <td className="py-3 px-4">
                                                <select
                                                    value={partida.tipo_detalle}
                                                    onChange={e => handlePartidaChange(idx, 'tipo_detalle', e.target.value)}
                                                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white outline-none"
                                                >
                                                    <option value="Refaccion">Refacción</option>
                                                    <option value="Mano de Obra">Mano de Obra</option>
                                                    <option value="Servicio">Servicio</option>
                                                </select>
                                            </td>
                                            <td className="py-3 px-4">
                                                <input
                                                    type="number"
                                                    min="0.01" step="0.01"
                                                    value={partida.cantidad}
                                                    onChange={e => handlePartidaChange(idx, 'cantidad', e.target.value)}
                                                    className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center bg-white focus:ring-2 focus:ring-primary-500/20 outline-none"
                                                />
                                            </td>
                                            <td className="py-3 px-4">
                                                <textarea
                                                    rows={1}
                                                    value={partida.descripcion}
                                                    onChange={e => handlePartidaChange(idx, 'descripcion', e.target.value)}
                                                    className="w-full text-sm font-medium text-slate-700 bg-transparent border-0 border-b border-transparent focus:border-primary-300 focus:ring-0 resize-none overflow-hidden"
                                                    onInput={(e) => {
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = (e.target.scrollHeight) + 'px';
                                                    }}
                                                />
                                            </td>
                                            <td className="py-3 px-4">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={partida.valor_unitario}
                                                    onChange={e => handlePartidaChange(idx, 'valor_unitario', e.target.value)}
                                                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right bg-white focus:ring-2 focus:ring-primary-500/20 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-sm font-semibold text-slate-700">
                                                ${importe.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => handleRemovePartida(idx)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {partidas.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-8 text-center text-slate-400">
                                            <p className="text-sm">Aún no se agregan costos. Esto se puede actualizar después del diagnóstico.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Totales */}
                    <div className="bg-slate-50 border-t border-slate-200 p-6 flex flex-col md:flex-row justify-end items-start gap-8">
                        <div className="w-full md:w-80 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="font-mono text-slate-700">${totales.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {totales.totalImpuestosTraslados > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">IVA Trasladado</span>
                                    <span className="font-mono text-slate-700">${totales.totalImpuestosTraslados.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                                <span className="font-bold text-slate-800 text-lg">Total Estimado</span>
                                <span className="font-mono font-bold text-primary-700 text-xl">
                                    ${totales.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-sm text-slate-500">{ordenData.moneda}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Modals */}
            {showConceptoModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Agregar Concepto a Orden</h3>
                            <button onClick={() => setShowConceptoModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-100 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text" placeholder="Buscar refacción o mano de obra..."
                                    value={conceptoSearch} onChange={e => setConceptoSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                            <button onClick={() => setShowNuevoConceptoModal(true)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
                                Nuevo Concepto
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 bg-slate-50/50 custom-scrollbar flex-1">
                            {filteredConceptos.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">No se encontraron conceptos.</p>
                            ) : (
                                <div className="grid gap-3">
                                    {filteredConceptos.map(c => (
                                        <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-primary-300 transition-colors flex justify-between items-center group">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-mono rounded font-medium">{c.no_identificacion || c.clave_prod_serv}</span>
                                                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{c.unidad}</span>
                                                </div>
                                                <p className="font-semibold text-slate-800 text-sm line-clamp-2">{c.descripcion}</p>
                                                <p className="text-primary-600 font-mono text-sm mt-1 font-semibold">${Number(c.valor_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleAddConcepto(c, 'Mano de Obra')}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                                >
                                                    + Mano de Obra
                                                </button>
                                                <button
                                                    onClick={() => handleAddConcepto(c, 'Refaccion')}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                                >
                                                    + Refacción
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showReceptorModal && (
                <ReceptorModal
                    isOpen={showReceptorModal}
                    onClose={() => setShowReceptorModal(false)}
                    onSaved={handleReceptorSaved}
                />
            )}

            {showNuevoConceptoModal && (
                <ConceptoModal
                    isOpen={showNuevoConceptoModal}
                    onClose={() => setShowNuevoConceptoModal(false)}
                    onSaved={handleConceptoSaved}
                />
            )}
        </div>
    );
};

export default NuevaOrdenServicio;
