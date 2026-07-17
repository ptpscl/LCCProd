import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch'; // note node v18+ has fetch natively, but we can use native fetch

const formData = new FormData();
formData.append('file', fs.createReadStream('test.csv'));

fetch('http://127.0.0.1:3000/api/bronze/loyalty/upload', {
  method: 'POST',
  body: formData
}).then(r => r.json()).then(console.log).catch(console.error);
