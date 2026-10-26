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
    FolioHistorial,
    sequelize
} from '../models/index.js';
import { generarPDF } from '../services/pdfService.js';
import { 
    getCreditosDisponibles, 
    registrarEmisorPAC, 
    asignarTimbresPAC, 
    consultarStatusSatPAC, 
    consultarPeticionesPendientesPAC, 
    testConexionPACService 
} from '../services/cfdiService.js';
import { Op } from 'sequelize';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getCerPath, getKeyPath, getPublicUrl, STORAGE_BASE, getEmissorDir } from '../utils/storageHelper.js';

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
                include: [
                    { model: Empresa, attributes: ['id', 'nombre', 'activo'] },
                    { model: ConfiguracionEstilo, as: 'estilo', attributes: ['id', 'logo_url', 'color_primario', 'color_secundario', 'layout_id'] }
                ],
                order: [['razon_social', 'ASC']]
            });
        } else {
            emisores = await Emisor.findAll({
                where: { empresa_id: req.usuario.empresa_id },
                include: [
                    { model: Empresa, attributes: ['id', 'nombre', 'activo'] },
                    { model: ConfiguracionEstilo, as: 'estilo', attributes: ['id', 'logo_url', 'color_primario', 'color_secundario', 'layout_id'] }
                ],
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

export const uploadLogoEmisor = async (req, res) => {
    const { id } = req.params;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        let estilo = await ConfiguracionEstilo.findOne({ where: { emisor_id: id } });
        if (!estilo) {
            estilo = await ConfiguracionEstilo.create({
                emisor_id: id,
                color_primario: '#004481',
                color_secundario: '#123247',
                tipo_letra: 'Arial',
                layout_id: 'v1'
            });
        }

        if (req.body.remove_logo === 'true' || req.body.remove_logo === true) {
            await estilo.update({ logo_url: null });
            return res.json({ message: 'Logotipo eliminado correctamente', logo_url: null });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No se envió ningún archivo de imagen' });
        }

        const fullPath = getEmissorDir(emisor.rfc, 'logos');
        const ext = path.extname(req.file.originalname) || '.png';
        const fileName = `logo_${Date.now()}${ext}`;
        fs.writeFileSync(path.join(fullPath, fileName), req.file.buffer);

        const logo_url = `/storage/${emisor.rfc}/logos/${fileName}`;
        const updateFields = { logo_url };
        if (req.body.color_primario) updateFields.color_primario = req.body.color_primario;
        if (req.body.color_secundario) updateFields.color_secundario = req.body.color_secundario;
        await estilo.update(updateFields);

        res.json({ message: 'Logotipo actualizado correctamente', logo_url, color_primario: estilo.color_primario, color_secundario: estilo.color_secundario });
    } catch (error) {
        console.error('Error uploading logo emisor:', error);
        res.status(500).json({ message: 'Error al procesar el logotipo: ' + error.message });
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

        // Crear objetos mock profesionales y completos para la vista previa CFDI 4.0
        const emisorCp = emisor.codigo_postal || '29960';
        const dummyDocumento = {
            id: 'preview',
            serie: 'A',
            folio: '1024',
            tipo_documento_id: (overrides && overrides.tipo_documento_id) ? overrides.tipo_documento_id : null,
            tipo_comprobante: 'I',
            fecha: new Date(),
            fecha_timbrado: new Date(Date.now() - 60000),
            lugar_expedicion: emisorCp,
            exportacion: '01',
            uso_cfdi: 'G03',
            forma_pago: '03',
            metodo_pago: 'PUE',
            condiciones_pago: 'Contado Inmediato',
            moneda: 'MXN',
            tipo_cambio: '1.000000',
            subtotal: 2500.00,
            descuento: 0.00,
            total_impuestos_trasladados: 400.00,
            total: 2900.00,
            uuid: '4E70B182-E7A9-4C35-8EF6-8FA485C1766C',
            no_certificado_emisor: emisor.no_certificado || '00001000000504465028',
            no_certificado_sat: '00001000000509846663',
            rfc_pac: 'LSO1306189R5',
            sello_cfdi: 'm3X8qPl9K1wZtYuIoP1aSdfgHjkLzXcvBnmQweRtYuIoP1aSdfgHjkLzXcvBnmQweRtYuIoP1aSdfgHjkLzXcvBnmQweRtYuIoP1aSdfgHjkLzXcvBnmQweRtYuIoP1aSdfgHjkL==',
            sello_sat: 'K9jL1mNoPqRsTuVwXyZ0123456789aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789aBcDeFgHiJkLmNoPqRsTuVwXyZ01==',
            cadena_original_tfd: '||1.1|4E70B182-E7A9-4C35-8EF6-8FA485C1766C|2026-10-25T10:15:30|LSO1306189R5|m3X8qPl9K1wZtYuIoP1aSdfgHjkLzXcvBnmQweRtYuIoP1aSdfgHjkLzXcvBnmQweRtYuIoP1aSdfgHjkLzXcvBnmQweRtYuIoP1aSdfgHjkLzXcvBnmQweRtYuIoP1aSdfgHjkL==|00001000000509846663||'
        };

        const dummyReceptor = {
            razon_social: 'CORPORATIVO EMPRESARIAL DEL SURESTE S.A. DE C.V.',
            rfc: 'CES180420KM9',
            regimen_fiscal: '601',
            codigo_postal: '06600',
            municipio: 'Cuauhtémoc',
            estado: 'Ciudad de México',
            pais: 'México'
        };

        const dummyDetalles = [
            {
                cantidad: 1,
                clave_sat: '84111506',
                clave_prod_serv: '84111506',
                clave_unidad: 'E48',
                unidad: 'Unidad de servicio',
                no_identificacion: 'SERV-FAC-01',
                descripcion: 'SERVICIOS PROFESIONALES DE FACTURACIÓN ELECTRÓNICA CFDI 4.0 - PLAN ANUAL EMPRESARIAL CON TIMBRADO MULTI-SERIE Y COMPLEMENTOS FISCALES',
                objeto_imp: '02',
                valor_unitario: 1500.00,
                descuento: 0.00,
                importe: 1500.00
            },
            {
                cantidad: 2,
                clave_sat: '43231500',
                clave_prod_serv: '43231500',
                clave_unidad: 'H87',
                unidad: 'Pieza',
                no_identificacion: 'LIC-CONCIL-02',
                descripcion: 'LICENCIA DE USUARIO CONCURRENTE PARA MÓDULO DE EMISIÓN, CANCELACIÓN Y CONCILIACIÓN FISCAL SAT AUTOMATIZADA',
                objeto_imp: '02',
                valor_unitario: 500.00,
                descuento: 0.00,
                importe: 1000.00
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

export const registrarEmisorEnPAC = async (req, res) => {
    const { id } = req.params;
    const { password_csd } = req.body;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ success: false, message: 'Emisor no encontrado', mensaje: 'Emisor no encontrado' });

        const result = await registrarEmisorPAC(emisor, password_csd);
        const responseData = {
            ...result,
            message: result.mensaje || result.message,
            mensaje: result.mensaje || result.message
        };
        if (result.success) {
            return res.json(responseData);
        } else {
            return res.status(400).json(responseData);
        }
    } catch (error) {
        console.error('Error al registrar emisor en PAC:', error);
        res.status(500).json({ success: false, message: error.message || 'Error interno al registrar emisor en el PAC', mensaje: error.message || 'Error interno al registrar emisor en el PAC' });
    }
};

export const asignarFoliosPAC = async (req, res) => {
    const { id } = req.params;
    const { no_timbres, notas } = req.body;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ success: false, message: 'Emisor no encontrado', mensaje: 'Emisor no encontrado' });

        const cantidad = Number(no_timbres);
        if (!cantidad || cantidad <= 0) {
            return res.status(400).json({ success: false, message: 'La cantidad de timbres debe ser mayor a 0', mensaje: 'La cantidad de timbres debe ser mayor a 0' });
        }

        const saldoAnterior = emisor.ultimos_folios_pac || 0;
        const result = await asignarTimbresPAC(emisor, cantidad);
        const responseData = {
            ...result,
            message: result.mensaje || result.message,
            mensaje: result.mensaje || result.message
        };

        if (result.success) {
            const saldoNuevo = saldoAnterior + cantidad;
            await emisor.update({ ultimos_folios_pac: saldoNuevo });

            // Registrar en FolioHistorial
            await FolioHistorial.create({
                emisor_id: emisor.id,
                empresa_id: emisor.empresa_id || null,
                usuario_id: req.usuario?.id || null,
                cantidad: cantidad,
                saldo_anterior: saldoAnterior,
                saldo_nuevo: saldoNuevo,
                tipo_movimiento: 'ASIGNACION_PAC',
                notas: notas || `Asignación de ${cantidad} folios a ${emisor.rfc}`,
                resultado_pac: result.mensaje || 'Asignación exitosa'
            });

            return res.json({
                ...responseData,
                saldo_anterior: saldoAnterior,
                saldo_nuevo: saldoNuevo
            });
        } else {
            return res.status(400).json(responseData);
        }
    } catch (error) {
        console.error('Error al asignar folios PAC:', error);
        res.status(500).json({ success: false, message: error.message || 'Error al asignar folios en el PAC', mensaje: error.message || 'Error al asignar folios en el PAC' });
    }
};

export const getHistorialFoliosPAC = async (req, res) => {
    const { id } = req.params;
    try {
        const historial = await FolioHistorial.findAll({
            where: { emisor_id: id },
            include: [
                { model: Usuario, attributes: ['id', 'nombre', 'email'] },
                { model: Emisor, attributes: ['id', 'rfc', 'razon_social'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(historial);
    } catch (error) {
        console.error('Error al consultar historial de folios del emisor:', error);
        res.status(500).json({ success: false, message: 'Error al consultar historial de folios', mensaje: 'Error al consultar historial de folios' });
    }
};

export const testConexionPAC = async (req, res) => {
    const { id } = req.params;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ success: false, message: 'Emisor no encontrado', mensaje: 'Emisor no encontrado' });

        const result = await testConexionPACService(emisor);
        res.json({
            ...result,
            message: result.mensaje || result.message,
            mensaje: result.mensaje || result.message
        });
    } catch (error) {
        console.error('Error diagnosticando PAC:', error);
        res.status(500).json({ success: false, message: error.message || 'Error al diagnosticar conexión con el PAC', mensaje: error.message || 'Error al diagnosticar conexión con el PAC' });
    }
};

export const consultarStatusSatPACController = async (req, res) => {
    const { id } = req.params;
    const { uuid } = req.body;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ success: false, message: 'Emisor no encontrado', mensaje: 'Emisor no encontrado' });

        const result = await consultarStatusSatPAC(emisor, uuid);
        res.json({
            ...result,
            message: result.mensaje || result.message,
            mensaje: result.mensaje || result.message
        });
    } catch (error) {
        console.error('Error consultando status SAT PAC:', error);
        res.status(500).json({ success: false, message: error.message || 'Error al consultar estatus SAT en el PAC', mensaje: error.message || 'Error al consultar estatus SAT en el PAC' });
    }
};

export const consultarPeticionesPendientesPACController = async (req, res) => {
    const { id } = req.params;
    try {
        const emisor = await Emisor.findByPk(id);
        if (!emisor) return res.status(404).json({ success: false, message: 'Emisor no encontrado', mensaje: 'Emisor no encontrado' });

        const result = await consultarPeticionesPendientesPAC(emisor);
        res.json({
            ...result,
            message: result.mensaje || result.message,
            mensaje: result.mensaje || result.message
        });
    } catch (error) {
        console.error('Error consultando peticiones SAT PAC:', error);
        res.status(500).json({ success: false, message: error.message || 'Error al consultar peticiones SAT en el PAC', mensaje: error.message || 'Error al consultar peticiones SAT en el PAC' });
    }
};

