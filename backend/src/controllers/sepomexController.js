import { sequelize } from '../config/database.js';

export const getByCodigoPostal = async (req, res) => {
    try {
        const { cp } = req.params;

        // 1. Fetch CP details to get Estado and Municipio codes
        const [cpRows] = await sequelize.query(
            "SELECT c_Estado, c_Municipio FROM c_cp WHERE c_CP = :cp LIMIT 1",
            { replacements: { cp } }
        );

        if (!cpRows || cpRows.length === 0) {
            return res.status(404).json({ message: 'No se encontraron registros para este código postal' });
        }

        const { c_Estado, c_Municipio } = cpRows[0];

        // 2. Fetch Estado name
        const [estadoRows] = await sequelize.query(
            "SELECT Descripcion FROM c_estado WHERE c_Estado = :c_Estado LIMIT 1",
            { replacements: { c_Estado } }
        );
        const estadoNombre = estadoRows.length > 0 ? estadoRows[0].Descripcion : c_Estado;

        // 3. Fetch Municipio name
        const [munRows] = await sequelize.query(
            "SELECT Descripcion FROM c_municipio WHERE c_Municipio = :c_Municipio AND c_Estado = :c_Estado LIMIT 1",
            { replacements: { c_Municipio, c_Estado } }
        );
        const municipioNombre = munRows.length > 0 ? munRows[0].Descripcion : c_Municipio;

        // 4. Fetch Colonias
        const [coloniaRows] = await sequelize.query(
            "SELECT Nombre, c_Colonia FROM c_colonia WHERE c_CodigoPostal = :cp",
            { replacements: { cp } }
        );

        const result = {
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
        };

        res.json(result);
    } catch (error) {
        console.error("Error fetching sepomex by cp:", error);
        res.status(500).json({ message: 'Error interno del servidor al consultar catálogos' });
    }
};
