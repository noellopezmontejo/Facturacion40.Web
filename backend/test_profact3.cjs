const axios = require('axios');

async function testProfact() {
    const fakeXmlB64 = Buffer.from('<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"></cfdi:Comprobante>').toString('base64');
    const pacUser = 'WSDL_PAC_TEST';
    const idComprobante = '12345'; // Identificador único de transacción

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:TimbraCFDI>
         <tem:usuarioIntegrador>${pacUser}</tem:usuarioIntegrador>
         <tem:xmlComprobanteBase64>${fakeXmlB64}</tem:xmlComprobanteBase64>
         <tem:idComprobante>${idComprobante}</tem:idComprobante>
      </tem:TimbraCFDI>
   </soapenv:Body>
</soapenv:Envelope>`;

    try {
        console.log('Sending correct envelope...');
        const response = await axios.post('https://timbracfdi33.mx:1443/Timbrado.asmx', soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'http://tempuri.org/TimbraCFDI'
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
testProfact();
