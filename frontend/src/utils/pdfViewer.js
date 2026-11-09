import api from '../api/axios';
import axios from 'axios';

/**
 * Abre un PDF o vista previa HTML de manera confiable.
 * Descarga el archivo mediante Blob para evitar interferencias de Service Workers
 * o capturas erróneas del enrutador SPA, visualizándolo en una nueva pestaña
 * utilizando el visor nativo del navegador.
 * 
 * @param {string} url Ruta relativa o absoluta del recurso (ej: /storage/RFC/pdf/archivo.pdf)
 * @param {string} [title] Título opcional
 */
export const openPdfViewer = async (url, title = 'Documento CFDI') => {
    if (!url) return false;

    // Resolver host base sin '/api' para no duplicar la ruta en peticiones estáticas
    const apiBase = api.defaults.baseURL || '/api';
    const rootHost = apiBase.startsWith('http')
        ? apiBase.replace(/\/api\/?$/, '')
        : (typeof window !== 'undefined' ? window.location.origin : '');

    const targetUrl = url.startsWith('http')
        ? url
        : `${rootHost}${url.startsWith('/') ? '' : '/'}${url}`;

    try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await axios.get(targetUrl, {
            responseType: 'blob',
            headers
        });

        const isHtml = url.toLowerCase().includes('.html');
        const contentType = response.headers['content-type'] || (isHtml ? 'text/html' : 'application/pdf');
        const blob = new Blob([response.data], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);

        const newTab = window.open(blobUrl, '_blank');
        if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
            const link = document.createElement('a');
            link.href = blobUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Liberar URL tras 3 minutos
        setTimeout(() => URL.revokeObjectURL(blobUrl), 180000);
        return true;
    } catch (error) {
        console.warn('[PDF Viewer] Fallback a apertura directa:', error);
        const fallbackUrl = targetUrl;
        window.open(fallbackUrl, '_blank');
        return false;
    }
};

