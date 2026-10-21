const axios = require('axios');

async function testProfactSandbox() {
    const fakeXmlB64 = Buffer.from('<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"></cfdi:Comprobante>').toString('base64');
    const token = 'mvpNUXmQfK8=';

    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body>
<TimbraCFDI xmlns="http://tempuri.org/" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
<usuarioIntegrador>${token}</usuarioIntegrador>
<xmlComprobanteBase64>${fakeXmlB64}</xmlComprobanteBase64>
<idComprobante></idComprobante>
</TimbraCFDI>
</s:Body>
</s:Envelope>`;

    console.log('Probando URL SANDBOX correcta: https://pruebas.timbracfdi33.mx/Timbrado.asmx');
    const response = await axios.post('https://pruebas.timbracfdi33.mx/Timbrado.asmx', soapEnvelope, {
        headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'http://tempuri.org/TimbraCFDI'
        }
    });
    console.log('Response:', response.data.substring(0, 800));
}
testProfactSandbox().catch(e => {
    console.error('Error:', e.message);
    if (e.response) console.log('Response data:', e.response.data?.substring(0, 300));
});
