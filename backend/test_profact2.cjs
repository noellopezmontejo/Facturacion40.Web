const axios = require('axios');

async function testProfact() {
    const fakeXmlB64 = Buffer.from('<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"></cfdi:Comprobante>').toString('base64');

    // Test 1: Wrong credentials
    const pacUser_wrong = 'WRONG';
    const pacPass_wrong = 'WRONG';

    const soapEnvelope_wrong = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:TimbraCFDI>
         <tem:usuario>${pacUser_wrong}</tem:usuario>
         <tem:contrasena>${pacPass_wrong}</tem:contrasena>
         <tem:xmlBase64>${fakeXmlB64}</tem:xmlBase64>
      </tem:TimbraCFDI>
   </soapenv:Body>
</soapenv:Envelope>`;

    try {
        console.log('--- TEST WRONG CREDS ---');
        const r1 = await axios.post('https://timbracfdi33.mx:1443/Timbrado.asmx', soapEnvelope_wrong, {
            headers: { 'Content-Type': 'text/xml;charset=UTF-8', 'SOAPAction': 'http://tempuri.org/TimbraCFDI' }
        });
        console.log(r1.data.substring(0, 500));
    } catch (err) {
        console.log('Error:', err.message);
    }
}
testProfact();
