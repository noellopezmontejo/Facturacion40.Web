const axios = require('axios');

async function testProfactExact() {
    const fakeXmlB64 = Buffer.from('<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"></cfdi:Comprobante>').toString('base64');
    const token = 'mvpNUXmQfK8=';

    // Formato EXACTO de la documentación de Profact
    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body>
<TimbraCFDI xmlns="http://tempuri.org/" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
<usuarioIntegrador>${token}</usuarioIntegrador>
<xmlComprobanteBase64>${fakeXmlB64}</xmlComprobanteBase64>
<idComprobante></idComprobante>
</TimbraCFDI>
</s:Body>
</s:Envelope>`;

    console.log('--- Enviando SOAP exacto de la documentación ---');
    const response = await axios.post('https://timbracfdi33.mx:1443/Timbrado.asmx', soapEnvelope, {
        headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'http://tempuri.org/TimbraCFDI'
        }
    });
    console.log('Response:', response.data.substring(0, 800));
}
testProfactExact().catch(e => console.error('Error:', e.message));
