import './_env.js';

// 소울 결정 → 종말의 계시 교환비 (1개당 계시 수). 잠정값 — 패치 시 조정.
const SOULS = [
  { key: 'rare',       name: '레어 소울 결정',     exchange: 2    },
  { key: 'unique',     name: '유니크 소울 결정',   exchange: 4    },
  { key: 'legendary',  name: '레전더리 소울 결정', exchange: 30   },
  { key: 'radiant',    name: '광휘의 소울 결정',   exchange: 40   },
  { key: 'epic',       name: '에픽 소울 결정',     exchange: 90   },
  { key: 'primordial', name: '태초 소울 결정',     exchange: 1000 },
];

const BASE = 'https://api.neople.co.kr/df';

// soldDate("YYYY-MM-DD HH:mm:ss", KST) → epoch ms
function parseKST(s) {
  const t = Date.parse((s || '').replace(' ', 'T') + '+09:00');
  return Number.isNaN(t) ? null : t;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const API_KEY = process.env.NEOPLE_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'NEOPLE_API_KEY not configured' });

  const now = Date.now();
  const WINDOW_MS = 3600 * 1000; // 최근 거래 = 1시간

  try {
    const data = await Promise.all(SOULS.map(async (soul) => {
      const q = encodeURIComponent(soul.name);
      const [auctionRes, soldRes] = await Promise.all([
        fetch(`${BASE}/auction?itemName=${q}&limit=400&sort=unitPrice:asc&apikey=${API_KEY}`),
        fetch(`${BASE}/auction-sold?itemName=${q}&limit=100&apikey=${API_KEY}`),
      ]);
      const auction = await auctionRes.json();
      const sold = await soldRes.json();

      // 현재 매물 — 싼 순. 깊이 계산용으로 충분한 만큼만 (개당가·수량).
      const listings = (auction.rows || [])
        .map(r => ({ unitPrice: r.unitPrice, count: r.count }))
        .filter(r => r.unitPrice && r.count)
        .slice(0, 400);   // 거의 전 매물 — 큰 목표 수량까지 실제 깊이 반영

      // 최근 1시간 실거래
      const sold1h = (sold.rows || [])
        .filter(r => { const t = parseKST(r.soldDate); return t && (now - t) <= WINDOW_MS; })
        .map(r => ({ unitPrice: r.unitPrice, count: r.count, soldDate: r.soldDate }));

      return { key: soul.key, name: soul.name, exchange: soul.exchange, listings, sold1h };
    }));

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      data,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
