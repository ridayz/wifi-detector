import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Collector } from './collector/index.mjs';
import { connectTo } from './connect/connect.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 4748);
const SCAN_INTERVAL_MS = Number(process.env.WIFI_SCAN_INTERVAL_MS || 2000);

const collector = new Collector({ scanIntervalMs: SCAN_INTERVAL_MS });
collector.start();
let lastManualScan = 0;

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (STATIC[url.pathname]) {
    const [file, type] = STATIC[url.pathname];
    try {
      const body = await readFile(path.join(PUBLIC_DIR, file));
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(500).end('static file missing');
    }
    return;
  }

  // POST /api/scan — force one environment scan on demand (Scan button).
  // Same header guard as /api/connect; debounced to one manual scan per second.
  if (url.pathname === '/api/scan') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, message: 'POST only' }));
      return;
    }
    if (req.headers['x-wifi-detector'] !== '1') {
      res.writeHead(403, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, message: 'missing x-wifi-detector header' }));
      return;
    }
    const now = Date.now();
    if (now - lastManualScan < 1000) {
      res.writeHead(429, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, message: 'scan already requested recently' }));
      return;
    }
    lastManualScan = now;
    try {
      const snap = await collector.requestScan();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, snapshot: snap }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, message: String(err?.message || err) }));
    }
    return;
  }

  // POST /api/connect — the ONLY state-changing route (DECISIONS/0003).
  // Custom header required; loopback drive-by pages cannot set it.
  if (url.pathname === '/api/connect') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, message: 'POST only' }));
      return;
    }
    if (req.headers['x-wifi-detector'] !== '1') {
      res.writeHead(403, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, message: 'missing x-wifi-detector header' }));
      return;
    }
    let body = '';
    let tooBig = false;
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16 * 1024) { tooBig = true; break; }
    }
    if (tooBig) {
      res.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, message: 'body too large' }));
      return;
    }
    try {
      const { ssid, password, security, securityRaw } = JSON.parse(body || '{}');
      const secNorm = ['open', 'WPA', 'WPA2', 'WPA3', 'WEP'].includes(security) ? security : 'WPA2';
      const result = await connectTo({ ssid, password, securityNorm: secNorm, securityRaw: String(securityRaw ?? ''), iface: process.env.WIFI_IFACE || 'Wi-Fi' });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(result)); // never echoes the password
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, message: String(err?.message || err) }));
    }
    return;
  }

  if (url.pathname === '/api/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(collector.snapshot ?? await collector.sampleOnce()));
    return;
  }

  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = async () => {
      try {
        const snap = collector.snapshot ?? await collector.sampleOnce();
        res.write(`data: ${JSON.stringify(snap)}\n\n`);
      } catch {
        // client will reconnect on its own when we close
      }
    };
    send();
    const timer = setInterval(send, 2500);
    req.on('close', () => clearInterval(timer));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`wifi-detector listening on http://127.0.0.1:${PORT}`);
  console.log(`scan interval: ${SCAN_INTERVAL_MS} ms · read-only · loopback only`);
});
