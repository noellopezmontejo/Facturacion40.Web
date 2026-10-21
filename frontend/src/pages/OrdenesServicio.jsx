import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, RefreshCw, Eye, Laptop, X, Filter, Wrench, CheckCircle2, Clock } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const OrdenesServicio = () => {
    const [ordenes, setOrdenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [selectedOrden, setSelectedOrden] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const { showToast } = useToast();
    const { activeEmisor } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrdenes();
    }, [activeEmisor]);

    const fetchOrdenes = async () => {
        try {
            setLoading(true);
            const url = activeEmisor ? `/ordenes-servicio?emisorId=${activeEmisor.id}` : '/ordenes-servicio';
            const response = await api.get(url);
            setOrdenes(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching ordenes:', error);
            showToast('Error al cargar órdenes de servicio', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = async (id) => {
        setLoadingDetail(true);
        try {
            const res = await api.get(`/ordenes-servicio/${id}`);
            setSelectedOrden(res.data);
        } catch (error) {
            console.error('Error fetching orden detail:', error);
            showToast('Error al cargar el detalle de la orden de servicio', 'error');
        } finally {
            setLoadingDetail(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Recibido':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'En Diagnóstico':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Esperando Aprobación':
                return 'bg-orange-50 text-orange-700 border-orange-200';
            case 'En Reparación':
                return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'Reparado':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Entregado':
                return 'bg-teal-50 text-teal-700 border-teal-200';
            case 'Cancelado':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Facturado':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const filteredOrdenes = ordenes.filter((orden) => {
        const matchesSearch =
            (orden.folio && orden.folio.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.equipo && orden.equipo.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.marca && orden.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.modelo && orden.modelo.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.numero_serie && orden.numero_serie.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (orden.Receptor?.razon_social && orden.Receptor.razon_social.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'Todos' || orden.estado === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Órdenes de Servicio</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Control de equipos de cómputo en recepción, diagnóstico y reparación técnica.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={fetchOrdenes}
                        className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-slate-200 bg-white"
                        title="Actualizar listado"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => navigate('/ordenes-servicio/nueva')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 shadow-sm shadow-primary-500/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nueva Orden</span>
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        placeholder="Buscar por folio, cliente, equipo o serie..."
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
                        <option value="Recibido">Recibido</option>
                        <option value="En Diagnóstico">En Diagnóstico</option>
                        <option value="Esperando Aprobación">Esperando Aprobación</option>
                        <option value="En Reparación">En Reparación</option>
                        <option value="Reparado">Reparado</option>
                        <option value="Entregado">Entregado</option>
                        <option value="Facturado">Facturado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-600 animate-spin mx-auto mb-4"></div>
                            <p className="text-sm">Cargando órdenes de servicio...</p>
                        </div>
                    ) : filteredOrdenes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
                            <Laptop className="w-16 h-16 mb-4 text-slate-200" />
                            <p className="font-medium text-lg text-slate-600 mb-1">No se encontraron órdenes de servicio</p>
                            <p className="text-sm text-slate-400">
                                {searchTerm || statusFilter !== 'Todos'
                                    ? 'Prueba modificando los filtros de búsqueda.'
                                    : 'Aún no has registrado órdenes de servicio para este emisor.'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[850px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider">
                                    <th className="p-4 font-semibold w-28">Folio</th>
                                    <th className="p-4 font-semibold w-32">Ingreso</th>
                                    <th className="p-4 font-semibold">Cliente</th>
                                    <th className="p-4 font-semibold">Equipo</th>
                                    <th className="p-4 font-semibold text-center w-36">Estado</th>
                                    <th className="p-4 font-semibold text-right w-36">Total</th>
                                    <th className="p-4 font-semibold text-right w-36">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredOrdenes.map((orden) => (
                                    <tr key={orden.id} className="hover:bg-slate-50/70 transition-colors group">
                                        <td className="p-4 font-mono font-semibold text-slate-800">
                                            {orden.folio || `#${orden.id}`}
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            {orden.fecha_ingreso
                                                ? new Date(orden.fecha_ingreso).toLocaleDateString('es-MX', {
                                                      day: '2-digit',
                                                      month: 'short',
                                                      year: 'numeric'
                                                  })
                                                : '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-semibold text-slate-800">
                                                {orden.Receptor?.razon_social || 'Cliente no especificado'}
                                            </div>
                                            {orden.Receptor?.rfc && (
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">
                                                    {orden.Receptor.rfc}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-slate-100 rounded text-slate-600">
                                                    <Laptop className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <span className="font-medium text-slate-800 block">
                                                        {orden.equipo || 'Equipo sin especificar'}
                                                    </span>
                                                    {(orden.marca || orden.modelo) && (
                                                        <span className="text-xs text-slate-400">
                                                            {[orden.marca, orden.modelo].filter(Boolean).join(' ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                                                    orden.estado
                                                )}`}
                                            >
                                                {orden.estado}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-bold text-slate-800">
                                                ${Number(orden.total || 0).toLocaleString('es-MX', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                })}
                                            </span>
                                            <span className="text-[11px] text-slate-400 ml-1 uppercase">
                                                {orden.moneda || 'MXN'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleViewDetail(orden.id)}
                                                    className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                                                    title="Ver ficha técnica de orden"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {orden.estado !== 'Facturado' && (
                                                    <button
                                                        onClick={() => navigate('/facturas/nueva', { state: { ordenServicioId: orden.id } })}
                                                        className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                                                        title="Facturar Orden"
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
                {!loading && filteredOrdenes.length > 0 && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
                        <span>Mostrando {filteredOrdenes.length} de {ordenes.length} órdenes</span>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedOrden && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-4 px-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                                    <Laptop className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-800 text-lg">
                                        Orden {selectedOrden.folio || `#${selectedOrden.id}`}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Ingreso: {new Date(selectedOrden.fecha_ingreso).toLocaleDateString('es-MX', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedOrden(null)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Cliente y Estado */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                                <div>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                        Cliente
                                    </span>
                                    <p className="font-bold text-slate-800">
                                        {selectedOrden.Receptor?.razon_social || 'N/A'}
                                    </p>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                                        RFC: {selectedOrden.Receptor?.rfc || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                        Estado de la Orden
                                    </span>
                                    <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                                            selectedOrden.estado
                                        )}`}
                                    >
                                        {selectedOrden.estado}
                                    </span>
                                </div>
                            </div>

                            {/* Datos del Equipo */}
                            <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <Laptop className="w-4 h-4 text-primary-600" />
                                    Datos del Equipo
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                                    <div>
                                        <span className="text-slate-400 block">Tipo / Equipo:</span>
                                        <span className="font-semibold text-slate-800">{selectedOrden.equipo || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Marca / Modelo:</span>
                                        <span className="font-semibold text-slate-800">{[selectedOrden.marca, selectedOrden.modelo].filter(Boolean).join(' ') || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Número de Serie:</span>
                                        <span className="font-mono text-slate-700">{selectedOrden.numero_serie || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Contraseña:</span>
                                        <span className="font-mono text-slate-700">{selectedOrden.contrasena_equipo || 'Sin contraseña'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-slate-400 block">Accesorios Recibidos:</span>
                                        <span className="text-slate-700">{selectedOrden.accesorios_incluidos || 'Ninguno'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Falla y Diagnóstico */}
                            <div className="space-y-3">
                                {selectedOrden.falla_reportada && (
                                    <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-100 text-xs">
                                        <span className="font-semibold text-rose-800 block mb-0.5">Falla reportada por el cliente:</span>
                                        <p className="text-slate-700 whitespace-pre-wrap">{selectedOrden.falla_reportada}</p>
                                    </div>
                                )}

                                {selectedOrden.diagnostico_tecnico && (
                                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs">
                                        <span className="font-semibold text-blue-800 block mb-0.5">Diagnóstico Técnico:</span>
                                        <p className="text-slate-700 whitespace-pre-wrap">{selectedOrden.diagnostico_tecnico}</p>
                                    </div>
                                )}
                            </div>

                            {/* Detalle de conceptos o refacciones */}
                            <div>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Servicios y Refacciones
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
                                            {selectedOrden.detalles && selectedOrden.detalles.length > 0 ? (
                                                selectedOrden.detalles.map((det, idx) => (
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
                                                        No hay conceptos o refacciones agregadas.
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
                                        <span>${Number(selectedOrden.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>IVA / Impuestos:</span>
                                        <span>${Number(selectedOrden.iva || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-200 text-base">
                                        <span>Total:</span>
                                        <span className="text-primary-600">
                                            ${Number(selectedOrden.total || 0).toFixed(2)}{' '}
                                            <span className="text-xs font-normal text-slate-400">
                                                {selectedOrden.moneda || 'MXN'}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button
                                onClick={() => setSelectedOrden(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                            {selectedOrden.estado !== 'Facturado' && (
                                <button
                                    onClick={() => navigate('/facturas/nueva', { state: { ordenServicioId: selectedOrden.id } })}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
                                >
                                    <FileText className="w-4 h-4" />
                                    Facturar Orden
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
