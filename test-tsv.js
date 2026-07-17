fetch('http://127.0.0.1:3000/api/bronze/loyalty/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: [
      {
        "DATE": "240102",
        "TRANSACTION NUMBER": "1128",
        "REGISTER NUMBER": "16",
        "STORE CODE": "417",
        "STORE CATEGORIZATION": "SMR SMALL",
        "CUSTOMER NUMBER": "51248608-RPC",
        "SKU CODE": "4215456",
        "TRANSACTION TYPE": "REGULAR SALE",
        "LOYALTY SALES": "65.50137594",
        "QTY SOLD": "1.000021007"
      }
    ]
  })
}).then(r => r.json()).then(console.log).catch(console.error);
