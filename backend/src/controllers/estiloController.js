import { ConfiguracionEstilo, Emisor } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { getEmissorDir } from '../utils/storageHelper.js';

export const getEstilo = async (req, res) => {
    const { emisorId } = req.params;
    try {
        let estilo = await ConfiguracionEstilo.findOne({ where: { emisor_id: emisorId } });

        if (!estilo) {
            // Retornar valores por defecto si no existe
            estilo = {
                color_primario: '#004481',
                color_secundario: '#123247',
                tipo_letra: 'Arial',
                layout_id: 'v1',
                logo_url: null
            };
        }

        res.json(estilo);
    } catch (error) {
        console.error('Error fetching estilo:', error);
        res.status(500).json({ message: 'Error al obtener configuración de estilo' });
    }
};

export const updateEstilo = async (req, res) => {
    const { emisorId } = req.params;
    const { color_primario, color_secundario, tipo_letra, layout_id, template_mapping, config_adicional } = req.body;

    try {
        const emisor = await Emisor.findByPk(emisorId);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        let estilo = await ConfiguracionEstilo.findOne({ where: { emisor_id: emisorId } });

        const updateData = {};
        if (color_primario !== undefined) updateData.color_primario = color_primario;
        if (color_secundario !== undefined) updateData.color_secundario = color_secundario;
        if (tipo_letra !== undefined) updateData.tipo_letra = tipo_letra;
        if (layout_id !== undefined) updateData.layout_id = layout_id;
        
        if (template_mapping !== undefined) {
            updateData.template_mapping = typeof template_mapping === 'string' 
                ? JSON.parse(template_mapping) 
                : template_mapping;
        }
        
        if (config_adicional !== undefined) {
            updateData.config_adicional = typeof config_adicional === 'string' 
                ? JSON.parse(config_adicional) 
                : config_adicional;
        }

        if (req.file) {
            // Procesar nuevo logo usando el helper de storage
            const fullPath = getEmissorDir(emisor.rfc, 'logos');
            const fileName = `logo_${Date.now()}${path.extname(req.file.originalname)}`;
            fs.writeFileSync(path.join(fullPath, fileName), req.file.buffer);

            updateData.logo_url = `/storage/${emisor.rfc}/logos/${fileName}`;
        }

        if (estilo) {
            await estilo.update(updateData);
        } else {
            // Si es creación, nos aseguramos de tener valores por defecto si no vienen
            await ConfiguracionEstilo.create({
                emisor_id: emisorId,
                color_primario: color_primario || '#004481',
                color_secundario: color_secundario || '#123247',
                tipo_letra: tipo_letra || 'Arial',
                layout_id: layout_id || 'v1',
                ...updateData
            });
        }

        res.json({ message: 'Configuración de estilo actualizada', estilo: updateData });
    } catch (error) {
        console.error('Error updating estilo:', error);
        res.status(500).json({ message: 'Error al actualizar configuración de estilo' });
    }
};
