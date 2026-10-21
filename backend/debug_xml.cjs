const { generarXML } = require('./src/services/cfdiService.js');

const emisor = {
    rfc: 'EKU9003173C9',
    razon_social: 'ESCUELA KEMPER URGATE',
    regimen_fiscal: '601',
    codigo_postal: '50000'
};

const receptor = {
    rfc: 'URE180429TM6',
    razon_social: 'UNIVERSIDAD ROBOTICA ESPAÑOLA',
    regimen_fiscal: '601',
    codigo_postal: '65000',
    uso_cfdi: 'G03'
};

const documento = {
    id: 1,
    serie: 'A',
    folio: '1',
    tipo_comprobante: 'I',
    moneda: 'MXN',
    subtotal: 100,
    total: 116,
    fecha: new Date(),
    forma_pago: '01',
    metodo_pago: 'PUE',
    impuestos_locales: {
        traslados: [{ impuesto: 'ISH', tasa: 3, importe: 3 }],
        retenciones: []
    }
};

const detalles = [{
    id: 1,
    cantidad: 1,
    valor_unitario: 100,
    importe: 100,
    es_objeto_imp: '02',
    Concepto: {
        clave_prod_serv: '01010101',
        clave_unidad: 'E48',
        unidad: 'SERVICIO',
        descripcion: 'TEST'
    },
    Impuestos: [{ tipo: 'traslado', descripcion: 'IVA', tasa_cuota: 0.16 }]
}];

generarXML(documento, emisor, receptor, detalles).then(xml => {
    console.log(xml);
}).catch(err => {
    console.error(err);
});
