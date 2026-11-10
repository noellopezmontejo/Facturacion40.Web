import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AlertTriangle, Clock, X, ArrowRight } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export const DashboardLayout = ({ children }) => {
    const { activeEmpresa } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [subNotice, setSubNotice] = useState(null);
    const [bannerDismissed, setBannerDismissed] = useState(false);

    useEffect(() => {
        const checkSuscripcion = async () => {
            try {
                const { data } = await api.get('/planes/mi-suscripcion');
                const dias = data?.empresa?.dias_restantes;
                const estado = data?.empresa?.estado_suscripcion;

                if (dias !== null && dias !== undefined) {
                    if (dias <= 5) {
                        setSubNotice({
                            dias,
                            estado,
                            esCritico: dias <= 0
                        });
                    } else {
                        setSubNotice(null);
                    }
                }
            } catch (err) {
                // Silencioso en caso de no estar autenticado o error transitorio
            }
        };

        checkSuscripcion();
    }, [activeEmpresa?.id]);

    const isAlreadyOnSuscripcionPage = location.pathname === '/mi-suscripcion';

    return (
        <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Topbar />

                {/* Banner Global de Vencimiento de Suscripción */}
                {subNotice && !bannerDismissed && !isAlreadyOnSuscripcionPage && (
                    <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-xs transition ${
                        subNotice.esCritico 
                            ? 'bg-rose-600 text-white' 
                            : 'bg-amber-500 text-slate-950'
                    }`}>
                        <div className="flex items-center gap-2 max-w-5xl mx-auto flex-1">
                            {subNotice.esCritico ? (
                                <AlertTriangle className="w-4 h-4 shrink-0 text-white animate-bounce" />
                            ) : (
                                <Clock className="w-4 h-4 shrink-0 text-slate-950" />
                            )}
                            <span>
                                {subNotice.esCritico
                                    ? `Atención: Tu suscripción de facturación ha vencido (${Math.abs(subNotice.dias)} días atrás). Te sugerimos regularizarla para mantener tus folios activos.`
                                    : `Recordatorio: Tu suscripción vence en ${subNotice.dias} ${subNotice.dias === 1 ? 'día' : 'días'}. Evita la suspensión del servicio de timbrado.`
                                }
                            </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => navigate('/mi-suscripcion')}
                                className={`px-3 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition shadow-xs ${
                                    subNotice.esCritico
                                        ? 'bg-white text-rose-700 hover:bg-rose-50'
                                        : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                            >
                                <span>Pagar / Renovar</span>
                                <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => setBannerDismissed(true)}
                                className={`p-1 rounded transition ${
                                    subNotice.esCritico
                                        ? 'hover:bg-rose-700 text-white'
                                        : 'hover:bg-amber-600 text-slate-900'
                                }`}
                                title="Ocultar por ahora"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
