import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Users, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

export const Receptores = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const [receptores, setReceptores] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [coloniasOpt, setColoniasOpt] = useState([]);
    const [regimenesOptBase, setRegimenesOptBase] = useState([]); // Store the original catalog
    const [regimenesOpt, setRegimenesOpt] = useState([]); // Filtered catalog
    const [usosCfdiOpt, setUsosCfdiOpt] = useState([]);
    const [isFetchingCP, setIsFetchingCP] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        rfc: '',
        razon_social: '',
        uso_cfdi: 'G03',
        regimen_fiscal: '601',
        codigo_postal: '',
        estado: '',
        municipio: '',
        colonia: '',
        calle: '',
        no_exterior: '',
        no_interior: ''
    });

    const fetchReceptores = async () => {
        if (!activeEmisor) {
            setReceptores([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await api.get(`/receptores/emisor/${activeEmisor.id}`);
            setReceptores(res.data);
        } catch (error) {
            console.error("Error fetching receptores", error);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        fetchReceptores();

        // Fetch Global Catalogs on Mount
        const fetchSettings = async () => {
            try {
                const resRegimenes = await api.get('/catalogos/regimenes-fiscales');
                setRegimenesOptBase(resRegimenes.data);
                setRegimenesOpt(resRegimenes.data); // Initial populate
                const resUsos = await api.get('/catalogos/usos-cfdi');
                setUsosCfdiOpt(resUsos.data);
            } catch (error) {
                console.error("Error fetching receptor catalogs", error);
            }
        };
        fetchSettings();
    }, [activeEmisor]);

    // SEPOMEX Autocomplete
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
                    console.error("CP not found");
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
            // Persona Moral - typically regime codes start with 6 (except some specifics, but general rule for this filter)
            // Or more safely, just exclude the ones explicitly for 'Fisicas' if we had a flags column.
            // Simplified logic: CFDI 4.0 validation generally expects 601, 603, etc for Morales (12 chars).
            validRegimenes = regimenesOptBase.filter(r => !['605', '606', '608', '611', '612', '614', '615', '616'].includes(r.clave));
        } else if (rfcLength === 13) {
            // Persona Física
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
            const payload = { ...formData, emisor_id: activeEmisor.id };
            if (editId) {
                await api.put(`/receptores/${editId}`, payload);
            } else {
                await api.post('/receptores', payload);
            }
            showToast("✅ Receptor guardado correctamente");
            setShowModal(false);
            setEditId(null);
            fetchReceptores(); // Reload the list
            setFormData({ 
                rfc: '', razon_social: '', uso_cfdi: 'G03', regimen_fiscal: '601', 
                codigo_postal: '', estado: '', municipio: '', colonia: '',
                calle: '', no_exterior: '', no_interior: ''
            });
        } catch (error) {
            console.error("Error saving receptor", error);
            showToast("No se pudo guardar el receptor. Verifica los datos.", "error");
        }
    };

    const handleEdit = (receptor) => {
        setEditId(receptor.id);
        setFormData({
            rfc: receptor.rfc,
            razon_social: receptor.razon_social,
            uso_cfdi: receptor.uso_cfdi || 'G03',
            regimen_fiscal: receptor.regimen_fiscal || '601',
            codigo_postal: receptor.codigo_postal,
            estado: receptor.estado || '',
            municipio: receptor.municipio || '',
            colonia: receptor.colonia || '',
            calle: receptor.calle || '',
            no_exterior: receptor.no_exterior || '',
            no_interior: receptor.no_interior || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este cliente?')) return;
        try {
            await api.delete(`/receptores/${id}`);
            fetchReceptores();
            showToast("✅ Cliente eliminado");
        } catch (error) {
            console.error("Error deleting receptor", error);
            showToast("No se pudo eliminar el receptor.", "error");
        }
    };

    if (!activeEmisor) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                Selecciona un emisor en la barra superior para continuar.
            </div>
        );
    }

    // Safety check during initial load
    const currentList = Array.isArray(receptores) ? receptores : [];

    const filtered = currentList.filter(r =>
        r.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.rfc.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Directorio de Clientes (Receptores)</h1>
                    <p className="text-slate-500 text-sm mt-1">Administra los datos fiscales de tus clientes para la emisión de facturas.</p>
                </div>
                <button onClick={() => {
                    setEditId(null);
                    setFormData({ 
                        rfc: '', razon_social: '', uso_cfdi: 'G03', regimen_fiscal: '601', 
                        codigo_postal: '', estado: '', municipio: '', colonia: '',
                        calle: '', no_exterior: '', no_interior: ''
                    });
                    setShowModal(true);
                }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 shadow-sm shadow-primary-500/20 transition-all">
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Cliente</span>
                </button>
            </div>

            {/* Form Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editId ? 'Editar Receptor' : 'Agregar Nuevo Receptor'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all">
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
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Calle</label>
                                    <input value={formData.calle} onChange={e => setFormData({ ...formData, calle: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm transition-all" placeholder="AV. PRINCIPAL" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">No. Exterior</label>
                                    <input value={formData.no_exterior} onChange={e => setFormData({ ...formData, no_exterior: e.target.value })} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm transition-all" placeholder="123" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">No. Interior</label>
                                    <input value={formData.no_interior} onChange={e => setFormData({ ...formData, no_interior: e.target.value })} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm transition-all" placeholder="A" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 active:scale-95 transition-all">Cancelar</button>
                                <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-semibold shadow-md shadow-primary-500/10 active:scale-95 transition-all">
                                    <Save className="w-4 h-4" /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por Razón Social o RFC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg text-sm transition-all outline-none bg-white"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold w-8">#</th>
                                <th className="p-4 font-semibold">Razón Social y RFC</th>
                                <th className="p-4 font-semibold text-center">Uso de CFDI (Default)</th>
                                <th className="p-4 font-semibold text-center">Régimen Fiscal</th>
                                <th className="p-4 font-semibold text-center">C.P.</th>
                                <th className="p-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filtered.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-4 text-slate-400">{idx + 1}</td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-800">{item.razon_social}</span>
                                            <span className="text-xs text-slate-500 font-mono mt-0.5">{item.rfc}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                            {item.uso_cfdi || 'S01'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                            {item.regimen_fiscal}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center font-mono text-slate-600">{item.codigo_postal}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors" title="Editar">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {loading && (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-slate-400">
                                        Cargando receptores...
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center">
                                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">No hay clientes registrados o coincidentes</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
