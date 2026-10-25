import { sequelize } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { getEmissorDir } from './storageHelper.js';
import { generateDynamicEmisorLogo } from '../services/pdfService.js';

async function main() {
    try {
        const [emisores] = await sequelize.query('SELECT id, razon_social, rfc FROM Emisores');
        console.log(`Encontrados ${emisores.length} emisores para inicializar logotipos.`);

        for (const em of emisores) {
            const dir = getEmissorDir(em.rfc, 'logos');
            const svgPath = path.join(dir, 'logo_default.svg');

            // Generar SVG con colores corporativos
            const dataUri = generateDynamicEmisorLogo(em, { color_primario: '#004481', color_secundario: '#123247' });
            const svgContent = decodeURIComponent(dataUri.replace('data:image/svg+xml;utf8,', ''));
            fs.writeFileSync(svgPath, svgContent, 'utf8');

            const logoUrl = `/storage/${em.rfc}/logos/logo_default.svg`;
            console.log(`Logo creado para [${em.rfc}] ${em.razon_social}: ${logoUrl}`);

            // Verificar si existe configuración de estilo
            const [existing] = await sequelize.query('SELECT id, logo_url FROM configuraciones_estilos WHERE emisor_id = ?', {
                replacements: [em.id]
            });

            if (existing && existing.length > 0) {
                // Si no tiene logo o es null, asignarle el logo generado
                if (!existing[0].logo_url) {
                    await sequelize.query('UPDATE configuraciones_estilos SET logo_url = ?, updatedAt = NOW() WHERE emisor_id = ?', {
                        replacements: [logoUrl, em.id]
                    });
                    console.log(`  -> Actualizado emisor ${em.id} con logo_url.`);
                } else {
                    console.log(`  -> Emisor ${em.id} ya tenía logo_url: ${existing[0].logo_url}`);
                }
            } else {
                await sequelize.query(`
                    INSERT INTO configuraciones_estilos 
                    (emisor_id, logo_url, color_primario, color_secundario, tipo_letra, layout_id, createdAt, updatedAt) 
                    VALUES (?, ?, '#004481', '#123247', 'Inter', 'v1', NOW(), NOW())
                `, {
                    replacements: [em.id, logoUrl]
                });
                console.log(`  -> Insertada nueva configuración de estilo para emisor ${em.id}.`);
            }
        }
        console.log('Inicialización de logotipos completada con éxito.');
        process.exit(0);
    } catch (err) {
        console.error('Error inicializando logotipos:', err);
        process.exit(1);
    }
}

main();
