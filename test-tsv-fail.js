fetch('http://127.0.0.1:3000/api/bronze/loyalty/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: [
      {
        "DATE": "240102",
        "TRANSACTION NUMBER": "1128"
      }
    ]
  })
}).then(r => r.json()).then(console.log).catch(console.error);
