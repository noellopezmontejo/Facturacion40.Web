/**
 * colorExtractor.js
 * Extrae la paleta cromática dominante de un logotipo (vía Canvas)
 * y genera paletas armónicas y de alto contraste ideales para plantillas de facturación PDF.
 */

// Convierte RGB a HSL
export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
            default:
                break;
        }
        h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Convierte HSL a HEX (#RRGGBB)
export function hslToHex(h, s, l) {
    h = (h % 360 + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Convierte HEX a RGB
export function hexToRgb(hex) {
    if (!hex) return null;
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return null;
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Calcula contraste de luminosidad relativo
export function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Analiza una imagen mediante un elemento Image en memoria y un Canvas
 * para extraer sus colores dominantes y generar opciones armónicas / contrastadas.
 * @param {string} imageSrc - URL o DataURL de la imagen
 * @returns {Promise<{dominant: string[], palettes: Array<{title: string, desc: string, primary: string, secondary: string, isContrast?: boolean}>}>}
 */
export function extractColorsFromImage(imageSrc) {
    return new Promise((resolve) => {
        if (!imageSrc) {
            resolve({ dominant: [], palettes: getDefaultPalettes() });
            return;
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve({ dominant: [], palettes: getDefaultPalettes() });
                    return;
                }

                // Tamaño pequeño optimizado para muestreo rápido
                const width = 64;
                const height = 64;
                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height).data;

                const colorBuckets = {};

                for (let i = 0; i < imageData.length; i += 4) {
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];
                    const a = imageData[i + 3];

                    // Ignorar píxeles transparentes o semi-transparentes
                    if (a < 128) continue;

                    // Ignorar blancos puros o fondos casi blancos (típicos en fotos de logos)
                    if (r > 235 && g > 235 && b > 235) continue;

                    // Ignorar negros absolutos excepto si es el único contenido
                    if (r < 18 && g < 18 && b < 18) continue;

                    // Cuantización a bloques de 16 para agrupar tonos similares
                    const qr = Math.round(r / 16) * 16;
                    const qg = Math.round(g / 16) * 16;
                    const qb = Math.round(b / 16) * 16;
                    const key = `${qr},${qg},${qb}`;

                    if (!colorBuckets[key]) {
                        colorBuckets[key] = { r: qr, g: qg, b: qb, count: 0 };
                    }
                    colorBuckets[key].count += 1;
                }

                const bucketsArray = Object.values(colorBuckets);

                if (bucketsArray.length === 0) {
                    resolve({ dominant: [], palettes: getDefaultPalettes() });
                    return;
                }

                // Ponderar cada bucket: mayor puntuación a colores saturados (la identidad de marca del logo)
                bucketsArray.forEach(b => {
                    const [h, s, l] = rgbToHsl(b.r, b.g, b.b);
                    b.hsl = [h, s, l];
                    // Multiplicador por saturación para que logos con fondo gris no elijan el gris
                    const satBonus = 1 + (s / 50);
                    // Penalizar extremos de luminosidad
                    const lumPenalty = (l < 15 || l > 88) ? 0.4 : 1.0;
                    b.score = b.count * satBonus * lumPenalty;
                });

                // Ordenar por score descendente
                bucketsArray.sort((a, b) => b.score - a.score);

                // Filtrar colores suficientemente distintos entre sí
                const distinctColors = [];
                for (const item of bucketsArray) {
                    const isTooClose = distinctColors.some(chosen => {
                        const dr = Math.abs(chosen.r - item.r);
                        const dg = Math.abs(chosen.g - item.g);
                        const db = Math.abs(chosen.b - item.b);
                        return dr + dg + db < 70;
                    });
                    if (!isTooClose) {
                        distinctColors.push(item);
                        if (distinctColors.length >= 4) break;
                    }
                }

                const primaryCandidate = distinctColors[0];
                const secondaryCandidate = distinctColors[1] || null;

                const dominantHexList = distinctColors.map(c => hslToHex(c.hsl[0], c.hsl[1], c.hsl[2]));

                const [h, s, l] = primaryCandidate.hsl;
                const primaryHex = hslToHex(h, s, l);

                // 1. Armonía Directa (Mismo tono de marca del logo, ajustado para legibilidad en encabezados)
                // Asegurar que no sea excesivamente claro para que el texto blanco del PDF resalte
                const adjustedL = Math.min(l, 42); 
                const brandPrimary = hslToHex(h, Math.max(s, 50), adjustedL);
                const brandSecondary = hslToHex(h, Math.min(s + 10, 90), Math.min(adjustedL + 18, 58));

                // 2. Colores de la Marca (si el logo tiene 2 colores distintos detectados)
                let multiColorPalette = null;
                if (secondaryCandidate) {
                    const [sh, ss, sl] = secondaryCandidate.hsl;
                    const secAdjustedL = Math.min(sl, 46);
                    multiColorPalette = {
                        title: 'Dúo Logotipo',
                        desc: 'Tono principal y secundario extraídos directamente de tu logo',
                        primary: brandPrimary,
                        secondary: hslToHex(sh, ss, secAdjustedL),
                        badge: 'Identidad Real'
                    };
                }

                // 3. Alto Contraste Complementario (Opuesto en el círculo cromático)
                const compH = (h + 180) % 360;
                // Si el logo es cálido (rojo/naranja/amarillo), el contraste es azul/índigo frío
                // Si el logo es frío (azul/verde), el contraste es cálido vibrante
                const contrastPrimary = hslToHex(compH, Math.max(s, 55), 32);
                const contrastSecondary = primaryHex; // el color del logo actúa como acento contrastante!

                // 4. Elegante Dark Slate (Fondo o cabecera oscura que hace brillar al logotipo)
                const darkSlatePrimary = hslToHex((h + 210) % 360, 25, 18);
                const darkSlateSecondary = primaryHex;

                // 5. Contraste Cálido / Vibrante
                const triadicH = (h + 120) % 360;
                const triadicPrimary = hslToHex(triadicH, Math.max(s - 10, 45), 35);
                const triadicSecondary = brandPrimary;

                const palettes = [
                    {
                        title: 'Armonía con tu Logo',
                        desc: 'Color corporativo uniforme y coordinado con el tono dominante',
                        primary: brandPrimary,
                        secondary: brandSecondary,
                        badge: 'Recomendado'
                    },
                    ...(multiColorPalette ? [multiColorPalette] : []),
                    {
                        title: 'Alto Contraste',
                        desc: 'Cabecera de contraste complementario para hacer resaltar el logo',
                        primary: contrastPrimary,
                        secondary: contrastSecondary,
                        isContrast: true,
                        badge: 'Contraste'
                    },
                    {
                        title: 'Corporativo Profundo',
                        desc: 'Azul grafito elegante con acentos vibrantes del color de tu marca',
                        primary: darkSlatePrimary,
                        secondary: darkSlateSecondary,
                        badge: 'Ejecutivo'
                    },
                    {
                        title: 'Dinámico Balanceado',
                        desc: 'Combinación triádica con alto dinamismo visual en totales y líneas',
                        primary: triadicPrimary,
                        secondary: triadicSecondary,
                        isContrast: true,
                        badge: 'Moderno'
                    }
                ];

                resolve({
                    dominant: dominantHexList,
                    palettes
                });
            } catch (err) {
                console.error('Error al extraer colores del canvas:', err);
                resolve({ dominant: [], palettes: getDefaultPalettes() });
            }
        };

        img.onerror = (e) => {
            console.warn('No se pudo cargar la imagen para extracción de paleta:', e);
            resolve({ dominant: [], palettes: getDefaultPalettes() });
        };

        img.src = imageSrc;
    });
}

// Paletas por defecto profesionales si no hay logotipo
export function getDefaultPalettes() {
    return [
        {
            title: 'Azul Corporativo Net',
            desc: 'Azul institucional sólido con azul cielo de acento',
            primary: '#004481',
            secondary: '#0284C7',
            badge: 'Clásico'
        },
        {
            title: 'Índigo Tecnológico',
            desc: 'Elegancia moderna para empresas de servicios y software',
            primary: '#4338CA',
            secondary: '#6366F1',
            badge: 'Moderno'
        },
        {
            title: 'Grafito Ejecutivo',
            desc: 'Diseño sobrio y minimalista de alto contraste',
            primary: '#1E293B',
            secondary: '#0F766E',
            badge: 'Minimalista'
        },
        {
            title: 'Esmeralda Fiscal',
            desc: 'Tonos verdes de confianza, comercio y agricultura',
            primary: '#065F46',
            secondary: '#10B981',
            badge: 'Comercial'
        }
    ];
}
