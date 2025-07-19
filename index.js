const express = require('express');
const fetch = require('node-fetch'); // Cambiado de 'request'
const app = express();

const PORT = process.env.PORT || 3000;

const REAL_URL = "https://streaming-live-fcdn.api.prd.univisionnow.com/tudn/tudn.isml/hls/tudn.m3u8";

app.get('/tudn.m3u8', async (req, res) => { // 'async' es importante aquí
    try {
        const response = await fetch(REAL_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://www.tudn.com',
                'Origin': 'https://www.tudn.com'
            }
        });

        if (!response.ok) {
            // Manejar errores de respuesta HTTP (ej. 403 Forbidden si aún hay geo-restricción)
            console.error(`Error del servidor de TUDN: ${response.status} ${response.statusText}`);
            return res.status(response.status).send(`Error al acceder al stream: ${response.statusText}`);
        }

        // Copiar los encabezados relevantes del stream original (Content-Type es importante)
        response.headers.forEach((value, name) => {
            if (name === 'content-type' || name === 'cache-control' || name === 'pragma' || name === 'expires') {
                res.setHeader(name, value);
            }
        });

        // Enviar el stream directamente al cliente
        response.body.pipe(res);

    } catch (error) {
        console.error('Error en el proxy:', error);
        res.status(500).send('Error interno del proxy al intentar acceder al stream.');
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
