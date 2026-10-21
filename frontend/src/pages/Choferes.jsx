import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserSquare2, Plus, Edit2, Trash2, Heading, X } from 'lucide-react';
import api from '../api/axios';

const Choferes = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const emisorId = activeEmisor?.id;
    const [choferes, setChoferes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [form, setForm] = useState({
        rfc_figura: '',
        num_licencia: '',
        nombre_figura: ''
    });

    useEffect(() => {
        if (emisorId) fetchChoferes();
    }, [emisorId]);

    const fetchChoferes = async () => {
        try {
            const { data } = await api.get(`/choferes?emisor_id=${emisorId}`);
            setChoferes(data);
        } catch (error) {
            showToast('Error al cargar la cartera de choferes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => setForm({ ...form, [e.target.name]: e.target.value.toUpperCase() });

    const openModal = (chofer = null) => {
        setEditingId(chofer ? chofer.id : null);
        setForm(chofer || { rfc_figura: '', num_licencia: '', nombre_figura: '' });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/choferes/${editingId}`, form);
                showToast('Operador actualizado exitosamente', 'success');
            } else {
                await api.post('/choferes', { ...form, emisor_id: emisorId });
                showToast('Operador dado de alta', 'success');
            }
            setIsModalOpen(false);
            fetchChoferes();
        } catch (error) {
            showToast('Error al guardar el operador', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Desar dar de baja a este operador permanentemente?')) {
            try {
                await api.delete(`/choferes/${id}`);
                showToast('Operador dado de baja', 'success');
                fetchChoferes();
            } catch (error) {
                showToast('Error al eliminar', 'error');
            }
        }
    };

    return (
        <div className="p-8 relative">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <UserSquare2 className="text-fuchsia-600" />
                        Directorio de Choferes
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Administra los operadores de la flota para ser asignados en tus Cartas Porte</p>
                </div>
                <button onClick={() => openModal()} className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 flex items-center gap-2 font-medium transition-colors shadow-sm">
                    <Plus size={18} />
                    Agregar Operador
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                            <th className="p-4">Nombre del Operador</th>
                            <th className="p-4">RFC Registrado</th>
                            <th className="p-4">Licencia SCT</th>
                            <th className="p-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="4" className="p-8 text-center text-slate-400">Consultando directorio...</td></tr>
                        ) : choferes.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-slate-400">No tienes operadores dados de alta.</td></tr>
                        ) : (
                            choferes.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-fuchsia-50 flex items-center justify-center text-fuchsia-600">
                                            <Heading size={18} />
                                        </div>
                                        {c.nombre_figura}
                                    </td>
                                    <td className="p-4 font-mono font-medium text-slate-700">{c.rfc_figura}</td>
                                    <td className="p-4 text-slate-600">{c.num_licencia}</td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => openModal(c)} className="p-2 text-fuchsia-600 hover:bg-fuchsia-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-md">
                            <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Operador' : 'Alta de Nuevo Operador'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                                    <input type="text" name="nombre_figura" value={form.nombre_figura} onChange={handleInputChange} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" placeholder="Nombre completo del conductor" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">RFC <span className="text-red-500">*</span></label>
                                        <input type="text" name="rfc_figura" value={form.rfc_figura} onChange={handleInputChange} required maxLength="13" minLength="12" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg uppercase" placeholder="AAAA000000XXX" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Número de Licencia <span className="text-red-500">*</span></label>
                                        <input type="text" name="num_licencia" value={form.num_licencia} onChange={handleInputChange} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg uppercase" />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                                    <button type="submit" className="px-5 py-2.5 bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 rounded-lg transition-colors">
                                        {editingId ? 'Guardar Cambios' : 'Registrar Operador'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Choferes;
