const axios = require('axios');

async function testProfactSoapAuth() {
    const fakeXmlB64 = Buffer.from('<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"></cfdi:Comprobante>').toString('base64');
    const token = 'mvpNUXmQfK8=';
    const idComprobante = '12345';

    // Omitimos usuarioIntegrador en el Body porque ahora va en el Header HTTP según el usuario
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:TimbraCFDI>
         <tem:usuarioIntegrador></tem:usuarioIntegrador>
         <tem:xmlComprobanteBase64>${fakeXmlB64}</tem:xmlComprobanteBase64>
         <tem:idComprobante>${idComprobante}</tem:idComprobante>
      </tem:TimbraCFDI>
   </soapenv:Body>
</soapenv:Envelope>`;

    try {
        console.log('Sending SOAP envelope with Bearer header...');
        const response = await axios.post('https://timbracfdi33.mx:1443/Timbrado.asmx', soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'http://tempuri.org/TimbraCFDI',
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('SUCCESS Response:', response.data.substring(0, 1000));
    } catch (err) {
        console.log('ERROR Status:', err.response?.status);
        if (err.response) {
            console.log('ERROR Data:', err.response.data);
        } else {
            console.log('ERROR Msg:', err.message);
        }
    }
}
testProfactSoapAuth();
