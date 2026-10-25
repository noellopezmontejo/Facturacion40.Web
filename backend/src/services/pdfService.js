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

handlebars.registerHelper('formatCurrency', function (value, decimals = 2) {
    if (value === undefined || value === null || value === '') return '$0.00';
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
});

handlebars.registerHelper('eq', function (a, b) {
    return a === b;
});

handlebars.registerHelper('or', function (a, b) {
    return a || b;
});

// Catálogos Oficiales SAT para CFDI 4.0
export const CAT_REGIMEN_FISCAL = {
    '601': 'General de Ley Personas Morales',
    '603': 'Personas Morales con Fines no Lucrativos',
    '605': 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
    '606': 'Arrendamiento',
    '607': 'Régimen de Enajenación o Adquisición de Bienes',
    '608': 'Demás ingresos',
    '610': 'Residentes en el Extranjero sin Establecimiento Permanente en México',
    '611': 'Ingresos por Dividendos (socios y accionistas)',
    '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
    '614': 'Ingresos por intereses',
    '615': 'Régimen de los ingresos por obtención de premios',
    '616': 'Sin obligaciones fiscales',
    '620': 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
    '621': 'Incorporación Fiscal',
    '622': 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    '623': 'Opcional para Grupos de Sociedades',
    '624': 'Coordinados',
    '625': 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    '626': 'Régimen Simplificado de Confianza (RESICO)'
};

export const CAT_FORMA_PAGO = {
    '01': 'Efectivo',
    '02': 'Cheque nominativo',
    '03': 'Transferencia electrónica de fondos',
    '04': 'Tarjeta de crédito',
    '05': 'Monedero electrónico',
    '06': 'Dinero electrónico',
    '08': 'Vales de despensa',
    '12': 'Dación en pago',
    '13': 'Pago por subrogación',
    '14': 'Pago por consignación',
    '15': 'Condonación',
    '17': 'Compensación',
    '23': 'Novación',
    '24': 'Confusión',
    '25': 'Remisión de deuda',
    '26': 'Prescripción o caducidad',
    '27': 'A satisfacción del acreedor',
    '28': 'Tarjeta de débito',
    '29': 'Tarjeta de servicios',
    '30': 'Aplicación de anticipos',
    '31': 'Intermediario pagos',
    '99': 'Por definir'
};

export const CAT_METODO_PAGO = {
    'PUE': 'Pago en una sola exhibición',
    'PPD': 'Pago en parcialidades o diferido'
};

export const CAT_USO_CFDI = {
    'G01': 'Adquisición de mercancías',
    'G02': 'Devoluciones, descuentos o bonificaciones',
    'G03': 'Gastos en general',
    'I01': 'Construcciones',
    'I02': 'Mobiliario y equipo de oficina por inversiones',
    'I03': 'Equipo de transporte',
    'I04': 'Equipo de computo y accesorios',
    'I05': 'Dados, troqueles, moldes, matrices y herramental',
    'I06': 'Comunicaciones telefónicas',
    'I07': 'Comunicaciones satelitales',
    'I08': 'Otra maquinaria y equipo',
    'D01': 'Honorarios médicos, dentales y gastos hospitalarios',
    'D02': 'Gastos médicos por incapacidad o discapacidad',
    'D03': 'Gastos funerales',
    'D04': 'Donativos',
    'D05': 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)',
    'D06': 'Aportaciones voluntarias al SAR',
    'D07': 'Primas por seguros de gastos médicos',
    'D08': 'Gastos de transportación escolar obligatoria',
    'D09': 'Depósitos en cuentas personales especiales para el ahorro, planes de pensiones',
    'D10': 'Pagos por servicios educativos (colegiaturas)',
    'S01': 'Sin efectos fiscales',
    'CP01': 'Pagos',
    'CN01': 'Nómina'
};

export const CAT_TIPO_COMPROBANTE = {
    'I': 'Ingreso',
    'E': 'Egreso',
    'T': 'Traslado',
    'N': 'Nómina',
    'P': 'Pago'
};

export const CAT_OBJETO_IMP = {
    '01': 'No objeto de impuesto',
    '02': 'Sí objeto de impuesto',
    '03': 'Sí objeto de impuesto y no obligado al desglose',
    '04': 'Sí objeto de impuesto y no causa impuesto'
};

export const CAT_EXPORTACION = {
    '01': 'No aplica',
    '02': 'Definitiva con clave A1',
    '03': 'Temporal',
    '04': 'Definitiva con clave distinta a A1'
};

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
                const selloSource = documento.sello_cfdi || documento.sello || 'SELLO_CFDI_PREVIEW';
                const last8Sello = selloSource.length >= 8 ? selloSource.slice(-8) : '8FA485C1';
                const totalFloat = parseFloat(documento.total || 0).toFixed(6);
                const satUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${documento.uuid}&re=${emisor.rfc}&rr=${receptor.rfc}&tt=${totalFloat}&fe=${last8Sello}`;
                qrUrlBase64 = await QRCode.toDataURL(satUrl, {
                    width: 160,
                    margin: 1,
                    color: {
                        dark: '#0f172a',
                        light: '#ffffff'
                    }
                });
            } catch (qrErr) {
                console.error('[PDF Service] Error generando QR:', qrErr);
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

        // 3.4 Preparar datos enriquecidos para CFDI 4.0
        const emisorRaw = emisor.toJSON ? emisor.toJSON() : emisor;
        const receptorRaw = receptor.toJSON ? receptor.toJSON() : receptor;
        const docRaw = documento.toJSON ? documento.toJSON() : documento;

        // Resolver catálogos fiscales
        const regimenEmisorCode = emisorRaw.regimen_fiscal || '601';
        const regimenEmisorDesc = CAT_REGIMEN_FISCAL[regimenEmisorCode] || emisorRaw.regimen_desc || 'General de Ley Personas Morales';
        const regimenEmisorDisplay = `${regimenEmisorCode} - ${regimenEmisorDesc}`;

        const regimenReceptorCode = receptorRaw.regimen_fiscal || '601';
        const regimenReceptorDesc = CAT_REGIMEN_FISCAL[regimenReceptorCode] || receptorRaw.regimen_desc || 'General de Ley Personas Morales';
        const regimenReceptorDisplay = `${regimenReceptorCode} - ${regimenReceptorDesc}`;

        const usoCfdiCode = docRaw.uso_cfdi || 'G03';
        const usoCfdiDesc = CAT_USO_CFDI[usoCfdiCode] || docRaw.uso_desc || 'Gastos en general';
        const usoCfdiDisplay = `${usoCfdiCode} - ${usoCfdiDesc}`;

        const formaPagoCode = docRaw.forma_pago || '01';
        const formaPagoDesc = CAT_FORMA_PAGO[formaPagoCode] || 'Efectivo';
        const formaPagoDisplay = `${formaPagoCode} - ${formaPagoDesc}`;

        const metodoPagoCode = docRaw.metodo_pago || 'PUE';
        const metodoPagoDesc = CAT_METODO_PAGO[metodoPagoCode] || 'Pago en una sola exhibición';
        const metodoPagoDisplay = `${metodoPagoCode} - ${metodoPagoDesc}`;

        const tipoCompCode = docRaw.tipo_comprobante || 'I';
        const tipoCompDesc = CAT_TIPO_COMPROBANTE[tipoCompCode] || 'Ingreso';
        const tipoCompDisplay = `${tipoCompCode} - ${tipoCompDesc}`;

        const exportacionCode = docRaw.exportacion || '01';
        const exportacionDesc = CAT_EXPORTACION[exportacionCode] || 'No aplica';
        const exportacionDisplay = `${exportacionCode} - ${exportacionDesc}`;

        const monedaCode = docRaw.moneda || 'MXN';
        const monedaDesc = monedaCode === 'MXN' ? 'MXN - Peso Mexicano' : (monedaCode === 'USD' ? 'USD - Dólar Estadounidense' : monedaCode);

        // Mapear conceptos / detalles con todos los campos SAT CFDI 4.0
        const detallesFormatted = detalles.map((d, idx) => {
            const raw = d.toJSON ? d.toJSON() : d;
            const conceptoObj = raw.Concepto || {};
            const cant = parseFloat(raw.cantidad || 1);
            const valUnit = parseFloat(raw.valor_unitario !== undefined ? raw.valor_unitario : (conceptoObj.precio_unitario || 0));
            const imp = parseFloat(raw.importe !== undefined ? raw.importe : (cant * valUnit));
            const desc = parseFloat(raw.descuento || 0);
            const base = imp - desc;

            const claveSat = raw.clave_sat || raw.clave_prod_serv || conceptoObj.clave_prod_serv || '84111506';
            const claveUnidad = raw.clave_unidad || conceptoObj.clave_unidad || 'E48';
            const unidad = raw.unidad || conceptoObj.unidad || 'Servicio';
            const noId = raw.no_identificacion || raw.codigo || conceptoObj.codigo || `ITEM-0${idx + 1}`;
            const descripcion = raw.descripcion || conceptoObj.descripcion || 'Concepto sin descripción';
            const objetoImp = raw.objeto_imp || '02';
            const objetoImpDesc = CAT_OBJETO_IMP[objetoImp] || 'Sí objeto de impuesto';
            const objetoImpDisplay = `${objetoImp} - ${objetoImpDesc}`;

            // Calcular desglose de impuesto de la partida
            const impuestosItem = [];
            if (objetoImp === '02') {
                const ivaTasa = 0.16;
                const ivaImp = base * ivaTasa;
                impuestosItem.push({
                    impuesto: '002 IVA',
                    tipo: 'Traslado',
                    factor: 'Tasa',
                    tasa: '16.00%',
                    tasa_cuota: '0.160000',
                    base: base.toFixed(2),
                    importe: ivaImp.toFixed(2)
                });
            }

            return {
                ...raw,
                no_identificacion: noId,
                clave_sat: claveSat,
                clave_prod_serv: claveSat,
                clave_unidad: claveUnidad,
                unidad: unidad,
                descripcion: descripcion,
                objeto_imp: objetoImp,
                objeto_imp_desc: objetoImpDesc,
                objeto_imp_display: objetoImpDisplay,
                cantidad_form: cant.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
                valor_unitario_form: valUnit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
                importe_form: imp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                descuento_form: desc > 0 ? desc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null,
                impuestos_item: impuestosItem
            };
        });

        // Tabla formal de resumen de impuestos SAT
        const resumenImpuestosSat = [];
        const baseSubtotal = computedSubtotal - parseFloat(docRaw.descuento || 0);
        if (totalTraslados > 0 || parseFloat(docRaw.total_impuestos_trasladados || 0) > 0) {
            const amtTras = totalTraslados > 0 ? totalTraslados : parseFloat(docRaw.total_impuestos_trasladados || 0);
            resumenImpuestosSat.push({
                tipo: 'Traslado',
                impuesto: '002 - IVA',
                tipo_factor: 'Tasa',
                tasa_cuota: '0.160000',
                tasa_porcentaje: '16.00%',
                base: baseSubtotal.toFixed(2),
                importe: amtTras.toFixed(2)
            });
        }
        retenciones.forEach(ret => {
            resumenImpuestosSat.push({
                tipo: 'Retención',
                impuesto: ret.impuesto,
                tipo_factor: 'Tasa',
                tasa_cuota: (parseFloat(ret.tasa) / 100).toFixed(6),
                tasa_porcentaje: `${ret.tasa}%`,
                base: baseSubtotal.toFixed(2),
                importe: ret.importe
            });
        });

        const data = {
            emisor: {
                ...emisorRaw,
                regimen_fiscal: regimenEmisorCode,
                regimen_desc: regimenEmisorDesc,
                regimen_display: regimenEmisorDisplay,
                codigo_postal: emisorRaw.codigo_postal || '29960',
                municipio: emisorRaw.municipio || '',
                estado: emisorRaw.estado || '',
                pais: emisorRaw.pais || 'México'
            },
            receptor: {
                ...receptorRaw,
                regimen_fiscal: regimenReceptorCode,
                regimen_desc: regimenReceptorDesc,
                regimen_display: regimenReceptorDisplay,
                codigo_postal: receptorRaw.codigo_postal || '00000',
                municipio: receptorRaw.municipio || '',
                estado: receptorRaw.estado || '',
                pais: receptorRaw.pais || 'México'
            },
            documento: {
                ...docRaw,
                serie: docRaw.serie || 'A',
                folio: docRaw.folio || '0001',
                tipo_comprobante: tipoCompCode,
                tipo_comprobante_desc: tipoCompDesc,
                tipo_comprobante_display: tipoCompDisplay,
                uso_cfdi: usoCfdiCode,
                uso_desc: usoCfdiDesc,
                uso_cfdi_display: usoCfdiDisplay,
                forma_pago: formaPagoCode,
                forma_pago_desc: formaPagoDesc,
                forma_pago_display: formaPagoDisplay,
                metodo_pago: metodoPagoCode,
                metodo_pago_desc: metodoPagoDesc,
                metodo_pago_display: metodoPagoDisplay,
                exportacion: exportacionCode,
                exportacion_desc: exportacionDesc,
                exportacion_display: exportacionDisplay,
                moneda: monedaCode,
                moneda_desc: monedaDesc,
                tipo_cambio: docRaw.tipo_cambio || '1.000000',
                condiciones_pago: docRaw.condiciones_pago || 'Contado Inmediato',
                lugar_expedicion: docRaw.lugar_expedicion || emisorRaw.codigo_postal || '29960',
                rfc_pac: docRaw.rfc_pac || 'LSO1306189R5',
                subtotal_form: parseFloat(docRaw.subtotal || computedSubtotal).toFixed(2),
                descuento_form: parseFloat(docRaw.descuento || 0).toFixed(2),
                iva_total: totalTraslados.toFixed(2),
                iva_total_form: totalTraslados.toFixed(2),
                total_form: parseFloat(docRaw.total || 0).toFixed(2),
                total_retenciones: totalRetenciones.toFixed(2),
                total_traslados_locales: totalTrasladosLocales.toFixed(2),
                total_retenciones_locales: totalRetencionesLocales.toFixed(2),
                total_en_letra: numeroALetras(parseFloat(docRaw.total || 0)),
                fecha: docRaw.fecha ? new Date(docRaw.fecha).toLocaleString('es-MX') : new Date().toLocaleString('es-MX'),
                fecha_timbrado: docRaw.fecha_timbrado ? new Date(docRaw.fecha_timbrado).toLocaleString('es-MX') : (docRaw.uuid ? new Date().toLocaleString('es-MX') : ''),
                no_certificado_emisor: docRaw.no_certificado_emisor || emisorRaw.no_certificado || '00001000000504465028',
                no_certificado_sat: docRaw.no_certificado_sat || '00001000000509846663',
                sello_cfdi: docRaw.sello_cfdi || docRaw.sello || '',
                sello_sat: docRaw.sello_sat || '',
                cadena_original_tfd: docRaw.cadena_original_tfd || docRaw.cadena_original || ''
            },
            detalles: detallesFormatted,
            resumenImpuestosSat: resumenImpuestosSat,
            doctosRelacionados: doctosRelacionados.map(dr => (dr.toJSON ? dr.toJSON() : dr)),
            pago: pagoInfo ? (pagoInfo.toJSON ? pagoInfo.toJSON() : pagoInfo) : null,
            retenciones: retenciones,
            trasladosLocales: trasladosLocales,
            retencionesLocales: retencionesLocales,
            color_primario: estilo.color_primario || '#004481',
            color_secundario: estilo.color_secundario || '#123247',
            tipo_letra: estilo.tipo_letra || 'Inter',
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
