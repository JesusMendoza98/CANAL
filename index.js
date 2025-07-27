// index.js
const express = require('express');
const fetch = require('node-fetch'); // Asegúrate de tener 'node-fetch' instalado: npm install node-fetch
const app = express();

const PORT = process.env.PORT || 3000;

// URL base del stream original de TUDN
const BASE_URL = 'https://streaming-live-fcdn.api.prd.univisionnow.com/tudn/';
// Ruta al manifiesto maestro (.m3u8) del stream de TUDN
const M3U8_PATH = 'tudn.isml/hls/tudn.m3u8';

// Ruta raíz informativa para el proxy
app.get('/', (req, res) => {
  res.send('Este es el proxy de TUDN. Usa /tudn para acceder al stream. Añade ?enable_subs=true para intentar habilitar subtítulos, o ?disable_subs=true para deshabilitarlos.');
});

// Ruta principal para servir la lista de reproducción maestra (.m3u8)
app.get('/tudn.m3u8', async (req, res) => {
  try {
    // Realiza una solicitud al servidor original de TUDN para obtener el manifiesto maestro
    const response = await fetch(BASE_URL + M3U8_PATH, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // User-Agent común
        'Origin': 'https://www.tudn.com', // Establece el Origin para evitar problemas de CORS
        'Referer': 'https://www.tudn.com', // Establece el Referer para simular una solicitud desde el sitio web
      },
    });

    // Convierte la respuesta a texto (el contenido del archivo .m3u8)
    let body = await response.text();

    // *** LÓGICA PARA HABILITAR/DESHABILITAR SUBTÍTULOS ***
    const enableSubs = req.query.enable_subs === 'true'; // Verifica si el parámetro enable_subs=true está presente
    const disableSubs = req.query.disable_subs === 'true'; // Verifica si el parámetro disable_subs=true está presente

    if (disableSubs) {
        console.log('Deshabilitando subtítulos: Eliminando directivas de subtítulos del manifiesto.');
        // Elimina todas las líneas que definen pistas de subtítulos (#EXT-X-MEDIA:TYPE=SUBTITLES)
        body = body.replace(/#EXT-X-MEDIA:TYPE=SUBTITLES[^\n]*/g, '');
        // Opcional: También podrías eliminar DEFAULT=YES de audio/video si no quieres que nada sea predeterminado
        body = body.replace(/#EXT-X-MEDIA:TYPE=(AUDIO|VIDEO)(.*?)DEFAULT=YES/g, '#EXT-X-MEDIA:TYPE=$1$2DEFAULT=NO');

    } else if (enableSubs) {
      console.log('Intentando habilitar subtítulos...');
      // Si se pide habilitar, aseguramos que audio/video no sea DEFAULT=YES para evitar conflictos
      body = body.replace(/#EXT-X-MEDIA:TYPE=(AUDIO|VIDEO)(.*?)DEFAULT=YES/g, '#EXT-X-MEDIA:TYPE=$1$2DEFAULT=NO');

      // Buscar la primera pista de subtítulos y establecer DEFAULT=YES
      const subtitleRegex = /(#EXT-X-MEDIA:TYPE=SUBTITLES[^,\n]*)(DEFAULT=(NO|YES))?([^#\n]*)/;
      const match = body.match(subtitleRegex);

      if (match && match[2] !== 'DEFAULT=YES') { 
        body = body.replace(subtitleRegex, (fullMatch, preDefault, defaultAttr, defaultVal, postDefault) => {
          console.log(`Pista de subtítulos encontrada para habilitar: ${fullMatch}`);
          if (defaultAttr) { 
            return `${preDefault}DEFAULT=YES${postDefault}`;
          } else { 
            if (preDefault.endsWith(',')) {
              return `${preDefault}DEFAULT=YES${postDefault}`;
            } else { 
              return `${preDefault},DEFAULT=YES${postDefault}`;
            }
          }
        });
        console.log('Subtítulos modificados a DEFAULT=YES');
      } else if (match && match[2] === 'DEFAULT=YES') {
        console.log('Pista de subtítulos ya es DEFAULT=YES. No se requiere modificación para habilitar.');
      } else {
        console.log('No se encontraron pistas de subtítulos modificables en el manifiesto maestro para habilitar.');
      }
    }
    // *** FIN DE LA LÓGICA PARA HABILITAR/DESHABILITAR SUBTÍTULOS ***


    // Reescribe las rutas internas de las variantes de stream (ej. diferentes calidades de video)
    // para que pasen por la ruta /segment/ de este proxy.
    body = body.replace(/(tudn\.isml\/hls\/[^#\n"]+)/g, (match) => `/segment/${match}`);

    // Reescribe las rutas de las sublistas de audio (ej. tudn-audio_eng=...)
    // para que pasen por la ruta /variant/ de este proxy.
    body = body.replace(/(tudn-audio_eng=[^#\n"]+\.m3u8)/g, (match) => `/variant/${match}`);

    // Establece el tipo de contenido adecuado para un archivo HLS .m3u8
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body); // Envía el manifiesto modificado al cliente
  } catch (err) {
    console.error('Error al obtener la playlist maestra:', err);
    res.status(500).send('Error al obtener el stream');
  }
});

// Manejo de variantes de stream (listas de reproducción secundarias: .m3u8 para calidades o audios)
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

    body = body.replace(/([^#\n"]+\.(?:ts|aac|mp4|m4a|m4s)(\?[^#\n"]*)?)/g, (match) => {
        if (!match.startsWith('tudn.isml/hls/')) {
            return `/segment/tudn.isml/hls/${match}`;
        }
        return `/segment/${match}`;
    });

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(body); 
  } catch (err) {
    console.error('Error al obtener variante:', err);
    res.status(500).send('Error al obtener variante');
  }
});

// Ruta para servir los segmentos de medios (.ts, .aac, etc.)
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
