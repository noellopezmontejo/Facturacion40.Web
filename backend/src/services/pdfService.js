import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfiguracionEstilo, Pago, PagoDocumento, Documento, Emisor, Receptor } from '../models/index.js';
import { getPdfPath, STORAGE_BASE } from '../utils/storageHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Registro de Helpers de Handlebars
handlebars.registerHelper('substring', function (str, start, len) {
    if (str && typeof str === 'string') {
        return str.substring(start, len);
    }
    return '';
});

handlebars.registerHelper('formatDecimal', function (value, decimals) {
    if (value === undefined || value === null || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toFixed(decimals);
});

function numeroALetras(num) {
    const Unidades = (n) => ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'][n - 1];
    const Decenas = (n) => ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'][n - 1];
    const DiezAlDiecinueve = (n) => ['ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'][n - 1];
    const VeinteAlVeintinueve = (n) => ['VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'][n - 1];
    const Centenas = (n) => ['CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'][n - 1];

    const Seccion = (num, divisor, strSingular, strPlural) => {
        let cientos = Math.floor(num / 100);
        let resto = num % 100;
        let str = "";

        if (cientos > 0) {
            if (cientos === 1 && resto === 0) str = "CIEN ";
            else str = Centenas(cientos) + " ";
        }

        if (resto > 0) {
            if (resto < 10) str += Unidades(resto);
            else if (resto < 20) {
                if (resto === 10) str += "DIEZ";
                else str += DiezAlDiecinueve(resto - 10);
            } else if (resto < 30) {
                if (resto === 20) str += "VEINTE";
                else str += VeinteAlVeintinueve(resto - 20);
            } else {
                let dec = Math.floor(resto / 10);
                let uni = resto % 10;
                str += Decenas(dec);
                if (uni > 0) str += " Y " + Unidades(uni);
            }
        }

        if (num === 0) return "";
        if (num === 1) return str + " " + strSingular;
        return str + " " + strPlural;
    };

    let entero = Math.floor(num);
    let centavos = Math.round((num - entero) * 100);
    let strCentavos = (centavos < 10 ? "0" : "") + centavos + "/100 M.N.";

    if (entero === 0) return "CERO PESOS " + strCentavos;
    if (entero === 1) return Seccion(entero, 1, "PESO", "PESOS") + " " + strCentavos;

    let millones = Math.floor(entero / 1000000);
    let miles = Math.floor((entero % 1000000) / 1000);
    let cientos = entero % 1000;

    let strMillones = millones > 0 ? Seccion(millones, 1000000, "MILLON", "MILLONES") + " " : "";
    let strMiles = miles > 0 ? Seccion(miles, 1000, "MIL", "MIL") + " " : "";
    let strCientos = Seccion(cientos, 1, "", "") + " ";

    return (strMillones + strMiles + strCientos + " PESOS " + strCentavos).replace(/\s+/g, ' ').trim();
}

function getGoogleFontsLink(fontName) {
    const fonts = {
        'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700;900&display=swap',
        'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700;900&display=swap',
        'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;700;900&display=swap',
        'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;700;800&display=swap',
        'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap',
        'Outfit': 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700;900&display=swap',
        'Raleway': 'https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;700;900&display=swap'
    };
    return fonts[fontName] || null;
}

export const generarPDF = async (documento, emisor, receptor, detalles, overrides = null) => {

    console.log(`[PDF Service] Iniciando generación real para Documento ID: ${documento.id}`);

    try {
        // 1. Obtener estilos del emisor
        let baseEstilo = await ConfiguracionEstilo.findOne({ where: { emisor_id: emisor.id } });
        let estilo = baseEstilo ? baseEstilo.toJSON() : {
            color_primario: '#004481',
            color_secundario: '#123247',
            tipo_letra: 'Arial',
            layout_id: 'v1',
            template_mapping: null,
            logo_url: null
        };

        // Aplicar overrides si existen (para vista previa en vivo)
        if (overrides) {
            console.log('[PDF Service] Aplicando overrides de estilo para vista previa');
            estilo = { ...estilo, ...overrides };
        }

        // 2. Determinar qué plantilla usar
        let layoutId = estilo.layout_id || 'v1';
        let isPago = documento.tipo_comprobante === 'P';
        let templateFileName = isPago ? `payment_v1.html` : `invoice_${layoutId}.html`;

        if (estilo.template_mapping && documento.tipo_documento_id && !isPago) {
            const mappedLayout = estilo.template_mapping[documento.tipo_documento_id];
            if (mappedLayout) {
                templateFileName = `invoice_${mappedLayout}.html`;
                console.log(`[PDF Service] Usando plantilla mapeada: ${templateFileName} para Tipo Documento: ${documento.tipo_documento_id}`);
            }
        }

        const templatePath = path.join(__dirname, '..', 'templates', templateFileName);
        if (!fs.existsSync(templatePath)) {
            throw new Error(`La plantilla no existe en: ${templatePath}`);
        }

        console.log(`[PDF Service] Cargando plantilla desde: ${templatePath}`);
        const templateHtml = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(templateHtml);

        // 3. Preparar Datos para el Template
        console.log('[PDF Service] Preparando datos para el template...');
        let pagoInfo = null;
        let doctosRelacionados = [];
        if (isPago) {
            pagoInfo = await Pago.findOne({ where: { documento_rep_id: documento.id } });
            if (pagoInfo) {
                const rawDoctos = await PagoDocumento.findAll({
                    where: { pago_id: pagoInfo.id },
                    include: [{ model: Documento }]
                });

                doctosRelacionados = rawDoctos.map(dr => {
                    const drJson = dr.toJSON ? dr.toJSON() : { ...dr };
                    const doc = drJson.Documento || {};
                    const impPagado = parseFloat(drJson.imp_pagado || 0);
                    const totalDoc = parseFloat(doc.total || 0);
                    const subtotalDoc = parseFloat(doc.subtotal || 0);
                    
                    let impTrasDoc = parseFloat(doc.total_impuestos_trasladados || 0);
                    if (impTrasDoc === 0 && totalDoc > subtotalDoc) {
                        impTrasDoc = totalDoc - subtotalDoc;
                    }

                    const ratio = totalDoc > 0 ? impPagado / totalDoc : 0;
                    const baseDR = subtotalDoc * ratio;
                    const importeDR = impTrasDoc * ratio;

                    drJson.base_dr = baseDR.toFixed(2);
                    drJson.importe_dr = importeDR.toFixed(2);
                    drJson.tasa_dr = "0.16"; // Tasa estándar
                    drJson.impuesto_nombre = "IVA 16%";
                    drJson.has_tax = impTrasDoc > 0.01;

                    // Formatear montos para el PDF
                    drJson.imp_saldo_ant_form = parseFloat(drJson.imp_saldo_ant || 0).toFixed(2);
                    drJson.imp_pagado_form = parseFloat(drJson.imp_pagado || 0).toFixed(2);
                    drJson.imp_saldo_insoluto_form = parseFloat(drJson.imp_saldo_insoluto || 0).toFixed(2);

                    return drJson;
                });

                // Obtener descripción de forma de pago
                const results = await Documento.sequelize.query(
                    "SELECT Descripcion FROM CatFormaPagoSat WHERE c_FormaPago = ?",
                    { replacements: [pagoInfo.forma_pago], type: Documento.sequelize.QueryTypes.SELECT }
                );
                
                pagoInfo = pagoInfo.toJSON ? pagoInfo.toJSON() : { ...pagoInfo };
                pagoInfo.monto_form = parseFloat(pagoInfo.monto || 0).toFixed(2);
                if (results && results.length > 0) {
                    pagoInfo.forma_pago_desc = results[0].Descripcion;
                } else {
                    pagoInfo.forma_pago_desc = "No especificado";
                }
            }
        }

        // Generar URL para QR SAT
        let qrUrlBase64 = '';
        if (documento.uuid) {
            console.log('[PDF Service] Generando QR para UUID:', documento.uuid);
            try {
                const last8Sello = documento.sello ? documento.sello.substring(documento.sello.length - 8) : '';
                const satUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${documento.uuid}&re=${emisor.rfc}&rr=${receptor.rfc}&tt=${documento.total}&fe=${last8Sello}`;
                qrUrlBase64 = await QRCode.toDataURL(satUrl);
            } catch (qrErr) {
                console.error('[PDF Service] Error generando QR:', qrErr);
                // No detenemos el proceso si falla el QR
            }
        }

        // Resolver URL absoluta del logo si existe para incrustarlo en el PDF
        let logoDataUri = null;
        if (estilo.logo_url) {
            console.log('[PDF Service] Resolviendo logo:', estilo.logo_url);
            let fullLogoPath = null;

            if (estilo.logo_url.startsWith('http')) {
                try {
                    const urlObj = new URL(estilo.logo_url);
                    const relativePath = urlObj.pathname.replace('/storage/', '');
                    fullLogoPath = path.join(STORAGE_BASE, relativePath);
                } catch (urlErr) {
                    console.error('[PDF Service] URL de logo inválida:', estilo.logo_url);
                }
            } else if (estilo.logo_url.startsWith('/storage/')) {
                const relativePath = estilo.logo_url.replace('/storage/', '');
                fullLogoPath = path.join(STORAGE_BASE, relativePath);
            } else if (estilo.logo_url.startsWith('storage/')) {
                const relativePath = estilo.logo_url.replace('storage/', '');
                fullLogoPath = path.join(STORAGE_BASE, relativePath);
            }

            if (fullLogoPath && fs.existsSync(fullLogoPath)) {
                try {
                    const logoBuffer = fs.readFileSync(fullLogoPath);
                    const ext = path.extname(fullLogoPath).replace('.', '');
                    logoDataUri = `data:image/${ext};base64,${logoBuffer.toString('base64')}`;
                    console.log('[PDF Service] Logo cargado correctamente');
                } catch (err) {
                    console.error('[PDF Service] Error leyendo logo:', err);
                }
            } else {
                console.warn(`[PDF Service] No se pudo encontrar el logo físicamente en: ${fullLogoPath}`);
            }
        }

        // Calcular impuestos detallados (traslados y retenciones)
        const traslados = [];
        const retenciones = [];
        let totalTraslados = 0;
        let totalRetenciones = 0;

        let computedSubtotal = 0;
        detalles.forEach(det => {
            computedSubtotal += parseFloat(det.importe || 0);
        });

        detalles.forEach(det => {
            const base = parseFloat(det.importe) - parseFloat(det.descuento || 0);

            // IVA 16% (Simplificado para la representación impresa)
            const iva = base * 0.16;
            totalTraslados += iva;

            if (det.retencion_isr) {
                const isr = base * parseFloat(det.retencion_isr_tasa || 0.10);
                totalRetenciones += isr;
                retenciones.push({ impuesto: 'ISR', tasa: (det.retencion_isr_tasa * 100).toFixed(2), importe: isr.toFixed(2) });
            }
            if (det.retencion_iva) {
                const tasaIVA = 0.106667;
                const ivaRet = base * tasaIVA;
                totalRetenciones += ivaRet;
                retenciones.push({ impuesto: 'IVA Ret', tasa: (tasaIVA * 100).toFixed(2), importe: ivaRet.toFixed(2) });
            }
        });

        if (documento.ajuste_manual && detalles.length > 0) {
            const targetSubtotal = parseFloat(documento.subtotal || 0);
            const targetTraslados = parseFloat(documento.total_impuestos_trasladados || 0);
            const targetRetenciones = parseFloat(documento.total_impuestos_retenidos || 0);

            const diffSubtotal = targetSubtotal - computedSubtotal;
            const diffTraslados = targetTraslados - totalTraslados;
            const diffRetenciones = targetRetenciones - totalRetenciones;

            const lastDet = detalles[detalles.length - 1];
            const currentImp = parseFloat(lastDet.importe || 0);
            const adjustedImp = (currentImp + diffSubtotal).toFixed(6);

            if (lastDet.setDataValue) {
                lastDet.setDataValue('importe', adjustedImp);
            } else {
                lastDet.importe = adjustedImp;
            }

            totalTraslados = targetTraslados;
            totalRetenciones = targetRetenciones;

            if (retenciones.length > 0) {
                const mainRet = retenciones.find(r => r.impuesto === 'ISR') || retenciones[0];
                if (mainRet) {
                    mainRet.importe = (parseFloat(mainRet.importe) + diffRetenciones).toFixed(2);
                }
            }
        }

        // Procesar Impuestos Locales
        const trasladosLocales = [];
        const retencionesLocales = [];
        let totalTrasladosLocales = 0;
        let totalRetencionesLocales = 0;

        if (documento.impuestos_locales) {
            try {
                const il = typeof documento.impuestos_locales === 'string' ? JSON.parse(documento.impuestos_locales) : documento.impuestos_locales;
                if (il && il.traslados && Array.isArray(il.traslados)) {
                    il.traslados.forEach(t => {
                        const amt = parseFloat(t.importe || 0);
                        if (!isNaN(amt)) {
                            totalTrasladosLocales += amt;
                            trasladosLocales.push({ 
                                impuesto: t.impuesto || 'N/A', 
                                tasa: (parseFloat(t.tasa || 0) * 100).toFixed(2), 
                                importe: amt.toFixed(2) 
                            });
                        }
                    });
                }
                if (il && il.retenciones && Array.isArray(il.retenciones)) {
                    il.retenciones.forEach(r => {
                        const amt = parseFloat(r.importe || 0);
                        if (!isNaN(amt)) {
                            totalRetencionesLocales += amt;
                            retencionesLocales.push({ 
                                impuesto: r.impuesto || 'N/A', 
                                tasa: (parseFloat(r.tasa || 0) * 100).toFixed(2), 
                                importe: amt.toFixed(2) 
                            });
                        }
                    });
                }
            } catch (e) {
                console.error("[PDF Service] Error parsing impuestos_locales:", e);
            }
        }

        const data = {
            emisor: {
                ...(emisor.toJSON ? emisor.toJSON() : emisor),
                regimen_desc: emisor.regimen_desc || 'General de Ley Personas Morales'
            },
            receptor: {
                ...(receptor.toJSON ? receptor.toJSON() : receptor),
                regimen_desc: receptor.regimen_desc || 'Personas Físicas con Actividades Empresariales'
            },
            documento: {
                ...(documento.toJSON ? documento.toJSON() : documento),
                uso_desc: documento.uso_desc || 'Gastos en general',
                iva_total: totalTraslados.toFixed(2),
                total_retenciones: totalRetenciones.toFixed(2),
                total_traslados_locales: totalTrasladosLocales.toFixed(2),
                total_retenciones_locales: totalRetencionesLocales.toFixed(2),
                total_en_letra: numeroALetras(documento.total),
                fecha: documento.fecha ? new Date(documento.fecha).toLocaleString('es-MX') : new Date().toLocaleString('es-MX'),
                // Campos de certificación
                fecha_timbrado: documento.fecha_timbrado ? new Date(documento.fecha_timbrado).toLocaleString('es-MX') : '',
                no_certificado_emisor: documento.no_certificado_emisor,
                no_certificado_sat: documento.no_certificado_sat,
                sello_cfdi: documento.sello_cfdi,
                sello_sat: documento.sello_sat,
                cadena_original_tfd: documento.cadena_original_tfd
            },
            detalles: detalles.map(d => (d.toJSON ? d.toJSON() : d)),
            doctosRelacionados: doctosRelacionados.map(dr => (dr.toJSON ? dr.toJSON() : dr)),
            pago: pagoInfo ? (pagoInfo.toJSON ? pagoInfo.toJSON() : pagoInfo) : null,
            retenciones: retenciones,
            trasladosLocales: trasladosLocales,
            retencionesLocales: retencionesLocales,
            color_primario: estilo.color_primario,
            color_secundario: estilo.color_secundario,
            tipo_letra: estilo.tipo_letra,
            logo_url: logoDataUri,
            qr_url: qrUrlBase64,
            google_fonts_link: getGoogleFontsLink(estilo.tipo_letra)
        };


        // 3.5 Generar Estilos Modulares (Alternativa 3)
        let modularStyles = '';
        if (estilo.config_adicional) {
            console.log('[PDF Service] Generando estilos modulares personalizados');
            try {
                const config = typeof estilo.config_adicional === 'string' 
                    ? JSON.parse(estilo.config_adicional) 
                    : estilo.config_adicional;
                
                // Visibilidad
                if (config.visible_sections) {
                    Object.entries(config.visible_sections).forEach(([section, isVisible]) => {
                        if (!isVisible) {
                            modularStyles += `.section-${section} { display: none !important; }\n`;
                        }
                    });
                }
                
                // Orden (usando Flexbox)
                if (config.sections_order && config.sections_order.length > 0) {
                    modularStyles += `.modular-container { display: flex !important; flex-direction: column !important; }\n`;
                    config.sections_order.forEach((section, index) => {
                        modularStyles += `.section-${section} { order: ${index} !important; }\n`;
                    });
                }
                
                // Espaciado
                if (config.spacing) {
                    Object.entries(config.spacing).forEach(([section, value]) => {
                        modularStyles += `.section-${section} { margin-bottom: ${value}px !important; }\n`;
                    });
                }
            } catch (err) {
                console.error('[PDF Service] Error parseando config_adicional:', err);
            }
        }

        console.log('[PDF Service] Datos finales para template:', {
            docId: data.documento.id,
            total: data.documento.total,
            trasladosLocales: data.trasladosLocales,
            retencionesLocales: data.retencionesLocales,
            detallesCount: data.detalles.length
        });

        const html = template(data);
        
        // Inyectar estilos modulares antes del cierre de </head>
        const finalHtml = modularStyles 
            ? html.replace('</head>', `<style>${modularStyles}</style></head>`)
            : html;

        console.log('[PDF Service] HTML compilado con estilos modulares. Iniciando Puppeteer...');

        // 4. Renderizar con Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        try {
            const page = await browser.newPage();
            console.log('[PDF Service] Página de Puppeteer creada. Renderizando contenido...');
            await page.setContent(finalHtml, { waitUntil: 'networkidle2', timeout: 30000 });

            const pdfPath = getPdfPath(emisor.rfc, documento.uuid || documento.id);
            const folder = path.dirname(pdfPath);
            if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

            console.log(`[PDF Service] Generando PDF en: ${pdfPath}`);
            await page.pdf({
                path: pdfPath,
                format: 'A4',
                printBackground: true,
                margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
            });
            console.log('[PDF Service] PDF generado con éxito');
        } finally {
            await browser.close();
            console.log('[PDF Service] Navegador Puppeteer cerrado');
        }

        // 5. Retornar Resultado
        // Construir URL pública (asumiendo helpers existentes)
        const pdfUrl = `/storage/${emisor.rfc}/pdf/${documento.uuid || documento.id}.pdf`;

        return {
            success: true,
            pdfUrl,
            message: 'PDF generado exitosamente.'
        };

    } catch (error) {
        console.error('[PDF Service] Error Crítico:', error);
        throw new Error(`Fallo al generar el reporte PDF: ${error.message}`);
    }
};

export const generarPDFPagoPreview = async (emisorId, receptorId, paymentData, facturas) => {
    console.log(`[PDF Service] Iniciando generación de preview PDF para Emisor: ${emisorId}, Receptor: ${receptorId}`);
    try {
        const emisor = await Emisor.findByPk(emisorId);
        const receptor = await Receptor.findByPk(receptorId);
        if (!emisor || !receptor) throw new Error("Emisor o Receptor no encontrado");

        let baseEstilo = await ConfiguracionEstilo.findOne({ where: { emisor_id: emisorId } });
        let estilo = baseEstilo ? baseEstilo.toJSON() : {
            color_primario: '#004481',
            color_secundario: '#123247',
            tipo_letra: 'Arial',
            layout_id: 'v1',
            template_mapping: null,
            logo_url: null
        };

        const templateFileName = `payment_v1.html`;
        const templatePath = path.join(__dirname, '..', 'templates', templateFileName);
        if (!fs.existsSync(templatePath)) {
            throw new Error(`La plantilla no existe en: ${templatePath}`);
        }

        const templateHtml = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(templateHtml);

        const doctosRelacionados = [];
        for (const f of facturas) {
            const doc = await Documento.findByPk(f.documento_id);
            if (!doc) continue;
            
            const impPagado = parseFloat(f.monto_aplicado || 0);
            const totalDoc = parseFloat(doc.total || 0);
            const subtotalDoc = parseFloat(doc.subtotal || 0);
            
            let impTrasDoc = parseFloat(doc.total_impuestos_trasladados || 0);
            if (impTrasDoc === 0 && totalDoc > subtotalDoc) {
                impTrasDoc = totalDoc - subtotalDoc;
            }

            const ratio = totalDoc > 0 ? impPagado / totalDoc : 0;
            const baseDR = subtotalDoc * ratio;
            const importeDR = impTrasDoc * ratio;

            doctosRelacionados.push({
                Documento: doc.toJSON ? doc.toJSON() : doc,
                imp_saldo_ant_form: parseFloat(f.saldo_anterior || 0).toFixed(2),
                imp_pagado_form: impPagado.toFixed(2),
                imp_saldo_insoluto_form: parseFloat(f.saldo_insoluto || 0).toFixed(2),
                num_parcialidad: f.num_parcialidad || 1,
                moneda_dr: doc.moneda,
                equivalencia_dr: 1,
                base_dr: baseDR.toFixed(2),
                importe_dr: importeDR.toFixed(2),
                tasa_dr: "0.16",
                impuesto_nombre: "IVA 16%",
                has_tax: impTrasDoc > 0.01
            });
        }

        let formaPagoDesc = "Efectivo";
        try {
            const results = await Documento.sequelize.query(
                "SELECT Descripcion FROM CatFormaPagoSat WHERE c_FormaPago = ?",
                { replacements: [paymentData.forma_pago || '01'], type: Documento.sequelize.QueryTypes.SELECT }
            );
            if (results && results.length > 0) {
                formaPagoDesc = results[0].Descripcion;
            }
        } catch (err) {}

        const pagoInfo = {
            fecha_pago: paymentData.fecha_pago,
            forma_pago: paymentData.forma_pago,
            forma_pago_desc: formaPagoDesc,
            moneda: paymentData.moneda || 'MXN',
            tipo_cambio: paymentData.tipo_cambio || 1,
            monto_form: parseFloat(paymentData.monto || 0).toFixed(2),
            no_operacion: paymentData.no_operacion || '',
            cta_ordenante: paymentData.cta_ordenante || '',
            cta_beneficiario: paymentData.cta_beneficiario || ''
        };

        let logoDataUri = null;
        if (estilo.logo_url) {
            let fullLogoPath = null;
            if (estilo.logo_url.startsWith('http')) {
                try {
                    const urlObj = new URL(estilo.logo_url);
                    const relativePath = urlObj.pathname.replace('/storage/', '');
                    fullLogoPath = path.join(STORAGE_BASE, relativePath);
                } catch (urlErr) {}
            } else if (estilo.logo_url.startsWith('/storage/')) {
                const relativePath = estilo.logo_url.replace('/storage/', '');
                fullLogoPath = path.join(STORAGE_BASE, relativePath);
            } else if (estilo.logo_url.startsWith('storage/')) {
                const relativePath = estilo.logo_url.replace('storage/', '');
                fullLogoPath = path.join(STORAGE_BASE, relativePath);
            }

            if (fullLogoPath && fs.existsSync(fullLogoPath)) {
                try {
                    const logoBuffer = fs.readFileSync(fullLogoPath);
                    const ext = path.extname(fullLogoPath).replace('.', '');
                    logoDataUri = `data:image/${ext};base64,${logoBuffer.toString('base64')}`;
                } catch (err) {}
            }
        }

        const data = {
            emisor: {
                ...(emisor.toJSON ? emisor.toJSON() : emisor),
                regimen_desc: emisor.regimen_desc || 'General de Ley Personas Morales'
            },
            receptor: {
                ...(receptor.toJSON ? receptor.toJSON() : receptor),
                regimen_desc: receptor.regimen_desc || 'Personas Físicas con Actividades Empresariales'
            },
            documento: {
                id: 'PREVIEW',
                tipo_comprobante: 'P',
                serie: 'P',
                folio: 'PREVIEW',
                fecha: new Date().toISOString(),
                total: parseFloat(paymentData.monto || 0),
                total_en_letra: numeroALetras(parseFloat(paymentData.monto || 0)),
                uuid: 'VISTA-PREVIA-NO-VALIDA-PARA-SAT',
                fecha_timbrado: '',
                no_certificado_emisor: '00000000000000000000',
                no_certificado_sat: '',
                sello_cfdi: '',
                sello_sat: '',
                cadena_original_tfd: ''
            },
            detalles: [{
                clave_prod_serv: '84111506',
                cantidad: 1,
                clave_unidad: 'ACT',
                descripcion: 'Pago',
                valor_unitario: 0,
                importe: 0
            }],
            doctosRelacionados,
            pago: pagoInfo,
            retenciones: [],
            trasladosLocales: [],
            retencionesLocales: [],
            color_primario: estilo.color_primario,
            color_secundario: estilo.color_secundario,
            tipo_letra: estilo.tipo_letra,
            logo_url: logoDataUri,
            qr_url: '',
            google_fonts_link: getGoogleFontsLink(estilo.tipo_letra)
        };

        const html = template(data);
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
            });
            return pdfBuffer;
        } finally {
            await browser.close();
        }
    } catch (error) {
        console.error('[PDF Service] Error en preview PDF:', error);
        throw error;
    }
};
