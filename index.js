// index.js
const express = require('express');
const fetch = require('node-fetch'); // Asegúrate de tener 'node-fetch' instalado: npm install node-fetch
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
    // Esto se aplica a la playlist maestra para las URLs de variantes
    body = body.replace(/(tudn\.isml\/hls\/[^#\n"]+)/g, (match) => `/segment/${match}`);

    // Reescribir sublistas (.m3u8) a /variant/
    body = body.replace(/(tudn-audio_eng=[^#\n"]+\.m3u8)/g, (match) => `/variant/${match}`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body);
  } catch (err) {
    console.error('Error al obtener la playlist maestra:', err);
    res.status(500).send('Error al obtener el stream');
  }
});

// Manejo de variantes (listas secundarias)
app.get('/variant/:file', async (req, res) => {
  const file = req.params.file;
  // Construye la URL para la solicitud al servidor original de TUDN
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

    // *** INICIO DE LA CORRECCIÓN ***
    // Reescribir todas las URLs relativas a segmentos para que pasen por /segment/
    // Esta expresión regular busca nombres de archivo que terminan en .ts, .aac, .mp4, etc.
    // y que NO son líneas de comentarios o directivas HLS (que empiezan con #)
    body = body.replace(/([^#\n"]+\.(?:ts|aac|mp4|m4a|m4s)(\?[^#\n"]*)?)/g, (match) => {
        // Asegúrate de que la URL del segmento incluya el prefijo completo para la ruta /segment/
        // El M3U8 de la variante devuelve solo el nombre del archivo, así que necesitamos añadir el path completo
        // para que la ruta /segment/* pueda reconstruir la URL original a TUDN.
        if (!match.startsWith('tudn.isml/hls/')) {
            // Si la URL del segmento no tiene el prefijo 'tudn.isml/hls/', lo añadimos para la solicitud a TUDN
            // y lo devolvemos con el prefijo /segment/ para el cliente.
            return `/segment/tudn.isml/hls/${match}`;
        }
        // Si ya tiene el prefijo (caso menos probable para las variantes de TUDN), simplemente añadimos /segment/
        return `/segment/${match}`;
    });
    // *** FIN DE LA CORRECCIÓN ***

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body);
  } catch (err) {
    console.error('Error al obtener variante:', err);
    res.status(500).send('Error al obtener variante');
  }
});

// Ruta para servir los segmentos (.ts y otros)
app.get('/segment/*', async (req, res) => {
  const segmentPath = req.params[0]; // Esto capturará el path completo después de /segment/
  const segmentUrl = BASE_URL + segmentPath; // Reconstruye la URL original para TUDN

  try {
    const response = await fetch(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://www.tudn.com',
        'Referer': 'https://www.tudn.com',
      },
    });

    // Establece el Content-Type adecuado para el segmento
    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    // Transmite el cuerpo de la respuesta directamente al cliente
    response.body.pipe(res);
  } catch (err) {
    console.error('Error al obtener segmento:', err);
    res.status(500).send('Error al obtener segmento');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy activo en puerto ${PORT}`);
});

