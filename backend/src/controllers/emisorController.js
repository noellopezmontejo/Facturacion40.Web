import { 
    Emisor, 
    Usuario, 
    Documento, 
    DetalleDocumento, 
    SerieFolio, 
    Empresa,
    Pago,
    PagoDocumento,
    DocumentoRecibido,
    PagoRecibido,
    PagoDocumentoRecibido,
    Cotizacion,
    DetalleCotizacion,
    OrdenServicio,
    DetalleOrdenServicio,
    Concepto,
    ConceptoImpuesto,
    Receptor,
    Proveedor,
    CatVehiculo,
    CatChofer,
    CartaPorte,
    CartaPorteUbicacion,
    CartaPorteMercancia,
    CartaPorteAutotransporte,
    CartaPorteFigura,
    ConfiguracionEstilo,
    UsuarioEmisor,
    sequelize
} from '../models/index.js';
import { generarPDF } from '../services/pdfService.js';
import { getCreditosDisponibles } from '../services/cfdiService.js';
import { Op } from 'sequelize';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getCerPath, getKeyPath, getPublicUrl, STORAGE_BASE } from '../utils/storageHelper.js';

// Configuración de Multer para memoria (luego procesamos nosotros el guardado por RFC)
const storage = multer.memoryStorage();
export const upload = multer({ storage: storage });

export const getEmisores = async (req, res) => {
    try {
        let emisores;
        const targetEmpresaId = req.query.empresa_id || req.query.empresaId;

        if (req.usuario.rol === 'Administrador') {
            const whereClause = targetEmpresaId ? { empresa_id: Number(targetEmpresaId) } : {};
            emisores = await Emisor.findAll({
                where: whereClause,
                include: [{ model: Empresa, attributes: ['id', 'nombre', 'activo'] }],
                order: [['razon_social', 'ASC']]
            });
        } else {
            emisores = await Emisor.findAll({
                where: { empresa_id: req.usuario.empresa_id },
                include: [{ model: Empresa, attributes: ['id', 'nombre', 'activo'] }],
                order: [['razon_social', 'ASC']]
            });
        }
        res.json(emisores);
    } catch (error) {
        console.error('Error fetching emisores:', error);
        res.status(500).json({ message: 'Error al obtener emisores' });
    }
};

export const createEmisor = async (req, res) => {
    try {
        const emisorData = { ...req.body };

        // Validaciones obligatorias de campos clave
        if (!emisorData.rfc || !emisorData.rfc.trim()) {
            return res.status(400).json({ message: 'El RFC del emisor es obligatorio.' });
        }
        if (!emisorData.razon_social || !emisorData.razon_social.trim()) {
            return res.status(400).json({ message: 'La razón social es obligatoria.' });
        }
        if (!emisorData.codigo_postal || !emisorData.codigo_postal.trim()) {
            return res.status(400).json({ message: 'El código postal es obligatorio.' });
        }

        emisorData.rfc = emisorData.rfc.trim().toUpperCase();
        emisorData.razon_social = emisorData.razon_social.trim();

        // Validar si el RFC ya existe en el sistema
        const existingEmisor = await Emisor.findOne({ where: { rfc: emisorData.rfc } });
        if (existingEmisor) {
            return res.status(400).json({ 
                message: `El RFC "${emisorData.rfc}" ya está registrado en el sistema (${existingEmisor.razon_social}). Ingrese un RFC diferente.` 
            });
        }

        // Asignación de empresa_id
        if (req.usuario.rol !== 'Administrador') {
            emisorData.empresa_id = req.usuario.empresa_id;
        } else if (!emisorData.empresa_id) {
            if (req.query.empresa_id) {
                emisorData.empresa_id = Number(req.query.empresa_id);
            } else {
                // Fallback a primera empresa si el administrador no especificó una
                const firstEmpresa = await Empresa.findOne({ order: [['id', 'ASC']] });
                if (firstEmpresa) emisorData.empresa_id = firstEmpresa.id;
            }
        }

        const newEmisor = await Emisor.create(emisorData);

        // Crear automáticamente Serie y Folio inicial predeterminado (Serie A)
        try {
            await SerieFolio.create({
                emisor_id: newEmisor.id,
                serie: 'A',
                ultimo_folio: 0,
                es_predeterminada: true
            });
        } catch (sErr) {
            console.error('Aviso al crear SerieFolio por defecto:', sErr);
        }

        // Crear automáticamente configuración de diseño/estilo inicial
        try {
            await ConfiguracionEstilo.create({
                emisor_id: newEmisor.id,
                layout_id: 'v1',
                color_primario: '#4F46E5'
            });
        } catch (eErr) {
            console.error('Aviso al crear ConfiguracionEstilo por defecto:', eErr);
        }

        // Vincular el emisor al usuario creador
        try {
            const usuario = await Usuario.findByPk(req.usuario.id);
            if (usuario && usuario.addEmisor) {
                await usuario.addEmisor(newEmisor);
            }
        } catch (uErr) {
            console.error('Aviso al vincular usuario-emisor:', uErr);
        }

        // Cargar con empresa para respuesta completa
        const emisorCompleto = await Emisor.findByPk(newEmisor.id, {
            include: [{ model: Empresa, attributes: ['id', 'nombre', 'activo'] }]
        });

        res.status(201).json(emisorCompleto);
    } catch (error) {
        console.error('Error creating emisor:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ 
                message: 'El RFC ingresado ya existe en la base de datos.',
                error: error.message 
            });
        }
        if (error.name === 'SequelizeValidationError') {
            const msgs = error.errors?.map(e => e.message).join(', ') || error.message;
            return res.status(400).json({ 
                message: `Error de validación: ${msgs}`,
                error: msgs 
            });
        }
        res.status(500).json({ 
            message: error.message || 'Error al crear emisor',
            error: error.message 
        });
    }
};



export const updateEmisor = async (req, res) => {
    const { id } = req.params;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        // WIP: Validar que el usuario tenga permiso sobre este emisor especificamente.

        await emisor.update(req.body);
        res.json(emisor);
    } catch (error) {
        console.error('Error updating emisor:', error);
        res.status(500).json({ message: 'Error al actualizar emisor' });
    }
};

export const deleteEmisor = async (req, res) => {
    const { id } = req.params;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        // Validar permisos
        if (req.usuario.rol !== 'Administrador' && req.usuario.rol !== 'Usuario Empresarial') {
            return res.status(403).json({ message: 'Solo administradores pueden eliminar emisores.' });
        }

        if (req.usuario.rol !== 'Administrador' && emisor.empresa_id !== req.usuario.empresa_id) {
            return res.status(403).json({ message: 'No tienes permisos para eliminar este emisor.' });
        }

        // 1. Proteger emisores con comprobantes fiscales emitidos en producción
        const docsCount = await Documento.count({ where: { emisor_id: id } });
        if (docsCount > 0 && !emisor.modo_prueba && req.query.force !== 'true') {
            return res.status(400).json({
                message: `No es posible eliminar a "${emisor.razon_social}" porque cuenta con ${docsCount} comprobante(s) fiscal(es) emitido(s) en producción (Productivo). Para preservar la trazabilidad fiscal del SAT, no se permite su eliminación.`
            });
        }

        // 2. Proteger si tiene complementos de pago en producción
        const pagosCount = await Pago.count({ where: { emisor_id: id } });
        if (pagosCount > 0 && !emisor.modo_prueba && req.query.force !== 'true') {
            return res.status(400).json({
                message: `No es posible eliminar el emisor porque cuenta con ${pagosCount} complemento(s) de pago registrado(s) en producción.`
            });
        }

        // 3. Limpieza en cascada en una transacción
        await sequelize.transaction(async (t) => {
            // Pagos recibidos y facturas recibidas de proveedores
            const pagosRec = await PagoRecibido.findAll({ where: { emisor_id: id }, attributes: ['id'], transaction: t });
            const pagoRecIds = pagosRec.map(p => p.id);

            const docsRec = await DocumentoRecibido.findAll({ where: { emisor_id: id }, attributes: ['id'], transaction: t });
            const docRecIds = docsRec.map(d => d.id);

            if (pagoRecIds.length > 0 || docRecIds.length > 0) {
                await PagoDocumentoRecibido.destroy({
                    where: {
                        [Op.or]: [
                            ...(pagoRecIds.length > 0 ? [{ pago_recibido_id: pagoRecIds }] : []),
                            ...(docRecIds.length > 0 ? [{ documento_recibido_id: docRecIds }] : [])
                        ]
                    },
                    transaction: t
                });
                if (docRecIds.length > 0) {
                    await DocumentoRecibido.destroy({ where: { id: docRecIds }, transaction: t });
                }
                if (pagoRecIds.length > 0) {
                    await PagoRecibido.destroy({ where: { id: pagoRecIds }, transaction: t });
                }
            }

            // Comprobantes emitidos (pruebas o forzado)
            if (docsCount > 0) {
                const docs = await Documento.findAll({ where: { emisor_id: id }, attributes: ['id'], transaction: t });
                const docIds = docs.map(d => d.id);
                if (docIds.length > 0) {
                    const cps = await CartaPorte.findAll({ where: { documento_id: docIds }, attributes: ['id'], transaction: t });
                    const cpIds = cps.map(c => c.id);
                    if (cpIds.length > 0) {
                        await CartaPorteUbicacion.destroy({ where: { carta_porte_id: cpIds }, transaction: t });
                        await CartaPorteMercancia.destroy({ where: { carta_porte_id: cpIds }, transaction: t });
                        await CartaPorteAutotransporte.destroy({ where: { carta_porte_id: cpIds }, transaction: t });
                        await CartaPorteFigura.destroy({ where: { carta_porte_id: cpIds }, transaction: t });
                        await CartaPorte.destroy({ where: { id: cpIds }, transaction: t });
                    }
                    await PagoDocumento.destroy({ where: { documento_id: docIds }, transaction: t });
                    await DetalleDocumento.destroy({ where: { documento_id: docIds }, transaction: t });
                    await Documento.destroy({ where: { id: docIds }, transaction: t });
                }
            }
            await Pago.destroy({ where: { emisor_id: id }, transaction: t });

            // Cotizaciones y sus partidas
            const cotizaciones = await Cotizacion.findAll({ where: { emisor_id: id }, attributes: ['id'], transaction: t });
            const cotizacionIds = cotizaciones.map(c => c.id);
            if (cotizacionIds.length > 0) {
                await DetalleCotizacion.destroy({ where: { cotizacion_id: cotizacionIds }, transaction: t });
                await Cotizacion.destroy({ where: { emisor_id: id }, transaction: t });
            }

            // Órdenes de servicio y sus partidas
            const ordenes = await OrdenServicio.findAll({ where: { emisor_id: id }, attributes: ['id'], transaction: t });
            const ordenIds = ordenes.map(o => o.id);
            if (ordenIds.length > 0) {
                await DetalleOrdenServicio.destroy({ where: { orden_servicio_id: ordenIds }, transaction: t });
                await OrdenServicio.destroy({ where: { emisor_id: id }, transaction: t });
            }

            // Conceptos e impuestos vinculados
            const conceptos = await Concepto.findAll({ where: { emisor_id: id }, attributes: ['id'], transaction: t });
            const conceptoIds = conceptos.map(c => c.id);
            if (conceptoIds.length > 0) {
                await ConceptoImpuesto.destroy({ where: { concepto_id: conceptoIds }, transaction: t });
                await Concepto.destroy({ where: { emisor_id: id }, transaction: t });
            }

            // Catálogos complementarios
            await CatVehiculo.destroy({ where: { emisor_id: id }, transaction: t });
            await CatChofer.destroy({ where: { emisor_id: id }, transaction: t });
            await Proveedor.destroy({ where: { emisor_id: id }, transaction: t });
            await Receptor.destroy({ where: { emisor_id: id }, transaction: t });

            // Series, folios y diseño de plantilla
            await SerieFolio.destroy({ where: { emisor_id: id }, transaction: t });
            await ConfiguracionEstilo.destroy({ where: { emisor_id: id }, transaction: t });

            // Asignación de usuarios al emisor
            await UsuarioEmisor.destroy({ where: { emisor_id: id }, transaction: t });

            // Eliminar registro del emisor
            await emisor.destroy({ transaction: t });
        });

        // 4. Eliminar certificados/archivos en disco si existen
        if (emisor.rfc) {
            try {
                const emisorStorageDir = path.join(STORAGE_BASE, emisor.rfc);
                if (fs.existsSync(emisorStorageDir)) {
                    fs.rmSync(emisorStorageDir, { recursive: true, force: true });
                }
            } catch (fsErr) {
                console.warn('No se pudo eliminar el directorio de almacenamiento del emisor:', fsErr.message);
            }
        }

        res.json({ message: 'Emisor eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting emisor:', error);
        res.status(500).json({ message: 'Error al eliminar emisor: ' + (error.message || 'error interno') });
    }
};

export const uploadCSD = async (req, res) => {
    const { id } = req.params;
    const { password_csd } = req.body;

    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        const files = req.files;
        if (!files || !files.certificado || !files.llave_privada) {
            return res.status(400).json({ message: 'Faltan archivos .cer o .key' });
        }

        const cerFile = files.certificado[0];
        const keyFile = files.llave_privada[0];

        // Rutas físicas
        const cerDest = getCerPath(emisor.rfc);
        const keyDest = getKeyPath(emisor.rfc);

        // Guardar archivos físicamente
        fs.writeFileSync(cerDest, cerFile.buffer);
        fs.writeFileSync(keyDest, keyFile.buffer);

        // Actualizar base de datos con rutas relativas/públicas
        await emisor.update({
            certificado_path: getPublicUrl(emisor.rfc, 'csd', 'certificado.cer'),
            llave_privada_path: getPublicUrl(emisor.rfc, 'csd', 'llave.key'),
            password_csd: password_csd || emisor.password_csd
        });

        res.json({
            message: 'Certificados actualizados correctamente',
            emisor
        });
    } catch (error) {
        console.error('Error uploading CSD:', error);
        res.status(500).json({ message: 'Error al procesar certificados' });
    }
};

export const getSeries = async (req, res) => {
    const { id } = req.params;
    const { tipo_documento_id } = req.query;
    try {
        const whereClause = { emisor_id: id };
        if (tipo_documento_id) whereClause.tipo_documento_id = tipo_documento_id;

        const series = await SerieFolio.findAll({ where: whereClause });
        res.json(series);
    } catch (error) {
        console.error('Error fetching series:', error);
        res.status(500).json({ message: 'Error al obtener series' });
    }
};

export const upsertSerie = async (req, res) => {
    const { id: emisor_id } = req.params;
    const { id, serie, ultimo_folio, es_predeterminada, tipo_documento_id } = req.body;
    try {
        if (id) {
            // Update
            const existing = await SerieFolio.findByPk(id);
            if (!existing) return res.status(404).json({ message: 'Serie no encontrada' });
            await existing.update({ serie, ultimo_folio, es_predeterminada, tipo_documento_id });
            res.json(existing);
        } else {
            // Create
            const newSerie = await SerieFolio.create({ 
                emisor_id, 
                serie, 
                ultimo_folio: ultimo_folio || 0, 
                es_predeterminada: es_predeterminada || false,
                tipo_documento_id
            });
            res.status(201).json(newSerie);
        }
    } catch (error) {
        console.error('Error upserting serie:', error);
        res.status(500).json({ message: 'Error al guardar serie' });
    }
};

export const deleteSerie = async (req, res) => {
    const { serieId } = req.params;
    try {
        const serie = await SerieFolio.findByPk(serieId);
        if (!serie) return res.status(404).json({ message: 'Serie no encontrada' });
        await serie.destroy();
        res.json({ message: 'Serie eliminada' });
    } catch (error) {
        console.error('Error deleting serie:', error);
        res.status(500).json({ message: 'Error al eliminar serie' });
    }
};

export const getPreviewPDF = async (req, res) => {
    const { id } = req.params;
    const overrides = req.body; // { color_primario, layout_id, etc. }

    console.log(`[EmisorController] Iniciando previsualización PDF para Emisor ID: ${id}`);
    console.log(`[EmisorController] Overrides recibidos:`, JSON.stringify(overrides));

    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        // Crear objetos mock para la vista previa
        const dummyDocumento = {
            id: 'preview',
            serie: 'SAMPLE',
            folio: '0001',
            tipo_documento_id: (overrides && overrides.tipo_documento_id) ? overrides.tipo_documento_id : null,
            fecha: new Date(),
            uso_cfdi: 'G03',
            forma_pago: '01',
            metodo_pago: 'PUE',
            moneda: 'MXN',
            subtotal: 1000.00,
            descuento: 0,
            total: 1160.00,
            uuid: '8FA485C1-766C-4C35-8EF6-4127A76B4D08', // UUID de ejemplo para mostrar sellos
            sello: 'MOCK_SELLO_DIGITAL_PARA_PREVISUALIZACION',
            sello_sat: 'MOCK_SELLO_SAT_PARA_PREVISUALIZACION',
            cadena_original: '||1.1|8FA485C1-766C-4C35-8EF6-4127A76B4D08|2026-03-12T12:40:43|LSO1306189R5|...'
        };

        const dummyReceptor = {
            razon_social: 'CLIENTE DE PRUEBA S.A. DE C.V.',
            rfc: 'XAXX010101000',
            regimen_fiscal: '601',
            codigo_postal: '00000'
        };

        const dummyDetalles = [
            {
                cantidad: 1,
                valor_unitario: 1000.00,
                importe: 1000.00,
                Concepto: {
                    descripcion: 'CONCEPTO DE PRUEBA PARA DISEÑO DE FACTURA',
                    unidad: 'PZ',
                    clave_sat: '01010101'
                }
            }
        ];

        // Pasar overrides al servicio de PDF para que no use solo la DB
        const pdfResult = await generarPDF(dummyDocumento, emisor, dummyReceptor, dummyDetalles, overrides);

        // Añadir cache buster al URL
        if (pdfResult.success) {
            pdfResult.pdfUrl = `${pdfResult.pdfUrl}?t=${Date.now()}`;
        }

        res.json(pdfResult);
    } catch (error) {
        console.error('Error generating preview PDF:', error);
        res.status(500).json({
            message: 'Error al generar vista previa',
            error: error.message || 'Error interno del servidor PDF'
        });
    }
};

export const getCreditos = async (req, res) => {
    const { id } = req.params;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        const result = await getCreditosDisponibles(emisor);
        res.json(result);
    } catch (error) {
        console.error('Error fetching creditos:', error);
        res.status(500).json({ message: 'Error al consultar créditos en el PAC' });
    }
};

export const getEmisorTotalAnual = async (req, res) => {
    const { id } = req.params;
    const { fecha } = req.query;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        const invoiceDate = fecha ? new Date(fecha) : new Date();
        const currentYear = invoiceDate.getFullYear();
        const startDate = new Date(`${currentYear}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${currentYear}-12-31T23:59:59.999Z`);

        const total = await Documento.sum('subtotal', {
            where: {
                emisor_id: id,
                estado_sat: 'Timbrado',
                fecha: {
                    [Op.between]: [startDate, endDate]
                }
            }
        }) || 0;

        res.json({ total: parseFloat(total) });
    } catch (error) {
        console.error('Error fetching total anual:', error);
        res.status(500).json({ message: 'Error al obtener el total facturado anual' });
    }
};
