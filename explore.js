const sdk = require('@0xpolygonid/js-sdk');
const fs = require('fs');
fs.writeFileSync('output.txt', JSON.stringify(Object.keys(sdk).filter(k => k.toLowerCase().includes('storage') || k.toLowerCase().includes('identity') || k.toLowerCase().includes('kms') || k.toLowerCase().includes('auth') || k.toLowerCase().includes('provid') || k.toLowerCase().includes('cred')), null, 2), 'utf-8');
