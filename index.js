// index.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

const PORT = process.env.PORT || 3000;

const BASE_URL = 'https://streaming-live-fcdn.api.prd.univisionnow.com/tudn/';
const M3U8_PATH = 'tudn.isml/hls/tudn.m3u8';

app.get('/tudn', async (req, res) => {
  try {
    const response = await fetch(BASE_URL + M3U8_PATH, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://www.tudn.com',
        'Referer': 'https://www.tudn.com'
      }
    });

    let body = await response.text();

    // Reescribe las rutas internas .ts y .m3u8 para pasarlas por el proxy
    body = body.replace(/tudn\.isml\/hls\/[^#\n"]+/g, (match) => `/segment/${match}`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body);
  } catch (err) {
    console.error('Error al obtener la playlist:', err);
    res.status(500).send('Error al obtener el stream');
  }
});

app.get('/segment/*', async (req, res) => {
  const segmentPath = req.params[0];
  const segmentUrl = BASE_URL + segmentPath;

  try {
    const response = await fetch(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://www.tudn.com',
        'Referer': 'https://www.tudn.com'
      }
    });

    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    response.body.pipe(res);
  } catch (err) {
    console.error('Error al obtener segmento:', err);
    res.status(500).send('Error al obtener segmento');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy activo en puerto ${PORT}`);
});
