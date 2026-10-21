const fs = require('fs');
const http = require('http');
const path = require('path');

const xsltDir = path.join(__dirname, 'src', 'storage', 'sat_xslt');
const utilUrl = 'http://www.sat.gob.mx/sitio_internet/cfd/2/cadenaoriginal_2_0/utilerias.xslt';

console.log('Descargando utilerias.xslt...');
http.get(utilUrl, (res) => {
    const destPath = path.join(xsltDir, 'utilerias.xslt');
    const dest = fs.createWriteStream(destPath);
    res.pipe(dest);

    dest.on('finish', () => {
        dest.close();
        console.log('Descargado utilerias.xslt exitosamente.');

        const origPath = path.join(xsltDir, 'cadenaoriginal_4_0.xslt');
        let content = fs.readFileSync(origPath, 'utf8');

        // Remover todos los xsl:include
        content = content.replace(/<xsl:include[^>]+>/g, '');

        // Agregar nuestro utilerias local
        const targetString = '<!-- Con el siguiente método';
        content = content.replace(targetString, '<xsl:include href="utilerias.xslt"/>\n  ' + targetString);

        const localPath = path.join(xsltDir, 'cadenaoriginal_4_0_local.xslt');
        fs.writeFileSync(localPath, content);

        console.log('Main XSLT modificado guardado como cadenaoriginal_4_0_local.xslt');
    });
}).on('error', (err) => {
    console.error('Error descargando utilerias:', err);
});
