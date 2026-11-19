import { ImpuestoLocal, Empresa } from '../models/index.js';

export const DEFAULT_IMPUESTOS_LOCALES = [
    { nombre: "PARA EL DES. ECON Y SOCIAL", tasa: 0.060000, tipo: "retencion" },
    { nombre: "IMPUESTO SOBRE NOMINA", tasa: 0.020000, tipo: "traslado" },
    { nombre: "PARA APOYAR DIVERSOS PROGRAMAS DE CAPACITACION QUE REALIZA EL DIF MUNICIPAL.", tasa: 0.001000, tipo: "retencion" },
    { nombre: "APORTACION AL MUNICIPIO PARA O.B.S.", tasa: 0.010000, tipo: "retencion" },
    { nombre: "5 AL MILLAR PARA OTROS", tasa: 0.005000, tipo: "retencion" },
    { nombre: "DERECHOS DE INSPECCION, CONTROL Y VIGILANCIA DE LOS TRABAJOS POR LA S.H.F.P.G.E", tasa: 0.005000, tipo: "retencion" }
];

const resolveTargetEmpresaId = async (req) => {
    if (req.usuario.rol !== 'Administrador') {
        return req.usuario.empresa_id || null;
    }

    const requestedId =
        req.query?.empresa_id ||
        req.query?.empresaId ||
        req.body?.empresa_id ||
        req.body?.empresaId;

    if (requestedId !== undefined && requestedId !== null && requestedId !== '') {
        return Number(requestedId);
    }

    if (req.usuario.empresa_id) {
        return req.usuario.empresa_id;
    }

    const firstEmpresa = await Empresa.findOne({ order: [['id', 'ASC']] });
    return firstEmpresa ? firstEmpresa.id : null;
};

export const seedImpuestosLocalesParaEmpresa = async (empresaId) => {
    if (!empresaId) return;
    const count = await ImpuestoLocal.count({ where: { empresa_id: empresaId } });
    if (count === 0) {
        const registros = DEFAULT_IMPUESTOS_LOCALES.map((imp) => ({
            ...imp,
            activo: true,
            empresa_id: empresaId
        }));
        await ImpuestoLocal.bulkCreate(registros);
    }
};

export const ensureImpuestosLocalesParaTodasLasEmpresas = async () => {
    const empresas = await Empresa.findAll({ attributes: ['id'] });
    for (const empresa of empresas) {
        await seedImpuestosLocalesParaEmpresa(empresa.id);
    }
};

export const getImpuestosLocales = async (req, res) => {
    try {
        const empresaId = await resolveTargetEmpresaId(req);
        if (!empresaId) {
            return res.json([]);
        }

        await seedImpuestosLocalesParaEmpresa(empresaId);

        const impuestos = await ImpuestoLocal.findAll({
            where: {
                empresa_id: empresaId,
                activo: true
            },
            order: [['nombre', 'ASC']]
        });
        res.json(impuestos);
    } catch (error) {
        console.error('Error fetching local taxes:', error);
        res.status(500).json({ message: 'Error al obtener impuestos locales' });
    }
};

export const createImpuestoLocal = async (req, res) => {
    try {
        const empresaId = await resolveTargetEmpresaId(req);
        if (!empresaId) {
            return res.status(400).json({ message: 'No se pudo determinar el espacio de trabajo.' });
        }

        const data = {
            nombre: req.body.nombre,
            tasa: req.body.tasa,
            tipo: req.body.tipo || 'retencion',
            activo: true,
            empresa_id: empresaId
        };

        const nuevo = await ImpuestoLocal.create(data);
        res.status(201).json(nuevo);
    } catch (error) {
        console.error('Error creating local tax:', error);
        res.status(500).json({ message: 'Error al crear impuesto local' });
    }
};

export const updateImpuestoLocal = async (req, res) => {
    const { id } = req.params;
    try {
        const imp = await ImpuestoLocal.findByPk(id);
        if (!imp) return res.status(404).json({ message: 'No encontrado' });

        // Seguridad multitenant: No administradores solo pueden editar los impuestos de su espacio de trabajo
        if (req.usuario.rol !== 'Administrador') {
            if (imp.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para modificar este impuesto local.' });
            }
        }

        const updateData = {};
        if (req.body.nombre !== undefined) updateData.nombre = req.body.nombre;
        if (req.body.tasa !== undefined) updateData.tasa = req.body.tasa;
        if (req.body.tipo !== undefined) updateData.tipo = req.body.tipo;
        if (req.body.activo !== undefined) updateData.activo = req.body.activo;

        await imp.update(updateData);
        res.json(imp);
    } catch (error) {
        console.error('Error updating local tax:', error);
        res.status(500).json({ message: 'Error al actualizar' });
    }
};

export const deleteImpuestoLocal = async (req, res) => {
    const { id } = req.params;
    try {
        const imp = await ImpuestoLocal.findByPk(id);
        if (!imp) return res.status(404).json({ message: 'No encontrado' });

        // Seguridad multitenant: No administradores solo pueden eliminar los impuestos de su espacio de trabajo
        if (req.usuario.rol !== 'Administrador') {
            if (imp.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar este impuesto local.' });
            }
        }

        // Borrado lógico para seguridad
        await imp.update({ activo: false });
        res.json({ message: 'Eliminado' });
    } catch (error) {
        console.error('Error deleting local tax:', error);
        res.status(500).json({ message: 'Error al eliminar' });
    }
};
