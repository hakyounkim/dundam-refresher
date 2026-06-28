// ════════════════════════════════════════════════════════════
//  로컬 풀스택 dev 서버 — 정적 파일 + /api/* (Vercel 핸들러 그대로 실행)
//  vercel dev 없이(로그인 불필요) .env.local 을 읽어 백엔드까지 로컬 구동.
//    실행:  node scripts/dev-server.mjs        (PORT 기본 8099)
//    디버그: node --inspect scripts/dev-server.mjs  → VS Code/Chrome 디버거 attach
// ════════════════════════════════════════════════════════════
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 이 파일 위치 기준으로 프로젝트 루트 고정 (cwd 무관). _env.js 가 cwd 기준으로
// .env.local 을 찾으므로 핸들러 import 전에 반드시 루트로 이동.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const PORT = Number(process.env.PORT) || 8099;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico':  'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

// Vercel 호환 res 보강 — 핸들러가 쓰는 res.status().json()/end()/send() 제공
function augment(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(o));
    return res;
  };
  res.send = (s) => { res.end(typeof s === 'string' ? s : JSON.stringify(s)); return res; };
  return res;
}

async function handleApi(req, res, name, url) {
  const file = path.join(ROOT, 'api', name + '.js');
  if (!file.startsWith(path.join(ROOT, 'api')) || !fs.existsSync(file)) {
    return res.status(404).json({ error: `no api route: ${name}` });
  }
  req.query = Object.fromEntries(url.searchParams);
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    const ct = req.headers['content-type'] || '';
    try { req.body = ct.includes('application/json') && raw ? JSON.parse(raw) : raw; }
    catch { req.body = raw; }
  }
  try {
    const mod = await import(pathToFileURL(file).href);   // 한 번 import 후 캐시
    await mod.default(req, res);
    if (!res.writableEnded) res.end();
  } catch (e) {
    console.error(`[api:${name}]`, e);
    if (!res.headersSent) res.status(500).json({ error: String((e && e.message) || e) });
    else if (!res.writableEnded) res.end();
  }
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    return res.status(404).send('not found');
  }
  res.setHeader('Content-Type', MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');   // 편집 즉시 반영
  fs.createReadStream(fp).pipe(res);
}

const server = http.createServer((req, res) => {
  augment(res);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice('/api/'.length).replace(/\/+$/, '');
    handleApi(req, res, name, url);
  } else {
    serveStatic(req, res, url);
  }
});

server.listen(PORT, () => {
  const hasDb = !!process.env.DATABASE_URL;
  const hasNeople = !!process.env.NEOPLE_API_KEY;
  console.log(`dev server  http://localhost:${PORT}`);
  console.log(`  root      ${ROOT}`);
  console.log(`  env       DATABASE_URL=${hasDb ? 'OK' : 'MISSING'}  NEOPLE_API_KEY=${hasNeople ? 'OK' : 'MISSING'}`);
});
