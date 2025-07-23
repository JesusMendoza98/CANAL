// index.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

const PORT = process.env.PORT || 3000;

const BASE_URL = 'https://streaming-live-fcdn.api.prd.univisionnow.com/tudn/';
const M3U8_PATH = 'tudn.isml/hls/tudn.m3u8';

// Ruta raíz informativa
app.get('/', (req, res) => {
  res.send('Este es el proxy de TUDN. Usa /tudn');
});

// Ruta principal que devuelve la lista maestra (.m3u8)
app.get('/tudn', async (req, res) => {
  try {
    const response = await fetch(BASE_URL + M3U8_PATH, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://www.tudn.com',
        'Referer': 'https://www.tudn.com',
      },
    });

    let body = await response.text();

    // Reescribir rutas internas de segmentos a /segment/
    body = body.replace(/tudn\.isml\/hls\/[^#\n"]+/g, (match) => `/segment/${match}`);

    // Reescribir sublistas (.m3u8) a /variant/
    body = body.replace(/(tudn-audio_eng=[^#\n"]+\.m3u8)/g, (match) => `/variant/${match}`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body);
  } catch (err) {
    console.error('Error al obtener la playlist:', err);
    res.status(500).send('Error al obtener el stream');
  }
});

// Maneja las sublistas (.m3u8) de variantes
app.get('/variant/:file', async (req, res) => {
  const file = req.params.file;
  const url = BASE_URL + 'tudn.isml/hls/' + file;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://www.tudn.com',
        'Referer': 'https://www.tudn.com',
      },
    });

    let body = await response.text();

    // Reescribir segmentos a /segment/
    body = body.replace(/tudn\.isml\/hls\/[^#\n"]+/g, (match) => `/segment/${match}`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body);
  } catch (err) {
    console.error('Error al obtener variante:', err);
    res.status(500).send('Error al obtener variante');
  }
});

// Ruta para servir los segmentos (.ts y otros)
app.get('/segment/*', async (req, res) => {
  const segmentPath = req.params[0];
  const segmentUrl = BASE_URL + segmentPath;

  try {
    const response = await fetch(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://www.tudn.com',
        'Referer': 'https://www.tudn.com',
      },
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

