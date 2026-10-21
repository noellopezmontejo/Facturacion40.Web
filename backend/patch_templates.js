const fs = require('fs');
const path = require('path');

const templatesDir = path.join(__dirname, 'src', 'templates');
const files = fs.readdirSync(templatesDir);

files.forEach(file => {
    if (file.startsWith('invoice_') && file.endsWith('.html')) {
        const filePath = path.join(templatesDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Fix unidad
        content = content.replace(/\{\{this\.Concepto\.unidad\}\}/g, '{{#if this.unidad}}{{this.unidad}}{{else if this.clave_unidad}}{{this.clave_unidad}}{{else}}{{this.Concepto.unidad}}{{/if}}');
        
        // Fix clave_sat
        content = content.replace(/\{\{this\.Concepto\.clave_sat\}\}/g, '{{#if this.clave_sat}}{{this.clave_sat}}{{else}}{{this.Concepto.clave_prod_serv}}{{/if}}');
        
        // Fix descripcion
        content = content.replace(/\{\{this\.Concepto\.descripcion\}\}/g, '{{#if this.descripcion}}{{this.descripcion}}{{else}}{{this.Concepto.descripcion}}{{/if}}');

        fs.writeFileSync(filePath, content);
        console.log(`Patched ${file}`);
    }
});
