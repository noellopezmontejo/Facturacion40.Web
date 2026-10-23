import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, Eye, EyeOff, ShieldCheck, Zap, Building2, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NetLogo } from '../components/NetLogo';

export const Login = () => {
    const [correo, setCorreo] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(correo, password);
            navigate('/');
        } catch (err) {
            if (!err.response) {
                setError('No se pudo establecer conexión con el servidor. Verifica tu conexión a internet o el estado del backend.');
            } else {
                const baseMsg = err.response?.data?.message || 'Error al iniciar sesión. Verifica tus credenciales.';
                const detailMsg = err.response?.data?.detail ? ` (${err.response.data.detail})` : '';
                setError(`${baseMsg}${detailMsg}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#06101e] text-slate-100 flex items-center justify-center relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
            {/* Ambient Background Glows */}
            <div className="absolute -top-40 -left-40 w-[550px] h-[550px] bg-gradient-to-br from-cyan-600/20 to-blue-700/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-gradient-to-tl from-blue-700/25 via-indigo-600/15 to-transparent rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-400/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Subtle Tech Grid Texture */}
            <div 
                className="absolute inset-0 opacity-[0.14] pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:28px_28px]" 
            />

            {/* Main Container */}
            <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 relative z-10 flex flex-col justify-center min-h-screen">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                    
                    {/* LEFT COLUMN: Brand Experience & Identity */}
                    <div className="lg:col-span-7 flex flex-col justify-center space-y-8 text-center lg:text-left pt-6 lg:pt-0">
                        
                        {/* Company Badge */}
                        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold backdrop-blur-md self-center lg:self-start shadow-lg shadow-cyan-950/40">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                            </span>
                            <span>NET CONSULTORES • DESDE 2017</span>
                        </div>

                        {/* Central Brand Header */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-center gap-5 justify-center lg:justify-start">
                                <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-105">
                                    <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-300" />
                                    <NetLogo size="xl" className="border-4 border-[#07172c] relative shadow-2xl" />
                                </div>
                                <div className="space-y-1 text-center sm:text-left">
                                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                                        FACTURACIÓN <span className="text-cyan-400">CFDI 4.0</span>
                                    </h2>
                                    <p className="text-xs sm:text-sm text-cyan-200/80 font-medium tracking-wider uppercase">
                                        Sistema Fiscal Certificado para Empresas de Vanguardia
                                    </p>
                                </div>
                            </div>

                            {/* Bold Official Slogan */}
                            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight leading-[1.15] text-white">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-sky-300 drop-shadow-sm">
                                    CONECTAMOS TU EMPRESA AL FUTURO
                                </span>
                            </h1>

                            <p className="text-sm sm:text-base text-slate-300/90 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
                                Administra con máxima eficiencia la emisión y timbrado de comprobantes fiscales digitales, complementos de pago (REP), nómina y cartas porte con tecnología en la nube de alta disponibilidad.
                            </p>
                        </div>

                        {/* Feature Badges Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                            <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-2 hover:border-cyan-500/40 transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Normativa SAT 4.0</h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Validación estricta de CSD, RFC y esquemas vigentes.</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-2 hover:border-blue-500/40 transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Timbrado PAC</h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Emisión veloz con sellado digital en milisegundos.</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-2 hover:border-cyan-500/40 transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">Multi-Emisor</h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Gestión empresarial de múltiples razones sociales.</p>
                                </div>
                            </div>
                        </div>

                        {/* Left Footer Credential */}
                        <div className="pt-2 text-xs text-slate-400 flex items-center justify-center lg:justify-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                            <span>Infraestructura Segura TLS 1.3 • Respaldo Automatizado en Nube</span>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: The Executive Login Card */}
                    <div className="lg:col-span-5 w-full">
                        <div className="bg-[#0b172a]/90 backdrop-blur-2xl border border-slate-700/60 rounded-3xl p-7 sm:p-9 shadow-2xl shadow-black/80 relative overflow-hidden">
                            
                            {/* Card Top Light Streak */}
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

                            {/* Mobile Logo View (Hidden on LG+) */}
                            <div className="flex lg:hidden flex-col items-center text-center mb-6">
                                <NetLogo size="lg" className="border-2 border-cyan-400/40 mb-3" />
                                <span className="text-xs font-bold text-cyan-400 tracking-widest uppercase">Net Consultores</span>
                            </div>

                            {/* Card Header */}
                            <div className="mb-6 text-center sm:text-left">
                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 text-[11px] font-semibold mb-2">
                                    <Lock className="w-3 h-3" />
                                    <span>PORTAL CORPORATIVO</span>
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">
                                    Iniciar Sesión
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                    Ingresa con tus credenciales autorizadas
                                </p>
                            </div>

                            {/* Error Alert */}
                            {error && (
                                <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 animate-fadeIn">
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <div className="flex-1 leading-relaxed">
                                        {error}
                                    </div>
                                </div>
                            )}

                            {/* Form */}
                            <form className="space-y-4" onSubmit={handleSubmit}>
                                
                                {/* Correo Electrónico */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Correo Electrónico
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <Mail className="h-4 w-4" />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={correo}
                                            onChange={(e) => setCorreo(e.target.value)}
                                            placeholder="admin@cfdi4.mx"
                                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Contraseña */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                            Contraseña
                                        </label>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <Lock className="h-4 w-4" />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-400 transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Options row */}
                                <div className="flex items-center justify-between pt-1">
                                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-400/30 focus:ring-offset-0"
                                        />
                                        <span>Recordar sesión</span>
                                    </label>

                                    {/* Live Status indicator */}
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        <span>PAC En Línea</span>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-3 group relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Autenticando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <LogIn className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                            <span>Acceder al Sistema</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Card Footer Help */}
                            <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                                <p className="text-[11px] text-slate-400">
                                    ¿Requieres soporte técnico o nuevas cuentas de emisor?
                                </p>
                                <a 
                                    href="https://netconsultores.com.mx" 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold mt-1 transition-colors"
                                >
                                    <Globe className="w-3 h-3" />
                                    <span>netconsultores.com.mx</span>
                                </a>
                            </div>
                        </div>

                        {/* Security Disclaimer below card */}
                        <div className="mt-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                            <span>Sesión encriptada con cifrado SSL de 256 bits y sellos CSD</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Global Footer */}
                <div className="mt-12 text-center text-xs text-slate-300/80">
                    © 2017 - 2026 <strong className="text-white font-semibold">Net Consultores</strong>. Todos los derechos reservados. Conectamos tu empresa al futuro.
                </div>
            </div>
        </div>
    );
};

export default Login;
