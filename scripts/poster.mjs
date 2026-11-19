// Captures public/poster.jpg (1600x900) from the built /poster page.
// Usage: pnpm build && pnpm poster   (run `pnpm exec playwright install chromium` once)
// Serves dist/ with a tiny static server, so no dev or preview server is needed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const out = fileURLToPath(new URL('../public/poster.jpg', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.jpg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const rel = normalize(path).replace(/^([/\\])+/, '');
  const file = join(dist, extname(rel) ? rel : join(rel, 'index.html'));
  if (!file.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/poster`, { waitUntil: 'networkidle' });
  await page.waitForSelector('html[data-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
  await browser.close();
  console.log(`Poster saved to ${out}`);
} finally {
  server.close();
}
