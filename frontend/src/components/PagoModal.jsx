import React, { useState, useEffect } from 'react';
import { X, Search, CreditCard, Calendar, DollarSign, Plus, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

export const PagoModal = ({ isOpen, onClose, emisorId, onSuccess }) => {
    const { showToast } = useToast();
    const [facturasPendientes, setFacturasPendientes] = useState([]);
    const [receptores, setReceptores] = useState([]);
    const [selectedReceptorId, setSelectedReceptorId] = useState('');
    const [formasPago, setFormasPago] = useState([]);
    
    const [pagoData, setPagoData] = useState({
        fecha_pago: new Date().toISOString().slice(0, 16),
        monto: '',
        forma_pago: '01',
        moneda: 'MXN',
        tipo_cambio: '1',
        no_operacion: '',
        rfc_emisor_cta_ord: '',
        nom_banco_ord_ext: '',
        cta_ordenante: '',
        rfc_emisor_cta_ben: '',
        cta_beneficiario: ''
    });

    const [facturasSeleccionadas, setFacturasSeleccionadas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        if (isOpen && emisorId) {
            fetchInitialData();
        }
    }, [isOpen, emisorId]);

    const fetchInitialData = async () => {
        try {
            const [resRec, resFormas] = await Promise.all([
                api.get(`/receptores/emisor/${emisorId}`),
                api.get('/catalogos/formas-pago')
            ]);
            setReceptores(resRec.data);
            setFormasPago(resFormas.data);
        } catch (error) {
            console.error("Error fetching initial data", error);
        }
    };

    useEffect(() => {
        if (selectedReceptorId) {
            api.get(`/pagos/pendientes?emisor_id=${emisorId}&receptor_id=${selectedReceptorId}`)
                .then(res => {
                    setFacturasPendientes(res.data);
                })
                .catch(err => {
                    console.error("Error al cargar pendientes", err);
                    setFacturasPendientes([]);
                });
        } else {
            setFacturasPendientes([]);
        }
    }, [selectedReceptorId, emisorId]);

    const handleAddFactura = (factura) => {
        if (facturasSeleccionadas.find(f => f.documento_id === factura.id)) return;
        
        const saldo = parseFloat(factura.saldo_insoluto !== null ? factura.saldo_insoluto : factura.total);
        
        setFacturasSeleccionadas([...facturasSeleccionadas, {
            documento_id: factura.id,
            serie: factura.serie,
            folio: factura.folio,
            uuid: factura.uuid,
            saldo_anterior: saldo,
            monto_aplicado: saldo,
            saldo_insoluto: 0,
            total: parseFloat(factura.total || 0),
            subtotal: parseFloat(factura.subtotal || 0),
            total_impuestos_trasladados: parseFloat(factura.total_impuestos_trasladados || 0)
        }]);
    };

    const handleRemoveFactura = (id) => {
        setFacturasSeleccionadas(facturasSeleccionadas.filter(f => f.documento_id !== id));
    };

    const handleMontoAplicadoChange = (id, val) => {
        setFacturasSeleccionadas(facturasSeleccionadas.map(f => {
            if (f.documento_id === id) {
                const aplicado = parseFloat(val) || 0;
                return {
                    ...f,
                    monto_aplicado: aplicado,
                    saldo_insoluto: f.saldo_anterior - aplicado
                };
            }
            return f;
        }));
    };

    const totalAplicado = facturasSeleccionadas.reduce((acc, f) => {
        let aplicado = parseFloat(f.monto_aplicado) || 0;
        if (pagoData.moneda !== 'MXN') {
            const tc = parseFloat(pagoData.tipo_cambio) || 1;
            aplicado = aplicado / tc;
        }
        return acc + aplicado;
    }, 0);

    const totalBase = facturasSeleccionadas.reduce((acc, f) => {
        const ratio = f.total > 0 ? (parseFloat(f.monto_aplicado) || 0) / f.total : 0;
        return acc + (f.subtotal * ratio);
    }, 0);

    const totalIVA = facturasSeleccionadas.reduce((acc, f) => {
        const ratio = f.total > 0 ? (parseFloat(f.monto_aplicado) || 0) / f.total : 0;
        let impTrasDoc = f.total_impuestos_trasladados;
        if (impTrasDoc === 0 && f.total > f.subtotal) impTrasDoc = f.total - f.subtotal;
        return acc + (impTrasDoc * ratio);
    }, 0);

    const totalRetenciones = facturasSeleccionadas.reduce((acc, f) => {
        const ratio = f.total > 0 ? (parseFloat(f.monto_aplicado) || 0) / f.total : 0;
        return acc + ((parseFloat(f.total_impuestos_retenidos) || 0) * ratio);
    }, 0);

    const handlePreviewPDF = async () => {
        if (facturasSeleccionadas.length === 0) return showToast("Selecciona al menos una factura para previsualizar", "error");
        
        setLoading(true);
        try {
            const payload = {
                emisor_id: emisorId,
                receptor_id: selectedReceptorId,
                ...pagoData,
                monto: totalAplicado,
                facturas: facturasSeleccionadas
            };
            
            const response = await api.post('/pagos/preview-pdf', payload);
            
            if (response.data?.success && response.data?.pdfUrl) {
                const backendBase = api.defaults.baseURL.replace('/api', '');
                const fileURL = `${backendBase}${response.data.pdfUrl}`;
                setPreviewUrl(fileURL);
            } else {
                throw new Error("No se pudo obtener la URL de vista previa");
            }
        } catch (error) {
            console.error("Error generating PDF preview", error);
            const message = error.response?.data?.message || error.message || "Error de red o del servidor al procesar la vista previa";
            showToast(`❌ ${message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setPreviewUrl(null);
        setPagoData({
            fecha_pago: new Date().toISOString().slice(0, 16),
            monto: '',
            forma_pago: '01',
            moneda: 'MXN',
            tipo_cambio: '1',
            no_operacion: '',
            rfc_emisor_cta_ord: '',
            nom_banco_ord_ext: '',
            cta_ordenante: '',
            rfc_emisor_cta_ben: '',
            cta_beneficiario: ''
        });
        setFacturasSeleccionadas([]);
        setSelectedReceptorId('');
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (facturasSeleccionadas.length === 0) return showToast("Selecciona al menos una factura", "error");
        
        setLoading(true);
        try {
            const payload = {
                emisor_id: emisorId,
                receptor_id: selectedReceptorId,
                ...pagoData,
                monto: totalAplicado,
                facturas: facturasSeleccionadas
            };

            await api.post('/pagos/registrar', payload);
            
            showToast("✅ Pago registrado con éxito");
            
            onSuccess();
            resetForm();
            onClose();
        } catch (error) {
            console.error("Error al registrar pago", error);
            const msg = error.response?.data?.details || error.response?.data?.message || 'Error desconocido';
            showToast("❌ " + msg, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    if (previewUrl) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Vista Previa de Complemento de Pago</h2>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Verifica los datos e impuestos del pago antes de guardar</p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200">
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>

                    <div className="flex-1 p-6 bg-slate-100 flex flex-col overflow-hidden">
                        <iframe 
                            src={previewUrl} 
                            className="w-full h-full rounded-xl border border-slate-200 shadow-md bg-white" 
                            title="Vista Previa PDF"
                        ></iframe>
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setPreviewUrl(null);
                            }}
                            className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-white border border-slate-200 hover:border-slate-300 transition-all flex items-center gap-2"
                        >
                            Volver a Modificar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-8 py-3 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200 transition-all flex items-center gap-2"
                        >
                            {loading ? 'Procesando...' : 'Guardar y Aplicar Pago'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-200">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Registrar Nuevo Pago</h2>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Abonos y Complementos de Pago</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                    {/* Tarjetas de Resumen de Impuestos del Pago (Ancho Completo) */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm animate-in slide-in-from-top duration-200">
                        <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Aplicado</p>
                            <p className="text-xl sm:text-2xl font-black text-slate-800">
                                ${totalAplicado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Base (Prop.)</p>
                            <p className="text-xl sm:text-2xl font-black text-emerald-600">
                                ${totalBase.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IVA 16% (Prop.)</p>
                            <p className="text-xl sm:text-2xl font-black text-indigo-600">
                                ${totalIVA.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Retenciones (Prop.)</p>
                            <p className="text-xl sm:text-2xl font-black text-amber-600">
                                ${totalRetenciones.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Sección Izquierda: Datos del Pago */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-primary-500 rounded-full"></div>
                                Información del Pago
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">RECEPTOR / CLIENTE</label>
                                    <select
                                        value={selectedReceptorId}
                                        onChange={(e) => setSelectedReceptorId(e.target.value)}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:ring-0 transition-all outline-none bg-slate-50/50"
                                        required
                                    >
                                        <option value="">Seleccione un cliente...</option>
                                        {receptores.map(r => (
                                            <option key={r.id} value={r.id}>{r.razon_social} ({r.rfc})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> FECHA DE PAGO
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={pagoData.fecha_pago}
                                        onChange={(e) => setPagoData({...pagoData, fecha_pago: e.target.value})}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:ring-0 transition-all outline-none bg-slate-50/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">FORMA DE PAGO</label>
                                    <select
                                        value={pagoData.forma_pago}
                                        onChange={(e) => setPagoData({...pagoData, forma_pago: e.target.value})}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:ring-0 transition-all outline-none bg-slate-50/50"
                                    >
                                        {formasPago.map(f => (
                                            <option key={f.clave} value={f.clave}>{f.clave} - {f.descripcion}</option>
                                        ))}
                                    </select>
                                </div>

                                <details className="group [&_summary::-webkit-details-marker]:hidden bg-white border-2 border-slate-100 rounded-2xl overflow-hidden transition-all">
                                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1.5 h-3 bg-amber-400 rounded-full"></div>
                                            Datos Bancarios / Moneda (Opcional)
                                        </span>
                                        <span className="transition group-open:rotate-180">
                                            <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24" className="text-slate-400 opacity-50"><path d="M6 9l6 6 6-6"></path></svg>
                                        </span>
                                    </summary>
                                    <div className="p-4 pt-0 space-y-4 bg-white border-t border-slate-100">
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1 uppercase">Moneda de Pago</label>
                                                <select
                                                    value={pagoData.moneda}
                                                    onChange={(e) => setPagoData({...pagoData, moneda: e.target.value})}
                                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-sm focus:border-amber-400 outline-none"
                                                >
                                                    <option value="MXN">MXN - Peso Mexicano</option>
                                                    <option value="USD">USD - Dólar Estadounidense</option>
                                                    <option value="EUR">EUR - Euro</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1 uppercase">Tipo de Cambio</label>
                                                <input
                                                    type="number" step="0.0001"
                                                    value={pagoData.tipo_cambio}
                                                    onChange={(e) => setPagoData({...pagoData, tipo_cambio: e.target.value})}
                                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-sm focus:border-amber-400 outline-none"
                                                    disabled={pagoData.moneda === 'MXN'}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1 uppercase">No. de Operación (SPEI/Cheque)</label>
                                            <input
                                                type="text"
                                                value={pagoData.no_operacion}
                                                onChange={(e) => setPagoData({...pagoData, no_operacion: e.target.value})}
                                                className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-sm focus:border-amber-400 outline-none"
                                                placeholder="Ej. 12903120938"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1 uppercase">RFC Cta. Origen</label>
                                                <input
                                                    type="text"
                                                    value={pagoData.rfc_emisor_cta_ord}
                                                    onChange={(e) => setPagoData({...pagoData, rfc_emisor_cta_ord: e.target.value})}
                                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-sm focus:border-amber-400 outline-none"
                                                    placeholder="RFC Banco Origen"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1 uppercase">Cuenta Origen</label>
                                                <input
                                                    type="text"
                                                    value={pagoData.cta_ordenante}
                                                    onChange={(e) => setPagoData({...pagoData, cta_ordenante: e.target.value})}
                                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-sm focus:border-amber-400 outline-none"
                                                    placeholder="10 a 50 dígitos"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1 uppercase">RFC Cta. Destino</label>
                                                <input
                                                    type="text"
                                                    value={pagoData.rfc_emisor_cta_ben}
                                                    onChange={(e) => setPagoData({...pagoData, rfc_emisor_cta_ben: e.target.value})}
                                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-sm focus:border-amber-400 outline-none"
                                                    placeholder="RFC Su Banco"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1 uppercase">Cuenta Destino</label>
                                                <input
                                                    type="text"
                                                    value={pagoData.cta_beneficiario}
                                                    onChange={(e) => setPagoData({...pagoData, cta_beneficiario: e.target.value})}
                                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-sm focus:border-amber-400 outline-none"
                                                    placeholder="10 a 50 dígitos"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </div>

                        {/* Sección Derecha: Facturas Pendientes */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                                    Facturas Pendientes
                                </div>
                                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-500">{facturasPendientes.length} encontradas</span>
                            </h3>

                            <div className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                                    {facturasPendientes.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-xs text-slate-400 font-medium">No hay facturas pendientes para este cliente</p>
                                        </div>
                                    ) : (
                                        facturasPendientes.map(f => (
                                            <div key={f.id} className="p-4 hover:bg-white transition-colors group flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{f.serie}{f.folio}</p>
                                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">Saldo: <span className="text-indigo-600 font-bold">${parseFloat(f.saldo_insoluto !== null ? f.saldo_insoluto : f.total).toLocaleString()}</span></p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddFactura(f)}
                                                    className="p-2 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-200 shadow-sm transition-all"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Facturas Seleccionadas */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                            Detalle de Aplicación del Pago
                        </h3>
                        
                        <div className="border-2 border-slate-50 rounded-2xl overflow-x-auto shadow-sm">
                            <table className="w-full min-w-[900px] text-left">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Factura</th>
                                        <th className="px-6 py-4 text-right">Saldo Anterior</th>
                                        <th className="px-6 py-4 text-right">Monto a Pagar</th>
                                        <th className="px-6 py-4 text-right">Base Prop.</th>
                                        <th className="px-6 py-4 text-right">IVA Prop.</th>
                                        <th className="px-6 py-4 text-right">Ret. Prop.</th>
                                        <th className="px-6 py-4 text-right">Nuevo Saldo</th>
                                        <th className="px-6 py-4 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {facturasSeleccionadas.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-12 text-center text-slate-300 italic text-sm">
                                                No se han seleccionado facturas para abonar
                                            </td>
                                        </tr>
                                    ) : (
                                        facturasSeleccionadas.map(f => {
                                            const ratio = f.total > 0 ? (parseFloat(f.monto_aplicado) || 0) / f.total : 0;
                                            const baseProp = f.subtotal * ratio;
                                            let impTrasDoc = f.total_impuestos_trasladados;
                                            if (impTrasDoc === 0 && f.total > f.subtotal) impTrasDoc = f.total - f.subtotal;
                                            const ivaProp = impTrasDoc * ratio;
                                            const retProp = (parseFloat(f.total_impuestos_retenidos) || 0) * ratio;

                                            return (
                                                <tr key={f.documento_id} className="hover:bg-slate-50/30 transition-colors animate-in slide-in-from-left duration-200">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-700">{f.serie}{f.folio}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono overflow-hidden truncate w-32">{f.uuid}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium text-slate-500">
                                                        ${f.saldo_anterior.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={f.monto_aplicado}
                                                                onChange={(e) => handleMontoAplicadoChange(f.documento_id, e.target.value)}
                                                                className="w-32 p-2 border-2 border-primary-50 rounded-xl focus:border-primary-500 text-right font-bold text-primary-700 bg-primary-50/30 outline-none"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                                        ${baseProp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium text-indigo-600">
                                                        ${ivaProp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium text-amber-600">
                                                        ${retProp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-slate-700">
                                                        ${f.saldo_insoluto.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button type="button" onClick={() => handleRemoveFactura(f.documento_id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </form>
 
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end items-center gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handlePreviewPDF}
                        disabled={facturasSeleccionadas.length === 0}
                        className="px-6 py-3 rounded-xl text-sm font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 border border-primary-100 shadow-sm"
                    >
                        <Search className="w-4 h-4" /> Vista Previa PDF
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || facturasSeleccionadas.length === 0}
                        className="px-8 py-3 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200 shadow-offset-2 transition-all flex items-center gap-2"
                    >
                        {loading ? 'Procesando...' : 'Guardar y Aplicar Pago'}
                    </button>
                </div>
            </div>
        </div>
    );
};
