import { Pago, PagoDocumento } from './src/models/index.js'; PagoDocumento.findAll({include:['Documento']}).then(res => { console.log(JSON.stringify(res, null, 2)); process.exit(0); });
