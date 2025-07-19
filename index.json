const express = require("express");
const request = require("request");
const app = express();

const PORT = process.env.PORT || 3000;

// URL del stream de TUDN — remplaza por el enlace que tú uses
const REAL_URL = "https://streaming-live-fcdn.api.prd.univisionnow.com/tudn/tudn.isml/hls/tudn.m3u8";

// Ruta proxy
app.get("/tudn.m3u8", (req, res) => {
  request({
    url: REAL_URL,
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://www.tudn.com",
      "Origin": "https://www.tudn.com"
    }
  }).pipe(res);
});

app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});
