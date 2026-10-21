import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

export const ReceptorModal = ({ isOpen, onClose, onSaved }) => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const [coloniasOpt, setColoniasOpt] = useState([]);
    const [regimenesOptBase, setRegimenesOptBase] = useState([]);
    const [regimenesOpt, setRegimenesOpt] = useState([]);
    const [usosCfdiOpt, setUsosCfdiOpt] = useState([]);
    const [isFetchingCP, setIsFetchingCP] = useState(false);
    const [formData, setFormData] = useState({
        rfc: '',
        razon_social: '',
        uso_cfdi: 'G03',
        regimen_fiscal: '601',
        codigo_postal: '',
        estado: '',
        municipio: '',
        colonia: ''
    });

    useEffect(() => {
        if (!isOpen) return;
        const fetchSettings = async () => {
            try {
                const resRegimenes = await api.get('/catalogos/regimenes-fiscales');
                setRegimenesOptBase(resRegimenes.data);
                setRegimenesOpt(resRegimenes.data);
                const resUsos = await api.get('/catalogos/usos-cfdi');
                setUsosCfdiOpt(resUsos.data);
            } catch (error) {
                console.error("Error fetching receptor catalogs", error);
            }
        };
        fetchSettings();
    }, [isOpen]);

    useEffect(() => {
        const fetchSepomex = async () => {
            if (formData.codigo_postal.length === 5) {
                setIsFetchingCP(true);
                try {
                    const res = await api.get(`/sepomex/cp/${formData.codigo_postal}`);
                    setColoniasOpt(res.data.colonias);
                    if (res.data.colonias.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            estado: res.data.estado.nombre,
                            municipio: res.data.municipio.nombre,
                            colonia: res.data.colonias[0].nombre // Select first by default
                        }));
                    }
                } catch (error) {
                    setColoniasOpt([]);
                    setFormData(prev => ({ ...prev, estado: '', municipio: '', colonia: '' }));
                } finally {
                    setIsFetchingCP(false);
                }
            } else {
                setColoniasOpt([]);
                setFormData(prev => ({ ...prev, estado: '', municipio: '', colonia: '' }));
            }
        };
        fetchSepomex();
    }, [formData.codigo_postal]);

    // Filter Regimen Fiscal based on RFC length (Persona Fisica vs Moral)
    useEffect(() => {
        if (!formData.rfc) {
            setRegimenesOpt(regimenesOptBase);
            return;
        }

        const rfcLength = formData.rfc.trim().length;
        let validRegimenes = regimenesOptBase;

        if (rfcLength === 12) {
            validRegimenes = regimenesOptBase.filter(r => !['605', '606', '608', '611', '612', '614', '615', '616'].includes(r.clave));
        } else if (rfcLength === 13) {
            validRegimenes = regimenesOptBase.filter(r => !['601', '603', '607', '609', '620', '622', '623', '624', '628'].includes(r.clave));
        }

        setRegimenesOpt(validRegimenes);

        if (validRegimenes.length > 0 && formData.regimen_fiscal) {
            const isValid = validRegimenes.some(r => r.clave === formData.regimen_fiscal);
            if (!isValid) {
                setFormData(prev => ({ ...prev, regimen_fiscal: validRegimenes[0].clave }));
            }
        }
    }, [formData.rfc, regimenesOptBase]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/receptores', { ...formData, emisor_id: activeEmisor.id });
            showToast("✅ Receptor guardado correctamente");
            if (onSaved) onSaved(res.data);
            onClose();
            setFormData({ rfc: '', razon_social: '', uso_cfdi: 'G03', regimen_fiscal: '601', codigo_postal: '', estado: '', municipio: '', colonia: '' });
        } catch (error) {
            console.error("Error saving receptor", error);
            showToast("No se pudo guardar el receptor. Verifica los datos.", "error");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800">Agregar Nuevo Receptor</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">RFC</label>
                            <input required value={formData.rfc} onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm font-mono uppercase transition-all" placeholder="XAXX010101000" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Código Postal</label>
                            <div className="relative">
                                <input required value={formData.codigo_postal} onChange={e => setFormData({ ...formData, codigo_postal: e.target.value })} type="text" maxLength="5" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm transition-all" placeholder="64000" />
                                {isFetchingCP && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Razón Social</label>
                            <input required value={formData.razon_social} onChange={e => setFormData({ ...formData, razon_social: e.target.value })} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm transition-all" placeholder="Nombre de la empresa o cliente" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Régimen Fiscal</label>
                            <select value={formData.regimen_fiscal} onChange={e => setFormData({ ...formData, regimen_fiscal: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm bg-white transition-all">
                                {regimenesOpt.map(reg => (
                                    <option key={reg.clave} value={reg.clave}>{reg.clave} - {reg.descripcion}</option>
                                ))}
                                {regimenesOpt.length === 0 && <option value="601">601 - General de Ley Personas Morales</option>}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Uso de CFDI</label>
                            <select value={formData.uso_cfdi} onChange={e => setFormData({ ...formData, uso_cfdi: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm bg-white transition-all">
                                {usosCfdiOpt.map(uso => (
                                    <option key={uso.clave} value={uso.clave}>{uso.clave} - {uso.descripcion}</option>
                                ))}
                                {usosCfdiOpt.length === 0 && <option value="G03">G03 - Gastos en general</option>}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Estado</label>
                            <input disabled value={formData.estado} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg font-semibold text-sm bg-slate-50 text-slate-500 cursor-not-allowed" placeholder="Estado..." />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Municipio / Alcaldía</label>
                            <input disabled value={formData.municipio} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg font-semibold text-sm bg-slate-50 text-slate-500 cursor-not-allowed" placeholder="Municipio..." />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Colonia / Localidad</label>
                            <select disabled={coloniasOpt.length === 0} value={formData.colonia} onChange={e => setFormData({ ...formData, colonia: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400 transition-all">
                                {coloniasOpt.length === 0 && <option value="">Seleccione un CP válido</option>}
                                {coloniasOpt.map(col => (
                                    <option key={col.id} value={col.nombre}>{col.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 active:scale-95 transition-all">Cancelar</button>
                        <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-semibold shadow-md shadow-primary-500/10 active:scale-95 transition-all">
                            <Save className="w-4 h-4" /> Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
