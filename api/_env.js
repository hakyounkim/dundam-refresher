// 로컬 vercel dev 에서 .env.local 을 안 집어주는 상황 대비.
// 프로덕션/프리뷰에선 process.env 에 이미 값이 있어 no-op.
import fs from 'node:fs';
import path from 'node:path';

let loaded = false;
export function loadLocalEnv() {
  if (loaded) return;
  loaded = true;
  for (const f of ['.env.local', '.env']) {
    const p = path.resolve(f);
    if (!fs.existsSync(p)) continue;
    try {
      for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        if (process.env[m[1]]) continue; // 이미 있으면 덮지 않음
        let v = m[2];
        const dq = v.startsWith('"') && v.endsWith('"');
        const sq = v.startsWith("'") && v.endsWith("'");
        if (dq || sq) v = v.slice(1, -1);
        if (dq) v = v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"');
        process.env[m[1]] = v.trim();
      }
    } catch {}
  }
}

loadLocalEnv();
