import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch'; // note node v18+ has fetch natively, but we can use native fetch

const CHUNK_SIZE = 50; // bytes
const fileBuffer = fs.readFileSync('test.csv');
const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE);
const uploadId = 'test-upload-12345';

async function run() {
  for (let i = 0; i < totalChunks; i++) {
    const chunk = fileBuffer.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const formData = new FormData();
    formData.append('file', chunk, 'test.csv');
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('uploadId', uploadId);

    const r = await fetch('http://127.0.0.1:3000/api/bronze/loyalty/upload', {
      method: 'POST',
      body: formData
    });
    console.log(await r.json());
  }
}
run();
