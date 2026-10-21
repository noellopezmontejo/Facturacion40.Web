import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Truck, Plus, Edit2, Trash2, ShieldCheck, Hash, X } from 'lucide-react';
import api from '../api/axios';

const Vehiculos = () => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const emisorId = activeEmisor?.id;
    const [vehiculos, setVehiculos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [form, setForm] = useState({
        nombre_interno: '',
        permiso_sct: '',
        num_permiso_sct: '',
        config_vehicular: '',
        placa: '',
        anio_modelo: '',
        asegura_resp_civil: '',
        poliza_resp_civil: ''
    });

    useEffect(() => {
        if (emisorId) fetchVehiculos();
    }, [emisorId]);

    const fetchVehiculos = async () => {
        try {
            const { data } = await api.get(`/vehiculos?emisor_id=${emisorId}`);
            setVehiculos(data);
        } catch (error) {
            showToast('Error al cargar la flota de vehículos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const openModal = (vehiculo = null) => {
        setEditingId(vehiculo ? vehiculo.id : null);
        setForm(vehiculo || {
            nombre_interno: '', permiso_sct: '', num_permiso_sct: '',
            config_vehicular: '', placa: '', anio_modelo: new Date().getFullYear(),
            asegura_resp_civil: '', poliza_resp_civil: ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/vehiculos/${editingId}`, form);
                showToast('Vehículo actualizado exitosamente', 'success');
            } else {
                await api.post('/vehiculos', { ...form, emisor_id: emisorId });
                showToast('Vehículo registrado en la flota', 'success');
            }
            setIsModalOpen(false);
            fetchVehiculos();
        } catch (error) {
            showToast('Error al guardar el vehículo', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Eliminar este vehículo de la flota permanentemente?')) {
            try {
                await api.delete(`/vehiculos/${id}`);
                showToast('Vehículo dado de baja', 'success');
                fetchVehiculos();
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
                        <Truck className="text-indigo-600" />
                        Mi Flota de Vehículos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Administra los autotransportes disponibles para la emisión rápida de Carta Porte</p>
                </div>
                <button onClick={() => openModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium transition-colors shadow-sm">
                    <Plus size={18} />
                    Agregar Vehículo
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                            <th className="p-4">Identificador</th>
                            <th className="p-4">Matrícula y Modelo</th>
                            <th className="p-4">Permiso SCT</th>
                            <th className="p-4">Seguro Vigente</th>
                            <th className="p-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400">Consultando cochera...</td></tr>
                        ) : vehiculos.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400">No tienes vehículos registrados. Agrega tu primer camión.</td></tr>
                        ) : (
                            vehiculos.map(v => (
                                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                            <Truck size={18} />
                                        </div>
                                        {v.nombre_interno}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded inline-block border border-slate-200">
                                            {v.placa}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">{v.config_vehicular} | Mod. {v.anio_modelo}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-semibold text-slate-700">{v.num_permiso_sct}</div>
                                        <div className="text-xs text-slate-500">{v.permiso_sct}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                                            <ShieldCheck size={14} className="text-emerald-500"/>
                                            {v.asegura_resp_civil}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 truncate max-w-[120px]">Pol: {v.poliza_resp_civil}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => openModal(v)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDelete(v.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 backdrop-blur-md">
                            <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Vehículo' : 'Alta de Vehículo Nuevo'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Corto / Económico <span className="text-red-500">*</span></label>
                                    <input type="text" name="nombre_interno" value={form.nombre_interno} onChange={handleInputChange} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" placeholder="Ej. Unidad 03" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Placa (Sin guiones) <span className="text-red-500">*</span></label>
                                        <input type="text" name="placa" value={form.placa} onChange={handleInputChange} required maxLength="7" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg uppercase" placeholder="123AB4" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Año Modelo <span className="text-red-500">*</span></label>
                                        <input type="number" name="anio_modelo" value={form.anio_modelo} onChange={handleInputChange} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo Permiso SCT <span className="text-red-500">*</span></label>
                                        <input type="text" name="permiso_sct" value={form.permiso_sct} onChange={handleInputChange} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg uppercase" placeholder="TPAF01" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Núm. Permiso SCT <span className="text-red-500">*</span></label>
                                        <input type="text" name="num_permiso_sct" value={form.num_permiso_sct} onChange={handleInputChange} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Configuración Vehicular SAT <span className="text-red-500">*</span></label>
                                    <input type="text" name="config_vehicular" value={form.config_vehicular} onChange={handleInputChange} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg uppercase" placeholder="Ej. VL o C2" />
                                    <p className="text-xs text-slate-400 mt-1">Clave SAT del tipo de camión.</p>
                                </div>

                                <div className="p-4 bg-slate-100 rounded-lg border border-slate-200 space-y-4">
                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600"/> Póliza de Seguro</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Aseguradora <span className="text-red-500">*</span></label>
                                            <input type="text" name="asegura_resp_civil" value={form.asegura_resp_civil} onChange={handleInputChange} required className="w-full p-2 bg-white border border-slate-200 rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Núm. Póliza <span className="text-red-500">*</span></label>
                                            <input type="text" name="poliza_resp_civil" value={form.poliza_resp_civil} onChange={handleInputChange} required className="w-full p-2 bg-white border border-slate-200 rounded-lg" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                                    <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors">
                                        {editingId ? 'Guardar Cambios' : 'Registrar Vehículo'}
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

export default Vehiculos;
