import { generarPDF } from './src/services/pdfService.js';
import { Documento, Emisor, Receptor, DetalleDocumento, Concepto, Impuesto } from './src/models/index.js';
import fs from 'fs';
import path from 'path';

async function test() {
    console.log("--- TEST GENERACIÓN PDF CFDI 4.0 COMPLETO ---");

    try {
        const emisor = await Emisor.findOne();
        const receptor = await Receptor.findOne();

        if (!emisor || !receptor) {
            console.error("No hay emisor o receptor en la DB para la prueba.");
            process.exit(1);
        }

        // Crear un documento dummy con datos de certificación
        const documento = await Documento.create({
            emisor_id: emisor.id,
            receptor_id: receptor.id,
            usuario_id: 1,
            tipo_comprobante: 'I',
            serie: 'TEST',
            folio: '100',
            fecha: new Date(),
            subtotal: 1000.00,
            total: 1160.00,
            moneda: 'MXN',
            uuid: '550e8400-e29b-41d4-a716-446655440000',
            no_certificado_emisor: '00001000000504421230',
            no_certificado_sat: '00001000000504204441',
            fecha_timbrado: new Date(),
            sello_cfdi: 'SelloDigitalPruebaABC123...',
            sello_sat: 'SelloSATPruebaXYZ789...',
            cadena_original_tfd: '||1.1|550e8400-e29b-41d4-a716-446655440000|2026-03-17T13:00:00|SelloCFDI|00001000000504204441||',
            estado_sat: 'Timbrado'
        });

        const concepto = await Concepto.findOne();
        if (!concepto) {
            console.error("No hay conceptos en la DB para la prueba.");
            process.exit(1);
        }

        const detalle = await DetalleDocumento.create({
            documento_id: documento.id,
            concepto_id: concepto.id,
            cantidad: 1,
            valor_unitario: 1000.00,
            importe: 1000.00,
            es_objeto_imp: '02'
        });

        const lineas = [detalle];

        console.log("Generando PDF para V1...");
        const res1 = await generarPDF(documento, emisor, receptor, lineas);
        console.log("PDF V1 generado en:", res1.pdfUrl);

        console.log("--- TEST FINALIZADO CON ÉXITO ---");

        // Limpiamos el documento de prueba al terminar
        await documento.destroy();

    } catch (error) {
        console.error("Error en el test:", error);
    }
}

test();
