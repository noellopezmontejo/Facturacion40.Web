import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

export const ImpuestosLocales = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [impuestos, setImpuestos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        nombre: '',
        tasa: '',
        tipo: 'retencion'
    });

    const fetchImpuestos = async () => {
        setLoading(true);
        try {
            const res = await api.get('/impuestos-locales');
            setImpuestos(res.data);
        } catch (error) {
            console.error("Error fetching impuestos locales", error);
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
            const payload = { ...formData, tasa: parseFloat(formData.tasa) };
            if (editingId) {
                await api.put(`/impuestos-locales/${editingId}`, payload);
                showToast("✅ Impuesto local actualizado");
            } else {
                await api.post('/impuestos-locales', payload);
                showToast("✅ Impuesto local guardado");
            }
            setShowModal(false);
            setEditingId(null);
            setFormData({ nombre: '', tasa: '', tipo: 'retencion' });
            fetchImpuestos();
        } catch (error) {
            console.error("Error saving impuesto local", error);
            showToast("No se pudo guardar. Verifica los datos.", "error");
        }
    };

    const handleEdit = (imp) => {
        setEditingId(imp.id);
        setFormData({
            nombre: imp.nombre,
            tasa: imp.tasa,
            tipo: imp.tipo
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar este impuesto local?")) return;
        try {
            await api.delete(`/impuestos-locales/${id}`);
            showToast("✅ Eliminado correctamente");
            fetchImpuestos();
        } catch (error) {
            showToast("Error al eliminar", "error");
        }
    };

    const filtered = impuestos.filter(i =>
        i.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Impuestos Locales (Construcción)</h1>
                    <p className="text-slate-500 text-sm mt-1">Configura retenciones y traslados específicos del sector.</p>
                </div>
                <button onClick={() => { setEditingId(null); setFormData({nombre:'', tasa:'', tipo:'retencion'}); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 shadow-sm transition-all">
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Impuesto Local</span>
                </button>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editingId ? 'Editar' : 'Agregar'} Impuesto Local</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Nombre del Impuesto</label>
                                <input required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-sm" placeholder="Ej. 5 al millar" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Tipo</label>
                                    <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-sm bg-white">
                                        <option value="retencion">Retención</option>
                                        <option value="traslado">Traslado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Tasa (Decimal)</label>
                                    <input required value={formData.tasa} onChange={e => setFormData({ ...formData, tasa: e.target.value })} type="number" step="0.000001" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-sm" placeholder="Ej. 0.005" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-50 rounded-lg">Cancelar</button>
                                <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">
                                    <Save className="w-4 h-4" /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm outline-none bg-white" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-widest font-black">
                                <th className="p-4 w-8">#</th>
                                <th className="p-4">Descripción</th>
                                <th className="p-4 text-center">Tipo</th>
                                <th className="p-4 text-right">Tasa</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                            {filtered.map((imp, idx) => (
                                <tr key={imp.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 text-slate-400">{idx + 1}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700">{imp.nombre}</span>
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
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${imp.tipo === 'traslado' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                            {imp.tipo}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-600">
                                        {(parseFloat(imp.tasa) * 100).toFixed(2)}%
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            {(user.rol === 'Administrador' || imp.empresa_id !== null) ? (
                                                <>
                                                    <button onClick={() => handleEdit(imp)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(imp.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-semibold italic px-2">Lectura</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
