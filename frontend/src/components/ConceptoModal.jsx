import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Save, Search } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import mockSatClaves from '../data/satClavesProdServ.json';

export const ConceptoModal = ({ isOpen, onClose, onSaved }) => {
    const { activeEmisor } = useAuth();
    const { showToast } = useToast();
    const [impuestosOptions, setImpuestosOptions] = useState([]);
    const [addedImpuestos, setAddedImpuestos] = useState([]);
    const [selectedImpuestoToAdd, setSelectedImpuestoToAdd] = useState('');
    const [satSearchTerm, setSatSearchTerm] = useState('');
    const [showSatDropdown, setShowSatDropdown] = useState(false);
    const satInputRef = useRef(null);
    const [formData, setFormData] = useState({
        clave_prod_serv: '01010101',
        clave_unidad: 'H87',
        unidad: 'PZ',
        descripcion: '',
        valor_unitario: '',
        desglosar_impuestos: false,
        notas: ''
    });

    useEffect(() => {
        if (!isOpen) return;
        const fetchImpuestos = async () => {
            try {
                const res = await api.get('/impuestos');
                setImpuestosOptions(res.data);
            } catch (error) {
                console.error("Error fetching impuestos options", error);
            }
        };
        fetchImpuestos();

        const handleClickOutside = (event) => {
            if (satInputRef.current && !satInputRef.current.contains(event.target)) {
                setShowSatDropdown(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, emisor_id: activeEmisor.id, impuestos: addedImpuestos };
            const res = await api.post('/conceptos', payload);
            showToast("✅ Concepto guardado correctamente");
            if (onSaved) onSaved(res.data);
            onClose();
            // Reset form
            setFormData({ clave_prod_serv: '01010101', clave_unidad: 'H87', descripcion: '', valor_unitario: '', unidad: 'PZ' });
            setAddedImpuestos([]);
        } catch (error) {
            console.error("Error saving concepto", error);
            showToast("No se pudo guardar el concepto. Verifica los datos.", "error");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] md:max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800">Agregar Nuevo Producto o Servicio</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Columna Izquierda - Datos del Concepto */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Descripción</label>
                                <textarea required value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm min-h-[70px] resize-y transition-all" placeholder="Nombre completo o descripción detallada de tu producto o servicio" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div ref={satInputRef} className="relative">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Clave Prod/Serv (SAT)</label>
                                    <div className="relative">
                                        <input
                                            required
                                            value={satSearchTerm}
                                            onChange={e => {
                                                setSatSearchTerm(e.target.value);
                                                setFormData({ ...formData, clave_prod_serv: e.target.value });
                                                setShowSatDropdown(true);
                                            }}
                                            onFocus={() => setShowSatDropdown(true)}
                                            type="text"
                                            className="w-full pl-3 pr-9 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm font-mono transition-all"
                                            placeholder="Ej. 01010101 o Diseño"
                                            autoComplete="off"
                                        />
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>

                                    {showSatDropdown && (
                                        <div className="absolute z-10 w-[150%] left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {mockSatClaves
                                                .filter(c => c.clave.includes(satSearchTerm) || c.desc.toLowerCase().includes(satSearchTerm.toLowerCase()))
                                                .map(c => (
                                                    <div
                                                        key={c.clave}
                                                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm flex flex-col border-b border-slate-100 last:border-0"
                                                        onClick={() => {
                                                            setFormData({ ...formData, clave_prod_serv: c.clave });
                                                            setSatSearchTerm(c.clave);
                                                            setShowSatDropdown(false);
                                                        }}
                                                    >
                                                        <span className="font-mono text-xs font-semibold text-slate-700">{c.clave}</span>
                                                        <span className="text-slate-500 text-xs truncate">{c.desc}</span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Clave de Unidad</label>
                                    <input required value={formData.clave_unidad} onChange={e => setFormData({ ...formData, clave_unidad: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm font-mono uppercase transition-all" placeholder="H87" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Unidad (Texto)</label>
                                    <input required value={formData.unidad} onChange={e => setFormData({ ...formData, unidad: e.target.value.toUpperCase() })} type="text" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm uppercase transition-all" placeholder="PZ - PIEZA" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Valor Unitario Base</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">$</div>
                                        <input required value={formData.valor_unitario} onChange={e => setFormData({ ...formData, valor_unitario: e.target.value })} type="number" step="0.01" className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm font-medium transition-all" placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha - Impuestos */}
                        <div className="space-y-4 md:border-l md:border-slate-200 md:pl-8">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Impuesto a Aplicar</label>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedImpuestoToAdd}
                                        onChange={(e) => setSelectedImpuestoToAdd(e.target.value)}
                                        className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm bg-white transition-all"
                                    >
                                        <option value="">Selecciona un impuesto...</option>
                                        {impuestosOptions.map(imp => (
                                            <option key={imp.id} value={imp.id}>{imp.descripcion} ({imp.tipo === 'traslado' ? '+' : '-'})</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!selectedImpuestoToAdd) return;
                                            const imp = impuestosOptions.find(i => i.id === parseInt(selectedImpuestoToAdd));
                                            if (imp && !addedImpuestos.find(a => a.id === imp.id)) {
                                                setAddedImpuestos([...addedImpuestos, imp]);
                                            }
                                            setSelectedImpuestoToAdd('');
                                        }}
                                        className="flex-shrink-0 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-all active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" /> Agregar
                                    </button>
                                </div>
                            </div>

                            {/* Tabla de impuestos agregados */}
                            <div className="border border-slate-200 rounded-lg overflow-hidden mt-4 bg-white shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="p-3 font-semibold">Descripción</th>
                                            <th className="p-3 font-semibold text-center">Tipo</th>
                                            <th className="p-3 font-semibold text-center">Tasa</th>
                                            <th className="p-3 font-semibold w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {addedImpuestos.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="p-6 text-center text-slate-400 text-sm bg-slate-50/50 italic">Ningún impuesto agregado a este producto.</td>
                                            </tr>
                                        ) : (
                                            addedImpuestos.map(imp => (
                                                <tr key={imp.id} className="hover:bg-slate-50 group">
                                                    <td className="p-3 font-medium text-slate-700">{imp.descripcion}</td>
                                                    <td className="p-3 text-center text-slate-500 capitalize">{imp.tipo}</td>
                                                    <td className="p-3 text-center text-slate-500 bg-slate-50 font-mono text-xs">{Number(imp.tasa_cuota).toFixed(4)}</td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAddedImpuestos(addedImpuestos.filter(a => a.id !== imp.id))}
                                                            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-6 text-xs text-slate-600 font-medium select-none">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.desglosar_impuestos} onChange={e => setFormData({ ...formData, desglosar_impuestos: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 transition-shadow cursor-pointer" />
                                        Desglose de Impuestos
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.permitir_editar_descripcion} onChange={e => setFormData({ ...formData, permitir_editar_descripcion: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 transition-shadow cursor-pointer" />
                                        Permitir editar descripción en factura
                                    </label>
                                </div>
                            </div>
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
