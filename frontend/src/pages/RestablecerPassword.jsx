import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { NetLogo } from '../components/NetLogo';
import api from '../api/axios';

export const RestablecerPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [verifying, setVerifying] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [userData, setUserData] = useState(null);
    const [tokenError, setTokenError] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setVerifying(false);
                setTokenValid(false);
                setTokenError('No se proporcionó ningún token de recuperación.');
                return;
            }

            try {
                const res = await api.get(`/auth/verificar-token-reset?token=${token}`);
                if (res.data?.valid) {
                    setTokenValid(true);
                    setUserData(res.data);
                } else {
                    setTokenValid(false);
                    setTokenError(res.data?.message || 'El enlace de recuperación es inválido o ha expirado.');
                }
            } catch (err) {
                setTokenValid(false);
                setTokenError(err.response?.data?.message || 'El enlace es inválido o ya ha expirado.');
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        if (password.length < 6) {
            setSubmitError('La contraseña debe contener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setSubmitError('Las contraseñas no coinciden. Por favor verifícalas.');
            return;
        }

        try {
            setSubmitting(true);
            const res = await api.post('/auth/restablecer-password', {
                token,
                password
            });

            if (res.data?.success) {
                setSuccess(true);
            } else {
                setSubmitError(res.data?.message || 'Error al actualizar la contraseña.');
            }
        } catch (err) {
            setSubmitError(err.response?.data?.message || 'Error al restablecer la contraseña.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#06101e] text-slate-100 flex items-center justify-center relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white p-4">
            {/* Ambient Glows */}
            <div className="absolute -top-40 -left-40 w-[550px] h-[550px] bg-gradient-to-br from-cyan-600/20 to-blue-700/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-gradient-to-tl from-blue-700/25 via-indigo-600/15 to-transparent rounded-full blur-[140px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="bg-[#0b172a]/95 backdrop-blur-2xl border border-slate-700/60 rounded-3xl p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

                    {/* Logo Header */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="relative group mb-3">
                            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full blur-md opacity-70" />
                            <NetLogo size="lg" className="border-2 border-cyan-400/40 relative shadow-xl" />
                        </div>
                        <h2 className="text-xl font-bold text-white tracking-wide">
                            FACTURACIÓN <span className="text-cyan-400">CFDI 4.0</span>
                        </h2>
                        <span className="text-[11px] text-cyan-200/80 uppercase tracking-wider font-semibold">
                            Net Consultores • Recuperación de Acceso
                        </span>
                    </div>

                    {verifying ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                            <p className="text-sm font-medium">Validando enlace de recuperación...</p>
                        </div>
                    ) : !tokenValid ? (
                        <div className="space-y-6 text-center">
                            <div className="w-14 h-14 bg-red-950/60 border border-red-500/40 text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                                <AlertCircle className="w-7 h-7" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-white">Enlace Expirado o Inválido</h3>
                                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                                    {tokenError || 'Este enlace de recuperación ha expirado o ya fue utilizado anteriormente.'}
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition border border-slate-700 shadow-md"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Volver a Iniciar Sesión</span>
                            </button>
                        </div>
                    ) : success ? (
                        <div className="space-y-6 text-center animate-fadeIn">
                            <div className="w-14 h-14 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                                <CheckCircle2 className="w-7 h-7" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-white">¡Contraseña Actualizada!</h3>
                                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                                    Tu contraseña ha sido restablecida exitosamente. Ya puedes acceder con tu nueva credencial.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg shadow-cyan-500/25"
                            >
                                Iniciar Sesión Ahora
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-fadeIn">
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">Crea tu Nueva Contraseña</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Hola <strong className="text-cyan-300">{userData?.nombre}</strong>, ingresa tu nueva contraseña segura.
                                </p>
                            </div>

                            {submitError && (
                                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2 animate-fadeIn">
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <span>{submitError}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Nueva Contraseña
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <Lock className="h-4 w-4" />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
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

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Confirmar Contraseña
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <KeyRound className="h-4 w-4" />
                                        </div>
                                        <input
                                            type={showConfirm ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repite la contraseña"
                                            className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm(!showConfirm)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-400 transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>Guardar Nueva Contraseña</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="text-center pt-2">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span>Cancelar y volver al login</span>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
