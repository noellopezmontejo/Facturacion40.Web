import { OrdenServicio, DetalleOrdenServicio, Emisor, Receptor, Concepto, Impuesto } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { generarPDFOrdenServicio } from '../services/pdfService.js';
import { getOrdenEvidenciasDir, STORAGE_BASE } from '../utils/storageHelper.js';

export const getOrdenesServicio = async (req, res) => {
    try {
        const { emisorId } = req.query;
        let where = {};
        if (emisorId) where.emisor_id = emisorId;

        const ordenes = await OrdenServicio.findAll({
            where,
            include: [
                { model: Emisor, attributes: ['id', 'razon_social', 'rfc'] },
                { model: Receptor, attributes: ['id', 'razon_social', 'rfc'] }
            ],
            order: [['fecha_ingreso', 'DESC']]
        });
        const formatted = ordenes.map(ord => {
            const raw = ord.toJSON ? ord.toJSON() : ord;
            raw.evidencias_multimedia = Array.isArray(raw.evidencias_multimedia)
                ? raw.evidencias_multimedia
                : (typeof raw.evidencias_multimedia === 'string' ? JSON.parse(raw.evidencias_multimedia || '[]') : []);
            return raw;
        });
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching ordenes de servicio:', error);
        res.status(500).json({ message: 'Error al obtener ordenes de servicio', error: error.message, stack: error.stack });
    }
};

export const getOrdenServicioById = async (req, res) => {
    try {
        const { id } = req.params;
        const orden = await OrdenServicio.findByPk(id, {
            include: [
                { model: Emisor },
                { model: Receptor },
                { 
                    model: DetalleOrdenServicio, 
                    as: 'detalles',
                    include: [
                        {
                            model: Concepto,
                            include: [{ model: Impuesto }]
                        }
                    ]
                }
            ]
        });
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });
        
        const raw = orden.toJSON ? orden.toJSON() : orden;
        raw.evidencias_multimedia = Array.isArray(raw.evidencias_multimedia)
            ? raw.evidencias_multimedia
            : (typeof raw.evidencias_multimedia === 'string' ? JSON.parse(raw.evidencias_multimedia || '[]') : []);
        
        res.json(raw);
    } catch (error) {
        console.error('Error fetching orden de servicio:', error);
        res.status(500).json({ message: 'Error al obtener orden de servicio' });
    }
};

export const createOrdenServicio = async (req, res) => {
    try {
        const { detalles, ...ordenData } = req.body;
        ordenData.usuario_id = req.usuario.id;
        
        const nuevaOrden = await OrdenServicio.create(ordenData);
        
        if (detalles && detalles.length > 0) {
            const detallesConOrdenId = detalles.map(det => ({
                ...det,
                orden_servicio_id: nuevaOrden.id
            }));
            await DetalleOrdenServicio.bulkCreate(detallesConOrdenId);
        }
        
        res.status(201).json(nuevaOrden);
    } catch (error) {
        console.error('Error creating orden de servicio:', error);
        res.status(500).json({ message: 'Error al crear orden de servicio' });
    }
};

export const updateOrdenServicioStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, diagnostico_tecnico, fecha_entrega_real, documento_id } = req.body;
        
        const orden = await OrdenServicio.findByPk(id);
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });
        
        if (estado) orden.estado = estado;
        if (diagnostico_tecnico !== undefined) orden.diagnostico_tecnico = diagnostico_tecnico;
        if (fecha_entrega_real) orden.fecha_entrega_real = fecha_entrega_real;
        if (documento_id) orden.documento_id = documento_id;
        
        await orden.save();
        res.json(orden);
    } catch (error) {
        console.error('Error updating orden de servicio:', error);
        res.status(500).json({ message: 'Error al actualizar orden de servicio' });
    }
};

export const updateOrdenServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const { detalles, ...updateData } = req.body;

        const orden = await OrdenServicio.findByPk(id);
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });

        const allowedFields = [
            'estado',
            'diagnostico_tecnico',
            'falla_reportada',
            'equipo',
            'marca',
            'modelo',
            'numero_serie',
            'contrasena_equipo',
            'accesorios_incluidos',
            'fecha_entrega_estimada',
            'fecha_entrega_real',
            'moneda',
            'documento_id'
        ];

        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                orden[field] = updateData[field];
            }
        });

        if (detalles !== undefined && Array.isArray(detalles)) {
            await DetalleOrdenServicio.destroy({ where: { orden_servicio_id: orden.id } });

            let subtotal = 0;
            let descuento = 0;
            let totalImpuestosTrasladados = 0;
            let totalImpuestosRetenidos = 0;

            const newDetalles = detalles.map((det, idx) => {
                const cant = parseFloat(det.cantidad || 1);
                const precio = parseFloat(det.valor_unitario || 0);
                const desc = parseFloat(det.descuento || 0);
                const importe = parseFloat(det.importe !== undefined ? det.importe : (cant * precio));
                const base = Math.max(0, importe - desc);

                subtotal += importe;
                descuento += desc;

                let traslados = det.impuestos_trasladados;
                if (!traslados && det.iva !== 0) {
                    const ivaAmt = Math.round(base * 0.16 * 100) / 100;
                    traslados = [{ impuesto: '002', tipo: 'Traslado', tasa: '0.160000', importe: ivaAmt }];
                }

                if (Array.isArray(traslados)) {
                    traslados.forEach(t => {
                        totalImpuestosTrasladados += parseFloat(t.importe || 0);
                    });
                }

                return {
                    orden_servicio_id: orden.id,
                    concepto_id: det.concepto_id || null,
                    tipo_detalle: det.tipo_detalle || 'Servicio',
                    descripcion: det.descripcion || `Partida ${idx + 1}`,
                    cantidad: cant,
                    valor_unitario: precio,
                    importe: importe,
                    descuento: desc,
                    clave_prod_serv: det.clave_prod_serv || '81112306',
                    clave_unidad: det.clave_unidad || 'E48',
                    impuestos_trasladados: traslados || [],
                    impuestos_retenidos: det.impuestos_retenidos || []
                };
            });

            if (newDetalles.length > 0) {
                await DetalleOrdenServicio.bulkCreate(newDetalles);
            }

            orden.subtotal = updateData.subtotal !== undefined ? parseFloat(updateData.subtotal) : subtotal;
            orden.descuento = updateData.descuento !== undefined ? parseFloat(updateData.descuento) : descuento;
            orden.total_impuestos_trasladados = updateData.total_impuestos_trasladados !== undefined 
                ? parseFloat(updateData.total_impuestos_trasladados) 
                : totalImpuestosTrasladados;
            orden.total_impuestos_retenidos = updateData.total_impuestos_retenidos !== undefined 
                ? parseFloat(updateData.total_impuestos_retenidos) 
                : totalImpuestosRetenidos;
            orden.total = updateData.total !== undefined 
                ? parseFloat(updateData.total) 
                : (orden.subtotal - orden.descuento + orden.total_impuestos_trasladados - orden.total_impuestos_retenidos);
        }

        await orden.save();

        const updatedOrden = await OrdenServicio.findByPk(orden.id, {
            include: [
                { model: Emisor },
                { model: Receptor },
                { 
                    model: DetalleOrdenServicio, 
                    as: 'detalles',
                    include: [
                        {
                            model: Concepto,
                            include: [{ model: Impuesto }]
                        }
                    ]
                }
            ]
        });

        const raw = updatedOrden.toJSON ? updatedOrden.toJSON() : updatedOrden;
        raw.evidencias_multimedia = Array.isArray(raw.evidencias_multimedia)
            ? raw.evidencias_multimedia
            : (typeof raw.evidencias_multimedia === 'string' ? JSON.parse(raw.evidencias_multimedia || '[]') : []);

        res.json({
            success: true,
            message: 'Orden de servicio actualizada exitosamente',
            orden: raw
        });
    } catch (error) {
        console.error('Error updating orden de servicio:', error);
        res.status(500).json({ message: 'Error al actualizar orden de servicio', error: error.message });
    }
};

export const addDetallesOrdenServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const detalles = req.body; // Array de detalles
        
        const orden = await OrdenServicio.findByPk(id);
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });
        
        const detallesConOrdenId = detalles.map(det => ({
            ...det,
            orden_servicio_id: orden.id
        }));
        await DetalleOrdenServicio.bulkCreate(detallesConOrdenId);
        
        // Aquí podríamos recalcular los totales de la orden
        
        res.status(201).json({ message: 'Detalles agregados' });
    } catch (error) {
        console.error('Error adding detalles a orden de servicio:', error);
        res.status(500).json({ message: 'Error al agregar detalles' });
    }
};

export const getOrdenServicioPdf = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await generarPDFOrdenServicio(id);
        res.json(result);
    } catch (error) {
        console.error('Error generating orden de servicio PDF:', error);
        res.status(500).json({ message: 'Error al generar PDF de orden de servicio', error: error.message });
    }
};

export const uploadEvidenciasOrdenServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const orden = await OrdenServicio.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });

        const files = req.files || (req.file ? [req.file] : []);
        if (files.length === 0) {
            return res.status(400).json({ message: 'No se recibieron archivos de imagen o video.' });
        }

        const emisor = orden.Emisor || {};
        const rfc = emisor.rfc ? emisor.rfc.trim().toUpperCase() : 'GENERICO';
        const evidenciasDir = getOrdenEvidenciasDir(rfc, orden.id);

        let currentEvidencias = Array.isArray(orden.evidencias_multimedia)
            ? [...orden.evidencias_multimedia]
            : (typeof orden.evidencias_multimedia === 'string'
                ? JSON.parse(orden.evidencias_multimedia || '[]')
                : []);

        const addedItems = [];

        for (const file of files) {
            const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.originalname);
            const ext = path.extname(file.originalname) || (isVideo ? '.mp4' : '.jpg');
            const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `${Date.now()}_${safeBaseName}${ext}`;
            const targetPath = path.join(evidenciasDir, filename);

            fs.writeFileSync(targetPath, file.buffer);

            const item = {
                id: `evi_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                nombre_original: file.originalname,
                archivo: filename,
                tipo: isVideo ? 'video' : 'imagen',
                mimetype: file.mimetype,
                tamano: file.size,
                url: `/storage/${rfc}/ordenes_servicio/${orden.id}/${filename}`,
                descripcion: req.body.descripcion || '',
                fecha: new Date().toISOString()
            };

            currentEvidencias.push(item);
            addedItems.push(item);
        }

        orden.evidencias_multimedia = currentEvidencias;
        await orden.save();

        res.status(201).json({
            success: true,
            message: `${addedItems.length} archivo(s) subido(s) exitosamente`,
            nuevas: addedItems,
            evidencias: currentEvidencias
        });
    } catch (error) {
        console.error('Error subiendo evidencia:', error);
        res.status(500).json({ message: 'Error al subir evidencia multimedia', error: error.message });
    }
};

export const deleteEvidenciaOrdenServicio = async (req, res) => {
    try {
        const { id, evidenciaId } = req.params;
        const orden = await OrdenServicio.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });

        const emisor = orden.Emisor || {};
        const rfc = emisor.rfc ? emisor.rfc.trim().toUpperCase() : 'GENERICO';

        let currentEvidencias = Array.isArray(orden.evidencias_multimedia)
            ? [...orden.evidencias_multimedia]
            : (typeof orden.evidencias_multimedia === 'string'
                ? JSON.parse(orden.evidencias_multimedia || '[]')
                : []);

        const targetIndex = currentEvidencias.findIndex(e => String(e.id) === String(evidenciaId));
        if (targetIndex === -1) {
            return res.status(404).json({ message: 'Evidencia no encontrada en la orden' });
        }

        const [removedItem] = currentEvidencias.splice(targetIndex, 1);

        // Eliminar archivo físico de disco si existe
        if (removedItem.url && removedItem.url.startsWith('/storage/')) {
            const relPath = removedItem.url.replace('/storage/', '');
            const fullDiskPath = path.join(STORAGE_BASE, relPath);
            if (fs.existsSync(fullDiskPath)) {
                try {
                    fs.unlinkSync(fullDiskPath);
                } catch (errUnlink) {
                    console.warn('No se pudo borrar el archivo en disco:', fullDiskPath, errUnlink.message);
                }
            }
        }

        orden.evidencias_multimedia = currentEvidencias;
        await orden.save();

        res.json({
            success: true,
            message: 'Evidencia eliminada exitosamente',
            evidencias: currentEvidencias
        });
    } catch (error) {
        console.error('Error eliminando evidencia:', error);
        res.status(500).json({ message: 'Error al eliminar evidencia', error: error.message });
    }
};
