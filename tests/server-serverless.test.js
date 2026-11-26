const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';

const app = require('../server');
const vercelHandler = require('../api/index');
const config = require('../config');
const UrlResolverService = require('../src/services/urlResolver.service');
const FileExportService = require('../src/services/fileExport.service');
const DownloadController = require('../src/controllers/download.controller');

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('1. Cold start Serverless: server.js y api/index.js exportan instancia Express válida', () => {
  assert.equal(typeof app, 'function');
  assert.equal(app, vercelHandler);

  const vercelJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8')
  );
  assert.equal(vercelJson.version, 2);
  assert.ok(vercelJson.functions['api/index.js']);
  assert.equal(vercelJson.functions['api/index.js'].maxDuration, 60);
  assert.ok(Array.isArray(vercelJson.rewrites));
});

test('2. Endpoints base: /api/health, index.html, sw.js, ads.txt, robots.txt y 404 API JSON', async () => {
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthBody = await healthRes.json();
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.status, 'healthy');

  const htmlRes = await fetch(`${baseUrl}/`);
  assert.equal(htmlRes.status, 200);
  const htmlText = await htmlRes.text();
  assert.match(htmlText, /MediaScraper/);
  // Verificación estricta de Google AdSense
  assert.match(htmlText, /<meta name="google-adsense-account" content="ca-pub-2369620196115106">/);
  assert.match(htmlText, /<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-2369620196115106"/);
  assert.doesNotMatch(htmlText, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@tensorflow\/tfjs/);

  const swRes = await fetch(`${baseUrl}/sw.js`);
  assert.equal(swRes.status, 200);
  assert.match(swRes.headers.get('cache-control') || '', /no-cache/);
  assert.equal(swRes.headers.get('service-worker-allowed'), '/');

  const adsRes = await fetch(`${baseUrl}/ads.txt`);
  assert.equal(adsRes.status, 200);
  const adsText = await adsRes.text();
  assert.match(adsText, /^google\.com, pub-2369620196115106, DIRECT, f08c47fec0942fa0/m);

  const robotsRes = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robotsRes.status, 200);
  const robotsText = await robotsRes.text();
  assert.match(robotsText, /User-agent:\s*Mediapartners-Google/);
  assert.match(robotsText, /Allow:\s*\/ads\.txt/);

  const notFoundRes = await fetch(`${baseUrl}/api/unknown-endpoint`);
  assert.equal(notFoundRes.status, 404);
  const notFoundBody = await notFoundRes.json();
  assert.equal(notFoundBody.status, 404);
});

test('3. Guardia CORS: permite same-origin y rechaza orígenes externos parasitarios con 403', async () => {
  const host = new URL(baseUrl).host;

  const sameOriginRes = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: `http://${host}` }
  });
  assert.equal(sameOriginRes.status, 200);
  assert.equal(sameOriginRes.headers.get('access-control-allow-origin'), `http://${host}`);

  const foreignOriginRes = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://evil-leecher.example.com' }
  });
  assert.equal(foreignOriginRes.status, 403);
});

test('4. Protección Anti-SSRF y validación de URLs en scrape, proxy y download', async () => {
  const maliciousTargets = [
    'http://127.0.0.1:8080/internal',
    'http://localhost/admin',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/private',
    'http://192.168.1.1/router',
    'http://[::1]/loopback',
    'http://[::ffff:127.0.0.1]/mapped',
    'file:///etc/passwd',
    'javascript:alert(1)'
  ];

  for (const badUrl of maliciousTargets) {
    const scrapeRes = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: badUrl })
    });
    assert.ok(
      scrapeRes.status === 400 || scrapeRes.status === 403,
      `Se esperaba 400/403 en /api/scrape para ${badUrl}, recibido ${scrapeRes.status}`
    );

    const proxyRes = await fetch(`${baseUrl}/api/proxy?url=${encodeURIComponent(badUrl)}`);
    assert.ok(
      proxyRes.status === 400 || proxyRes.status === 403,
      `Se esperaba 400/403 en /api/proxy para ${badUrl}, recibido ${proxyRes.status}`
    );
  }

  // URL vacía o malformada devuelve 400 (nunca 500)
  const invalidScrape = await fetch(`${baseUrl}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: '   ' })
  });
  assert.equal(invalidScrape.status, 400);

  // Dominio de red social devuelve aviso controlado 200
  const socialScrape = await fetch(`${baseUrl}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  });
  assert.equal(socialScrape.status, 200);
  const socialBody = await socialScrape.json();
  assert.equal(socialBody.isSocialMedia, true);
});

test('5. Desenvolvimiento de doble proxy (/api/proxy dentro de /api/download) y selector HLS', async () => {
  const nested = '/api/proxy?url=' + encodeURIComponent('/api/proxy?url=' + encodeURIComponent('https://example.com/media/video.mp4'));
  assert.equal(UrlResolverService.unwrapProxyUrl(nested), 'https://example.com/media/video.mp4');

  // /api/download con /api/proxy apuntando a IP privada desenvuelve la URL y aplica bloqueo SSRF 403 (no 500 Invalid URL)
  const proxiedLoopback = `/api/proxy?url=${encodeURIComponent('http://127.0.0.1/audio.mp4')}`;
  const dlRes = await fetch(`${baseUrl}/api/download?url=${encodeURIComponent(proxiedLoopback)}&filename=test.mp3`);
  assert.equal(dlRes.status, 403);

  // Selección real de mejor calidad en Master Playlist HLS
  const sampleMaster = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360',
    'low/index.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080',
    'high/index.m3u8'
  ].join('\n');
  const bestVariant = DownloadController.selectBestVariantFromMaster(sampleMaster, 'https://cdn.example.com/videos/master.m3u8');
  assert.equal(bestVariant, 'https://cdn.example.com/videos/high/index.m3u8');
});

test('6. Bloqueo de escritura arbitraria en disco y confinamiento estricto a /tmp/mediascraper', async () => {
  // Por defecto ENABLE_LOCAL_FS_EXPORT es false -> 403
  const exportRes = await fetch(`${baseUrl}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetDirectory: 'C:\\Users\\USUARIO\\Downloads\\ScrapedMedia',
      items: [{ url: 'https://example.com/img.png', filename: 'img.png' }]
    })
  });
  assert.equal(exportRes.status, 403);

  // Si se habilita en entorno cloud, confina forzosamente a /tmp/mediascraper neutralizando Path Traversal
  const prevFlag = config.enableLocalFsExport;
  const prevCloud = config.isCloud;
  try {
    config.enableLocalFsExport = true;
    config.isCloud = true;
    const safeDir = FileExportService.resolveSafeExportDirectory('../../../../etc/passwd');
    assert.ok(
      safeDir.startsWith(path.join(os.tmpdir(), 'mediascraper')),
      `Directorio debe estar dentro de /tmp/mediascraper, recibido: ${safeDir}`
    );
  } finally {
    config.enableLocalFsExport = prevFlag;
    config.isCloud = prevCloud;
  }
});

test('7. Exportación ZIP en streaming funciona en memoria sin requerir escritura fuera de /tmp', async () => {
  // PNG 1x1 transparente válido en base64
  const tinyPngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const zipRes = await fetch(`${baseUrl}/api/export-zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ url: tinyPngDataUri, filename: 'pixel.png' }]
    })
  });

  assert.equal(zipRes.status, 200);
  assert.match(zipRes.headers.get('content-type') || '', /application\/zip/);

  const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
  assert.ok(zipBuffer.length > 20);
  // Firma mágica PK\x03\x04 de archivo ZIP válido
  assert.equal(zipBuffer[0], 0x50);
  assert.equal(zipBuffer[1], 0x4b);
});

test('8. Validación sintáctica de todos los módulos ES del frontend y Service Worker', () => {
  const swPath = path.join(__dirname, '..', 'public/sw.js');
  execFileSync(process.execPath, ['--check', swPath]);

  const esModulesToVerify = [
    'public/js/app.js',
    'public/js/config/constants.js',
    'public/js/utils/dom.util.js',
    'public/js/services/api.service.js',
    'public/js/services/aiVision.service.js',
    'public/js/services/audioExtractor.service.js',
    'public/js/services/pdfReport.service.js',
    'public/js/components/theme.component.js',
    'public/js/components/history.component.js',
    'public/js/components/fullscreen.component.js',
    'public/js/components/imageEditor.component.js',
    'public/js/components/drawer.component.js',
    'public/js/components/videoPlayer.component.js',
    'public/js/components/gallery.component.js',
    'public/js/components/exportModal.component.js'
  ];

  for (const relPath of esModulesToVerify) {
    const absPath = path.join(__dirname, '..', relPath);
    assert.ok(fs.existsSync(absPath), `Debe existir ${relPath}`);
    const source = fs.readFileSync(absPath, 'utf8');
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: source });
  }
});

test('9. Compatibilidad Render: node server.js sin VERCEL levanta servidor HTTP propio y responde /api/health', async () => {
  const { spawn } = require('node:child_process');
  const testPort = 39876;
  const childEnv = { ...process.env, PORT: String(testPort), NODE_ENV: 'production' };
  delete childEnv.VERCEL;

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout esperando arranque de server.js en modo Render')), 5000);
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes(String(testPort))) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      child.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`server.js salió prematuramente con código ${code}`));
      });
    });

    const res = await fetch(`http://127.0.0.1:${testPort}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.serverless, false);
  } finally {
    child.kill('SIGTERM');
  }
});

