import forge from 'node-forge';

const pki = forge.pki;
console.log('--- Forge PKI Methods ---');
console.log('pki has decryptPrivateKey:', !!pki.decryptPrivateKey);
console.log('pki has decryptPrivateKeyInfo:', !!pki.decryptPrivateKeyInfo);
console.log('pki has privateKeyFromAsn1:', !!pki.privateKeyFromAsn1);
console.log('pki has privateKeyFromPrivateKeyInfo:', !!pki.privateKeyFromPrivateKeyInfo);
console.log('pki has privateKeyToPem:', !!pki.privateKeyToPem);

// Verificando cómo invocar decryption
// SAT keys son típicamente PKCS#8 DER Encrypted.
// Según docs de forge 1.x:
// forge.pki.decryptPrivateKey(derBinary, password) -> PrivateKey
