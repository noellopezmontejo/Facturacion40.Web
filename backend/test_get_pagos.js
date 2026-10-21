import { Pago, Receptor, Documento, PagoDocumento } from './src/models/index.js';

async function test() {
    try {
        const pagos = await Pago.findAll({
            include: [
                { model: Receptor, attributes: ['razon_social', 'rfc'] },
                { model: Documento, attributes: ['id', 'serie', 'folio', 'uuid'], through: { attributes: ['num_parcialidad', 'imp_pagado'] } }
            ]
        });
        console.log("Found:", pagos.length);
    } catch (e) {
        console.error("ERROR FETCHING PAGOS:", e);
    } finally {
        process.exit();
    }
}

test();
