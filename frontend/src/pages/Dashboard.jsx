import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, DollarSign, Activity, ArrowRight, RefreshCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const MetricCard = ({ title, value, change, icon: Icon, trend, loading }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
        {loading ? (
            <div className="animate-pulse space-y-3">
                <div className="flex justify-between items-start">
                    <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                    <div className="w-12 h-5 bg-slate-200 rounded-full"></div>
                </div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                <div className="h-6 bg-slate-200 rounded w-1/2"></div>
            </div>
        ) : (
            <>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${trend === 'up' ? 'bg-green-50 text-green-700 border border-green-200/50' : 'bg-rose-50 text-rose-700 border border-rose-200/50'}`}>
                            {change}
                        </span>
                    )}
                </div>
                <h3 className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">{title}</h3>
                <p className="text-2xl font-black text-slate-800">{value}</p>
            </>
        )}
    </div>
);

export const Dashboard = () => {
    const { activeEmisor } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const url = activeEmisor ? `/dashboard?emisorId=${activeEmisor.id}` : '/dashboard';
            const res = await api.get(url);
            setData(res.data);
        } catch (error) {
            console.error("Error fetching dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [activeEmisor]);

    // Calcular escala máxima para gráfico
    const maxVal = data?.chartData?.length > 0 
        ? Math.max(...data.chartData.map(d => Math.max(d.facturado, d.cobrado)), 0) 
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 text-sm mt-1">Visión general de tu facturación y cobranza en tiempo real.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchDashboard} className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-transparent hover:border-primary-100">
                        <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <Link to="/facturas/nueva" className="px-4 py-2 bg-primary-600 border border-transparent text-white rounded-lg text-sm font-semibold hover:bg-primary-500 shadow-md shadow-primary-500/20 transition-all active:scale-95">
                        Nueva Factura
                    </Link>
                </div>
            </div>

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Ingresos del Mes" 
                    value={loading ? '...' : `$${(data?.metrics?.ingresos?.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                    change={data?.metrics?.ingresos?.change} 
                    trend={data?.metrics?.ingresos?.trend} 
                    icon={DollarSign} 
                    loading={loading}
                />
                <MetricCard 
                    title="Facturas Emitidas" 
                    value={loading ? '...' : (data?.metrics?.facturas?.value || 0).toString()} 
                    change={data?.metrics?.facturas?.change} 
                    trend={data?.metrics?.facturas?.trend} 
                    icon={FileText} 
                    loading={loading}
                />
                <MetricCard 
                    title="Cartera Vencida" 
                    value={loading ? '...' : `$${(data?.metrics?.carteraVencida?.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                    change={data?.metrics?.carteraVencida?.change} 
                    trend={data?.metrics?.carteraVencida?.trend} 
                    icon={Activity} 
                    loading={loading}
                />
                <MetricCard 
                    title="Nuevos Clientes" 
                    value={loading ? '...' : (data?.metrics?.clientes?.value || 0).toString()} 
                    change={data?.metrics?.clientes?.change} 
                    trend={data?.metrics?.clientes?.trend} 
                    icon={Users} 
                    loading={loading}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gráfico de Historial */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between min-h-[360px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Facturado vs Cobrado</h3>
                            <p className="text-xs text-slate-400 font-medium">Comparativo acumulado mensual de los últimos 6 meses</p>
                        </div>
                        <div className="flex gap-4 text-xs font-semibold text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 bg-primary-500 rounded-sm"></div>
                                <span>Facturado</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 bg-slate-300 rounded-sm"></div>
                                <span>Cobrado</span>
                            </div>
                        </div>
                    </div>
                    
                    {loading ? (
                        <div className="h-64 bg-slate-50 rounded-lg animate-pulse flex items-center justify-center text-slate-400">
                            Cargando gráfico de historial...
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col justify-end">
                            <div className="h-64 flex items-end justify-between px-2 gap-4 relative">
                                <div className="absolute top-0 left-0 w-full border-t border-dashed border-slate-200/60"></div>
                                <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-slate-200/60"></div>
                                
                                {data?.chartData?.map((item, i) => {
                                    const heightFacturado = maxVal > 0 ? (item.facturado / maxVal) * 85 : 0;
                                    const heightCobrado = maxVal > 0 ? (item.cobrado / maxVal) * 85 : 0;
                                    
                                    return (
                                        <div key={i} className="w-full flex justify-center items-end gap-1.5 h-full z-10 group relative">
                                            {/* Barra Facturado */}
                                            <div 
                                                style={{ height: `${heightFacturado}%` }} 
                                                className="w-1/3 bg-primary-500 rounded-t-sm group-hover:bg-primary-400 transition-all relative cursor-pointer min-h-[4px]"
                                            >
                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2.5 rounded shadow-lg pointer-events-none transition-opacity whitespace-nowrap z-30">
                                                    Facturado: ${item.facturado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            
                                            {/* Barra Cobrado */}
                                            <div 
                                                style={{ height: `${heightCobrado}%` }} 
                                                className="w-1/3 bg-slate-300 rounded-t-sm group-hover:bg-slate-400 transition-all relative cursor-pointer min-h-[4px]"
                                            >
                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2.5 rounded shadow-lg pointer-events-none transition-opacity whitespace-nowrap z-30">
                                                    Cobrado: ${item.cobrado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between px-2 mt-4 text-xs font-semibold text-slate-400">
                                {data?.chartData?.map((item, i) => (
                                    <span key={i} className="w-full text-center">{item.name}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Documentos Recientes */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between min-h-[360px]">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Documentos Recientes</h3>
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="animate-pulse flex justify-between items-center p-3 border border-slate-100 rounded-lg">
                                        <div className="space-y-2 flex-1">
                                            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                                            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                                        </div>
                                        <div className="space-y-2 items-end flex flex-col">
                                            <div className="h-4 bg-slate-200 rounded w-12"></div>
                                            <div className="h-3 bg-slate-200 rounded w-10"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : data?.recentDocuments?.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-sm">
                                No se encontraron facturas recientes.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data?.recentDocuments?.map((doc) => (
                                    <Link 
                                        key={doc.id} 
                                        to="/facturas"
                                        className="flex justify-between items-center p-3 hover:bg-slate-50/80 rounded-xl transition-all border border-transparent hover:border-slate-100 cursor-pointer group"
                                    >
                                        <div className="min-w-0 flex-1 pr-3">
                                            <p className="font-bold text-sm text-slate-800 group-hover:text-primary-600 transition-colors">
                                                {doc.serie || 'F'}-{doc.folio || doc.id}
                                            </p>
                                            <p className="text-xs text-slate-400 font-medium truncate">
                                                {doc.Receptor?.razon_social || 'Cliente sin razón social'}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-sm text-slate-800">
                                                ${parseFloat(doc.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                            <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider mt-0.5 ${
                                                doc.estado_pago === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200/50' :
                                                doc.estado_pago === 'Vencido' ? 'bg-rose-50 text-rose-700 border-rose-200/50' :
                                                'bg-slate-50 text-slate-500 border-slate-200/50'
                                            }`}>
                                                {doc.estado_pago}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {!loading && data?.recentDocuments?.length > 0 && (
                        <div className="pt-4 mt-4 border-t border-slate-100">
                            <Link 
                                to="/facturas" 
                                className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-500 transition-colors"
                            >
                                Ver todos los documentos
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

