import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, RefreshCw, Eye, X, Filter, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const Cotizaciones = () => {
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [selectedCotizacion, setSelectedCotizacion] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const { showToast } = useToast();
    const { activeEmisor } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchCotizaciones();
    }, [activeEmisor]);

    const fetchCotizaciones = async () => {
        try {
            setLoading(true);
            const url = activeEmisor ? `/cotizaciones?emisorId=${activeEmisor.id}` : '/cotizaciones';
            const response = await api.get(url);
            setCotizaciones(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching cotizaciones:', error);
            showToast('Error al cargar cotizaciones', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = async (id) => {
        setLoadingDetail(true);
        try {
            const res = await api.get(`/cotizaciones/${id}`);
            setSelectedCotizacion(res.data);
        } catch (error) {
            console.error('Error fetching cotizacion detail:', error);
            showToast('Error al cargar el detalle de la cotización', 'error');
        } finally {
            setLoadingDetail(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Borrador':
                return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'Enviada':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Aceptada':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Rechazada':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Facturada':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'Cancelada':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const filteredCotizaciones = cotizaciones.filter((item) => {
        const matchesSearch =
            (item.folio && item.folio.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.Receptor?.razon_social && item.Receptor.razon_social.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.Receptor?.rfc && item.Receptor.rfc.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'Todos' || item.estado === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Cotizaciones</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Gestiona las cotizaciones y propuestas comerciales para tus clientes.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={fetchCotizaciones}
                        className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-slate-200 bg-white"
                        title="Actualizar listado"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => navigate('/cotizaciones/nueva')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 shadow-sm shadow-primary-500/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nueva Cotización</span>
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        placeholder="Buscar por folio o cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:border-primary-500"
                    >
                        <option value="Todos">Todos</option>
                        <option value="Borrador">Borrador</option>
                        <option value="Enviada">Enviada</option>
                        <option value="Aceptada">Aceptada</option>
                        <option value="Rechazada">Rechazada</option>
                        <option value="Facturada">Facturada</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>
            </div>

            {/* Table / Card Container */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-600 animate-spin mx-auto mb-4"></div>
                            <p className="text-sm">Cargando cotizaciones...</p>
                        </div>
                    ) : filteredCotizaciones.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
                            <FileText className="w-16 h-16 mb-4 text-slate-200" />
                            <p className="font-medium text-lg text-slate-600 mb-1">No se encontraron cotizaciones</p>
                            <p className="text-sm text-slate-400">
                                {searchTerm || statusFilter !== 'Todos'
                                    ? 'Prueba ajustando los filtros de búsqueda.'
                                    : 'Aún no has generado cotizaciones para este emisor.'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[750px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider">
                                    <th className="p-4 font-semibold w-28">Folio</th>
                                    <th className="p-4 font-semibold w-32">Fecha</th>
                                    <th className="p-4 font-semibold">Cliente</th>
                                    <th className="p-4 font-semibold text-right w-36">Total</th>
                                    <th className="p-4 font-semibold text-center w-36">Estado</th>
                                    <th className="p-4 font-semibold text-right w-40">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredCotizaciones.map((cotizacion) => (
                                    <tr key={cotizacion.id} className="hover:bg-slate-50/70 transition-colors group">
                                        <td className="p-4 font-mono font-semibold text-slate-800">
                                            {cotizacion.folio || `#${cotizacion.id}`}
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            {cotizacion.fecha
                                                ? new Date(cotizacion.fecha).toLocaleDateString('es-MX', {
                                                      day: '2-digit',
                                                      month: 'short',
                                                      year: 'numeric'
                                                  })
                                                : '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-semibold text-slate-800">
                                                {cotizacion.Receptor?.razon_social || 'Cliente no especificado'}
                                            </div>
                                            {cotizacion.Receptor?.rfc && (
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">
                                                    {cotizacion.Receptor.rfc}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-bold text-slate-800">
                                                ${Number(cotizacion.total || 0).toLocaleString('es-MX', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                })}
                                            </span>
                                            <span className="text-[11px] text-slate-400 ml-1 uppercase">
                                                {cotizacion.moneda || 'MXN'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                                                    cotizacion.estado
                                                )}`}
                                            >
                                                {cotizacion.estado}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleViewDetail(cotizacion.id)}
                                                    className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                                                    title="Ver detalle de cotización"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {cotizacion.estado !== 'Facturada' && (
                                                    <button
                                                        onClick={() => navigate('/facturas/nueva', { state: { cotizacionId: cotizacion.id } })}
                                                        className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                                                        title="Convertir a Factura"
                                                    >
                                                        Facturar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Count */}
                {!loading && filteredCotizaciones.length > 0 && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
                        <span>Mostrando {filteredCotizaciones.length} de {cotizaciones.length} cotizaciones</span>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedCotizacion && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-4 px-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-800 text-lg">
                                        Cotización {selectedCotizacion.folio || `#${selectedCotizacion.id}`}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        {new Date(selectedCotizacion.fecha).toLocaleDateString('es-MX', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCotizacion(null)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Cliente / Emisor info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                                <div>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                        Cliente
                                    </span>
                                    <p className="font-bold text-slate-800">
                                        {selectedCotizacion.Receptor?.razon_social || 'N/A'}
                                    </p>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                                        RFC: {selectedCotizacion.Receptor?.rfc || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                        Estado y Vigencia
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                                                selectedCotizacion.estado
                                            )}`}
                                        >
                                            {selectedCotizacion.estado}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {selectedCotizacion.vigencia_dias} días de vigencia
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Partidas */}
                            <div>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Conceptos / Partidas
                                </h3>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="p-2.5">Cant.</th>
                                                <th className="p-2.5">Descripción</th>
                                                <th className="p-2.5 text-right">P. Unitario</th>
                                                <th className="p-2.5 text-right">Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedCotizacion.detalles && selectedCotizacion.detalles.length > 0 ? (
                                                selectedCotizacion.detalles.map((det, idx) => (
                                                    <tr key={det.id || idx}>
                                                        <td className="p-2.5 font-semibold text-slate-700">
                                                            {det.cantidad} {det.clave_unidad || 'Pza'}
                                                        </td>
                                                        <td className="p-2.5 text-slate-800">
                                                            {det.descripcion}
                                                        </td>
                                                        <td className="p-2.5 text-right text-slate-600">
                                                            ${Number(det.valor_unitario).toFixed(2)}
                                                        </td>
                                                        <td className="p-2.5 text-right font-medium text-slate-800">
                                                            ${Number(det.importe).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="p-4 text-center text-slate-400">
                                                        No hay conceptos registrados.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totales */}
                            <div className="flex justify-end">
                                <div className="w-64 space-y-1.5 text-sm">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Subtotal:</span>
                                        <span>${Number(selectedCotizacion.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>IVA / Impuestos:</span>
                                        <span>${Number(selectedCotizacion.iva || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-200 text-base">
                                        <span>Total:</span>
                                        <span className="text-primary-600">
                                            ${Number(selectedCotizacion.total || 0).toFixed(2)}{' '}
                                            <span className="text-xs font-normal text-slate-400">
                                                {selectedCotizacion.moneda || 'MXN'}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Notas */}
                            {selectedCotizacion.notas && (
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                                    <span className="font-semibold block mb-0.5">Notas adicionales:</span>
                                    <p className="whitespace-pre-wrap">{selectedCotizacion.notas}</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button
                                onClick={() => setSelectedCotizacion(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                            {selectedCotizacion.estado !== 'Facturada' && (
                                <button
                                    onClick={() => navigate('/facturas/nueva', { state: { cotizacionId: selectedCotizacion.id } })}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
                                >
                                    <FileText className="w-4 h-4" />
                                    Facturar Cotización
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
