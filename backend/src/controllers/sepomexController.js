import { sequelize } from '../config/database.js';
import axios from 'axios';

const ESTADO_MAP = {
    'aguascalientes': 'AGU',
    'baja california': 'BCN',
    'baja california sur': 'BCS',
    'campeche': 'CAM',
    'chiapas': 'CHP',
    'chihuahua': 'CHH',
    'coahuila': 'COA',
    'coahuila de zaragoza': 'COA',
    'colima': 'COL',
    'ciudad de mexico': 'DIF',
    'distrito federal': 'DIF',
    'durango': 'DUR',
    'guanajuato': 'GUA',
    'guerrero': 'GRO',
    'hidalgo': 'HID',
    'jalisco': 'JAL',
    'estado de mexico': 'MEX',
    'mexico': 'MEX',
    'michoacan': 'MIC',
    'michoacan de ocampo': 'MIC',
    'morelos': 'MOR',
    'nayarit': 'NAY',
    'nuevo leon': 'NLE',
    'oaxaca': 'OAX',
    'puebla': 'PUE',
    'queretaro': 'QUE',
    'quintana roo': 'ROO',
    'san luis potosi': 'SLP',
    'sinaloa': 'SIN',
    'sonora': 'SON',
    'tabasco': 'TAB',
    'tamaulipas': 'TAM',
    'tlaxcala': 'TLA',
    'veracruz': 'VER',
    'veracruz de ignacio de la llave': 'VER',
    'yucatan': 'YUC',
    'zacatecas': 'ZAC'
};

const getSatEstadoCode = (nombre) => {
    if (!nombre) return '';
    const norm = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return ESTADO_MAP[norm] || nombre.substring(0, 3).toUpperCase();
};

export const getByCodigoPostal = async (req, res) => {
    const { cp } = req.params;

    // 1. Intentar consulta en base de datos local si existen las tablas SAT
    try {
        const [cpRows] = await sequelize.query(
            "SELECT c_Estado, c_Municipio FROM c_cp WHERE c_CP = :cp LIMIT 1",
            { replacements: { cp } }
        );

        if (cpRows && cpRows.length > 0) {
            const { c_Estado, c_Municipio } = cpRows[0];

            const [estadoRows] = await sequelize.query(
                "SELECT Descripcion FROM c_estado WHERE c_Estado = :c_Estado LIMIT 1",
                { replacements: { c_Estado } }
            );
            const estadoNombre = estadoRows.length > 0 ? estadoRows[0].Descripcion : c_Estado;

            const [munRows] = await sequelize.query(
                "SELECT Descripcion FROM c_municipio WHERE c_Municipio = :c_Municipio AND c_Estado = :c_Estado LIMIT 1",
                { replacements: { c_Municipio, c_Estado } }
            );
            const municipioNombre = munRows.length > 0 ? munRows[0].Descripcion : c_Municipio;

            const [coloniaRows] = await sequelize.query(
                "SELECT Nombre, c_Colonia FROM c_colonia WHERE c_CodigoPostal = :cp",
                { replacements: { cp } }
            );

            return res.json({
                codigo_postal: cp,
                estado: {
                    id: c_Estado,
                    nombre: estadoNombre,
                    c_estado: c_Estado
                },
                municipio: {
                    id: c_Municipio,
                    nombre: municipioNombre,
                    c_municipio: c_Municipio
                },
                colonias: coloniaRows.map(c => ({
                    id: c.c_Colonia,
                    nombre: c.Nombre,
                    c_colonia: c.c_Colonia
                }))
            });
        }
    } catch (dbError) {
        console.warn(`Tablas locales de CP no disponibles (${dbError.message}). Usando servicio postal alterno.`);
    }

    // 2. Si no existen tablas locales o no hubo resultados, consultar servicio público SEPOMEX / CorreosMéxico
    try {
        const onlineRes = await axios.get(`https://correosmexico.com.mx/api/cp?cp=${encodeURIComponent(cp)}`, {
            timeout: 4000,
            headers: { 'Accept': 'application/json' }
        });

        if (onlineRes.data && onlineRes.data.resultados && onlineRes.data.resultados.length > 0) {
            const results = onlineRes.data.resultados;
            const primer = results[0];
            const estadoNombre = primer.estado || '';
            const c_Estado = getSatEstadoCode(estadoNombre);
            const municipioNombre = primer.municipio || primer.ciudad || estadoNombre;

            const colonias = results.map((r, idx) => ({
                id: String(idx + 1).padStart(4, '0'),
                nombre: r.asentamiento,
                c_colonia: String(idx + 1).padStart(4, '0')
            }));

            return res.json({
                codigo_postal: cp,
                estado: {
                    id: c_Estado,
                    nombre: estadoNombre,
                    c_estado: c_Estado
                },
                municipio: {
                    id: municipioNombre,
                    nombre: municipioNombre,
                    c_municipio: municipioNombre
                },
                colonias
            });
        }
    } catch (api1Error) {
        console.warn(`CorreosMéxico API fallback no respondió (${api1Error.message}), probando Zippopotam...`);
    }

    // 3. Respaldo secundario Zippopotam
    try {
        const zipRes = await axios.get(`https://api.zippopotam.us/mx/${encodeURIComponent(cp)}`, {
            timeout: 3000
        });

        if (zipRes.data && zipRes.data.places && zipRes.data.places.length > 0) {
            const places = zipRes.data.places;
            const estadoNombre = places[0].state || '';
            const c_Estado = getSatEstadoCode(estadoNombre);
            const municipioNombre = estadoNombre;

            const colonias = places.map((p, idx) => ({
                id: String(idx + 1).padStart(4, '0'),
                nombre: p['place name'],
                c_colonia: String(idx + 1).padStart(4, '0')
            }));

            return res.json({
                codigo_postal: cp,
                estado: {
                    id: c_Estado,
                    nombre: estadoNombre,
                    c_estado: c_Estado
                },
                municipio: {
                    id: municipioNombre,
                    nombre: municipioNombre,
                    c_municipio: municipioNombre
                },
                colonias
            });
        }
    } catch (zipError) {
        console.warn(`Zippopotam API no respondió (${zipError.message})`);
    }

    // Si no se encuentra en ningún lado, devolver 404 limpio
    return res.status(404).json({
        message: 'No se encontraron registros para este código postal'
    });
};
