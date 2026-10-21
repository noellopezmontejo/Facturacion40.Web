const axios = require('axios');

async function testProfact() {
    const fakeXmlB64 = Buffer.from('<cfdi:Comprobante></cfdi:Comprobante>').toString('base64');
    const pacUser = 'WSDL_PAC_TEST'; // Mock fallback per your cfdiService.js
    const pacPass = 'PruebasTimbrado123$';

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:TimbraCFDI>
         <tem:usuario>${pacUser}</tem:usuario>
         <tem:contrasena>${pacPass}</tem:contrasena>
         <tem:xmlBase64>${fakeXmlB64}</tem:xmlBase64>
      </tem:TimbraCFDI>
   </soapenv:Body>
</soapenv:Envelope>`;

    try {
        const response = await axios.post('https://timbracfdi33.mx:1443/Timbrado.asmx', soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'http://tempuri.org/TimbraCFDI'
            }
        });
        console.log('SUCCESS Response:', response.data.substring(0, 1000));
    } catch (err) {
        console.log('ERROR Status:', err.response?.status);
        console.log('ERROR Response:', err.response?.data);
        console.log('ERROR Default:', err.message);
    }
}
testProfact();
