const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Universal CORS headers for all incoming requests (supports multi-device LAN & remote access)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, X-Requested-With');

    // Handle OPTIONS CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 1. CORS Proxy endpoint for remote assets (e.g. Firebase Cloud Storage PDFs)
    if (req.url.startsWith('/proxy?') || req.url.startsWith('/proxy/')) {
        let targetUrl = null;
        try {
            const parsed = new URL(req.url, `http://${req.headers.host || '127.0.0.1:8000'}`);
            targetUrl = parsed.searchParams.get('url');
        } catch (e) {}

        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Missing url parameter');
            return;
        }

        const fetchRemote = (remoteUrl, redirectCount = 0) => {
            if (redirectCount > 4) {
                res.writeHead(508, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
                res.end('Too many redirects');
                return;
            }
            const client = remoteUrl.startsWith('https:') ? https : http;
            const proxyReq = client.get(remoteUrl, (pRes) => {
                if (pRes.statusCode >= 300 && pRes.statusCode < 400 && pRes.headers.location) {
                    return fetchRemote(pRes.headers.location, redirectCount + 1);
                }
                res.writeHead(pRes.statusCode, {
                    'Content-Type': pRes.headers['content-type'] || 'application/pdf',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=86400'
                });
                pRes.pipe(res);
            });
            proxyReq.on('error', (err) => {
                res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end('Proxy error: ' + err.message);
            });
        };

        fetchRemote(targetUrl);
        return;
    }

    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/' || reqUrl === '') reqUrl = '/index.html';

    const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(ROOT, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found: ' + reqUrl);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Niprak OSM Digital Correction Server running at http://0.0.0.0:${PORT}/ (Accessible locally and across LAN)`);
});
