import { Documento } from './src/models/index.js'; Documento.findOne({where: {serie: 'A', folio: '10'}}).then(d => { console.log(d.toJSON()); process.exit(0); });
