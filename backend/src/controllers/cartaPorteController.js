import { sequelize } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { 
    Documento, CartaPorte, CartaPorteUbicacion, 
    CartaPorteMercancia, CartaPorteAutotransporte, 
    CartaPorteFigura, Emisor, Receptor, DetalleDocumento 
} from '../models/index.js';
import { generarXMLCartaPorte, firmarXML, timbrarPAC } from '../services/cfdiService.js';

export const emitirCartaPorte = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            emisor_id, receptor_id, tipo_comprobante, serie, folio, 
            forma_pago, metodo_pago, uso_cfdi, moneda, tipo_cambio, 
            detalles, // Arreglo de conceptos de facturación
            cartaPorte // Objeto profundo con: transp_internac, total_dist_rec, ubicaciones, mercancias, autotransporte, figuras
        } = req.body;

        const emisor = await Emisor.findByPk(emisor_id, { transaction: t });
        const receptor = await Receptor.findByPk(receptor_id, { transaction: t });

        if (!emisor || !receptor) {
            throw new Error("Emisor o Receptor no encontrado.");
        }

        // 1. Guardar o preparar el Documento Padre (I o T)
        let subtotal = 0, descuento = 0;
        detalles.forEach(d => {
            subtotal += (d.cantidad * d.valor_unitario);
            descuento += parseFloat(d.descuento || 0);
        });
        
        // El SAT requiere que si es Traslado (T), subtotal y total sean 0.
        const rSubtotal = tipo_comprobante === 'T' ? 0 : subtotal;
        const rTotal = tipo_comprobante === 'T' ? 0 : subtotal - descuento; // Ignorando impuestos para el cálculo base del stub

        const nuevoDoc = await Documento.create({
            emisor_id, receptor_id, usuario_id: req.usuario.id,
            tipo_comprobante, serie, folio, fecha: new Date(),
            forma_pago: tipo_comprobante === 'I' ? forma_pago : null,
            metodo_pago: tipo_comprobante === 'I' ? metodo_pago : null,
            uso_cfdi: receptor.uso_cfdi || uso_cfdi || 'G03',
            moneda: tipo_comprobante === 'T' ? 'XXX' : (moneda || 'MXN'),
            tipo_cambio: (tipo_comprobante !== 'T' && moneda !== 'MXN') ? tipo_cambio : 1,
            subtotal: rSubtotal, descuento: tipo_comprobante === 'T' ? 0 : descuento, total: rTotal,
            estado_sat: 'Pendiente', estado_pago: tipo_comprobante === 'T' ? 'Pagado' : 'Pendiente'
        }, { transaction: t });

        // Guardar detalles
        const detallesInst = await Promise.all(detalles.map(async (d) => {
             return await DetalleDocumento.create({
                 documento_id: nuevoDoc.id, concepto_id: d.concepto_id || null,
                 cantidad: d.cantidad, valor_unitario: d.valor_unitario, descuento: d.descuento,
                 es_objeto_imp: tipo_comprobante === 'T' ? '01' : (d.es_objeto_imp || '02'),
                 retencion_iva: d.retencion_iva, retencion_isr: d.retencion_isr, retencion_isr_tasa: d.retencion_isr_tasa
             }, { transaction: t });
        }));

        // 2. Guardar Carta Porte
        const idCCP = uuidv4().toUpperCase(); // Generar un UUID único requerido por el estándar 3.1
        
        const nuevaCP = await CartaPorte.create({
            documento_id: nuevoDoc.id, version: '3.1', idCCP,
            transp_internac: cartaPorte.transp_internac || 'No',
            total_dist_rec: cartaPorte.total_dist_rec || 0,
            peso_bruto_total: cartaPorte.peso_bruto_total || 0,
            unidad_peso: cartaPorte.unidad_peso || 'KGM',
            num_total_mercancias: cartaPorte.mercancias ? cartaPorte.mercancias.length : 0
        }, { transaction: t });

        // Guardar Ubicaciones
        if (cartaPorte.ubicaciones && cartaPorte.ubicaciones.length > 0) {
            for (const u of cartaPorte.ubicaciones) {
                await CartaPorteUbicacion.create({ ...u, carta_porte_id: nuevaCP.id }, { transaction: t });
            }
        }

        // Guardar Mercancías
        if (cartaPorte.mercancias && cartaPorte.mercancias.length > 0) {
            for (const m of cartaPorte.mercancias) {
                await CartaPorteMercancia.create({ ...m, carta_porte_id: nuevaCP.id }, { transaction: t });
            }
        }

        // Guardar Autotransporte
        if (cartaPorte.autotransporte) {
            await CartaPorteAutotransporte.create({ ...cartaPorte.autotransporte, carta_porte_id: nuevaCP.id }, { transaction: t });
        }

        // Guardar Figuras (Choferes)
        if (cartaPorte.figuras && cartaPorte.figuras.length > 0) {
            for (const f of cartaPorte.figuras) {
                await CartaPorteFigura.create({ ...f, carta_porte_id: nuevaCP.id }, { transaction: t });
            }
        }

        cartaPorte.idCCP = idCCP; // Inject for XML builder
        cartaPorte.num_total_mercancias = cartaPorte.mercancias ? cartaPorte.mercancias.length : 0;

        // 3. Generar XML
        const xmlBase = await generarXMLCartaPorte(nuevoDoc, emisor, receptor, detallesInst, cartaPorte);
        const fsDebug = await import('fs');
        fsDebug.writeFileSync('carta_porte_debug.xml', xmlBase);
        
        // 4. Firmar XML
        const xmlFirmado = await firmarXML(xmlBase, emisor.id);

        // 5. Timbrar PAC
        const resultTimbrado = await timbrarPAC(xmlFirmado, emisor);

        if (resultTimbrado.success) {
            await nuevoDoc.update({
                uuid: resultTimbrado.uuid,
                estado_sat: 'Timbrado',
                xml_url: resultTimbrado.xmlTimbradoUrl,
                no_certificado_emisor: resultTimbrado.noCertificadoEmisor,
                no_certificado_sat: resultTimbrado.noCertificadoSAT,
                fecha_timbrado: resultTimbrado.fechaTimbrado,
                sello_cfdi: resultTimbrado.selloCFDI,
                sello_sat: resultTimbrado.selloSAT
            }, { transaction: t });
            
            await t.commit();
            res.json({ success: true, message: 'Carta Porte Timbrada Exitosamente', uuid: resultTimbrado.uuid, documento: nuevoDoc });
        } else {
            throw new Error("Fallo en la comunicación con el PAC");
        }

    } catch (error) {
        await t.rollback();
        console.error('Error emitiendo Carta Porte:', error);
        res.status(500).json({ message: error.message || 'Error interno al timbrar Carta Porte' });
    }
};
