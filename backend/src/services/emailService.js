import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { Emisor, Empresa, Receptor } from '../models/index.js';
import { STORAGE_BASE, getXmlPath, getPdfPath } from '../utils/storageHelper.js';

/**
 * Determina el modo TLS correcto según el puerto SMTP:
 * - Puerto 465 usa SSL/TLS implícito (secure: true)
 * - Puertos 587, 25 y 2525 usan STARTTLS (secure: false; si se envía secure: true falla con wrong_version_number)
 */
const resolveSmtpSecure = (port, rawSecure) => {
    const numPort = parseInt(port) || 587;
    if (numPort === 465) return true;
    if (numPort === 587 || numPort === 25 || numPort === 2525) return false;
    return Boolean(rawSecure);
};

/**
 * Normaliza la contraseña SMTP (en Gmail/Google Workspace las contraseñas de aplicación
 * suelen copiarse con espacios cada 4 letras: "xxxx xxxx xxxx xxxx").
 */
const normalizeSmtpPassword = (host = '', pass = '') => {
    const cleanHost = String(host).toLowerCase().trim();
    const rawPass = String(pass);
    if (cleanHost.includes('gmail.com') || cleanHost.includes('googlemail.com')) {
        return rawPass.replace(/\s+/g, '');
    }
    return rawPass.trim();
};

/**
 * Traduce errores técnicos de Nodemailer / OpenSSL / GSMTP a mensajes claros en español.
 */
export const traducirErrorSmtp = (error, host = '', port = 587, user = '') => {
    const msg = error?.message || String(error);
    if (msg.includes('535') || msg.includes('BadCredentials') || msg.includes('Username and Password not accepted') || error?.responseCode === 535) {
        if (String(host).toLowerCase().includes('gmail')) {
            return `Google rechazó el usuario o contraseña (Error 535). Verifica que el correo "${user}" sea exacto y que la Contraseña de Aplicación de 16 letras pertenezca a esa misma cuenta de Gmail.`;
        }
        return `El servidor SMTP (${host}) rechazó el usuario o la contraseña (Error 535). Verifica las credenciales de "${user}".`;
    }
    if (msg.includes('wrong version number') || msg.includes('ssl3_get_record')) {
        return `Incompatibilidad SSL/STARTTLS en el puerto ${port}. Para el puerto 587 se usa STARTTLS automático y para el puerto 465 se usa SSL directo.`;
    }
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
        return `No se encontró el servidor SMTP "${host}". Verifica que el nombre del host esté bien escrito.`;
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ESOCKET')) {
        return `No se pudo establecer conexión con ${host}:${port}. Verifica el puerto (587 o 465) y tu conexión de red.`;
    }
    return msg;
};

/**
 * Resuelve en cascada qué configuración SMTP utilizar para un Emisor o Empresa:
 * 1) SMTP Propio del Emisor (si usar_smtp_propio = true y tiene credenciales)
 * 2) SMTP del Espacio de Trabajo / Empresa (con Reply-To al correo_emisor)
 * 3) Variables de entorno globales (.env SMTP_HOST, SMTP_USER, SMTP_PASS)
 */
export const resolverConfiguracionSmtp = async (emisorOrId, empresaOrId = null) => {
    let emisor = null;
    let empresa = null;

    if (emisorOrId) {
        if (typeof emisorOrId === 'object' && emisorOrId.rfc) {
            emisor = emisorOrId;
        } else {
            emisor = await Emisor.findByPk(emisorOrId);
        }
    }

    if (empresaOrId) {
        if (typeof empresaOrId === 'object' && empresaOrId.nombre) {
            empresa = empresaOrId;
        } else {
            empresa = await Empresa.findByPk(empresaOrId);
        }
    } else if (emisor?.empresa_id) {
        empresa = await Empresa.findByPk(emisor.empresa_id);
    }

    // Nivel 1: SMTP Propio del Emisor
    if (emisor && emisor.usar_smtp_propio && emisor.smtp_host && emisor.smtp_user && emisor.smtp_pass) {
        const port = parseInt(emisor.smtp_port) || 587;
        const secure = resolveSmtpSecure(port, emisor.smtp_secure);
        const fromName = emisor.smtp_from_name || emisor.razon_social || emisor.rfc;
        const fromEmail = emisor.correo_emisor || emisor.smtp_user;

        return {
            origen: 'emisor',
            origenLabel: `SMTP Propio del Emisor (${emisor.rfc})`,
            host: emisor.smtp_host.trim(),
            port,
            secure,
            user: emisor.smtp_user.trim(),
            pass: normalizeSmtpPassword(emisor.smtp_host, emisor.smtp_pass),
            from: `"${fromName.replace(/"/g, '')}" <${emisor.smtp_user.trim()}>`,
            replyTo: fromEmail
        };
    }

    // Nivel 2: SMTP del Espacio de Trabajo (Empresa)
    if (empresa && empresa.smtp_host && empresa.smtp_user && empresa.smtp_pass) {
        const port = parseInt(empresa.smtp_port) || 587;
        const secure = resolveSmtpSecure(port, empresa.smtp_secure);
        const fromName = emisor?.razon_social || empresa.smtp_from_name || empresa.nombre || 'Facturación CFDI 4.0';
        const fromAddress = (empresa.smtp_from_email || empresa.smtp_user).trim();
        const replyToAddress = (emisor?.correo_emisor || fromAddress).trim();

        return {
            origen: 'empresa',
            origenLabel: `SMTP del Espacio de Trabajo (${empresa.nombre})`,
            host: empresa.smtp_host.trim(),
            port,
            secure,
            user: empresa.smtp_user.trim(),
            pass: normalizeSmtpPassword(empresa.smtp_host, empresa.smtp_pass),
            from: `"${fromName.replace(/"/g, '')}" <${fromAddress}>`,
            replyTo: replyToAddress
        };
    }

    // Nivel 3: SMTP Global en variables de entorno (.env)
    const envHost = process.env.SMTP_HOST || process.env.SMTP_SERVER;
    const envUser = process.env.SMTP_USER;
    const envPass = process.env.SMTP_PASS;
    if (envHost && envUser && envPass) {
        const port = parseInt(process.env.SMTP_PORT) || 587;
        const secure = resolveSmtpSecure(port, process.env.SMTP_SECURE === 'true');
        const fromName = emisor?.razon_social || process.env.SMTP_FROM_NAME || 'Facturación CFDI 4.0';
        const replyToAddress = emisor?.correo_emisor || envUser;

        return {
            origen: 'sistema',
            origenLabel: 'SMTP Predeterminado del Sistema (.env)',
            host: envHost.trim(),
            port,
            secure,
            user: envUser.trim(),
            pass: normalizeSmtpPassword(envHost, envPass),
            from: `"${fromName.replace(/"/g, '')}" <${envUser.trim()}>`,
            replyTo: replyToAddress
        };
    }

    return null;
};

/**
 * Resuelve la ruta física en disco de un archivo de storage (/storage/RFC/pdf/uuid.pdf)
 */
const resolvePhysicalStoragePath = (urlOrPath, rfc, uuid, type = 'pdf') => {
    if (urlOrPath) {
        if (fs.existsSync(urlOrPath)) return urlOrPath;
        const cleanRel = urlOrPath.replace(/^\/?(api\/)?storage\/?/i, '');
        const candidate = path.join(STORAGE_BASE, cleanRel);
        if (fs.existsSync(candidate)) return candidate;
    }
    if (rfc && uuid) {
        const fallback = type === 'xml' ? getXmlPath(rfc, uuid) : getPdfPath(rfc, uuid);
        if (fs.existsSync(fallback)) return fallback;
    }
    return null;
};

/**
 * Envía una factura/CFDI por correo electrónico adjuntando PDF y XML.
 */
export const enviarFacturaPorCorreo = async (documento, receptor, xmlPath, pdfPath, opcionesExtras = {}) => {
    try {
        const emisor = opcionesExtras.emisor || await Emisor.findByPk(documento.emisor_id);
        const receptorObj = receptor || await Receptor.findByPk(documento.receptor_id);

        const destinatariosRaw = opcionesExtras.destinatarios || receptorObj?.correo || receptorObj?.email || '';
        const destinatarios = String(destinatariosRaw)
            .split(/[,;\s]+/)
            .map(e => e.trim())
            .filter(e => e.includes('@'));

        if (destinatarios.length === 0) {
            return {
                success: false,
                message: 'El receptor no tiene un correo electrónico asignado. Ingrese un correo destinatario.'
            };
        }

        const smtpConfig = await resolverConfiguracionSmtp(emisor);
        if (!smtpConfig) {
            return {
                success: false,
                message: 'No hay servidor de correo (SMTP) configurado ni en el Emisor ni en el Espacio de Trabajo. Configúralo en Configuración -> Correo SMTP o en Emisores.'
            };
        }

        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const folioLabel = `${documento.serie ? `${documento.serie}-` : ''}${documento.folio || documento.id}`;
        const tipoLabel = documento.tipo_comprobante === 'P'
            ? 'Complemento de Recepción de Pagos (REP)'
            : documento.tipo_comprobante === 'E'
                ? 'Nota de Crédito (CFDI de Egreso)'
                : 'Factura Electrónica (CFDI de Ingreso)';

        const attachments = [];
        const physicalPdf = resolvePhysicalStoragePath(pdfPath || documento.pdf_url, emisor?.rfc, documento.uuid, 'pdf');
        const physicalXml = resolvePhysicalStoragePath(xmlPath || documento.xml_url, emisor?.rfc, documento.uuid, 'xml');

        if (physicalPdf) {
            attachments.push({
                filename: `CFDI_${emisor?.rfc || 'EMISOR'}_${folioLabel}.pdf`,
                path: physicalPdf,
                contentType: 'application/pdf'
            });
        }
        if (physicalXml) {
            attachments.push({
                filename: `CFDI_${emisor?.rfc || 'EMISOR'}_${folioLabel}.xml`,
                path: physicalXml,
                contentType: 'application/xml'
            });
        }

        const totalFormatted = `$${parseFloat(documento.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${documento.moneda || 'MXN'}`;
        const notaPersonalizada = opcionesExtras.mensaje
            ? `<div style="margin: 18px 0; padding: 14px 16px; background: #f8fafc; border-left: 4px solid #4f46e5; color: #334155; font-size: 14px; border-radius: 6px;">${opcionesExtras.mensaje.replace(/\n/g, '<br/>')}</div>`
            : '';

        const asunto = opcionesExtras.asunto || `${tipoLabel} ${folioLabel} - ${emisor?.razon_social || emisor?.rfc}`;

        const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
            <div style="background: #0f172a; color: #ffffff; padding: 24px 28px;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700;">Comprobante Fiscal Digital CFDI 4.0</div>
                <h2 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800;">${emisor?.razon_social || 'Emisor CFDI'}</h2>
                <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">RFC: ${emisor?.rfc || ''}</div>
            </div>
            <div style="padding: 26px 28px; color: #1e293b;">
                <p style="margin-top: 0; font-size: 14px; line-height: 1.6;">
                    Estimado(a) <strong>${receptorObj?.razon_social || 'Cliente'}</strong> (${receptorObj?.rfc || ''}),
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                    Adjunto a este correo encontrará los archivos oficiales (<strong>PDF</strong> y <strong>XML</strong>) correspondientes a su <strong>${tipoLabel}</strong>.
                </p>
                ${notaPersonalizada}
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 13px;">
                    <tr>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Serie y Folio</td>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a; text-align: right;">${folioLabel}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Folio Fiscal (UUID)</td>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 12px; color: #334155; text-align: right;">${documento.uuid || 'En proceso'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Fecha de Emisión</td>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right;">${documento.fecha ? new Date(documento.fecha).toLocaleString('es-MX') : ''}</td>
                    </tr>
                    ${documento.tipo_comprobante !== 'P' ? `
                    <tr>
                        <td style="padding: 12px 14px; color: #0f172a; font-weight: 700;">Total del Comprobante</td>
                        <td style="padding: 12px 14px; font-weight: 900; font-size: 15px; color: #059669; text-align: right;">${totalFormatted}</td>
                    </tr>` : ''}
                </table>
                <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
                    Si tiene alguna duda o comentario respecto a este comprobante, puede responder directamente a este correo (${smtpConfig.replyTo}).
                </p>
            </div>
            <div style="background: #f1f5f9; padding: 14px 28px; text-align: center; font-size: 11px; color: #64748b;">
                Enviado mediante ${smtpConfig.origenLabel}
            </div>
        </div>`;

        const info = await transporter.sendMail({
            from: smtpConfig.from,
            to: destinatarios.join(', '),
            replyTo: smtpConfig.replyTo,
            subject: asunto,
            html: htmlBody,
            attachments
        });

        console.log(`[Email Service] ✅ Correo enviado a ${destinatarios.join(', ')} (MessageId: ${info.messageId}, Origen: ${smtpConfig.origen})`);
        return {
            success: true,
            message: `Correo enviado exitosamente a ${destinatarios.join(', ')}`,
            origen: smtpConfig.origenLabel,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('[Email Service] Error enviando correo:', error);
        return {
            success: false,
            message: traducirErrorSmtp(error, error?.host, error?.port)
        };
    }
};

/**
 * Prueba una configuración SMTP en vivo y opcionalmente envía un correo de prueba.
 */
export const probarConexionSmtp = async (config, correoDestinoPrueba = '') => {
    const port = parseInt(config.smtp_port) || 587;
    const secure = resolveSmtpSecure(port, config.smtp_secure);
    const host = (config.smtp_host || '').trim();
    const user = (config.smtp_user || '').trim();
    const pass = normalizeSmtpPassword(host, config.smtp_pass || '');

    if (!host || !user || !pass) {
        throw new Error('Debe completar el Servidor SMTP (Host), Usuario y Contraseña.');
    }

    try {
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user,
                pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.verify();

        if (correoDestinoPrueba && correoDestinoPrueba.includes('@')) {
            const fromName = config.smtp_from_name || 'Sistema de Facturación CFDI 4.0';
            const fromAddress = (config.smtp_from_email || user).trim();
            await transporter.sendMail({
                from: `"${fromName.replace(/"/g, '')}" <${fromAddress}>`,
                to: correoDestinoPrueba.trim(),
                replyTo: config.reply_to || fromAddress,
                subject: '✅ Prueba de Configuración de Correo SMTP - Facturación CFDI 4.0',
                html: `
                <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h3 style="margin-top: 0; color: #059669;">¡Conexión SMTP Exitosa!</h3>
                    <p style="font-size: 14px; color: #334155;">
                        Este es un correo de prueba para confirmar que el servidor <strong>${host}:${port}</strong> está correctamente configurado para el envío de facturas CFDI 4.0 (PDF y XML).
                    </p>
                    <div style="font-size: 12px; color: #64748b; background: #f8fafc; padding: 12px; border-radius: 8px;">
                        <div><strong>Remitente:</strong> ${fromName} &lt;${fromAddress}&gt;</div>
                        <div><strong>Responder a (Reply-To):</strong> ${config.reply_to || fromAddress}</div>
                    </div>
                </div>`
            });
        }

        return {
            success: true,
            message: correoDestinoPrueba
                ? `Conexión verificada y correo de prueba enviado a ${correoDestinoPrueba}`
                : 'Conexión con el servidor SMTP verificada exitosamente.'
        };
    } catch (err) {
        throw new Error(traducirErrorSmtp(err, host, port, user));
    }
};
