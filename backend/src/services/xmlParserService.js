import xml2js from 'xml2js';

const ensureArray = (val) => {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
};

/**
 * Parsea un XML de CFDI y extrae la información estructurada.
 * Soporta CFDI de Ingreso (I) y CFDI de Pago (P) - Complemento de Pago.
 * 
 * @param {string} xmlString Contenido del archivo XML
 * @returns {Promise<Object>} Datos estructurados del CFDI
 */
export const parseCFDI = async (xmlString) => {
    try {
        const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
            tagNameProcessors: [xml2js.processors.stripPrefix],
            attrNameProcessors: [xml2js.processors.stripPrefix]
        });

        const result = await parser.parseStringPromise(xmlString);
        
        const comprobante = result.Comprobante;
        if (!comprobante) {
            throw new Error('El XML no contiene un nodo Comprobante válido.');
        }

        // 1. Extraer datos generales
        const version = comprobante.Version;
        const tipoComprobante = comprobante.TipoDeComprobante; // I (Ingreso), P (Pago), etc.
        const serie = comprobante.Serie || null;
        const folio = comprobante.Folio || null;
        const fecha = comprobante.Fecha;
        const total = parseFloat(comprobante.Total || 0);
        const subtotal = parseFloat(comprobante.SubTotal || 0);
        const descuento = parseFloat(comprobante.Descuento || 0);
        const moneda = comprobante.Moneda || 'MXN';
        const tipoCambio = parseFloat(comprobante.TipoCambio || 1);
        const formaPago = comprobante.FormaPago || null;
        const metodoPago = comprobante.MetodoPago || null;

        // 2. Extraer datos del Emisor y Receptor
        const emisorNode = comprobante.Emisor || {};
        const emisor = {
            rfc: emisorNode.Rfc || emisorNode.RFC,
            nombre: emisorNode.Nombre,
            regimenFiscal: emisorNode.RegimenFiscal || null
        };

        const receptorNode = comprobante.Receptor || {};
        const receptor = {
            rfc: receptorNode.Rfc || receptorNode.RFC,
            nombre: receptorNode.Nombre,
            regimenFiscalReceptor: receptorNode.RegimenFiscalReceptor || null,
            domicilioFiscalReceptor: receptorNode.DomicilioFiscalReceptor || null,
            usoCfdi: receptorNode.UsoCFDI || null
        };

        // 3. Extraer el Timbre Fiscal Digital (UUID)
        const complementoNode = comprobante.Complemento || {};
        const tfdNode = complementoNode.TimbreFiscalDigital || {};
        const uuid = tfdNode.UUID;

        if (!uuid) {
            throw new Error('No se encontró el Folio Fiscal (UUID) en el XML.');
        }

        const cfdiData = {
            uuid,
            version,
            tipoComprobante,
            serie,
            folio,
            fecha: new Date(fecha),
            subtotal,
            descuento,
            total,
            moneda,
            tipoCambio,
            formaPago,
            metodoPago,
            emisor,
            receptor,
            pagos: []
        };

        // 4. Si es un complemento de pago, extraer los datos del pago y documentos relacionados
        if (tipoComprobante === 'P') {
            const pagosNode = complementoNode.Pagos || {};
            const pagosList = ensureArray(pagosNode.Pago);

            cfdiData.pagos = pagosList.map(pagoItem => {
                const pagoAttr = pagoItem.$ || pagoItem; // Dependiendo de cómo lo procese xml2js
                
                const fechaPago = pagoAttr.FechaPago || pagoItem.FechaPago;
                const formaPagoP = pagoAttr.FormaDePagoP || pagoItem.FormaDePagoP;
                const monedaP = pagoAttr.MonedaP || pagoItem.MonedaP || 'MXN';
                const monto = parseFloat(pagoAttr.Monto || pagoItem.Monto || 0);
                const tipoCambioP = parseFloat(pagoAttr.TipoCambioP || pagoItem.TipoCambioP || 1);

                const doctosRel = ensureArray(pagoItem.DoctoRelacionado);
                const documentosRelacionados = doctosRel.map(dr => {
                    const drAttr = dr.$ || dr;
                    return {
                        idDocumento: drAttr.IdDocumento || dr.IdDocumento, // UUID de la factura relacionada
                        impPagado: parseFloat(drAttr.ImpPagado || dr.ImpPagado || 0),
                        impSaldoInsoluto: parseFloat(drAttr.ImpSaldoInsoluto || dr.ImpSaldoInsoluto || 0),
                        numParcialidad: parseInt(drAttr.NumParcialidad || dr.NumParcialidad || 1, 10),
                        monedaDR: drAttr.MonedaDR || dr.MonedaDR || 'MXN'
                    };
                });

                return {
                    fechaPago: new Date(fechaPago),
                    formaPagoP,
                    monedaP,
                    monto,
                    tipoCambioP,
                    documentosRelacionados
                };
            });
        }

        return cfdiData;
    } catch (error) {
        console.error('Error al procesar/parsear XML de CFDI:', error);
        throw error;
    }
};
