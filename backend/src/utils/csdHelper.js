import fs from 'fs';
import forge from 'node-forge';
import { getCerPath, getFielCerPath } from './storageHelper.js';

/**
 * Inspecciona y extrae la información y vigencia técnica del archivo .cer de un Emisor.
 * 
 * @param {string} rfc RFC del emisor a consultar
 * @returns {Object} Información del certificado CSD, número de serie, vigencia y estado de caducidad.
 */
export const getCsdInfo = (rfc) => {
    if (!rfc) {
        return {
            tieneCertificado: false,
            estado: 'sin_certificados',
            nivel: 'info',
            mensaje: 'No se especificó un RFC válido.',
            diasRestantes: null,
            noCertificado: null,
            vigenciaDesde: null,
            vigenciaHasta: null
        };
    }

    const cleanRfc = String(rfc).trim().toUpperCase();
    const cerPath = getCerPath(cleanRfc);

    if (!fs.existsSync(cerPath)) {
        return {
            tieneCertificado: false,
            estado: 'sin_certificados',
            nivel: 'info',
            mensaje: `El emisor ${cleanRfc} aún no tiene un archivo de Certificado (.cer) cargado.`,
            diasRestantes: null,
            noCertificado: null,
            vigenciaDesde: null,
            vigenciaHasta: null
        };
    }

    try {
        const cerBuffer = fs.readFileSync(cerPath);
        const asn1 = forge.asn1.fromDer(cerBuffer.toString('binary'));
        const cert = forge.pki.certificateFromAsn1(asn1);

        // Convertir serial hex a caracteres ASCII según estándar SAT
        const serialHex = cert.serialNumber || '';
        let noCertificado = '';
        for (let i = 0; i < serialHex.length; i += 2) {
            noCertificado += String.fromCharCode(parseInt(serialHex.substr(i, 2), 16));
        }

        const subjectField = cert.subject.getField('CN');
        const nombreSujeto = subjectField ? subjectField.value : '';

        const notBefore = cert.validity.notBefore;
        const notAfter = cert.validity.notAfter;

        const now = new Date();
        const diffMs = notAfter.getTime() - now.getTime();
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let estado = 'vigente';
        let nivel = 'success';
        let mensaje = `Certificado CSD vigente por ${diasRestantes} días.`;

        if (diasRestantes <= 0) {
            estado = 'vencido';
            nivel = 'danger';
            mensaje = `¡Atención! El Certificado CSD expiró el ${notAfter.toLocaleDateString('es-MX')} (${Math.abs(diasRestantes)} días vencido). El SAT rechazará cualquier intento de timbrado.`;
        } else if (diasRestantes <= 30) {
            estado = 'por_vencer';
            nivel = 'warning';
            mensaje = `¡Aviso! El Certificado CSD vencerá en ${diasRestantes} días (${notAfter.toLocaleDateString('es-MX')}). Se recomienda tramitar y cargar la renovación a la brevedad.`;
        }

        return {
            tieneCertificado: true,
            estado,
            nivel,
            mensaje,
            diasRestantes,
            vigenciaDesde: notBefore.toISOString(),
            vigenciaHasta: notAfter.toISOString(),
            vigenciaDesdeFormatted: notBefore.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
            vigenciaHastaFormatted: notAfter.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
            noCertificado,
            nombreSujeto,
            rfc: cleanRfc
        };
    } catch (error) {
        console.error(`[csdHelper] Error al decodificar certificado para RFC ${cleanRfc}:`, error.message);
        return {
            tieneCertificado: true,
            estado: 'error_lectura',
            nivel: 'danger',
            mensaje: `El archivo .cer de ${cleanRfc} está dañado o no tiene formato X.509 DER válido.`,
            error: error.message,
            diasRestantes: null,
            noCertificado: null,
            vigenciaDesde: null,
            vigenciaHasta: null
        };
    }
};

/**
 * Inspecciona y extrae la información y vigencia técnica del archivo .cer de la e.firma (FIEL) de un Emisor.
 * 
 * @param {string} rfc RFC del emisor a consultar
 * @returns {Object} Información del certificado de e.firma, número de serie, vigencia y estado.
 */
export const getFielInfo = (rfc) => {
    if (!rfc) {
        return {
            tieneCertificado: false,
            estado: 'sin_certificados',
            nivel: 'info',
            mensaje: 'No se especificó un RFC válido.',
            diasRestantes: null,
            noCertificado: null,
            vigenciaDesde: null,
            vigenciaHasta: null
        };
    }

    const cleanRfc = String(rfc).trim().toUpperCase();
    const fielPath = getFielCerPath(cleanRfc);

    if (!fs.existsSync(fielPath)) {
        return {
            tieneCertificado: false,
            estado: 'sin_certificados',
            nivel: 'info',
            mensaje: `El emisor ${cleanRfc} aún no tiene una e.firma (FIEL) configurada.`,
            diasRestantes: null,
            noCertificado: null,
            vigenciaDesde: null,
            vigenciaHasta: null
        };
    }

    try {
        const cerBuffer = fs.readFileSync(fielPath);
        const asn1 = forge.asn1.fromDer(cerBuffer.toString('binary'));
        const cert = forge.pki.certificateFromAsn1(asn1);

        const serialHex = cert.serialNumber || '';
        let noCertificado = '';
        for (let i = 0; i < serialHex.length; i += 2) {
            noCertificado += String.fromCharCode(parseInt(serialHex.substr(i, 2), 16));
        }

        const subjectField = cert.subject.getField('CN');
        const nombreSujeto = subjectField ? subjectField.value : '';

        const notBefore = cert.validity.notBefore;
        const notAfter = cert.validity.notAfter;

        const now = new Date();
        const diffMs = notAfter.getTime() - now.getTime();
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let estado = 'vigente';
        let nivel = 'success';
        let mensaje = `e.firma (FIEL) vigente por ${diasRestantes} días.`;

        if (diasRestantes <= 0) {
            estado = 'vencido';
            nivel = 'danger';
            mensaje = `¡Atención! La e.firma expiró el ${notAfter.toLocaleDateString('es-MX')}. El SAT rechazará la descarga masiva.`;
        } else if (diasRestantes <= 30) {
            estado = 'por_vencer';
            nivel = 'warning';
            mensaje = `¡Aviso! La e.firma vencerá en ${diasRestantes} días (${notAfter.toLocaleDateString('es-MX')}).`;
        }

        return {
            tieneCertificado: true,
            estado,
            nivel,
            mensaje,
            diasRestantes,
            vigenciaDesde: notBefore.toISOString(),
            vigenciaHasta: notAfter.toISOString(),
            vigenciaDesdeFormatted: notBefore.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
            vigenciaHastaFormatted: notAfter.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
            noCertificado,
            nombreSujeto,
            rfc: cleanRfc
        };
    } catch (error) {
        console.error(`[csdHelper] Error al decodificar e.firma para RFC ${cleanRfc}:`, error.message);
        return {
            tieneCertificado: true,
            estado: 'error_lectura',
            nivel: 'danger',
            mensaje: `El archivo .cer de e.firma de ${cleanRfc} no tiene formato X.509 DER válido.`,
            error: error.message,
            diasRestantes: null,
            noCertificado: null,
            vigenciaDesde: null,
            vigenciaHasta: null
        };
    }
};

