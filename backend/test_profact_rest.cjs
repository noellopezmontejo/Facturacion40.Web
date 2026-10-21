const axios = require('axios');

async function testProfactRest() {
    const fakeXmlB64 = Buffer.from('<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"></cfdi:Comprobante>').toString('base64');
    const token = 'mvpNUXmQfK8=';

    // Testing endpoints usually associated with Profact REST API
    const endpoints = [
        'https://cfdi33-pruebas.facturapronto.mx/api/v1/timbrado/timbrar',
        'https://api.sandbox.facturapronto.mx/v1/timbrado',
        'https://timbracfdi33.mx:1443/api/v1/timbrado',
        'https://timbracfdi33.mx:1443/api/v1/timbrado/timbrar'
    ];

    for (const url of endpoints) {
        try {
            console.log('Testing:', url);
            const res = await axios.post(url, {
                xml: fakeXmlB64
            }, {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                timeout: 3000
            });
            console.log('SUCCESS:', res.status, res.data);
            return;
        } catch (err) {
            console.log('FAILED:', err.message);
        }
    }
}
testProfactRest();
