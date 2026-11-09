import React, { useState, useEffect } from 'react';
import { 
    FileText, Search, CreditCard, AlertCircle, RefreshCw, 
    Upload, Calendar, CheckCircle2, ChevronRight, DollarSign, 
    Clock, Landmark, FileCheck2, ArrowUpRight, HelpCircle,
    Download, History, Check, ExternalLink, Inbox, AlertTriangle, Building2, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

export const CuentasPorPagar = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    
    // States
    const [documentos, setDocumentos] = useState([]);
    const [resumen, setResumen] = useState({
        totalFacturado: 0,
        totalCuentasPorPagar: 0,
        totalPagado: 0,
        pendientesCount: 0,
        pagadasCount: 0
    });
    const [formasPago, setFormasPago] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [methodFilter, setMethodFilter] = useState('');
    
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    
    // SAT Download Dialog States
    const [showSatModal, setShowSatModal] = useState(false);
    const [satModalTab, setSatModalTab] = useState('nueva'); // 'nueva' | 'historial'
    const [satDateStart, setSatDateStart] = useState('');
    const [satDateEnd, setSatDateEnd] = useState('');
    const [satLoading, setSatLoading] = useState(false);
    const [satResult, setSatResult] = useState(null);
    const [solicitudesSat, setSolicitudesSat] = useState([]);
    const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
    const [verificandoId, setVerificandoId] = useState(null);
    const [descargandoId, setDescargandoId] = useState(null);

    // e.firma (FIEL) fields for SAT mass download
    const [fielCerFile, setFielCerFile] = useState(null);
    const [fielKeyFile, setFielKeyFile] = useState(null);
    const [fielPass, setFielPass] = useState('');
    const [guardarFiel, setGuardarFiel] = useState(true);
    const [showFielUploader, setShowFielUploader] = useState(false);

    // Invoice Detail Modal States
    const [selectedDoc, setSelectedDoc] = useState(null);

    const fetchDatos = async () => {
        if (!activeEmisor) return;
        setLoading(true);
        try {
            // 1. Fetch documentos recibidos
            let url = `/documentos-recibidos?emisor_id=${activeEmisor.id}`;
            if (statusFilter) url += `&estado_pago=${statusFilter}`;
            if (methodFilter) url += `&metodo_pago=${methodFilter}`;
            if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
            
            const docsRes = await api.get(url);
            setDocumentos(docsRes.data);

            // 2. Fetch resumen y distribución
            const resRes = await api.get(`/documentos-recibidos/resumen?emisor_id=${activeEmisor.id}`);
            setResumen(resRes.data.resumen);
            setFormasPago(resRes.data.formasPago);

        } catch (error) {
            console.error("Error loading accounts payable data", error);
            showToast("Error al cargar los datos de cuentas por pagar", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDatos();
    }, [activeEmisor, statusFilter, methodFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchDatos();
    };

    // Drag and drop handlers
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await uploadFiles(e.dataTransfer.files);
        }
    };

    const handleFileInput = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            await uploadFiles(e.target.files);
        }
    };

    const uploadFiles = async (fileList) => {
        const xmlFiles = Array.from(fileList).filter(f => f.name.endsWith('.xml'));
        if (xmlFiles.length === 0) {
            showToast("Por favor selecciona solo archivos XML", "error");
            return;
        }

        setImporting(true);
        const formData = new FormData();
        formData.append('emisor_id', activeEmisor.id);
        xmlFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await api.post('/documentos-recibidos/importar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const { exitosos, errores, detalles } = res.data.resultados;
            showToast(`Procesamiento finalizado. Exitosos: ${exitosos}, Errores: ${errores}`, exitosos > 0 ? "success" : "error");
            
            // Si hay detalles, listamos en consola o toast
            if (errores > 0) {
                console.error("Detalles de errores al importar XMLs:", detalles.filter(d => d.error));
            }
            
            fetchDatos();
        } catch (error) {
            console.error("Error al importar XMLs", error);
            showToast(error.response?.data?.message || "Error al subir los archivos", "error");
        } finally {
            setImporting(false);
        }
    };

    const fetchSolicitudesSat = async () => {
        if (!activeEmisor) return;
        setLoadingSolicitudes(true);
        try {
            const res = await api.get(`/documentos-recibidos/solicitudes?emisor_id=${activeEmisor.id}`);
            setSolicitudesSat(res.data);
        } catch (error) {
            console.error("Error al obtener solicitudes SAT:", error);
        } finally {
            setLoadingSolicitudes(false);
        }
    };

    const handleSatDownload = async (e) => {
        e.preventDefault();
        if (!satDateStart || !satDateEnd) {
            showToast("Selecciona un rango de fechas", "error");
            return;
        }

        setSatLoading(true);
        setSatResult(null);
        try {
            let res;
            if (fielCerFile && fielKeyFile) {
                const formData = new FormData();
                formData.append('emisor_id', activeEmisor.id);
                formData.append('fecha_inicio', satDateStart);
                formData.append('fecha_fin', satDateEnd);
                formData.append('fiel_cer', fielCerFile);
                formData.append('fiel_key', fielKeyFile);
                formData.append('password_fiel', fielPass);
                formData.append('guardar_fiel', guardarFiel);
                res = await api.post('/documentos-recibidos/solicitar-descarga', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await api.post('/documentos-recibidos/solicitar-descarga', {
                    emisor_id: activeEmisor.id,
                    fecha_inicio: satDateStart,
                    fecha_fin: satDateEnd
                });
            }
            setSatResult(res.data);
            showToast(res.data.mensaje || "Petición de descarga masiva enviada al SAT");
            fetchSolicitudesSat();
            fetchDatos();
        } catch (error) {
            console.error("Error en descarga SAT", error);
            showToast(error.response?.data?.message || "Error al solicitar la descarga masiva", "error");
        } finally {
            setSatLoading(false);
        }
    };

    const handleVerificarSolicitud = async (id) => {
        setVerificandoId(id);
        try {
            const res = await api.post(`/documentos-recibidos/verificar-solicitud/${id}`);
            const msg = res.data.estatus?.mensaje || `Estatus SAT: ${res.data.solicitud?.estado_sat}`;
            showToast(msg);
            fetchSolicitudesSat();
        } catch (error) {
            console.error("Error al verificar solicitud SAT:", error);
            showToast(error.response?.data?.message || "Error al verificar con el SAT", "error");
        } finally {
            setVerificandoId(null);
        }
    };

    const handleDescargarPaquetes = async (id) => {
        setDescargandoId(id);
        try {
            const res = await api.post(`/documentos-recibidos/descargar-paquetes/${id}`);
            showToast(res.data.message || "Comprobantes descargados e importados exitosamente");
            fetchSolicitudesSat();
            fetchDatos();
        } catch (error) {
            console.error("Error descargando paquetes SAT:", error);
            showToast(error.response?.data?.message || "Error al descargar e importar paquetes", "error");
        } finally {
            setDescargandoId(null);
        }
    };

    const handleSimularPaquetes = async (id) => {
        try {
            const res = await api.post(`/documentos-recibidos/simular-paquetes/${id}`);
            showToast(res.data.message || "Paquete de prueba generado");
            fetchSolicitudesSat();
        } catch (error) {
            console.error("Error simulando paquete de prueba:", error);
            showToast(error.response?.data?.message || "Error al generar paquete de prueba", "error");
        }
    };

    // Helper para mapear claves del SAT a nombres de forma de pago
    const getFormaPagoName = (code) => {
        const catalogo = {
            '01': 'Efectivo',
            '02': 'Cheque nominativo',
            '03': 'Transferencia electrónica',
            '04': 'Tarjeta de crédito',
            '05': 'Monedero electrónico',
            '06': 'Dinero electrónico',
            '08': 'Vales de despensa',
            '12': 'Dación en pago',
            '17': 'Compensación',
            '27': 'A novación',
            '30': 'Aplicación de anticipos',
            '99': 'Por definir'
        };
        return catalogo[code] || `Otro (${code})`;
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cuentas por Pagar</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium italic">Control de facturas recibidas de proveedores y abonos aplicados.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => { setShowSatModal(true); fetchSolicitudesSat(); }}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md"
                    >
                        <Landmark className="w-4 h-4" />
                        <span>Sincronizar SAT / PAC</span>
                    </button>
                    <label className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-500 transition-all cursor-pointer shadow-md shadow-primary-100">
                        <Upload className="w-4 h-4" />
                        <span>Subir XMLs Proveedores</span>
                        <input
                            type="file"
                            multiple
                            accept=".xml"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-2xl text-white shadow-xl shadow-red-100 relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
                        <Clock className="w-40 h-40" />
                    </div>
                    <p className="text-red-100 text-xs font-bold uppercase tracking-wider">Pendiente por Pagar (PPD)</p>
                    <h3 className="text-3xl font-black mt-2">{formatCurrency(resumen.totalCuentasPorPagar)}</h3>
                    <div className="mt-4 flex items-center gap-2 text-red-100 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4" />
                        <span>{resumen.pendientesCount} facturas activas a crédito</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
                        <Landmark className="w-40 h-40" />
                    </div>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Total Pagado</p>
                    <h3 className="text-3xl font-black mt-2">{formatCurrency(resumen.totalPagado)}</h3>
                    <div className="mt-4 flex items-center gap-2 text-emerald-100 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Incluye facturas PUE y abonos en CRP</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl text-slate-800 border border-slate-100 shadow-md relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 text-slate-100 translate-x-4 translate-y-4">
                        <FileText className="w-40 h-40" />
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Recibido (Facturado)</p>
                    <h3 className="text-3xl font-black mt-2 text-slate-900">{formatCurrency(resumen.totalFacturado)}</h3>
                    <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-semibold">
                        <Landmark className="w-4 h-4 text-slate-400" />
                        <span>{documentos.length} comprobantes cargados en total</span>
                    </div>
                </div>
            </div>

            {/* Drag & Drop Import Dropzone */}
            <div 
                onDragEnter={handleDrag} 
                onDragOver={handleDrag} 
                onDragLeave={handleDrag} 
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all ${
                    dragActive 
                        ? 'border-primary-500 bg-primary-50/50 scale-[1.01]' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
            >
                {importing ? (
                    <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-10 h-10 text-primary-500 animate-spin" />
                        <p className="text-slate-600 font-bold text-sm">Procesando y validando XMLs...</p>
                    </div>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <p className="text-slate-800 font-bold text-sm">Arrastra y suelta aquí tus XMLs de proveedores</p>
                            <p className="text-slate-400 text-xs mt-1">Soporta facturas de gastos (Ingreso) y complementos de pago (REP)</p>
                        </div>
                    </>
                )}
            </div>

            {/* List & Filters Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                
                {/* Left side: Forms of payment used */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight uppercase flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-primary-500" />
                        Métodos Utilizados
                    </h3>
                    <p className="text-xs text-slate-400">Total distribuido por forma de pago (facturas y complementos):</p>
                    <div className="space-y-3">
                        {formasPago.length === 0 ? (
                            <p className="text-slate-400 text-xs italic">Sin registros de pago aún.</p>
                        ) : (
                            formasPago.map(fp => (
                                <div key={fp.forma_pago} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-medium text-slate-600">{getFormaPagoName(fp.forma_pago)}</span>
                                        <span className="font-bold text-slate-900">{formatCurrency(fp.monto)}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-primary-500 h-full" 
                                            style={{ width: `${Math.min(100, (fp.monto / (resumen.totalPagado || 1)) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right side: Table and Filters */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Filters Bar */}
                    <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-50/50">
                        <form onSubmit={handleSearch} className="relative w-full md:w-72">
                            <input
                                type="text"
                                placeholder="Buscar por UUID o folio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-primary-500 transition-colors"
                            />
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        </form>
                        
                        <div className="flex gap-2 w-full md:w-auto">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-primary-500 w-full md:w-auto"
                            >
                                <option value="">Todos los Estatus</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Pago Parcial">Pago Parcial</option>
                                <option value="Pagado">Pagado</option>
                                <option value="Cancelado">Cancelado</option>
                            </select>

                            <select
                                value={methodFilter}
                                onChange={(e) => setMethodFilter(e.target.value)}
                                className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-primary-500 w-full md:w-auto"
                            >
                                <option value="">Cualquier Método</option>
                                <option value="PPD">A crédito (PPD)</option>
                                <option value="PUE">Contado (PUE)</option>
                            </select>

                            <button 
                                onClick={fetchDatos}
                                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                                title="Actualizar"
                            >
                                <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    <th className="px-6 py-4">Proveedor / Fecha</th>
                                    <th className="px-6 py-4">Folio / UUID</th>
                                    <th className="px-6 py-4">Método / Forma</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                    <th className="px-6 py-4 text-right">Saldo Pendiente</th>
                                    <th className="px-6 py-4">Estatus</th>
                                    <th className="px-6 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                                            Cargando facturas recibidas...
                                        </td>
                                    </tr>
                                ) : documentos.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400 italic">
                                            No se encontraron facturas recibidas.
                                        </td>
                                    </tr>
                                ) : (
                                    documentos.map(doc => (
                                        <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{doc.Proveedor?.razon_social || 'Proveedor Genérico'}</div>
                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{doc.Proveedor?.rfc}</div>
                                                <div className="text-[10px] text-slate-400 mt-1">{new Date(doc.fecha).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-[10px]">
                                                {doc.xml_url === null ? (
                                                    <span className="inline-flex items-center gap-1 text-orange-500 bg-orange-50 px-2 py-0.5 rounded font-sans font-semibold mb-1">
                                                        <HelpCircle className="w-3 h-3" /> Faltante (Creado por Pago)
                                                    </span>
                                                ) : null}
                                                <div className="font-semibold text-slate-700">{(doc.serie || '') + ' ' + (doc.folio || '')}</div>
                                                <div className="text-slate-400 mt-0.5">{doc.uuid}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-700">{doc.metodo_pago}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{doc.forma_pago ? getFormaPagoName(doc.forma_pago) : '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-950">
                                                {formatCurrency(doc.total)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold">
                                                {doc.metodo_pago === 'PUE' ? (
                                                    <span className="text-slate-400">-</span>
                                                ) : (
                                                    <span className={parseFloat(doc.saldo_insoluto) > 0 ? "text-red-500 font-bold" : "text-slate-400"}>
                                                        {formatCurrency(doc.saldo_insoluto || 0)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                    doc.estado_pago === 'Pagado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                    doc.estado_pago === 'Pago Parcial' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                                    doc.estado_pago === 'Cancelado' ? 'bg-slate-100 text-slate-600' :
                                                    'bg-red-50 text-red-700 border border-red-100'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        doc.estado_pago === 'Pagado' ? 'bg-emerald-500' :
                                                        doc.estado_pago === 'Pago Parcial' ? 'bg-orange-500' :
                                                        doc.estado_pago === 'Cancelado' ? 'bg-slate-400' :
                                                        'bg-red-500'
                                                    }`} />
                                                    {doc.estado_pago}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => setSelectedDoc(doc)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700"
                                                >
                                                    Ver Detalle
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* SAT Download Modal */}
            {showSatModal && (
                <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Landmark className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Sincronización Masiva del SAT</h2>
                                    <p className="text-xs text-slate-500">
                                        Web Service Oficial de Descarga de CFDI Recibidos (e.firma / CSD)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowSatModal(false); setSatResult(null); }}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Tabs del Modal */}
                        <div className="flex items-center gap-2 mt-4 p-1 bg-slate-100 rounded-xl border border-slate-200/60 self-start text-xs font-bold">
                            <button
                                onClick={() => setSatModalTab('nueva')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    satModalTab === 'nueva'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Nueva Solicitud SAT</span>
                            </button>
                            <button
                                onClick={() => { setSatModalTab('historial'); fetchSolicitudesSat(); }}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    satModalTab === 'historial'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Historial de Solicitudes</span>
                                {solicitudesSat.length > 0 && (
                                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                        {solicitudesSat.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Contenido TAB 1: Nueva Solicitud */}
                        {satModalTab === 'nueva' && (
                            <div className="overflow-y-auto space-y-4 mt-4 py-1 custom-scrollbar">
                                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-600">
                                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                                        <Building2 className="w-4 h-4 text-primary-600" />
                                        <span>Emisor Activo: {activeEmisor?.razon_social}</span>
                                        <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">{activeEmisor?.rfc}</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-slate-500">
                                        La solicitud se firmará con los sellos y llaves registrados del emisor. El SAT procesa solicitudes de forma asíncrona; una vez aceptada, el paquete estará listo para descarga e importación automática.
                                    </p>
                                </div>

                                <form onSubmit={handleSatDownload} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha Inicial</label>
                                            <input
                                                type="date"
                                                value={satDateStart}
                                                onChange={(e) => setSatDateStart(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:border-primary-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha Final</label>
                                            <input
                                                type="date"
                                                value={satDateEnd}
                                                onChange={(e) => setSatDateEnd(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:border-primary-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Explicación y Carga opcional de e.firma (FIEL) */}
                                    <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-2.5 text-amber-900">
                                        <div className="flex items-start gap-2.5">
                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold text-amber-950">Requisito Oficial del SAT: e.firma (FIEL)</span>
                                                <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                                                    El Web Service de Descarga Masiva del SAT exige los archivos de la <strong>e.firma (Firma Electrónica Avanzada)</strong>. Los sellos <strong>CSD</strong> son de uso exclusivo para emisión y timbrado de facturas, por lo que el SAT rechaza las descargas masivas firmadas con CSD (Error 305).
                                                </p>
                                            </div>
                                        </div>

                                        {activeEmisor?.fiel_info?.tieneCertificado && (
                                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs">
                                                <span className="flex items-center gap-1.5 font-semibold">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    e.firma guardada en sistema (Serie: {activeEmisor.fiel_info.noCertificado})
                                                </span>
                                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                                    Vigente ({activeEmisor.fiel_info.diasRestantes} días)
                                                </span>
                                            </div>
                                        )}

                                        <div className="pt-1 border-t border-amber-200/60 flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={() => setShowFielUploader(!showFielUploader)}
                                                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-1 cursor-pointer"
                                            >
                                                <span>{showFielUploader ? '▲ Ocultar adjuntar e.firma' : (activeEmisor?.fiel_info?.tieneCertificado ? '▼ Cambiar o subir otra e.firma temporalmente' : '▼ Adjuntar archivos de e.firma (.cer y .key) para esta descarga')}</span>
                                            </button>
                                            {fielCerFile && fielKeyFile && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                    <Check className="w-3 h-3" /> e.firma cargada
                                                </span>
                                            )}
                                        </div>

                                        {showFielUploader && (
                                            <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-2.5 mt-2 animate-in fade-in">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Certificado e.firma (.cer)</label>
                                                        <input 
                                                            type="file" 
                                                            accept=".cer"
                                                            onChange={(e) => setFielCerFile(e.target.files[0])}
                                                            className="w-full text-[11px] text-slate-600 mt-1 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Llave Privada e.firma (.key)</label>
                                                        <input 
                                                            type="file" 
                                                            accept=".key"
                                                            onChange={(e) => setFielKeyFile(e.target.files[0])}
                                                            className="w-full text-[11px] text-slate-600 mt-1 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 items-center pt-1">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Contraseña de la e.firma</label>
                                                        <input 
                                                            type="password"
                                                            placeholder="Contraseña de la FIEL"
                                                            value={fielPass}
                                                            onChange={(e) => setFielPass(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs mt-1 focus:outline-none focus:border-amber-400"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 pt-4">
                                                        <input 
                                                            type="checkbox"
                                                            id="guardarFielChk"
                                                            checked={guardarFiel}
                                                            onChange={(e) => setGuardarFiel(e.target.checked)}
                                                            className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                                                        />
                                                        <label htmlFor="guardarFielChk" className="text-[11px] text-slate-600 select-none cursor-pointer">
                                                            Guardar en el emisor para futuras descargas
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={satLoading}
                                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-primary-100 disabled:opacity-50"
                                    >
                                        {satLoading ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Conectando y Firmando con el SAT...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Landmark className="w-4 h-4" />
                                                <span>Enviar Solicitud al Web Service del SAT</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                {satResult && (
                                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-2 text-xs animate-in fade-in">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-800">Folio Solicitud SAT:</span>
                                            <span className="font-mono text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 font-semibold">{satResult.solicitudId}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-800">Estatus:</span>
                                            <span className="text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">{satResult.estado || 'Aceptada'}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{satResult.mensaje}</p>
                                        <div className="pt-2 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => { setSatModalTab('historial'); fetchSolicitudesSat(); }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                                            >
                                                <span>Ver en Historial de Solicitudes</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Contenido TAB 2: Historial de Solicitudes */}
                        {satModalTab === 'historial' && (
                            <div className="overflow-y-auto space-y-3 mt-4 py-1 custom-scrollbar flex-1">
                                <div className="flex justify-between items-center pb-2">
                                    <span className="text-xs font-semibold text-slate-500">Solicitudes registradas para {activeEmisor?.rfc}</span>
                                    <button
                                        type="button"
                                        onClick={fetchSolicitudesSat}
                                        disabled={loadingSolicitudes}
                                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${loadingSolicitudes ? 'animate-spin' : ''}`} />
                                        <span>Actualizar Lista</span>
                                    </button>
                                </div>

                                {loadingSolicitudes ? (
                                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                                        <span>Consultando solicitudes...</span>
                                    </div>
                                ) : solicitudesSat.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                        <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                                        <p>No hay solicitudes de descarga registradas para este emisor.</p>
                                        <button
                                            type="button"
                                            onClick={() => setSatModalTab('nueva')}
                                            className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs"
                                        >
                                            Generar Primera Solicitud
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                                        {solicitudesSat.map(s => {
                                            const isTerminada = s.estado_sat === 'Terminada' || (s.paquetes_ids && s.paquetes_ids.length > 0 && s.estado_sat !== 'Descargada');
                                            const isDescargada = s.estado_sat === 'Descargada';
                                            const isVerificando = verificandoId === s.id;
                                            const isDescargando = descargandoId === s.id;

                                            return (
                                                <div key={s.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 hover:border-slate-300 transition-colors">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-[11px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                {s.id_solicitud_sat}
                                                            </span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                isDescargada
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                    : isTerminada
                                                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                                        : s.estado_sat === 'Error' || s.estado_sat === 'Rechazada'
                                                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            }`}>
                                                                {s.estado_sat}
                                                                {s.numero_cfdis > 0 && ` (${s.numero_cfdis} CFDIs)`}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(s.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                                        <span>Periodo: <strong className="text-slate-700">{s.fecha_inicio}</strong> al <strong className="text-slate-700">{s.fecha_fin}</strong></span>
                                                        {s.paquetes_ids && Array.isArray(s.paquetes_ids) && (
                                                            <span className="font-mono text-[10px] text-slate-400">
                                                                {s.paquetes_ids.length} paquete(s) SAT
                                                            </span>
                                                        )}
                                                    </div>

                                                    {s.mensaje_sat && (
                                                        <p className="text-[10px] text-slate-500 bg-white/70 p-2 rounded border border-slate-100 leading-relaxed">
                                                            {s.mensaje_sat}
                                                        </p>
                                                    )}

                                                    {/* Botones de acción */}
                                                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                                                        {!isDescargada && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleVerificarSolicitud(s.id)}
                                                                disabled={isVerificando || isDescargando}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                                                            >
                                                                <RefreshCw className={`w-3 h-3 ${isVerificando ? 'animate-spin text-indigo-600' : ''}`} />
                                                                <span>{isVerificando ? 'Consultando SAT...' : 'Verificar Estatus SAT'}</span>
                                                            </button>
                                                        )}

                                                        {!isTerminada && !isDescargada && (activeEmisor?.modo_prueba || s.codigo_estado === '305') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSimularPaquetes(s.id)}
                                                                disabled={isVerificando || isDescargando}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                                                                title="Simular generación de paquetes en ambiente de prueba para ensayar la descarga e importación automática"
                                                            >
                                                                <Sparkles className="w-3 h-3 text-amber-600" />
                                                                <span>Simular Paquete de Prueba</span>
                                                            </button>
                                                        )}

                                                        {isTerminada && !isDescargada && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDescargarPaquetes(s.id)}
                                                                disabled={isDescargando || isVerificando}
                                                                className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                                                            >
                                                                <Download className={`w-3.5 h-3.5 ${isDescargando ? 'animate-bounce' : ''}`} />
                                                                <span>{isDescargando ? 'Importando Facturas...' : 'Descargar e Importar a Cuentas por Pagar'}</span>
                                                            </button>
                                                        )}

                                                        {isDescargada && (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Comprobantes importados</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => { setShowSatModal(false); setSatResult(null); }}
                                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-600"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Detail & Payment History Modal */}
            {selectedDoc && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-100 max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                            <div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-2 ${
                                    selectedDoc.metodo_pago === 'PUE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                }`}>
                                    CFDI {selectedDoc.metodo_pago}
                                </span>
                                <h3 className="text-base font-bold text-slate-900">{selectedDoc.Proveedor?.razon_social}</h3>
                                <p className="text-slate-400 text-xs mt-0.5">RFC: {selectedDoc.Proveedor?.rfc}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Total Facturado</p>
                                <p className="text-xl font-black text-slate-950">{formatCurrency(selectedDoc.total)}</p>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {/* Invoice Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">UUID / Folio Fiscal</p>
                                    <p className="font-mono text-slate-600 truncate mt-0.5" title={selectedDoc.uuid}>{selectedDoc.uuid}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Folio Interno</p>
                                    <p className="text-slate-800 font-semibold mt-0.5">{(selectedDoc.serie || '') + ' ' + (selectedDoc.folio || 'N/A')}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Fecha de Emisión</p>
                                    <p className="text-slate-800 font-semibold mt-0.5">{new Date(selectedDoc.fecha).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Forma de Pago</p>
                                    <p className="text-slate-800 font-semibold mt-0.5">{selectedDoc.forma_pago ? getFormaPagoName(selectedDoc.forma_pago) : 'No especificada'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Estatus Pago</p>
                                    <p className="text-slate-800 font-semibold mt-0.5">{selectedDoc.estado_pago}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Saldo Restante</p>
                                    <p className="text-slate-800 font-bold mt-0.5 text-red-500">
                                        {selectedDoc.metodo_pago === 'PUE' ? '$0.00' : formatCurrency(selectedDoc.saldo_insoluto)}
                                    </p>
                                </div>
                            </div>

                            {/* Payment History Section */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-slate-900 text-xs tracking-tight uppercase flex items-center gap-1.5">
                                    <CreditCard className="w-4 h-4 text-primary-500" />
                                    Historial de Abonos / Complementos de Pago
                                </h4>

                                {selectedDoc.metodo_pago === 'PUE' ? (
                                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3">
                                        <Landmark className="w-5 h-5 text-emerald-500" />
                                        <p className="text-xs text-emerald-800">
                                            Esta factura fue pagada en una sola exhibición (<strong>PUE</strong>) usando la forma de pago <strong>{getFormaPagoName(selectedDoc.forma_pago)}</strong>. No requiere complementos adicionales.
                                        </p>
                                    </div>
                                ) : !selectedDoc.PagoRecibidos || selectedDoc.PagoRecibidos.length === 0 ? (
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
                                        <p className="text-xs text-slate-500">No se han registrado complementos de pago (CRP) vinculados a esta factura.</p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                                        {selectedDoc.PagoRecibidos.map(pago => (
                                            <div key={pago.id} className="p-3 flex justify-between items-center text-xs hover:bg-slate-50/30">
                                                <div>
                                                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                                                        <span>Abono Aplicado</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">({pago.uuid.substring(0, 8)}...)</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        Pagado el: {formatDate(pago.fecha_pago)} via {getFormaPagoName(pago.forma_pago_p)}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-900">{formatCurrency(pago.PagoDocumentoRecibido?.imp_pagado)}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        Parcialidad #{pago.PagoDocumentoRecibido?.num_parcialidad} | Resta: {formatCurrency(pago.PagoDocumentoRecibido?.imp_saldo_insoluto)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                onClick={() => setSelectedDoc(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-700 bg-white"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
