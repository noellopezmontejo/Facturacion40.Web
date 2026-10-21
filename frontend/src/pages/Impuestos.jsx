import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

export const Impuestos = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [impuestos, setImpuestos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        descripcion: '',
        tipo: 'traslado',
        impuesto_sat: '002',
        tipo_factor: 'Tasa',
        tasa_cuota: ''
    });

    const fetchImpuestos = async () => {
        setLoading(true);
        try {
            const res = await api.get('/impuestos');
            setImpuestos(res.data);
        } catch (error) {
            console.error("Error fetching impuestos", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchImpuestos();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, tasa_cuota: parseFloat(formData.tasa_cuota) };
            if (editingId) {
                await api.put(`/impuestos/${editingId}`, payload);
                showToast("✅ Impuesto actualizado correctamente");
            } else {
                await api.post('/impuestos', payload);
                showToast("✅ Impuesto guardado correctamente");
            }
            setShowModal(false);
            setEditingId(null);
            fetchImpuestos(); // Reload the list
            setFormData({ descripcion: '', tipo: 'traslado', impuesto_sat: '002', tipo_factor: 'Tasa', tasa_cuota: '' });
        } catch (error) {
            console.error("Error saving impuesto", error);
            showToast("No se pudo guardar el impuesto. Verifica los datos.", "error");
        }
    };

    const handleEdit = (imp) => {
        setEditingId(imp.id);
        setFormData({
            descripcion: imp.descripcion,
            tipo: imp.tipo,
            impuesto_sat: imp.impuesto_sat,
            tipo_factor: imp.tipo_factor,
            tasa_cuota: imp.tasa_cuota
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar este impuesto del catálogo?")) return;
        try {
            await api.delete(`/impuestos/${id}`);
            showToast("✅ Impuesto eliminado correctamente");
            fetchImpuestos();
        } catch (error) {
            console.error("Error deleting impuesto", error);
            showToast("Error al eliminar el impuesto", "error");
        }
    };

    const currentList = Array.isArray(impuestos) ? impuestos : [];

    const filteredImpuestos = currentList.filter(i =>
        i.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Catálogo de Impuestos</h1>
                    <p className="text-slate-500 text-sm mt-1">Configura las tasas o cuotas de traslados y retenciones.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 shadow-sm shadow-primary-500/20 transition-all">
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Impuesto</span>
                </button>
            </div>

            {/* Form Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editingId ? 'Editar' : 'Agregar Nuevo'} Impuesto</h3>
                            <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
                                    <input required value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm" placeholder="Ej. IVA 16% o Retención ISR 1.25%" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Impuesto</label>
                                    <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm bg-white">
                                        <option value="traslado">Traslado</option>
                                        <option value="retencion">Retención</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Clave SAT</label>
                                    <select value={formData.impuesto_sat} onChange={e => setFormData({ ...formData, impuesto_sat: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm bg-white">
                                        <option value="001">001 - ISR</option>
                                        <option value="002">002 - IVA</option>
                                        <option value="003">003 - IEPS</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo Factor</label>
                                    <select value={formData.tipo_factor} onChange={e => setFormData({ ...formData, tipo_factor: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm bg-white">
                                        <option value="Tasa">Tasa</option>
                                        <option value="Cuota">Cuota</option>
                                        <option value="Exento">Exento</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tasa o Cuota (Decimal)</label>
                                    <input required value={formData.tasa_cuota} onChange={e => setFormData({ ...formData, tasa_cuota: e.target.value })} type="number" step="0.000001" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm" placeholder="Ej. 0.160000" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
                                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors">
                                    <Save className="w-4 h-4" /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar impuesto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg text-sm transition-all outline-none bg-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold w-8">#</th>
                                <th className="p-4 font-semibold">Descripción</th>
                                <th className="p-4 font-semibold">Tipo</th>
                                <th className="p-4 font-semibold">Factor y Tasa</th>
                                <th className="p-4 font-semibold text-center">Clave SAT</th>
                                <th className="p-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                            {filteredImpuestos.map((imp, idx) => (
                                <tr key={imp.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-4 text-slate-400">{idx + 1}</td>
                                    <td className="p-4 text-slate-850 font-medium">
                                        <div className="flex items-center gap-2.5">
                                            <Tag className={`w-4 h-4 ${imp.tipo === 'traslado' ? 'text-blue-500' : 'text-orange-500'}`} />
                                            <span className="font-bold text-slate-700">{imp.descripcion}</span>
                                            {imp.empresa_id === null ? (
                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/60">
                                                    Público
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                                                    Privado
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${imp.tipo === 'traslado'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : 'bg-orange-50 text-orange-700 border border-orange-100'
                                            }`}>
                                            {imp.tipo.charAt(0).toUpperCase() + imp.tipo.slice(1)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        {imp.tipo_factor} {(imp.tasa_cuota !== null && imp.tasa_cuota !== undefined) ? `(${(imp.tasa_cuota * 100).toFixed(4)}%)` : ''}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs select-all">
                                            {imp.impuesto_sat}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {(user.rol === 'Administrador' || imp.empresa_id !== null) ? (
                                                <>
                                                    <button onClick={() => handleEdit(imp)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Editar">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(imp.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-semibold italic px-2">Lectura</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {loading && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-400">
                                        Cargando impuestos...
                                    </td>
                                </tr>
                            )}
                            {!loading && filteredImpuestos.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        No se encontraron impuestos que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
                    <span>Mostrando {filteredImpuestos.length} impuestos</span>
                </div>
            </div>
        </div>
    );
};
