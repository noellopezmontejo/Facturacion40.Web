import { create } from 'xmlbuilder2';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import crypto from 'crypto';
import forge from 'node-forge';
import SaxonJS from 'saxon-js';
import { fileURLToPath } from 'url';
import { Emisor } from '../models/index.js';
import { getCerPath, getKeyPath, getXmlPath } from '../utils/storageHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Normaliza decimales para SAT
 */
const roundDec = (num, decimals = 2) => Number(Math.round(num + "e" + decimals) + "e-" + decimals).toFixed(decimals);
const roundTasa = (num) => Number(num).toFixed(6);

/**
 * Extrae NoCertificado y Base64 del archivo .cer del SAT
 */
const extractCertInfo = (cerBuffer) => {
    try {
        const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(cerBuffer.toString('binary')));
        const serialHex = cert.serialNumber;

        // Convertir hex a caracteres ASCII (SAT serial format)
        let serialStr = "";
        for (let i = 0; i < serialHex.length; i += 2) {
            serialStr += String.fromCharCode(parseInt(serialHex.substr(i, 2), 16));
        }

        const subject = cert.subject.getField('CN').value;

        return {
            noCertificado: serialStr,
            certificado: cerBuffer.toString('base64'),
            nombreSujeto: subject
        };
    } catch (err) {
        console.error("Error extrayendo info del certificado:", err.message);
        return null;
    }
};

/**
 * Servicio para la generación de la estructura XML del CFDI Anexo 20 v4.0
 */
export const generarXML = async (documento, emisor, receptor, detalles) => {
    console.log(`[CFDI Service] Generando XML Anexo 20 v4.0 para documento ID: ${documento.id}`);

    let noCertificado = '20001000000300022762';
    let certificadoStr = 'MIIFuzCCA6OgAwIBAgIUMjAwMDEwMDAwMDAzMDAwMjI3NjIwDQYJKoZIhvcNAQELBQAwgg...';
    let nombreCertificado = null;

    const pathCert = getCerPath(emisor.rfc);
    if (fs.existsSync(pathCert)) {
        const cerBuffer = fs.readFileSync(pathCert);
        const info = extractCertInfo(cerBuffer);
        if (info) {
            noCertificado = info.noCertificado;
            certificadoStr = info.certificado;
            nombreCertificado = info.nombreSujeto;
        }
    }

    let totalTraslados = 0;
    let totalRetenciones = 0;
    let totalRetISR = 0;
    let totalRetIVA = 0;
    const globalTrasladosMap = {};
    let baseISR = 0;
    let baseIVARet = 0;
    let subtotalXml = 0;
    let descuentoXml = 0;

    const needsPaymentInfo = ['I', 'E'].includes(documento.tipo_comprobante);

    const conceptosArr = detalles.map(d => {
        const price = parseFloat(d.valor_unitario);
        const qty = parseFloat(d.cantidad);
        const disc = parseFloat(d.descuento || 0);

        const importeConcepto = parseFloat(roundDec(qty * price, 2));
        const descuentoConcepto = parseFloat(roundDec(disc, 2));
        const baseConcepto = parseFloat(roundDec(importeConcepto - descuentoConcepto, 2));

        subtotalXml += importeConcepto;
        descuentoXml += descuentoConcepto;

        const conceptoNode = {
            '@ClaveProdServ': d.Concepto ? d.Concepto.clave_prod_serv : '01010101',
            '@NoIdentificacion': d.Concepto?.no_identificacion || d.id.toString(),
            '@Cantidad': roundDec(qty, 6),
            '@ClaveUnidad': d.Concepto ? d.Concepto.clave_unidad : 'E48',
            '@Unidad': d.Concepto?.unidad || 'SERVICIO',
            '@Descripcion': d.Concepto?.descripcion || 'Descripción del producto',
            '@ValorUnitario': roundDec(price, 6),
            '@Importe': roundDec(importeConcepto, 2),
            '@Descuento': descuentoConcepto > 0 ? roundDec(descuentoConcepto, 2) : undefined,
            '@ObjetoImp': d.es_objeto_imp || '02'
        };

        if (d.es_objeto_imp === '02') {
            const traslados = [];
            const retenciones = [];

            let conceptTraslados = d.Concepto?.Impuestos?.filter(imp => imp.tipo === 'traslado') || [];
            if (conceptTraslados.length === 0) {
                // Default IVA 16%
                conceptTraslados = [{
                    impuesto_sat: '002',
                    tipo_factor: 'Tasa',
                    tasa_cuota: 0.16
                }];
            }

            conceptTraslados.forEach(imp => {
                const tasa = parseFloat(imp.tasa_cuota || 0);
                const tipoFactor = imp.tipo_factor || 'Tasa';
                const impAmt = tipoFactor === 'Exento' ? 0 : parseFloat(roundDec(baseConcepto * tasa, 2));

                traslados.push({
                    '@Base': roundDec(baseConcepto, 6),
                    '@Impuesto': imp.impuesto_sat,
                    '@TipoFactor': tipoFactor,
                    '@TasaOCuota': tipoFactor === 'Exento' ? undefined : roundTasa(tasa),
                    '@Importe': tipoFactor === 'Exento' ? undefined : roundDec(impAmt, 2)
                });

                totalTraslados += impAmt;

                // Group globally
                const key = `${imp.impuesto_sat}_${tipoFactor}_${tasa}`;
                if (!globalTrasladosMap[key]) {
                    globalTrasladosMap[key] = {
                        impuesto: imp.impuesto_sat,
                        tipoFactor: tipoFactor,
                        tasaOCuota: tasa,
                        base: 0,
                        importe: 0
                    };
                }
                globalTrasladosMap[key].base += baseConcepto;
                globalTrasladosMap[key].importe += impAmt;
            });

            if (d.retencion_isr) {
                const tasaISR = parseFloat(d.retencion_isr_tasa || 0.10);
                const impISR = baseConcepto * tasaISR;
                retenciones.push({
                    '@Base': roundDec(baseConcepto, 6),
                    '@Impuesto': '001',
                    '@TipoFactor': 'Tasa',
                    '@TasaOCuota': roundTasa(tasaISR),
                    '@Importe': roundDec(impISR, 6)
                });
                totalRetISR += impISR;
                baseISR += baseConcepto;
            }

            if (d.retencion_iva) {
                const tasaIVA = 0.106667;
                const impIVARet = baseConcepto * tasaIVA;
                retenciones.push({
                    '@Base': roundDec(baseConcepto, 6),
                    '@Impuesto': '002',
                    '@TipoFactor': 'Tasa',
                    '@TasaOCuota': roundTasa(tasaIVA),
                    '@Importe': roundDec(impIVARet, 6)
                });
                totalRetIVA += impIVARet;
                baseIVARet += baseConcepto;
            }

            conceptoNode['cfdi:Impuestos'] = {
                'cfdi:Traslados': { 'cfdi:Traslado': traslados },
                'cfdi:Retenciones': retenciones.length > 0 ? { 'cfdi:Retencion': retenciones } : undefined
            };
        }
        return conceptoNode;
    });

    totalRetenciones = parseFloat(roundDec(totalRetISR + totalRetIVA, 2));

    if (documento.ajuste_manual && conceptosArr.length > 0) {
        const diffSubtotal = parseFloat(documento.subtotal) - subtotalXml;
        const diffTraslados = parseFloat(documento.total_impuestos_trasladados) - totalTraslados;
        const diffRetenciones = parseFloat(documento.total_impuestos_retenidos) - totalRetenciones;

        const lastConcept = conceptosArr[conceptosArr.length - 1];

        // 1. Ajustar subtotal en el último concepto
        const lastImporte = parseFloat(lastConcept['@Importe']) + diffSubtotal;
        lastConcept['@Importe'] = roundDec(lastImporte, 2);
        
        const lastDesc = parseFloat(lastConcept['@Descuento'] || 0);
        const lastBase = parseFloat(roundDec(lastImporte - lastDesc, 2));

        subtotalXml = parseFloat(documento.subtotal);

        // 2. Ajustar los impuestos a nivel concepto
        if (lastConcept['cfdi:Impuestos']) {
            if (lastConcept['cfdi:Impuestos']['cfdi:Traslados'] && lastConcept['cfdi:Impuestos']['cfdi:Traslados']['cfdi:Traslado']) {
                const trasList = lastConcept['cfdi:Impuestos']['cfdi:Traslados']['cfdi:Traslado'];
                const ivaTras = trasList.find(t => t['@Impuesto'] === '002') || trasList[0];
                if (ivaTras) {
                    ivaTras['@Base'] = roundDec(lastBase, 6);
                    if (ivaTras['@Importe'] !== undefined) {
                        const newImpAmt = parseFloat(ivaTras['@Importe']) + diffTraslados;
                        ivaTras['@Importe'] = roundDec(newImpAmt, 2);
                    }
                }
            }

            if (lastConcept['cfdi:Impuestos']['cfdi:Retenciones'] && lastConcept['cfdi:Impuestos']['cfdi:Retenciones']['cfdi:Retencion']) {
                const retList = lastConcept['cfdi:Impuestos']['cfdi:Retenciones']['cfdi:Retencion'];
                const mainRet = retList.find(r => r['@Impuesto'] === '001') || retList.find(r => r['@Impuesto'] === '002') || retList[0];
                if (mainRet) {
                    mainRet['@Base'] = roundDec(lastBase, 6);
                    const newRetAmt = parseFloat(mainRet['@Importe']) + diffRetenciones;
                    mainRet['@Importe'] = roundDec(newRetAmt, 2);
                }
            }
        }

        // 3. Ajustar acumuladores globales
        totalTraslados = parseFloat(documento.total_impuestos_trasladados);
        totalRetenciones = parseFloat(documento.total_impuestos_retenidos);

        if (totalRetISR > 0 && totalRetIVA > 0) {
            totalRetISR += diffRetenciones;
        } else if (totalRetISR > 0) {
            totalRetISR = totalRetenciones;
        } else if (totalRetIVA > 0) {
            totalRetIVA = totalRetenciones;
        }

        const keys = Object.keys(globalTrasladosMap);
        if (keys.length > 0) {
            const mainKey = keys.find(k => k.startsWith('002_')) || keys[0];
            globalTrasladosMap[mainKey].importe = parseFloat(roundDec(globalTrasladosMap[mainKey].importe + diffTraslados, 2));
            globalTrasladosMap[mainKey].base = lastBase;
        }
    }

    // Cálculos Impuestos Locales
    let totalTrasladosLocales = 0;
    let totalRetencionesLocales = 0;
    const implocalTraslados = [];
    const implocalRetenciones = [];

    if (documento.impuestos_locales) {
        try {
            const il = typeof documento.impuestos_locales === 'string' ? JSON.parse(documento.impuestos_locales) : documento.impuestos_locales;
            if (il && il.traslados && Array.isArray(il.traslados)) {
                il.traslados.forEach(t => {
                    const amt = parseFloat(roundDec(t.importe || 0, 2));
                    if (!isNaN(amt)) {
                        totalTrasladosLocales += amt;
                        implocalTraslados.push({
                            '@ImpLocTrasladado': t.impuesto,
                            '@TasadeTraslado': roundDec(t.tasa || 0, 2), // SAT local taxes XSD requires 2 decimals
                            '@Importe': roundDec(amt, 2)
                        });
                    }
                });
            }
            if (il && il.retenciones && Array.isArray(il.retenciones)) {
                il.retenciones.forEach(r => {
                    const amt = parseFloat(roundDec(r.importe || 0, 2));
                    if (!isNaN(amt)) {
                        totalRetencionesLocales += amt;
                        implocalRetenciones.push({
                            '@ImpLocRetenido': r.impuesto,
                            '@TasadeRetencion': roundDec(r.tasa || 0, 2), // SAT local taxes XSD requires 2 decimals
                            '@Importe': roundDec(amt, 2)
                        });
                    }
                });
            }
        } catch (e) {
            console.error("[CFDI Service] Error parsing impuestos_locales:", e);
        }
    }

    const totalComprobante = parseFloat(roundDec(subtotalXml - descuentoXml + totalTraslados - totalRetenciones + totalTrasladosLocales - totalRetencionesLocales, 2));

    const cfdiObject = {
        'cfdi:Comprobante': {
            '@xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4',
            '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            '@xmlns:implocal': 'http://www.sat.gob.mx/implocal',
            '@xsi:schemaLocation': 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/implocal http://www.sat.gob.mx/sitio_internet/cfd/implocal/implocal.xsd',
            '@Version': '4.0',
            '@Serie': documento.serie || 'A',
            '@Folio': documento.folio || documento.id.toString(),
            '@Fecha': documento.fecha ? new Date(new Date(documento.fecha).getTime() - new Date(documento.fecha).getTimezoneOffset() * 60000).toISOString().substring(0, 19) : new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 19),
            '@Sello': '',
            '@FormaPago': needsPaymentInfo ? (documento.forma_pago || '01') : undefined,
            '@NoCertificado': noCertificado,
            '@Certificado': certificadoStr,
            '@SubTotal': roundDec(subtotalXml, 2),
            '@Descuento': descuentoXml > 0 ? roundDec(descuentoXml, 2) : undefined,
            '@Moneda': documento.moneda || 'MXN',
            '@TipoCambio': documento.moneda !== 'MXN' ? roundDec(documento.tipo_cambio || 1, 4) : undefined,
            '@Total': roundDec(totalComprobante, 2),
            '@TipoDeComprobante': documento.tipo_comprobante,
            '@Exportacion': '01',
            '@MetodoPago': needsPaymentInfo ? (documento.metodo_pago || 'PUE') : undefined,
            '@LugarExpedicion': emisor.codigo_postal,

            'cfdi:Emisor': {
                '@Rfc': emisor.rfc,
                '@Nombre': emisor.razon_social,
                '@RegimenFiscal': emisor.regimen_fiscal
            },
            'cfdi:Receptor': {
                '@Rfc': receptor.rfc,
                '@Nombre': receptor.razon_social,
                '@DomicilioFiscalReceptor': receptor.codigo_postal,
                '@RegimenFiscalReceptor': receptor.regimen_fiscal,
                '@UsoCFDI': receptor.uso_cfdi || 'G03'
            },
            'cfdi:Conceptos': {
                'cfdi:Concepto': conceptosArr
            }
        }
    };

    const globalTrasladosList = Object.values(globalTrasladosMap).map(gt => {
        return {
            '@Base': roundDec(gt.base, 2),
            '@Impuesto': gt.impuesto,
            '@TipoFactor': gt.tipoFactor,
            '@TasaOCuota': gt.tipoFactor === 'Exento' ? undefined : roundTasa(gt.tasaOCuota),
            '@Importe': gt.tipoFactor === 'Exento' ? undefined : roundDec(gt.importe, 2)
        };
    });

    const hasTraslados = Object.keys(globalTrasladosMap).length > 0;
    const hasTasaTraslado = Object.values(globalTrasladosMap).some(gt => gt.tipoFactor === 'Tasa');

    if (hasTraslados || totalRetenciones > 0) {
        cfdiObject['cfdi:Comprobante']['cfdi:Impuestos'] = {
            '@TotalImpuestosRetenidos': totalRetenciones > 0 ? roundDec(totalRetenciones, 2) : undefined,
            '@TotalImpuestosTrasladados': hasTasaTraslado ? roundDec(totalTraslados, 2) : undefined,
            'cfdi:Retenciones': totalRetenciones > 0 ? {
                'cfdi:Retencion': [
                    totalRetISR > 0 ? { '@Impuesto': '001', '@Importe': roundDec(totalRetISR, 2) } : null,
                    totalRetIVA > 0 ? { '@Impuesto': '002', '@Importe': roundDec(totalRetIVA, 2) } : null
                ].filter(Boolean)
            } : undefined,
            'cfdi:Traslados': globalTrasladosList.length > 0 ? {
                'cfdi:Traslado': globalTrasladosList
            } : undefined
        };
    }

    // Complemento Impuestos Locales
    if (implocalTraslados.length > 0 || implocalRetenciones.length > 0) {
        cfdiObject['cfdi:Comprobante']['cfdi:Complemento'] = {
            'implocal:ImpuestosLocales': {
                '@version': '1.0',
                '@TotaldeRetenciones': roundDec(totalRetencionesLocales, 2),
                '@TotaldeTraslados': roundDec(totalTrasladosLocales, 2),
                'implocal:RetencionesLocales': implocalRetenciones.length > 0 ? implocalRetenciones : undefined,
                'implocal:TrasladosLocales': implocalTraslados.length > 0 ? implocalTraslados : undefined
            }
        };
    }

    const xmlDoc = create({ version: '1.0', encoding: 'UTF-8' }, cfdiObject);
    return xmlDoc.end({ prettyPrint: false });
};const generarCadenaOriginal = async (xmlString) => {
    return new Promise((resolve, reject) => {
        try {
            const xsltPath = path.join(__dirname, '..', 'storage', 'sat_xslt', 'cadenaoriginal_4_0.sef.json');
            if (!fs.existsSync(xsltPath)) {
                return reject(new Error(`No se encontró el archivo XSLT en: ${xsltPath}`));
            }
            const options = { stylesheetFileName: xsltPath, sourceText: xmlString, destination: 'serialized' };
            const result = SaxonJS.transform(options, 'sync');
            resolve(result.principalResult.trim());
        } catch (error) {
            console.error('Error procesando Cadena Original:', error);
            reject(new Error('Fallo al generar Cadena Original XSLT: ' + error.message));
        }
    });
};

export const firmarXML = async (xmlString, emisorId) => {
    console.log(`[CFDI Service] Firmando XML con CSD del Emisor ${emisorId}`);
    const emisor = await Emisor.findByPk(emisorId);
    const pathKey = getKeyPath(emisor.rfc);

    let selloDigital = '';
    const doc = create(xmlString);

    if (!fs.existsSync(pathKey) || !emisor.password_csd) {
        console.warn(`[CFDI Service] ATENCIÓN: No se encontró el archivo .key. Usando MOCK.`);
        const hash = crypto.createHash('sha256').update(xmlString).digest('base64');
        selloDigital = 'MOCK' + hash.substring(0, 40);
    } else {
        const cadenaOriginal = await generarCadenaOriginal(xmlString);
        console.log(`[CFDI Service] Cadena Original generada correctamente.`);

        const privKeyBuffer = fs.readFileSync(pathKey);
        const pki = forge.pki;
        const asn1 = forge.asn1.fromDer(privKeyBuffer.toString('binary'));
        const privateKeyInfo = pki.decryptPrivateKeyInfo(asn1, emisor.password_csd);

        if (!privateKeyInfo) {
            throw new Error("No se pudo desencriptar la llave. Verifica la contraseña.");
        }

        const privateKey = pki.privateKeyFromAsn1(privateKeyInfo);
        const md = forge.md.sha256.create();
        md.update(Buffer.from(cadenaOriginal, 'utf8').toString('binary'));
        const signature = privateKey.sign(md);
        selloDigital = forge.util.encode64(signature);

        // Registro de diagnóstico: Cadena Original
        try {
            const scratchDir = path.join(process.cwd(), 'scratch');
            if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir);
            fs.writeFileSync(path.join(scratchDir, 'ultima_cadena_original.txt'), cadenaOriginal);
        } catch (e) {}
    }

    doc.root().att('Sello', selloDigital);
    const finalXml = doc.end({ prettyPrint: false });

    // Guardar XML final firmado para diagnóstico
    try {
        const scratchDir = path.join(process.cwd(), 'scratch');
        fs.writeFileSync(path.join(scratchDir, 'ultimo_xml_firmado.xml'), finalXml);
    } catch (e) {}

    return finalXml;
};

export const getPacToken = () => {
    const raw = (process.env.PAC_PROFACT_USER || '').trim();
    if (!raw || raw === 'mvpNUXmQfK8=' || raw === 'WSDL_PAC_TEST') {
        return '4cIoBiE1v5day42PhbSKxA==';
    }
    return raw;
};

export const getPacRfcIntegrador = () => {
    const raw = (process.env.PAC_RFC_INTEGRADOR || '').trim();
    if (!raw) return 'LOMC791127F35';
    return raw;
};

/**
 * Determina el endpoint SOAP y el ambiente (Producción o Sandbox) del PAC Profact.
 * Si el token es de producción (como 4cIoBiE1v5day42PhbSKxA==), se conecta a producción fiscal.
 */
export const getPacEndpoint = (emisor = {}) => {
    const token = getPacToken();
    const envSetting = (process.env.PAC_ENV || '').toLowerCase().trim();

    // Si el usuario configuró explícitamente sandbox y usa usuario genérico de pruebas
    if ((envSetting === 'sandbox' || envSetting === 'pruebas') && token === 'WSDL_PAC_TEST') {
        return {
            isSandbox: true,
            pacUrl: 'https://pruebas.timbracfdi33.mx/Timbrado.asmx',
            modo: 'Sandbox'
        };
    }

    // El token de integrador oficial del usuario '4cIoBiE1v5day42PhbSKxA==' es de PRODUCCIÓN.
    // En sandbox este token no existe. Por tanto se direcciona siempre al servidor oficial:
    if (token === '4cIoBiE1v5day42PhbSKxA==' || envSetting === 'production' || envSetting === 'produccion') {
        return {
            isSandbox: false,
            pacUrl: 'https://timbracfdi33.mx:1443/Timbrado.asmx',
            modo: 'Producción'
        };
    }

    const isSandbox = Boolean(emisor?.modo_prueba);
    return {
        isSandbox,
        pacUrl: isSandbox ? 'https://pruebas.timbracfdi33.mx/Timbrado.asmx' : 'https://timbracfdi33.mx:1443/Timbrado.asmx',
        modo: isSandbox ? 'Sandbox' : 'Producción'
    };
};

export const timbrarPAC = async (xmlFirmado, emisor) => {
    console.log(`[CFDI Service] Iniciando timbrado SOAP con PAC Profact...`);
    const { isSandbox, pacUrl } = getPacEndpoint(emisor);
    const pacToken = getPacToken();
    
    // Limpieza estricta: asegurar que no haya el prólogo XML antes de Base64
    const xmlLimpio = xmlFirmado.replace(/^<\?xml.*?\?>\s*/, '').trim();
    const xmlBase64 = Buffer.from(xmlLimpio, 'utf-8').toString('base64');
    
    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><TimbraCFDI xmlns="http://tempuri.org/"><usuarioIntegrador>${pacToken}</usuarioIntegrador><xmlComprobanteBase64>${xmlBase64}</xmlComprobanteBase64><idComprobante></idComprobante></TimbraCFDI></s:Body></s:Envelope>`;

    try {
        const response = await axios.post(pacUrl, soapEnvelope, {
            headers: { 
                'Content-Type': 'text/xml;charset=UTF-8', 
                'SOAPAction': 'http://tempuri.org/TimbraCFDI' 
            },
            timeout: 30000
        });

        const resultJson = await parseStringPromise(response.data, { 
            explicitArray: false, 
            tagNameProcessors: [name => name.replace(/.*:/, '')] 
        });
        
        const body = resultJson.Envelope?.Body;
        const timbraResult = body?.TimbraCFDIResponse?.TimbraCFDIResult?.anyType;
        
        if (!timbraResult || !Array.isArray(timbraResult)) {
            // Manejar errores de SOAP Fault o respuestas vacías
            if (body?.Fault) {
                throw new Error(`PAC SOAP Fault: ${body.Fault.faultstring}`);
            }
            throw new Error('Respuesta malformada del PAC.');
        }

        const vals = timbraResult.map(item => (typeof item === 'object' ? item._ : item) || '');
        const tipo = (vals[0] || '').trim().toLowerCase();
        const codigo = (vals[1] || '').trim();
        const mensaje = (vals[2] || 'Sin mensaje').trim();

        if (tipo !== 'ok' && codigo !== '0') {
            throw new Error(`Profact PAC Error [${tipo.toUpperCase()} ${codigo}]: ${mensaje}`);
        }

        let finalXml = vals.find(v => typeof v === 'string' && (v.includes('<cfdi:Comprobante') || v.includes('<Comprobante')));
        if (!finalXml) throw new Error('El PAC no devolvió un XML timbrado.');

        const uuidMatch = finalXml.match(/UUID="([^"]+)"/);
        const finalUuid = uuidMatch ? uuidMatch[1] : `ERR-${Date.now()}`;
        const xmlPath = getXmlPath(emisor.rfc, finalUuid);
        fs.writeFileSync(xmlPath, finalXml, 'utf-8');

        return { 
            success: true, 
            uuid: finalUuid, 
            xmlTimbradoUrl: `/storage/${emisor.rfc}/xml/${finalUuid}.xml`,
            noCertificadoSAT: (finalXml.match(/NoCertificadoSAT="([^"]+)"/) || [])[1] || '',
            selloSAT: (finalXml.match(/SelloSAT="([^"]+)"/) || [])[1] || '',
            fechaTimbrado: (finalXml.match(/FechaTimbrado="([^"]+)"/) || [])[1] || new Date().toISOString()
        };
    } catch (error) {
        console.error('[CFDI Service] Error crítico en timbrarPAC:', error.message);
        throw error;
    }
};

/**
 * Consulta de folios / timbres disponibles del PAC Profact (SOAP ObtieneTimbresDisponibles)
 */
export const getCreditosDisponibles = async (emisor) => {
    const { isSandbox, pacUrl } = getPacEndpoint(emisor);
    const pacToken = getPacToken();
    
    if (!pacToken) {
        return { 
            success: false, 
            mensaje: 'No se ha configurado el usuario integrador del PAC.' 
        };
    }

    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ObtieneTimbresDisponibles xmlns="http://tempuri.org/"><usuarioIntegrador>${pacToken}</usuarioIntegrador><rfcEmisor>${emisor.rfc}</rfcEmisor></ObtieneTimbresDisponibles></s:Body></s:Envelope>`;
    
    try {
        const startTime = Date.now();
        const response = await axios.post(pacUrl, soapEnvelope, { 
            headers: { 
                'Content-Type': 'text/xml;charset=UTF-8', 
                'SOAPAction': 'http://tempuri.org/ObtieneTimbresDisponibles' 
            },
            timeout: 15000
        });
        const latencyMs = Date.now() - startTime;

        const resultJson = await parseStringPromise(response.data, { 
            explicitArray: false, 
            tagNameProcessors: [name => name.replace(/.*:/, '')] 
        });
        const resNode = resultJson.Envelope?.Body?.ObtieneTimbresDisponiblesResponse?.ObtieneTimbresDisponiblesResult?.anyType;
        
        if (!resNode) return { success: false, mensaje: 'Sin respuesta estructurada del PAC' };
        
        const vals = (Array.isArray(resNode) ? resNode : [resNode]).map(v => (typeof v === 'object' ? v._ : v) || '');
        const tipoCuenta = (vals[0] || '').trim();
        const codigo = (vals[1] || '').trim();
        const mensaje = (vals[2] || '').trim();

        const timbresTotales = parseInt(vals[3], 10) || 0;
        const timbresUsados = parseInt(vals[4], 10) || 0;
        const timbresDisponibles = parseInt(vals[5], 10) || parseInt(vals[3], 10) || 0;
        const timbresEmisor = parseInt(vals[6], 10) || 0;

        const isSuccess = codigo === '0' || tipoCuenta.toUpperCase() === 'OK' || tipoCuenta.toUpperCase() === 'INTEGRADORES';

        if (isSuccess && typeof emisor.update === 'function') {
            await emisor.update({ ultimos_folios_pac: timbresDisponibles }).catch(() => {});
        }

        return {
            success: isSuccess,
            creditos: timbresDisponibles,
            disponibles: timbresDisponibles,
            utilizados: timbresUsados,
            totales: timbresTotales,
            timbres_emisor: timbresEmisor,
            codigo,
            mensaje,
            tipo_cuenta: tipoCuenta || 'Integrador',
            modo_prueba: isSandbox,
            pac_nombre: 'PROFACT (PAC SAT Autorizado No. 58073)',
            pac_url: pacUrl,
            latencia_ms: latencyMs,
            emisor_rfc: emisor.rfc
        };
    } catch (error) {
        console.error('[CFDI Service] Error en getCreditosDisponibles:', error.message);
        return { 
            success: false, 
            mensaje: `Error al contactar con el PAC: ${error.message}`,
            pac_url: pacUrl,
            modo_prueba: isSandbox
        };
    }
};

/**
 * Registra o actualiza al emisor y su CSD en el PAC Profact (SOAP RegistraEmisor)
 */
export const registrarEmisorPAC = async (emisor, customPassword = null) => {
    const { isSandbox, pacUrl } = getPacEndpoint(emisor);
    const pacToken = getPacToken();

    if (!pacToken) {
        return { 
            success: false, 
            mensaje: 'No se ha configurado el usuario integrador del PAC.' 
        };
    }

    const cerPath = getCerPath(emisor.rfc);
    const keyPath = getKeyPath(emisor.rfc);

    if (!fs.existsSync(cerPath) || !fs.existsSync(keyPath)) {
        return {
            success: false,
            mensaje: `No se encontraron los archivos CSD físicos para el RFC ${emisor.rfc} en el servidor. Por favor carga el Certificado (.cer) y la Llave Privada (.key) en la pestaña "Certificados CSD" y presiona "Guardar Cambios" antes de registrar en el PAC.`
        };
    }

    const passwordCsd = (customPassword && customPassword.trim()) || (emisor.password_csd && emisor.password_csd.trim());
    if (!passwordCsd) {
        return {
            success: false,
            mensaje: 'Se requiere la contraseña de la llave privada CSD para registrar al emisor en el PAC. Ingrésala en el campo de contraseña antes de confirmar.'
        };
    }

    const cerBase64 = fs.readFileSync(cerPath).toString('base64');
    const keyBase64 = fs.readFileSync(keyPath).toString('base64');

    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><RegistraEmisor xmlns="http://tempuri.org/"><usuarioIntegrador>${pacToken}</usuarioIntegrador><rfcEmisor>${emisor.rfc}</rfcEmisor><base64Cer>${cerBase64}</base64Cer><base64Key>${keyBase64}</base64Key><contrasena>${passwordCsd}</contrasena></RegistraEmisor></s:Body></s:Envelope>`;

    try {
        console.log(`[CFDI Service] Registrando emisor ${emisor.rfc} en el PAC (${isSandbox ? 'Sandbox' : 'Producción'})...`);
        const response = await axios.post(pacUrl, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'http://tempuri.org/RegistraEmisor'
            },
            timeout: 30000
        });

        const resultJson = await parseStringPromise(response.data, {
            explicitArray: false,
            tagNameProcessors: [name => name.replace(/.*:/, '')]
        });

        const resNode = resultJson.Envelope?.Body?.RegistraEmisorResponse?.RegistraEmisorResult?.anyType;
        if (!resNode) {
            return { success: false, mensaje: 'Respuesta vacía del PAC al registrar emisor.' };
        }

        const vals = (Array.isArray(resNode) ? resNode : [resNode]).map(v => (typeof v === 'object' ? v._ : v) || '');
        const tipo = (vals[0] || '').trim();
        const codigo = (vals[1] || '').trim();
        const mensaje = (vals[2] || 'Emisor registrado satisfactoriamente en el PAC.').trim();

        const isSuccess = codigo === '0' || tipo.toUpperCase() === 'OK' || tipo.toUpperCase() === 'INTEGRADORES';

        if (isSuccess) {
            if (typeof emisor.update === 'function') {
                await emisor.update({
                    registrado_pac: true,
                    fecha_registro_pac: new Date(),
                    password_csd: passwordCsd
                }).catch(() => {});
            }
            return {
                success: true,
                mensaje: `El emisor ${emisor.rfc} fue registrado exitosamente en el PAC. Ya está facultado para emitir y timbrar facturas CFDI 4.0.`,
                codigo,
                tipo,
                fecha_registro: new Date()
            };
        } else {
            return {
                success: false,
                mensaje: `PAC Error [${codigo}]: ${mensaje}`,
                codigo,
                tipo
            };
        }
    } catch (error) {
        console.error('[CFDI Service] Error en registrarEmisorPAC:', error.message);
        return {
            success: false,
            mensaje: `Error de conexión con el PAC: ${error.message}`
        };
    }
};

/**
 * Asigna una cantidad de timbres al emisor en el PAC (SOAP AsignaTimbresEmisor)
 */
export const asignarTimbresPAC = async (emisor, noTimbres) => {
    const { isSandbox, pacUrl } = getPacEndpoint(emisor);
    const pacToken = getPacToken();

    const cant = parseInt(noTimbres, 10);
    if (!cant || cant <= 0) {
        return { success: false, mensaje: 'La cantidad de timbres a asignar debe ser un número entero mayor a 0.' };
    }

    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><AsignaTimbresEmisor xmlns="http://tempuri.org/"><usuarioIntegrador>${pacToken}</usuarioIntegrador><rfcEmisor>${emisor.rfc}</rfcEmisor><noTimbres>${cant}</noTimbres></AsignaTimbresEmisor></s:Body></s:Envelope>`;

    try {
        const response = await axios.post(pacUrl, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'http://tempuri.org/AsignaTimbresEmisor'
            },
            timeout: 20000
        });

        const resultJson = await parseStringPromise(response.data, {
            explicitArray: false,
            tagNameProcessors: [name => name.replace(/.*:/, '')]
        });

        const resNode = resultJson.Envelope?.Body?.AsignaTimbresEmisorResponse?.AsignaTimbresEmisorResult?.anyType;
        if (!resNode) return { success: false, mensaje: 'Sin respuesta del PAC al asignar timbres.' };

        const vals = (Array.isArray(resNode) ? resNode : [resNode]).map(v => (typeof v === 'object' ? v._ : v) || '');
        const codigo = (vals[1] || '').trim();
        const mensaje = (vals[2] || '').trim();
        const isSuccess = codigo === '0' || (vals[0] || '').toUpperCase() === 'OK';

        return {
            success: isSuccess,
            mensaje: isSuccess ? `Se asignaron correctamente ${cant} timbres al emisor ${emisor.rfc} en el PAC.` : `Error PAC [${codigo}]: ${mensaje}`,
            codigo
        };
    } catch (error) {
        return { success: false, mensaje: `Error al asignar timbres en PAC: ${error.message}` };
    }
};

/**
 * Consulta el estatus ante el SAT directamente mediante el PAC (SOAP ConsultaEstatusSat)
 */
export const consultarStatusSatPAC = async (emisor, folioUUID) => {
    const { isSandbox, pacUrl } = getPacEndpoint(emisor);
    const pacToken = getPacToken();

    if (!folioUUID) {
        return { success: false, mensaje: 'Se requiere el Folio Fiscal (UUID) a consultar.' };
    }

    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ConsultaEstatusSat xmlns="http://tempuri.org/"><usuarioIntegrador>${pacToken}</usuarioIntegrador><folioUUID>${folioUUID.trim()}</folioUUID></ConsultaEstatusSat></s:Body></s:Envelope>`;

    try {
        const response = await axios.post(pacUrl, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'http://tempuri.org/ConsultaEstatusSat'
            },
            timeout: 20000
        });

        const resultJson = await parseStringPromise(response.data, {
            explicitArray: false,
            tagNameProcessors: [name => name.replace(/.*:/, '')]
        });

        const resNode = resultJson.Envelope?.Body?.ConsultaEstatusSatResponse?.ConsultaEstatusSatResult?.anyType;
        if (!resNode) return { success: false, mensaje: 'Sin respuesta del PAC.' };

        const vals = (Array.isArray(resNode) ? resNode : [resNode]).map(v => (typeof v === 'object' ? v._ : v) || '');
        return {
            success: true,
            uuid: folioUUID,
            estado_sat: vals[0] || 'Vigente',
            codigo_estatus: vals[1] || '',
            es_cancelable: vals[2] || '',
            estatus_cancelacion: vals[3] || '',
            detalles: vals
        };
    } catch (error) {
        return { success: false, mensaje: `Error consultando estatus SAT en el PAC: ${error.message}` };
    }
};

/**
 * Consulta peticiones pendientes de cancelación en el SAT (SOAP ConsultaPeticionesPendientesCFDI)
 */
export const consultarPeticionesPendientesPAC = async (emisor) => {
    const { isSandbox, pacUrl } = getPacEndpoint(emisor);
    const pacToken = getPacToken();

    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ConsultaPeticionesPendientesCFDI xmlns="http://tempuri.org/"><usuarioIntegrador>${pacToken}</usuarioIntegrador><rfcReceptor>${emisor.rfc}</rfcReceptor></ConsultaPeticionesPendientesCFDI></s:Body></s:Envelope>`;

    try {
        const response = await axios.post(pacUrl, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'http://tempuri.org/ConsultaPeticionesPendientesCFDI'
            },
            timeout: 20000
        });

        const resultJson = await parseStringPromise(response.data, {
            explicitArray: false,
            tagNameProcessors: [name => name.replace(/.*:/, '')]
        });

        const resNode = resultJson.Envelope?.Body?.ConsultaPeticionesPendientesCFDIResponse?.ConsultaPeticionesPendientesCFDIResult?.anyType;
        const vals = resNode ? (Array.isArray(resNode) ? resNode : [resNode]).map(v => (typeof v === 'object' ? v._ : v) || '') : [];

        const peticiones = vals.filter(v => v && typeof v === 'string' && v.length > 10 && v.includes('-'));

        return {
            success: true,
            emisor_rfc: emisor.rfc,
            peticiones,
            total_pendientes: peticiones.length,
            raw: vals
        };
    } catch (error) {
        return { success: false, mensaje: `Error consultando peticiones: ${error.message}`, peticiones: [] };
    }
};

/**
 * Diagnóstico y prueba de conectividad con el PAC (Ping & Latencia)
 */
export const testConexionPACService = async (emisor) => {
    const { isSandbox, pacUrl } = getPacEndpoint(emisor);
    const pacToken = getPacToken();

    const startTime = Date.now();
    try {
        const response = await axios.get(`${pacUrl}?WSDL`, { timeout: 8000 });
        const latencyMs = Date.now() - startTime;

        return {
            success: response.status === 200,
            pac_nombre: 'PROFACT (PAC SAT Autorizado No. 58073)',
            pac_url: pacUrl,
            modo: isSandbox ? 'Pruebas / Sandbox' : 'Producción',
            latencia_ms: latencyMs,
            token_configurado: !!pacToken,
            token_length: pacToken ? pacToken.length : 0,
            servicios_activos: ['Timbrado CFDI 4.0', 'Obtiene Timbres', 'Registro de Emisores', 'Cancelación SAT']
        };
    } catch (error) {
        return {
            success: false,
            pac_nombre: 'PROFACT',
            pac_url: pacUrl,
            error: error.message,
            latencia_ms: Date.now() - startTime
        };
    }
};


export const generarXMLPago = async (pago, emisor, receptor, doctosRelacionados) => {
    console.log(`[CFDI Service] Generando XML Pago 2.0 (Deep Fix V3.1) para Pago ID: ${pago.id}`);
    
    let noCertificado = '20001000000300022762', certificadoStr = '', nombreCertificado = null;
    const pathCert = getCerPath(emisor.rfc);
    if (fs.existsSync(pathCert)) {
        const info = extractCertInfo(fs.readFileSync(pathCert));
        if (info) { noCertificado = info.noCertificado; certificadoStr = info.certificado; nombreCertificado = info.nombreSujeto; }
    }

    const fechaPago = new Date(new Date(pago.fecha_pago).getTime() - new Date(pago.fecha_pago).getTimezoneOffset() * 60000).toISOString().substring(0, 19);
    const fechaComprobante = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 19);
    const montoTotal = parseFloat(pago.monto || 0);

    let totalTrasladosBaseIVA16_MXN = 0;
    let totalTrasladosImpuestoIVA16_MXN = 0;
    let totalTrasladosBaseIVA16_P = 0;
    let totalTrasladosImpuestoIVA16_P = 0;

    const mappedDoctosRel = doctosRelacionados.map(dr => {
        const doc = dr.Documento || {}, impPagado = parseFloat(dr.imp_pagado || 0), totalDoc = parseFloat(doc.total || 0), subtotalDoc = parseFloat(doc.subtotal || 0);
        let impTrasDoc = parseFloat(doc.total_impuestos_trasladados || 0);
        if (impTrasDoc === 0 && totalDoc > subtotalDoc) impTrasDoc = totalDoc - subtotalDoc;

        const ratio = totalDoc > 0 ? impPagado / totalDoc : 0;
        const baseDR = subtotalDoc * ratio, importeDR = impTrasDoc * ratio;
        const objDR = impTrasDoc > 0.01 ? '02' : '01';

        const baseDRRedondeada = parseFloat(roundDec(baseDR, 2));
        const importeDRRedondeado = parseFloat(roundDec(importeDR, 2));

        const equivalenciaDR = (dr.moneda_dr === pago.moneda) ? 1 : parseFloat(dr.equivalencia_dr || 1);
        const eqDR = dr.moneda_dr !== (pago.moneda || 'MXN') ? roundDec(equivalenciaDR, 6) : '1';

        if (objDR === '02') {
            // Conversión a moneda de pago
            const baseP = baseDRRedondeada / equivalenciaDR;
            const importeP = importeDRRedondeado / equivalenciaDR;

            totalTrasladosBaseIVA16_P += baseP;
            totalTrasladosImpuestoIVA16_P += importeP;

            // Conversión a MXN
            const tipoCambioP = (!pago.moneda || pago.moneda === 'MXN') ? 1 : parseFloat(pago.tipo_cambio || 1);
            totalTrasladosBaseIVA16_MXN += baseP * tipoCambioP;
            totalTrasladosImpuestoIVA16_MXN += importeP * tipoCambioP;
        }

        const node = {
            '@IdDocumento': doc.uuid, '@Serie': doc.serie || undefined, '@Folio': doc.folio || undefined, '@MonedaDR': dr.moneda_dr || 'MXN', '@EquivalenciaDR': eqDR, '@NumParcialidad': dr.num_parcialidad?.toString() || '1',
            '@ImpSaldoAnt': roundDec(dr.imp_saldo_ant, 2), '@ImpPagado': roundDec(dr.imp_pagado, 2), '@ImpSaldoInsoluto': roundDec(dr.imp_saldo_insoluto, 2), '@ObjetoImpDR': objDR
        };

        if (objDR === '02') {
            node['pago20:ImpuestosDR'] = { 
                'pago20:TrasladosDR': { 
                    'pago20:TrasladoDR': { 
                        '@BaseDR': roundDec(baseDRRedondeada, 2), 
                        '@ImpuestoDR': '002', 
                        '@TipoFactorDR': 'Tasa', 
                        '@TasaOCuotaDR': '0.160000', 
                        '@ImporteDR': roundDec(importeDRRedondeado, 2) 
                    } 
                } 
            };
        }
        return node;
    });

    const montoXmlRedondeadoStr = roundDec(montoTotal, 2);
    const montoMultiplicable = parseFloat(montoXmlRedondeadoStr);

    const cfdiObject = {
        'cfdi:Comprobante': {
            '@xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4', '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance', '@xmlns:pago20': 'http://www.sat.gob.mx/Pagos20',
            '@xsi:schemaLocation': 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/Pagos20 http://www.sat.gob.mx/sitio_internet/cfd/Pagos/Pagos20.xsd',
            '@Version': '4.0', '@Serie': pago.serie || 'P', '@Folio': pago.folio || pago.id.toString(), '@Fecha': fechaComprobante, '@Sello': '', '@NoCertificado': noCertificado, '@Certificado': certificadoStr,
            '@SubTotal': '0', '@Moneda': 'XXX', '@Total': '0', '@TipoDeComprobante': 'P', '@Exportacion': '01', '@LugarExpedicion': emisor.codigo_postal,
            'cfdi:Emisor': { '@Rfc': emisor.rfc, '@Nombre': emisor.razon_social, '@RegimenFiscal': emisor.regimen_fiscal },
            'cfdi:Receptor': { '@Rfc': receptor.rfc, '@Nombre': receptor.razon_social, '@DomicilioFiscalReceptor': receptor.codigo_postal, '@RegimenFiscalReceptor': receptor.regimen_fiscal, '@UsoCFDI': 'CP01' },
            'cfdi:Conceptos': { 'cfdi:Concepto': { '@ClaveProdServ': '84111506', '@Cantidad': '1', '@ClaveUnidad': 'ACT', '@Descripcion': 'Pago', '@ValorUnitario': '0', '@Importe': '0', '@ObjetoImp': '01' } },
            'cfdi:Complemento': {
                'pago20:Pagos': {
                    '@Version': '2.0',
                    'pago20:Totales': {
                        '@TotalTrasladosBaseIVA16': totalTrasladosImpuestoIVA16_MXN > 0.01 ? roundDec(totalTrasladosBaseIVA16_MXN, 2) : undefined,
                        '@TotalTrasladosImpuestoIVA16': totalTrasladosImpuestoIVA16_MXN > 0.01 ? roundDec(totalTrasladosImpuestoIVA16_MXN, 2) : undefined,
                        '@MontoTotalPagos': roundDec(montoMultiplicable * (pago.moneda !== 'MXN' ? parseFloat(pago.tipo_cambio || 1) : 1), 2)
                    },
                    'pago20:Pago': {
                        '@FechaPago': fechaPago, '@FormaDePagoP': pago.forma_pago || '03', '@MonedaP': pago.moneda || 'MXN', '@TipoCambioP': (!pago.moneda || pago.moneda === 'MXN') ? '1' : roundDec(pago.tipo_cambio || 1, 4), '@Monto': montoXmlRedondeadoStr, '@NumOperacion': pago.no_operacion || undefined, '@RfcEmisorCtaOrd': pago.rfc_emisor_cta_ord || undefined, '@NomBancoOrdExt': pago.nom_banco_ord_ext || undefined, '@CtaOrdenante': pago.cta_ordenante || undefined, '@RfcEmisorCtaBen': pago.rfc_emisor_cta_ben || undefined, '@CtaBeneficiario': pago.cta_beneficiario || undefined,
                        'pago20:DoctoRelacionado': mappedDoctosRel,
                        'pago20:ImpuestosP': totalTrasladosImpuestoIVA16_P > 0.01 ? { 
                            'pago20:TrasladosP': { 
                                'pago20:TrasladoP': { 
                                    '@BaseP': roundDec(totalTrasladosBaseIVA16_P, 6), 
                                    '@ImpuestoP': '002', 
                                    '@TipoFactorP': 'Tasa', 
                                    '@TasaOCuotaP': '0.160000', 
                                    '@ImporteP': roundDec(totalTrasladosImpuestoIVA16_P, 6) 
                                } 
                            } 
                        } : undefined
                    }
                }
            }
        }
    };

    const xmlString = create({ version: '1.0', encoding: 'UTF-8' }, cfdiObject).end({ prettyPrint: false });
    try { 
        const scratchDir = path.join(process.cwd(), 'scratch');
        if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir);
        fs.writeFileSync(path.join(scratchDir, 'ultimo_xml_generado.xml'), xmlString); 
    } catch (e) {}
    return xmlString;
};

export const generarXMLCartaPorte = async (documento, emisor, receptor, detalles, cpData) => {
    console.log(`[CFDI Service] Generando Carta Porte 3.1 para documento ID: ${documento.id}`);

    let noCertificado = '20001000000300022762', certificadoStr = '';
    const pathCert = getCerPath(emisor.rfc);
    if (fs.existsSync(pathCert)) {
        const info = extractCertInfo(fs.readFileSync(pathCert));
        if (info) { noCertificado = info.noCertificado; certificadoStr = info.certificado; }
    }

    const isIngreso = documento.tipo_comprobante === 'I';
    let subtotalXml = 0, descuentoXml = 0, totalTraslados = 0, totalRetenciones = 0, baseIVA16 = 0, totalRetISR = 0, totalRetIVA = 0;

    let conceptosArr = detalles.map(d => {
        const qty = parseFloat(d.cantidad || 0), price = parseFloat(d.valor_unitario || 0), disc = parseFloat(d.descuento || 0);
        const imp = parseFloat(roundDec(qty * price, 2)), descBase = parseFloat(roundDec(disc, 2));
        const base = parseFloat(roundDec(imp - descBase, 2));
        
        subtotalXml += imp; descuentoXml += descBase;

        const concept = {
            '@ClaveProdServ': d.Concepto?.clave_prod_serv || '01010101', '@NoIdentificacion': d.Concepto?.no_identificacion || d.id.toString(),
            '@Cantidad': roundDec(qty, 6), '@ClaveUnidad': d.Concepto?.clave_unidad || 'E48', '@Unidad': d.Concepto?.unidad || 'SERVICIO',
            '@Descripcion': d.Concepto?.descripcion || 'Servicio de Autotransporte', '@ValorUnitario': roundDec(price, 6), '@Importe': roundDec(imp, 2),
            '@Descuento': descBase > 0 ? roundDec(descBase, 2) : undefined, '@ObjetoImp': isIngreso ? (d.es_objeto_imp || '02') : '01'
        };

        if (isIngreso && concept['@ObjetoImp'] === '02') {
            const tasIva = base * 0.16;
            totalTraslados += tasIva; baseIVA16 += base;
            const tras = { '@Base': roundDec(base, 6), '@Impuesto': '002', '@TipoFactor': 'Tasa', '@TasaOCuota': roundTasa(0.16), '@Importe': roundDec(tasIva, 6) };
            
            const rets = [];
            if (d.retencion_iva) {
                const tr = 0.04;
                const ir = base * tr;
                rets.push({ '@Base': roundDec(base, 6), '@Impuesto': '002', '@TipoFactor': 'Tasa', '@TasaOCuota': roundTasa(tr), '@Importe': roundDec(ir, 6) });
                totalRetIVA += ir;
            }
            if (d.retencion_isr) {
                const tasaISR = parseFloat(d.retencion_isr_tasa || 0.10);
                const impISR = base * tasaISR;
                rets.push({ '@Base': roundDec(base, 6), '@Impuesto': '001', '@TipoFactor': 'Tasa', '@TasaOCuota': roundTasa(tasaISR), '@Importe': roundDec(impISR, 6) });
                totalRetISR += impISR;
            }
            concept['cfdi:Impuestos'] = { 'cfdi:Traslados': { 'cfdi:Traslado': tras }, 'cfdi:Retenciones': rets.length > 0 ? { 'cfdi:Retencion': rets } : undefined };
        }
        return concept;
    });

    // Validar que al menos haya un concepto (Requisito CFDI 4.0)
    if (conceptosArr.length === 0) {
        conceptosArr.push({
            '@ClaveProdServ': isIngreso ? '78101802' : '01010101', // Servicios de transporte de carga por carretera
            '@Cantidad': '1',
            '@ClaveUnidad': 'E48',
            '@Unidad': 'SERVICIO',
            '@Descripcion': isIngreso ? 'SERVICIO DE AUTOTRANSPORTE' : 'TRASLADO DE MERCANCIAS',
            '@ValorUnitario': '0.00',
            '@Importe': '0.00',
            '@ObjetoImp': isIngreso ? '02' : '01'
        });
    }

    totalRetenciones = parseFloat(roundDec(totalRetISR + totalRetIVA, 2));

    if (documento.ajuste_manual && conceptosArr.length > 0) {
        const diffSubtotal = parseFloat(documento.subtotal) - subtotalXml;
        const diffTraslados = parseFloat(documento.total_impuestos_trasladados) - totalTraslados;
        const diffRetenciones = parseFloat(documento.total_impuestos_retenidos) - totalRetenciones;

        const lastConcept = conceptosArr[conceptosArr.length - 1];

        // 1. Ajustar subtotal en el último concepto
        const lastImporte = parseFloat(lastConcept['@Importe']) + diffSubtotal;
        lastConcept['@Importe'] = roundDec(lastImporte, 2);
        
        const lastDesc = parseFloat(lastConcept['@Descuento'] || 0);
        const lastBase = parseFloat(roundDec(lastImporte - lastDesc, 2));

        subtotalXml = parseFloat(documento.subtotal);

        // 2. Ajustar los impuestos a nivel concepto
        if (lastConcept['cfdi:Impuestos']) {
            if (lastConcept['cfdi:Impuestos']['cfdi:Traslados'] && lastConcept['cfdi:Impuestos']['cfdi:Traslados']['cfdi:Traslado']) {
                const trasNode = lastConcept['cfdi:Impuestos']['cfdi:Traslados']['cfdi:Traslado'];
                const trasList = Array.isArray(trasNode) ? trasNode : [trasNode];
                const ivaTras = trasList.find(t => t['@Impuesto'] === '002') || trasList[0];
                if (ivaTras) {
                    ivaTras['@Base'] = roundDec(lastBase, 6);
                    if (ivaTras['@Importe'] !== undefined) {
                        const newImpAmt = parseFloat(ivaTras['@Importe']) + diffTraslados;
                        ivaTras['@Importe'] = roundDec(newImpAmt, 2);
                    }
                }
            }

            if (lastConcept['cfdi:Impuestos']['cfdi:Retenciones'] && lastConcept['cfdi:Impuestos']['cfdi:Retenciones']['cfdi:Retencion']) {
                const retNode = lastConcept['cfdi:Impuestos']['cfdi:Retenciones']['cfdi:Retencion'];
                const retList = Array.isArray(retNode) ? retNode : [retNode];
                const mainRet = retList.find(r => r['@Impuesto'] === '001') || retList.find(r => r['@Impuesto'] === '002') || retList[0];
                if (mainRet) {
                    mainRet['@Base'] = roundDec(lastBase, 6);
                    const newRetAmt = parseFloat(mainRet['@Importe']) + diffRetenciones;
                    mainRet['@Importe'] = roundDec(newRetAmt, 2);
                }
            }
        }

        // 3. Ajustar acumuladores globales
        totalTraslados = parseFloat(documento.total_impuestos_trasladados);
        totalRetenciones = parseFloat(documento.total_impuestos_retenidos);

        if (totalRetISR > 0 && totalRetIVA > 0) {
            totalRetISR += diffRetenciones;
        } else if (totalRetISR > 0) {
            totalRetISR = totalRetenciones;
        } else if (totalRetIVA > 0) {
            totalRetIVA = totalRetenciones;
        }
    }

    const totalC = documento.ajuste_manual ? parseFloat(documento.total) : parseFloat(roundDec(subtotalXml - descuentoXml + totalTraslados - totalRetenciones, 2));

    // Armado Complemento Carta Porte 3.1
    let ubicacionesCP = [];
    if(cpData.ubicaciones) {
        ubicacionesCP = cpData.ubicaciones.map((u, idx) => ({
                '@IDUbicacion': (u.tipo_ubicacion === 'Origen' ? 'OR' : 'DE') + (idx + 1).toString().padStart(6, '0'),
                '@TipoUbicacion': u.tipo_ubicacion === 'Origen' ? 'Origen' : 'Destino',
                '@RFCRemitenteDestinatario': u.rfc_remitente_destinatario || undefined, 
                '@NombreRemitenteDestinatario': u.nombre_remitente_destinatario || undefined,
                '@FechaHoraSalidaLlegada': u.fecha_hora_salida_llegada ? new Date(new Date(u.fecha_hora_salida_llegada).getTime() - new Date(u.fecha_hora_salida_llegada).getTimezoneOffset() * 60000).toISOString().substring(0, 19) : undefined,
                '@DistanciaRecorrida': u.tipo_ubicacion === 'Destino' ? roundDec(u.distancia_recorrida || 0, 2) : undefined,
                'cartaporte31:Domicilio': u.codigo_postal ? {
                    '@Calle': u.calle || 'CONOCIDO',
                    '@NumeroExterior': u.numero_exterior || undefined,
                    '@NumeroInterior': u.numero_interior || undefined,
                    '@Colonia': u.colonia ? u.colonia.toString().padStart(4, '0') : undefined,
                    '@Localidad': u.localidad || undefined,
                    '@Municipio': u.municipio ? u.municipio.toString().padStart(3, '0') : undefined, 
                    '@Estado': (u.estado || 'MEX').substring(0, 3).toUpperCase(),
                    '@Pais': u.pais || 'MEX', 
                    '@CodigoPostal': u.codigo_postal
                } : undefined
        }));
    }

    let mercanciasCP = [];
    if(cpData.mercancias) {
        mercanciasCP = cpData.mercancias.map(m => ({
            '@BienesTransp': (m.bienes_transp && m.bienes_transp.length === 8) ? m.bienes_transp : '01010101', 
            '@Descripcion': (m.descripcion || 'MERCANCIA').substring(0, 1000), 
            '@Cantidad': roundDec(m.cantidad || 1, 6),
            '@ClaveUnidad': (m.clave_unidad || 'H87').toUpperCase(), 
            '@Unidad': m.unidad || undefined, 
            '@PesoEnKg': roundDec(m.peso_en_kg || 1, 3),
            '@MaterialPeligroso': (m.material_peligroso === 'Sí' || m.material_peligroso === 'Si') ? 'Si' : 'No', 
            '@CveMaterialPeligroso': (m.material_peligroso === 'Sí' || m.material_peligroso === 'Si') ? m.cve_material_peligroso : undefined,
            '@Embalaje': (m.material_peligroso === 'Sí' || m.material_peligroso === 'Si') ? m.embalaje : undefined,
            '@ValorMercancia': m.valor_mercancia ? roundDec(m.valor_mercancia, 2) : undefined,
            '@Moneda': m.valor_mercancia ? (m.moneda || 'MXN') : undefined
        }));
    }

    if (mercanciasCP.length === 0) {
        mercanciasCP.push({
            '@BienesTransp': '01010101', '@Descripcion': 'MERCANCIA GENERICA', '@Cantidad': '1.000000',
            '@ClaveUnidad': 'E48', '@Unidad': 'SERVICIO', '@PesoEnKg': '1.000',
            '@MaterialPeligroso': 'No'
        });
    }

    let autotransporteCP = undefined;
    if(cpData.autotransporte) {
        const at = cpData.autotransporte;
        autotransporteCP = {
            '@PermSCT': (at.permiso_sct || 'TPXX00').toUpperCase(), '@NumPermisoSCT': at.num_permiso_sct || '000000',
            'cartaporte31:IdentificacionVehicular': {
                '@ConfigVehicular': (at.config_vehicular || 'VL').toUpperCase(), 
                '@PlacaVM': (at.placa_vm || '000AAA').replace(/-/g, '').toUpperCase(), 
                '@AnioModeloVM': at.anio_modelo_vm || '2024',
                '@PesoBrutoVehicular': roundDec(at.peso_bruto_vehicular || 20.00, 2)
            },
            'cartaporte31:Seguros': {
                '@AseguraRespCivil': (at.asegura_resp_civil || 'QUALITAS').toUpperCase(), 
                '@PolizaRespCivil': at.poliza_resp_civil || '000000'
            }
        };

        if (at.subtipo_remolque && at.placa_remolque) {
            autotransporteCP['cartaporte31:Remolques'] = {
                'cartaporte31:Remolque': {
                    '@SubTipoRem': at.subtipo_remolque.toUpperCase(),
                    '@Placa': at.placa_remolque.replace(/-/g, '').toUpperCase()
                }
            };
        }
    }

    if (!autotransporteCP) {
        autotransporteCP = {
            '@PermSCT': 'TPXX00', '@NumPermisoSCT': '000000',
            'cartaporte31:IdentificacionVehicular': { '@ConfigVehicular': 'VL', '@PlacaVM': '000AAA', '@AnioModeloVM': '2024', '@PesoBrutoVehicular': '20.00' },
            'cartaporte31:Seguros': { '@AseguraRespCivil': 'QUALITAS', '@PolizaRespCivil': '000000' }
        };
    }

    let figurasCP = undefined;
    if(cpData.figuras && cpData.figuras.length > 0) {
        figurasCP = cpData.figuras.map((f, idx) => {
            const figuraNode = {
                '@TipoFigura': f.tipo_figura || '01', 
                '@RFCFigura': f.rfc_figura, 
                '@NumLicencia': f.num_licencia, 
                '@NombreFigura': f.nombre_figura
            };
            
            if (f.codigo_postal) {
                figuraNode['cartaporte31:Domicilio'] = {
                    '@Calle': f.calle || 'CONOCIDO',
                    '@NumeroExterior': f.numero_exterior || undefined,
                    '@NumeroInterior': f.numero_interior || undefined,
                    '@Colonia': f.colonia ? f.colonia.toString().padStart(4, '0') : undefined,
                    '@Localidad': f.localidad || undefined,
                    '@Municipio': f.municipio ? f.municipio.toString().padStart(3, '0') : undefined, 
                    '@Estado': (f.estado || 'MEX').substring(0, 3).toUpperCase(),
                    '@Pais': f.pais || 'MEX', 
                    '@CodigoPostal': f.codigo_postal
                };
            }
            return figuraNode;
        });
    }

    if (!figurasCP || figurasCP.length === 0) {
        figurasCP = [{
            '@TipoFigura': '01', 
            '@RFCFigura': 'XAXX010101000', 
            '@NumLicencia': '0000000000', 
            '@NombreFigura': 'CHOFER GENERICO'
        }];
    }

    let total_dist = 0;
    const ubicacionesFinal = ubicacionesCP.map(u => {
        if(u['@DistanciaRecorrida'] !== undefined) {
            const d = parseFloat(u['@DistanciaRecorrida'] || 0);
            total_dist += d;
        }
        return u;
    });

    const cartaporteRoot = {
        '@Version': '3.1', 
        '@IdCCP': (cpData.idCCP || 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'.replace(/e/g, () => (Math.random() * 16 | 0).toString(16).toUpperCase())).replace(/^.{3}/, 'CCC'), 
        '@TranspInternac': cpData.transp_internac || 'No',
        '@TotalDistRec': cpData.transp_internac === 'No' ? roundDec(Math.max(total_dist, 0.1), 2) : undefined,
        'cartaporte31:Ubicaciones': { 'cartaporte31:Ubicacion': ubicacionesFinal },
        'cartaporte31:Mercancias': {
            '@PesoBrutoTotal': roundDec(Math.max(cpData.peso_bruto_total || 0, 1), 3), 
            '@PesoNetoTotal': cpData.peso_neto_total ? roundDec(Math.max(cpData.peso_neto_total, 1), 3) : undefined,
            '@UnidadPeso': cpData.unidad_peso || 'KGM',
            '@NumTotalMercancias': Math.max(cpData.num_total_mercancias || 0, mercanciasCP.length, 1),
            'cartaporte31:Mercancia': mercanciasCP,
            'cartaporte31:Autotransporte': autotransporteCP
        },
        'cartaporte31:FiguraTransporte': { 'cartaporte31:TiposFigura': figurasCP }
    };

    const cfdiObject = {
        'cfdi:Comprobante': {
            '@xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4', '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance', '@xmlns:cartaporte31': 'http://www.sat.gob.mx/CartaPorte31',
            '@xsi:schemaLocation': 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/CartaPorte31 http://www.sat.gob.mx/sitio_internet/cfd/CartaPorte/CartaPorte31.xsd',
            '@Version': '4.0', '@Serie': documento.serie || 'C', '@Folio': documento.folio || documento.id.toString(),
            '@Fecha': documento.fecha ? new Date(new Date(documento.fecha).getTime() - new Date(documento.fecha).getTimezoneOffset() * 60000).toISOString().substring(0, 19) : new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 19),
            '@Sello': '', '@FormaPago': isIngreso ? (documento.forma_pago || '01') : undefined, '@NoCertificado': noCertificado, '@Certificado': certificadoStr,
            '@SubTotal': roundDec(subtotalXml, 2), '@Descuento': descuentoXml > 0 ? roundDec(descuentoXml, 2) : undefined,
            '@Moneda': documento.moneda || (isIngreso ? 'MXN' : 'XXX'), '@TipoCambio': (documento.moneda !== 'MXN' && documento.moneda !== 'XXX') ? roundDec(documento.tipo_cambio || 1, 4) : undefined,
            '@Total': roundDec(totalC, 2), '@TipoDeComprobante': documento.tipo_comprobante, '@Exportacion': '01',
            '@MetodoPago': isIngreso ? (documento.metodo_pago || 'PUE') : undefined, '@LugarExpedicion': emisor.codigo_postal,
            'cfdi:Emisor': { '@Rfc': emisor.rfc, '@Nombre': emisor.razon_social, '@RegimenFiscal': emisor.regimen_fiscal },
            'cfdi:Receptor': { '@Rfc': receptor.rfc, '@Nombre': receptor.razon_social, '@DomicilioFiscalReceptor': receptor.codigo_postal, '@RegimenFiscalReceptor': receptor.regimen_fiscal, '@UsoCFDI': 'CP01' },
            'cfdi:Conceptos': { 'cfdi:Concepto': conceptosArr }
        }
    };

    if (totalTraslados > 0 || totalRetenciones > 0) {
        cfdiObject['cfdi:Comprobante']['cfdi:Impuestos'] = {
            '@TotalImpuestosRetenidos': totalRetenciones > 0 ? roundDec(totalRetenciones, 2) : undefined,
            '@TotalImpuestosTrasladados': totalTraslados > 0 ? roundDec(totalTraslados, 2) : undefined,
            'cfdi:Retenciones': totalRetenciones > 0 ? { 'cfdi:Retencion': [
                totalRetISR > 0 ? { '@Impuesto': '001', '@Importe': roundDec(totalRetISR, 2) } : null,
                totalRetIVA > 0 ? { '@Impuesto': '002', '@Importe': roundDec(totalRetIVA, 2) } : null
            ].filter(Boolean) } : undefined,
            'cfdi:Traslados': totalTraslados > 0 ? { 'cfdi:Traslado': { '@Base': roundDec(baseIVA16, 2), '@Impuesto': '002', '@TipoFactor': 'Tasa', '@TasaOCuota': roundTasa(0.16), '@Importe': roundDec(totalTraslados, 2) } } : undefined
        };
    }
    
    cfdiObject['cfdi:Comprobante']['cfdi:Complemento'] = { 'cartaporte31:CartaPorte': cartaporteRoot };

    const xmlDoc = create({ version: '1.0', encoding: 'UTF-8' }, cfdiObject);
    return xmlDoc.end({ prettyPrint: false });
};
