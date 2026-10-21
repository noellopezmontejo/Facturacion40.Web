import React, { useState, useEffect } from 'react';
import { 
    FileText, Search, CreditCard, AlertCircle, RefreshCw, 
    Upload, Calendar, CheckCircle2, ChevronRight, DollarSign, 
    Clock, Landmark, FileCheck2, ArrowUpRight, HelpCircle
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
    const [satDateStart, setSatDateStart] = useState('');
    const [satDateEnd, setSatDateEnd] = useState('');
    const [satLoading, setSatLoading] = useState(false);
    const [satResult, setSatResult] = useState(null);

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

    const handleSatDownload = async (e) => {
        e.preventDefault();
        if (!satDateStart || !satDateEnd) {
            showToast("Selecciona un rango de fechas", "error");
            return;
        }

        setSatLoading(true);
        setSatResult(null);
        try {
            const res = await api.post('/documentos-recibidos/solicitar-descarga', {
                emisor_id: activeEmisor.id,
                fecha_inicio: satDateStart,
                fecha_fin: satDateEnd
            });
            setSatResult(res.data);
            showToast("Petición de descarga masiva enviada al SAT");
            fetchDatos();
        } catch (error) {
            console.error("Error en descarga SAT", error);
            showToast("Error al solicitar la descarga masiva", "error");
        } finally {
            setSatLoading(false);
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
                        onClick={() => setShowSatModal(true)}
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
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Landmark className="w-5 h-5 text-primary-500" />
                            Sincronización Masiva del SAT
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Consulta y descarga comprobantes recibidos directamente de los servidores de Hacienda.
                        </p>

                        <form onSubmit={handleSatDownload} className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha Inicial</label>
                                    <input
                                        type="date"
                                        value={satDateStart}
                                        onChange={(e) => setSatDateStart(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha Final</label>
                                    <input
                                        type="date"
                                        value={satDateEnd}
                                        onChange={(e) => setSatDateEnd(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={satLoading}
                                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-primary-100 disabled:opacity-50"
                            >
                                {satLoading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Solicitando al SAT...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        <span>Solicitar Descarga</span>
                                    </>
                                )}
                            </button>
                        </form>

                        {satResult && (
                            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Folio Solicitud:</span>
                                    <span className="font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100">{satResult.solicitudId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-800">Estatus:</span>
                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{satResult.estado}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{satResult.mensaje}</p>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
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
