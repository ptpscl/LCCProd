fetch('http://127.0.0.1:3000/api/bronze/loyalty/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: [
      {
        "DATE": "240315",
        "TRANSACTION NUMBER": "123",
        "REGISTER NUMBER": "1",
        "STORE CODE": "S1",
        "STORE CATEGORIZATION": "A",
        "CUSTOMER NUMBER": "C1",
        "SKU CODE": "SKU1",
        "LOYALTY SALES": "100",
        "QTY SOLD": "1"
      }
    ]
  })
}).then(r => r.json()).then(console.log).catch(console.error);
