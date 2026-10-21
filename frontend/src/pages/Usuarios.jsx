import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Users, X, Save, Shield, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

export const Usuarios = () => {
    const { user: currentUser, activeEmpresa } = useAuth();
    const { showToast } = useToast();
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [emisores, setEmisores] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [filtroEmpresa, setFiltroEmpresa] = useState('activa'); // 'activa' | 'todas'
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);

    const [formData, setFormData] = useState({
        nombre: '',
        email: '',
        password: '',
        rolId: '',
        emisoresIds: [],
        activo: true,
        empresaId: ''
    });

    const fetchUsuarios = async () => {
        setLoading(true);
        try {
            const res = await api.get('/usuarios');
            setUsuarios(res.data);
        } catch (error) {
            console.error("Error fetching usuarios", error);
            showToast("No se pudieron cargar los usuarios", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchRolesEmisoresAndEmpresas = async () => {
        try {
            const [resRoles, resEmisores] = await Promise.all([
                api.get('/usuarios/roles'),
                api.get('/emisores')
            ]);
            setRoles(resRoles.data);
            setEmisores(resEmisores.data);

            if (currentUser.rol === 'Administrador') {
                const resEmpresas = await api.get('/empresas');
                setEmpresas(resEmpresas.data);
            }
        } catch (error) {
            console.error("Error fetching dependencies", error);
        }
    };


    useEffect(() => {
        fetchUsuarios();
        fetchRolesEmisoresAndEmpresas();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        
        if (!editId && !formData.password) {
            showToast("La contraseña es requerida para nuevos usuarios.", "error");
            return;
        }

        if (!formData.rolId) {
            showToast("Debes seleccionar un rol para el usuario.", "error");
            return;
        }

        try {
            const payload = {
                ...formData,
                rolId: Number(formData.rolId),
                emisoresIds: formData.emisoresIds.map(Number),
                empresaId: formData.empresaId ? Number(formData.empresaId) : null
            };

            if (editId && !formData.password.trim()) {
                delete payload.password;
            }

            if (editId) {
                await api.put(`/usuarios/${editId}`, payload);
                showToast("✅ Usuario actualizado correctamente");
            } else {
                await api.post('/usuarios', payload);
                showToast("✅ Usuario creado correctamente");
            }

            setShowModal(false);
            setEditId(null);
            fetchUsuarios();
            resetForm();
        } catch (error) {
            console.error("Error saving usuario", error);
            const errMsg = error.response?.data?.message || "No se pudo guardar el usuario.";
            showToast(errMsg, "error");
        }
    };

    const handleEdit = (usuario) => {
        setEditId(usuario.id);
        
        const rolAsignado = roles.find(r => usuario.roles.includes(r.nombre));
        
        setFormData({
            nombre: usuario.nombre,
            email: usuario.email,
            password: '',
            rolId: rolAsignado ? rolAsignado.id : '',
            emisoresIds: usuario.emisores.map(e => e.id),
            activo: usuario.activo,
            empresaId: usuario.empresa_id || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (id === currentUser.id) {
            showToast("No puedes eliminar tu propio usuario.", "error");
            return;
        }

        if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;
        
        try {
            await api.delete(`/usuarios/${id}`);
            fetchUsuarios();
            showToast("✅ Usuario eliminado correctamente");
        } catch (error) {
            console.error("Error deleting usuario", error);
            const errMsg = error.response?.data?.message || "No se pudo eliminar el usuario.";
            showToast(errMsg, "error");
        }
    };

    const resetForm = () => {
        setFormData({
            nombre: '',
            email: '',
            password: '',
            rolId: roles.length > 0 ? roles[0].id : '',
            emisoresIds: [],
            activo: true,
            empresaId: activeEmpresa?.id ? String(activeEmpresa.id) : ''
        });
    };

    const handleCheckboxChange = (emisorId) => {
        setFormData(prev => {
            const current = [...prev.emisoresIds];
            const idx = current.indexOf(emisorId);
            if (idx > -1) {
                current.splice(idx, 1);
            } else {
                current.push(emisorId);
            }
            return { ...prev, emisoresIds: current };
        });
    };

    // Filtrar los emisores a mostrar en el formulario según la empresa seleccionada en el selector del formulario
    const emisoresFiltradosForm = emisores.filter(em => {
        if (currentUser.rol === 'Administrador') {
            if (!formData.empresaId) return false; // Si no ha seleccionado empresa, no mostrar emisores
            return em.empresa_id === Number(formData.empresaId);
        }
        return true; // Para Usuario Empresarial, el backend ya los filtró por su empresa
    });

    const filtered = usuarios.filter(u => {
        if (currentUser.rol === 'Administrador' && filtroEmpresa === 'activa' && activeEmpresa?.id) {
            if (u.empresa_id !== activeEmpresa.id) return false;
        }
        return (
            u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.roles.some(r => r.toLowerCase().includes(searchTerm.toLowerCase())) ||
            u.empresaNombre.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {currentUser.rol === 'Administrador' 
                            ? 'Administra los usuarios globales y de espacios empresariales.' 
                            : 'Administra los usuarios y operadores de tu espacio empresarial.'
                        }
                    </p>
                </div>
                <button onClick={() => {
                    setEditId(null);
                    resetForm();
                    setShowModal(true);
                }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 shadow-sm shadow-primary-500/20 transition-all">
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Usuario</span>
                </button>
            </div>

            {/* Form Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editId ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo</label>
                                        <input required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm" placeholder="Ej. Juan Pérez" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                                        <input required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} type="email" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm" placeholder="juan.perez@empresa.com" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                                        Contraseña {editId && <span className="text-slate-400 font-normal">(Dejar en blanco para no cambiar)</span>}
                                    </label>
                                    <input required={!editId} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} type="password" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm font-mono" placeholder="••••••••" />
                                </div>

                                {currentUser.rol === 'Administrador' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Espacio Empresarial</label>
                                        <select value={formData.empresaId} onChange={e => setFormData({ ...formData, empresaId: e.target.value, emisoresIds: [] })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm bg-white">
                                            <option value="">Sin Espacio (Administrador Global)</option>
                                            {empresas.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Rol</label>
                                        <select 
                                            required 
                                            disabled={editId === currentUser.id}
                                            value={formData.rolId} 
                                            onChange={e => setFormData({ ...formData, rolId: e.target.value })} 
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                        >
                                            <option value="">Seleccione un rol...</option>
                                            {roles.map(rol => (
                                                <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                                            ))}
                                        </select>
                                        {editId === currentUser.id && (
                                            <span className="text-[10px] text-slate-400 font-medium mt-1 block">*(No puedes cambiar tu propio rol por seguridad)</span>
                                        )}
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={formData.activo} onChange={e => setFormData({ ...formData, activo: e.target.checked })} className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4" />
                                            <span className="text-sm text-slate-700 font-medium">Usuario Activo</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                                        Emisores Autorizados {currentUser.rol === 'Administrador' && <span className="text-slate-400 font-normal">(Selecciona un espacio primero)</span>}
                                    </label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
                                        {emisoresFiltradosForm.map(em => (
                                            <label key={em.id} className="flex items-start gap-2.5 p-1 hover:bg-slate-100/50 rounded cursor-pointer text-sm">
                                                <input type="checkbox" checked={formData.emisoresIds.includes(em.id)} onChange={() => handleCheckboxChange(em.id)} className="mt-1 rounded text-primary-600 focus:ring-primary-500 h-4 w-4" />
                                                <div>
                                                    <span className="font-semibold text-slate-700">{em.rfc}</span>
                                                    <span className="text-slate-500 text-xs block">{em.razon_social}</span>
                                                </div>
                                            </label>
                                        ))}
                                        {emisoresFiltradosForm.length === 0 && (
                                            <div className="text-center text-xs text-slate-400 py-4">
                                                {currentUser.rol === 'Administrador' && !formData.empresaId 
                                                    ? 'Por favor, selecciona un espacio empresarial para ver sus emisores.'
                                                    : 'No hay emisores disponibles para este espacio empresarial.'
                                                }
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
                                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors">
                                    <Save className="w-4 h-4" /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por Nombre, Email, Rol o Espacio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg text-sm transition-all outline-none bg-white"
                        />
                    </div>

                    {currentUser.rol === 'Administrador' && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFiltroEmpresa('activa')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                    filtroEmpresa === 'activa' 
                                        ? 'bg-indigo-600 text-white shadow-xs' 
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                <span>Espacio: {activeEmpresa?.nombre ? activeEmpresa.nombre.substring(0, 20) : 'Activo'}</span>
                                <span className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                                    filtroEmpresa === 'activa' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
                                }`}>
                                    {usuarios.filter(u => u.empresa_id === activeEmpresa?.id).length}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFiltroEmpresa('todas')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                    filtroEmpresa === 'todas' 
                                        ? 'bg-indigo-600 text-white shadow-xs' 
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <span>Todos</span>
                                <span className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                                    filtroEmpresa === 'todas' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
                                }`}>
                                    {usuarios.length}
                                </span>
                            </button>
                        </div>
                    )}
                </div>


                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold w-8">#</th>
                                <th className="p-4 font-semibold">Usuario</th>
                                {currentUser.rol === 'Administrador' && <th className="p-4 font-semibold">Espacio Empresarial</th>}
                                <th className="p-4 font-semibold">Rol</th>
                                <th className="p-4 font-semibold">Emisores Autorizados</th>
                                <th className="p-4 font-semibold text-center">Estado</th>
                                <th className="p-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filtered.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-4 text-slate-400">{idx + 1}</td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-800">{item.nombre}</span>
                                            <span className="text-xs text-slate-500 mt-0.5">{item.email}</span>
                                        </div>
                                    </td>
                                    {currentUser.rol === 'Administrador' && (
                                        <td className="p-4">
                                            <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${item.empresa_id ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                {item.empresaNombre}
                                            </span>
                                        </td>
                                    )}
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5">
                                            <Shield className={`w-4 h-4 ${item.roles.includes('Administrador') ? 'text-rose-500' : 'text-blue-500'}`} />
                                            <span className="font-medium text-slate-700">
                                                {item.roles.length > 0 ? item.roles.join(', ') : 'Operador'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1.5 max-w-xs md:max-w-md">
                                            {item.emisores.map(em => (
                                                <span key={em.id} className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200" title={em.razon_social}>
                                                    <Building2 className="w-3 h-3 opacity-60" />
                                                    {em.rfc}
                                                </span>
                                            ))}
                                            {item.emisores.length === 0 && (
                                                <span className="text-xs text-slate-400 italic">Ningún emisor asignado</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold leading-5 ${item.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                                            {item.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors" title="Editar">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {item.id !== currentUser.id && (
                                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {loading && (
                                <tr>
                                    <td colSpan={currentUser.rol === 'Administrador' ? 7 : 6} className="p-12 text-center text-slate-400">
                                        Cargando usuarios...
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={currentUser.rol === 'Administrador' ? 7 : 6} className="p-12 text-center">
                                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">No se encontraron usuarios</p>
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
