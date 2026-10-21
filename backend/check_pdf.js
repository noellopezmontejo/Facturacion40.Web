import { Documento } from './src/models/index.js'; Documento.findOne({ order: [['id', 'DESC']] }).then(d => { console.log(d.toJSON()); process.exit(0); });
