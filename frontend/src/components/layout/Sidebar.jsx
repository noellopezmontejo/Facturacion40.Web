import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, FileText, CreditCard, Settings, LogOut, Package, FilePlus, Palette, Truck, UserSquare2, MapPinned, Tag, Landmark, ClipboardList, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const mainNavItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Generar Factura', path: '/facturas/nueva', icon: FilePlus },
    { name: 'Documentos Emitidos', path: '/documentos', icon: FileText },
    { name: 'Cotizaciones', path: '/cotizaciones', icon: ClipboardList },
    { name: 'Órdenes de Servicio', path: '/ordenes-servicio', icon: Wrench },
    { name: 'Cuentas Por Cobrar', path: '/pagos', icon: CreditCard },
    { name: 'Cuentas por Pagar', path: '/cuentas-por-pagar', icon: Landmark },
    { name: 'Receptores', path: '/receptores', icon: Users },
    { name: 'Conceptos', path: '/conceptos', icon: Package },
    { name: 'Usuarios', path: '/usuarios', icon: Users, roles: ['Administrador', 'Usuario Empresarial'] },
    { name: 'Impuestos', path: '/impuestos', icon: FileText, roles: ['Administrador', 'Usuario Empresarial'] },
    { name: 'Impuestos Locales', path: '/impuestos-locales', icon: Tag, roles: ['Administrador', 'Usuario Empresarial'] },
    { name: 'Emisores', path: '/emisores', icon: Building2 },
    { name: 'Diseñador de Facturas', path: '/configuracion/diseno', icon: Palette, roles: ['Administrador'] },
    { name: 'Configuración', path: '/configuracion', icon: Settings },
];

const cartaPorteItems = [
    { name: 'Emitir Carta Porte', path: '/carta-porte/nueva', icon: MapPinned },
    { name: 'Vehículos Flota', path: '/vehiculos', icon: Truck },
    { name: 'Choferes', path: '/choferes', icon: UserSquare2 },
];

export const Sidebar = () => {
    const { user, logout } = useAuth();
    const [isCpMenuOpen, setIsCpMenuOpen] = React.useState(false);

    const renderNavItem = (item, isSubItem = false) => {
        const Icon = item.icon;
        return (
            <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                        ? 'bg-primary-500/10 text-primary-400 font-medium'
                        : 'hover:bg-slate-800 hover:text-white'
                    } ${isSubItem ? 'ml-6 border-l border-slate-700 pl-4 my-1' : ''}`
                }
            >
                <Icon className={`${isSubItem ? 'w-4 h-4' : 'w-5 h-5'} opacity-70 group-hover:opacity-100 transition-opacity`} />
                <span className={isSubItem ? 'text-sm' : ''}>{item.name}</span>
            </NavLink>
        );
    };

    const filteredNavItems = mainNavItems.filter(item => {
        if (!item.roles) return true;
        return user && item.roles.includes(user.rol);
    });

    return (
        <div className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col font-sans border-r border-slate-800 hidden md:flex">
            <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/30">
                        F
                    </div>
                    <span className="font-semibold text-white tracking-wide text-lg">Facturación<span className="text-primary-500">4.0</span></span>
                </div>
            </div>

            <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto custom-scrollbar">
                <p className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Menú Principal</p>
                {filteredNavItems.map(item => renderNavItem(item))}
                
                <div className="mt-6 pt-4 border-t border-slate-800">
                    <button 
                        onClick={() => setIsCpMenuOpen(!isCpMenuOpen)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors group mb-1"
                    >
                        <div className="flex items-center gap-3">
                            <Truck className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity text-indigo-400" />
                            <span className="font-semibold tracking-wide text-sm uppercase text-slate-400 group-hover:text-white">Carta Porte 3.1</span>
                        </div>
                        <span className="text-slate-500 text-xs text-opacity-60">{isCpMenuOpen ? '▲' : '▼'}</span>
                    </button>
                    
                    {isCpMenuOpen && (
                        <div className="animate-fadeIn mt-2">
                            {cartaPorteItems.map(item => renderNavItem(item, true))}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left hover:bg-slate-800 hover:text-white transition-colors text-slate-400 group"
                >
                    <LogOut className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:text-red-400 object-transition" />
                    <span className="group-hover:text-red-400 transition-colors">Cerrar Sesión</span>
                </button>
            </div>
        </div>
    );
};
