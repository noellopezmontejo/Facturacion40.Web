/**
 * Storage Helper — Gestión de directorios por emisor (RFC)
 * Estructura: src/storage/{RFC}/{xml,pdf,csd}/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Raíz del storage general:
// 1. Variable de entorno STORAGE_PATH si está definida
// 2. En Hostinger (hbuilds/versions/<uuid>/...), carpeta persistente fuera de hbuilds para no perder archivos al redesplegar
// 3. Por defecto en local: src/storage
const resolveStorageBase = () => {
    if (process.env.STORAGE_PATH && process.env.STORAGE_PATH.trim()) {
        return path.resolve(process.env.STORAGE_PATH.trim());
    }
    const normalized = __dirname.replace(/\\/g, '/');
    const hbuildsIdx = normalized.indexOf('/hbuilds/');
    if (hbuildsIdx !== -1) {
        const domainRoot = normalized.slice(0, hbuildsIdx);
        return path.join(domainRoot, 'storage_facturacion40');
    }
    return path.resolve(__dirname, '..', 'storage');
};

export const STORAGE_BASE = resolveStorageBase();
if (!fs.existsSync(STORAGE_BASE)) {
    fs.mkdirSync(STORAGE_BASE, { recursive: true });
}

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
 * Ruta al archivo .cer de un emisor (CSD)
 */
export const getCerPath = (rfc) => path.join(getEmissorDir(rfc, 'csd'), 'certificado.cer');

/**
 * Ruta al archivo .key de un emisor (CSD)
 */
export const getKeyPath = (rfc) => path.join(getEmissorDir(rfc, 'csd'), 'llave.key');

/**
 * Ruta al archivo .cer de la e.firma (FIEL) de un emisor
 */
export const getFielCerPath = (rfc) => path.join(getEmissorDir(rfc, 'fiel'), 'fiel.cer');

/**
 * Ruta al archivo .key de la e.firma (FIEL) de un emisor
 */
export const getFielKeyPath = (rfc) => path.join(getEmissorDir(rfc, 'fiel'), 'fiel.key');

/**
 * Ruta para guardar un XML timbrado
 */
export const getXmlPath = (rfc, uuid) => path.join(getEmissorDir(rfc, 'xml'), `${uuid}.xml`);

/**
 * Ruta para guardar un PDF
 */
export const getPdfPath = (rfc, uuid) => path.join(getEmissorDir(rfc, 'pdf'), `${uuid}.pdf`);

/**
 * Directorio para evidencias de una orden de servicio
 */
export const getOrdenEvidenciasDir = (rfc, ordenId) => {
    const dir = path.join(getEmissorDir(rfc, 'ordenes_servicio'), String(ordenId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

/**
 * URL pública relativa para acceder a un recurso vía /storage/...
 */
export const getPublicUrl = (rfc, tipo, filename) => `/storage/${rfc}/${tipo}/${filename}`;
