import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env.local / .env so DATABASE_URL is available locally.
for (const f of ['.env.local', '.env']) {
  try {
    const txt = fs.readFileSync(path.resolve(f), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        const dq = v.startsWith('"') && v.endsWith('"');
        const sq = v.startsWith("'") && v.endsWith("'");
        if (dq || sq) v = v.slice(1, -1);
        if (dq) v = v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"');
        process.env[m[1]] = v.trim();
      }
    }
  } catch {}
}

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing. Neon 연결 후 .env.local 에 넣어주세요.'); process.exit(1); }

const sql = neon(url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();

for (const f of files) {
  const raw = fs.readFileSync(path.join(migDir, f), 'utf8');
  // Strip SQL line comments, then split on ';' at end-of-statement.
  const cleaned = raw.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n');
  const statements = cleaned
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length);
  console.log(`\n[${f}] applying ${statements.length} statements…`);
  for (const s of statements) {
    // Neon HTTP: sql() as a function-call accepts a raw SQL string + params array.
    await sql(s, []);
  }
  console.log(`[${f}] ok`);
}
console.log('\n✓ migrations done');
