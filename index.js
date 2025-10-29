// index.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

const PORT = process.env.PORT || 3000;

/**
 * 1️⃣ Configura aquí tus canales
 * Puedes agregar más entradas con nombre y URLs base correspondientes.
 */
const channels = {
  tudn: {
    base: 'https://streaming-live-fcdn.api.prd.univisionnow.com/tudn/',
    path: 'tudn.isml/hls/tudn.m3u8',
    origin: 'https://www.tudn.com',
    referer: 'https://www.tudn.com'
  },
  canal2: {
    base: 'https://e3.thetvapp.to/',
    path: 'hls/espn-deportes/index.m3u8',
    origin: 'https://e3.thetvapp.to',
    referer: 'https://e3.thetvapp.to'
  }
};

// 🏠 Ruta raíz informativa
app.get('/', (req, res) => {
  res.send('Proxy multi-canal activo. Usa /tudn.m3u8 o /canal2.m3u8 según el canal.');
});

// 🎥 Ruta dinámica para cada canal: /:canal.m3u8
app.get('/:channel.m3u8', async (req, res) => {
  const channel = req.params.channel;
  const config = channels[channel];

  if (!config) {
    return res.status(404).send('Canal no encontrado');
  }

  try {
    const response = await fetch(config.base + config.path, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': config.origin,
        'Referer': config.referer
      }
    });

    let body = await response.text();

    // 🔁 Reescribe rutas internas para pasar por /segment/:channel/
    body = body.replace(/([^\n"]+\.m3u8)/g, (m) => `/variant/${channel}/${m}`);
    body = body.replace(/([^\n"]+\.(ts|aac|m4s|mp4|m4a))/g, (m) => `/segment/${channel}/${m}`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body);
  } catch (err) {
    console.error(`Error obteniendo manifest del canal ${channel}:`, err);
    res.status(500).send('Error al obtener el stream');
  }
});

// 🎧 Variantes de audio/video
app.get('/variant/:channel/:file', async (req, res) => {
  const { channel, file } = req.params;
  const config = channels[channel];
  if (!config) return res.status(404).send('Canal no encontrado');

  const url = config.base + 'tudn.isml/hls/' + file; // Ajusta si tu estructura cambia
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': config.origin,
        'Referer': config.referer
      }
    });

    let body = await response.text();
    body = body.replace(/([^\n"]+\.(ts|aac|m4s|mp4|m4a))/g, (m) => `/segment/${channel}/${m}`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body);
  } catch (err) {
    console.error(`Error en variante de ${channel}:`, err);
    res.status(500).send('Error al obtener variante');
  }
});

// 📦 Segmentos
app.get('/segment/:channel/*', async (req, res) => {
  const { channel } = req.params;
  const config = channels[channel];
  if (!config) return res.status(404).send('Canal no encontrado');

  const segmentPath = req.params[0];
  const segmentUrl = config.base + segmentPath;

  try {
    const response = await fetch(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': config.origin,
        'Referer': config.referer
      }
    });

    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    response.body.pipe(res);
  } catch (err) {
    console.error(`Error obteniendo segmento del canal ${channel}:`, err);
    res.status(500).send('Error al obtener segmento');
  }
});

// 🚀 Inicio
app.listen(PORT, () => {
  console.log(`Servidor proxy activo en puerto ${PORT}`);
});
