const express = require('express');
const fetch = require('node-fetch'); // Nota: Asegúrate de tener node-fetch v2 o usa 'import' para v3+. Para Express, 'require' con v2 es común.
const app = express();

// Configuración de CORS para permitir solicitudes desde cualquier origen
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const PORT = process.env.PORT || 3000;

/**
 * 1️⃣ Configura aquí tus canales
 * Se usa 'prefix' para indicar la ruta del directorio donde se encuentran las variantes y segmentos,
 * lo cual es clave para que el proxy funcione correctamente.
 */
const channels = {
    tudn: {
        base: 'https://streaming-live-fcdn.api.prd.univisionnow.com/tudn/',
        prefix: 'tudn.isml/hls/', // Directorio donde viven las variantes (e.g., index_720p.m3u8) y segmentos
        manifest: 'tudn.m3u8',    // Nombre del manifiesto principal
        origin: 'https://www.tudn.com',
        referer: 'https://www.tudn.com'
    },
    canal2: {
        base: 'https://e3.thetvapp.to/',
        prefix: 'hls/espn-deportes/', // Directorio donde viven las variantes y segmentos
        manifest: 'index.m3u8',     // Nombre del manifiesto principal
        origin: 'https://e3.thetvapp.to',
        referer: 'https://e3.thetvapp.to'
    }
};

// 🏠 Ruta raíz informativa
app.get('/', (req, res) => {
    res.send('Proxy multi-canal activo. Usa el nombre del canal seguido de .m3u8, e.g., /tudn.m3u8 o /canal2.m3u8.');
});

// 🎥 Ruta dinámica para el manifiesto principal: /:canal.m3u8
app.get('/:channel.m3u8', async (req, res) => {
    const channel = req.params.channel;
    const config = channels[channel];

    if (!config) {
        return res.status(404).send('Canal no encontrado');
    }

    try {
        const fullUrl = config.base + config.prefix + config.manifest;

        const response = await fetch(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Origin': config.origin,
                'Referer': config.referer
            }
        });

        if (!response.ok) {
            console.error(`Respuesta no ok (${response.status}) del canal ${channel}: ${fullUrl}`);
            return res.status(response.status).send(`Error al obtener el manifiesto: ${response.statusText}`);
        }

        let body = await response.text();

        // 🔁 Reescribe rutas internas: /variant/ para otros .m3u8 y /segment/ para .ts/.aac/.mp4
        // Nota: Las rutas relativas dentro del manifiesto (e.g., variant.m3u8) se reemplazan con la ruta local del proxy.
        body = body.replace(/([^\n"]+\.m3u8)/g, (m) => `/variant/${channel}/${m}`);
        body = body.replace(/([^\n"]+\.(ts|aac|m4s|mp4|m4a))/g, (m) => `/segment/${channel}/${m}`);

        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(body);
    } catch (err) {
        console.error(`Error obteniendo manifest del canal ${channel}:`, err);
        res.status(500).send('Error al obtener el stream');
    }
});

// 🎧 Ruta para las variantes de audio/video (manifiestos secundarios)
app.get('/variant/:channel/:file', async (req, res) => {
    const { channel, file } = req.params;
    const config = channels[channel];
    if (!config) return res.status(404).send('Canal no encontrado');

    // La variante se encuentra en la base + prefix + nombre del archivo (file)
    const url = config.base + config.prefix + file; 
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Origin': config.origin,
                'Referer': config.referer
            }
        });

        if (!response.ok) {
            console.error(`Respuesta no ok (${response.status}) de variante ${file} del canal ${channel}`);
            return res.status(response.status).send(`Error al obtener variante: ${response.statusText}`);
        }

        let body = await response.text();
        
        // 🔁 Reescribe las referencias a segmentos dentro de este manifiesto de variante
        body = body.replace(/([^\n"]+\.(ts|aac|m4s|mp4|m4a))/g, (m) => `/segment/${channel}/${m}`);

        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(body);
    } catch (err) {
        console.error(`Error en variante de ${channel}:`, err);
        res.status(500).send('Error al obtener variante');
    }
});

// 📦 Ruta para los segmentos de video y audio
app.get('/segment/:channel/*', async (req, res) => {
    const { channel } = req.params;
    const config = channels[channel];
    if (!config) return res.status(404).send('Canal no encontrado');

    // req.params[0] contiene la parte de la ruta después de /segment/:channel/
    const segmentPath = req.params[0];

    // La URL completa del segmento es base + prefix + segmentPath
    const segmentUrl = config.base + config.prefix + segmentPath;

    try {
        const response = await fetch(segmentUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Origin': config.origin,
                'Referer': config.referer
            }
        });

        if (!response.ok) {
            console.error(`Respuesta no ok (${response.status}) de segmento ${segmentPath} del canal ${channel}`);
            return res.status(response.status).send(`Error al obtener segmento: ${response.statusText}`);
        }

        // Configura los headers de respuesta y streamea el cuerpo del segmento
        res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        res.set('Cache-Control', 'public, max-age=31536000'); // Cachea segmentos por un año
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
