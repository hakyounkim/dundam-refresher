// GET /api/diag — 런타임 env 존재 여부만 확인 (값은 노출 X)
import './_env.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const show = (v) => v
    ? { set: true, length: v.length, sample: v.slice(0, 8) + '…', trailingNewline: /\n$/.test(v) }
    : { set: false };
  res.status(200).json({
    DATABASE_URL:    show(process.env.DATABASE_URL),
    POSTGRES_URL:    show(process.env.POSTGRES_URL),
    NEOPLE_API_KEY:  show(process.env.NEOPLE_API_KEY),
    nodeVersion:     process.version,
  });
}
