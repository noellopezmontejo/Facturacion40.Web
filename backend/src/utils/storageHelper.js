/**
 * Storage Helper — Gestión de directorios por emisor (RFC)
 * Estructura: src/storage/{RFC}/{xml,pdf,csd}/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Raíz del storage general
export const STORAGE_BASE = path.resolve(__dirname, '..', 'storage');

/**
 * Devuelve (y crea si no existe) el directorio de un sub-módulo para un RFC concreto.
 * @param {string} rfc   RFC del emisor  (ej. "EKU9003173C9")
 * @param {'xml'|'pdf'|'csd'} tipo Subdirectorio deseado
 * @returns {string} Ruta absoluta al directorio
 */
export const getEmissorDir = (rfc, tipo) => {
    if (!rfc) throw new Error('RFC requerido para resolver el directorio del emisor.');
    const dir = path.join(STORAGE_BASE, rfc, tipo);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

/**
 * Ruta al archivo .cer de un emisor
 */
export const getCerPath = (rfc) => path.join(getEmissorDir(rfc, 'csd'), 'certificado.cer');

/**
 * Ruta al archivo .key de un emisor
 */
export const getKeyPath = (rfc) => path.join(getEmissorDir(rfc, 'csd'), 'llave.key');

/**
 * Ruta para guardar un XML timbrado
 */
export const getXmlPath = (rfc, uuid) => path.join(getEmissorDir(rfc, 'xml'), `${uuid}.xml`);

/**
 * Ruta para guardar un PDF
 */
export const getPdfPath = (rfc, uuid) => path.join(getEmissorDir(rfc, 'pdf'), `${uuid}.pdf`);

/**
 * URL pública relativa para acceder a un recurso vía /storage/...
 */
export const getPublicUrl = (rfc, tipo, filename) => `/storage/${rfc}/${tipo}/${filename}`;
