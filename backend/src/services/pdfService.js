import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfiguracionEstilo, Pago, PagoDocumento, Documento, Emisor, Receptor } from '../models/index.js';
import { getPdfPath, STORAGE_BASE, getEmissorDir } from '../utils/storageHelper.js';

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

export const getPuppeteerLaunchOptions = () => {
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--hide-scrollbars',
        '--mute-audio'
    ];

    const options = {
        headless: 'new',
        args
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else if (process.platform === 'linux') {
        const commonPaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/snap/bin/chromium'
        ];
        for (const p of commonPaths) {
            if (fs.existsSync(p)) {
                options.executablePath = p;
                break;
            }
        }
    }

    return options;
};

export const createPrintableHtml = (htmlContent, title = 'CFDI 4.0 - Representación Impresa') => {
    const printToolbar = `
    <div class="net-preview-toolbar no-print" style="position: sticky; top: 0; z-index: 999999; background: #0f172a; color: #f8fafc; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 20px rgba(0,0,0,0.25); font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border-bottom: 2px solid #0284c7;">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: linear-gradient(135deg, #0284c7, #0369a1); width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: white; box-shadow: 0 2px 8px rgba(2,132,199,0.4);">
                N
            </div>
            <div>
                <div style="font-weight: 700; font-size: 14px; letter-spacing: 0.5px; color: #ffffff;">NET CONSULTORES</div>
                <div style="font-size: 11px; color: #94a3b8;">\${title} &bull; Modo Imprimible (Calidad Vectorial)</div>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <button onclick="window.print()" style="background: linear-gradient(135deg, #0284c7, #0ea5e9); color: white; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(2,132,199,0.3); transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir / Guardar como PDF
            </button>
            <button onclick="window.close()" style="background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                Cerrar
            </button>
        </div>
    </div>
    `;

    const printStyles = `
    <style>
        @media print {
            .net-preview-toolbar, .no-print { display: none !important; }
            body { margin: 0 !important; padding: 0 !important; background: white !important; }
            @page { size: A4; margin: 0; }
        }
        @media screen {
            body { background-color: #f1f5f9 !important; padding-bottom: 40px !important; }
            .invoice-box, .container, .page, .page-container {
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08) !important;
                margin: 20px auto !important;
                background-color: #ffffff !important;
            }
        }
    </style>
    `;

    let processed = htmlContent;
    if (processed.includes('</head>')) {
        processed = processed.replace('</head>', `\${printStyles}</head>`);
    } else {
        processed = `\${printStyles}\${processed}`;
    }

    if (processed.includes('<body')) {
        processed = processed.replace(/<body[^>]*>/, (match) => `\${match}\n\${printToolbar}`);
    } else {
        processed = `\${printToolbar}\n\${processed}`;
    }

    return processed;
};

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

        let templatePath = path.join(__dirname, '..', 'templates', templateFileName);
        if (!fs.existsSync(templatePath)) {
            console.warn(`[PDF Service] La plantilla ${templateFileName} no existe en: ${templatePath}. Usando plantilla v1 por defecto.`);
            templateFileName = isPago ? 'payment_v1.html' : 'invoice_v1.html';
            templatePath = path.join(__dirname, '..', 'templates', templateFileName);
        }
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

        console.log('[PDF Service] HTML compilado con estilos modulares.');

        // 4. Preparar rutas de salida y fallback HTML imprimible
        const rfcSafe = (emisor && emisor.rfc) ? emisor.rfc.trim().toUpperCase() : 'GENERICO';
        const uuidSafe = documento.uuid || documento.id || `preview-${Date.now()}`;
        const pdfDir = getEmissorDir(rfcSafe, 'pdf');
        const pdfFileName = `${uuidSafe}.pdf`;
        const htmlFileName = `${uuidSafe}.html`;
        const pdfPath = path.join(pdfDir, pdfFileName);
        const htmlPath = path.join(pdfDir, htmlFileName);

        // Guardar representación HTML imprimible enriquecida con la barra Net Consultores
        const printableHtml = createPrintableHtml(finalHtml, 'Factura CFDI 4.0');
        try {
            fs.writeFileSync(htmlPath, printableHtml, 'utf8');
            console.log(`[PDF Service] Respaldo HTML imprimible guardado en: ${htmlPath}`);
        } catch (htmlSaveErr) {
            console.warn('[PDF Service] No se pudo guardar archivo HTML:', htmlSaveErr.message);
        }

        let pdfGenerated = false;

        // Intentar renderizar PDF binario con Puppeteer
        try {
            console.log('[PDF Service] Intentando renderizar PDF con Puppeteer...');
            const launchOptions = getPuppeteerLaunchOptions();
            const browser = await puppeteer.launch(launchOptions);

            try {
                const page = await browser.newPage();
                console.log('[PDF Service] Página de Puppeteer creada. Renderizando contenido...');
                await page.setContent(finalHtml, { waitUntil: 'networkidle2', timeout: 25000 });

                console.log(`[PDF Service] Generando PDF binario en: ${pdfPath}`);
                await page.pdf({
                    path: pdfPath,
                    format: 'A4',
                    printBackground: true,
                    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
                });
                pdfGenerated = true;
                console.log('[PDF Service] PDF binario generado con éxito');
            } finally {
                await browser.close().catch(() => {});
                console.log('[PDF Service] Navegador Puppeteer cerrado');
            }
        } catch (puppeteerErr) {
            console.warn(`[PDF Service] Puppeteer no está disponible o falló en este entorno (${puppeteerErr.message}). Utilizando representación HTML imprimible de alta fidelidad como respaldo.`);
        }

        // 5. Retornar Resultado
        const chosenUrl = pdfGenerated 
            ? `/storage/${rfcSafe}/pdf/${pdfFileName}` 
            : `/storage/${rfcSafe}/pdf/${htmlFileName}`;

        return {
            success: true,
            pdfUrl: chosenUrl,
            htmlUrl: `/storage/${rfcSafe}/pdf/${htmlFileName}`,
            isHtmlFallback: !pdfGenerated,
            message: pdfGenerated ? 'PDF generado exitosamente.' : 'Vista previa HTML imprimible generada con éxito.'
        };

    } catch (error) {
        console.error('[PDF Service] Error Crítico:', error);
        // Fallback de emergencia si ocurrió un error previo
        try {
            const rfcSafe = (emisor && emisor.rfc) ? emisor.rfc.trim().toUpperCase() : 'GENERICO';
            const uuidSafe = documento?.uuid || documento?.id || `preview-${Date.now()}`;
            const pdfDir = getEmissorDir(rfcSafe, 'pdf');
            const emergencyHtmlPath = path.join(pdfDir, `${uuidSafe}.html`);
            const fallbackContent = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>Vista Previa - CFDI</title></head>
            <body style="font-family:system-ui,-apple-system,sans-serif;padding:30px;color:#334155;background:#f8fafc;">
                <div style="max-width:600px;margin:40px auto;background:white;padding:30px;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                    <h2 style="color:#0284c7;margin-top:0;">Net Consultores - Vista Previa</h2>
                    <p>No se pudo generar la representación completa debido al siguiente detalle:</p>
                    <pre style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto;">${error.message}</pre>
                    <p style="font-size:13px;color:#64748b;">Por favor verifica la configuración del emisor y los conceptos.</p>
                </div>
            </body>
            </html>`;
            fs.writeFileSync(emergencyHtmlPath, fallbackContent, 'utf8');
            return {
                success: true,
                pdfUrl: `/storage/${rfcSafe}/pdf/${uuidSafe}.html`,
                isHtmlFallback: true,
                message: error.message
            };
        } catch (emergencyErr) {
            throw new Error(`Fallo al generar el reporte PDF: ${error.message}`);
        }
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
        const printableHtml = createPrintableHtml(html, 'Complemento de Pago (REP)');

        try {
            console.log('[PDF Service] Intentando renderizar PDF para pago con Puppeteer...');
            const launchOptions = getPuppeteerLaunchOptions();
            const browser = await puppeteer.launch(launchOptions);

            try {
                const page = await browser.newPage();
                await page.setContent(html, { waitUntil: 'networkidle2', timeout: 25000 });
                const pdfBuffer = await page.pdf({
                    format: 'A4',
                    printBackground: true,
                    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
                });
                return {
                    isHtml: false,
                    data: pdfBuffer
                };
            } finally {
                await browser.close().catch(() => {});
            }
        } catch (puppeteerErr) {
            console.warn(`[PDF Service] Puppeteer no disponible para preview de pago (${puppeteerErr.message}). Utilizando HTML imprimible.`);
            return {
                isHtml: true,
                data: Buffer.from(printableHtml, 'utf8')
            };
        }
    } catch (error) {
        console.error('[PDF Service] Error en preview PDF:', error);
        throw error;
    }
};
