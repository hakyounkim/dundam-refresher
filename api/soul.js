const SOULS = [
  { key: 'rare',      name: '레어 소울 결정',    exchange: 2    },
  { key: 'unique',    name: '유니크 소울 결정',   exchange: 4    },
  { key: 'legendary', name: '레전더리 소울 결정', exchange: 30   },
  { key: 'radiant',   name: '광휘의 소울 결정',   exchange: 40   },
  { key: 'epic',      name: '에픽 소울 결정',     exchange: 90   },
  { key: 'primordial',name: '태초 소울 결정',     exchange: 1000 },
];

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
}

export default async function handler(req, res) {
  const API_KEY = process.env.NEOPLE_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'NEOPLE_API_KEY not configured' });

  try {
    const results = await Promise.all(SOULS.map(async (soul) => {
      const base = 'https://api.neople.co.kr/df';
      const q = encodeURIComponent(soul.name);

      const [auctionRes, soldRes] = await Promise.all([
        fetch(`${base}/auction?itemName=${q}&limit=10&sort=unitPrice:asc&apikey=${API_KEY}`),
        fetch(`${base}/auction-sold?itemName=${q}&limit=50&apikey=${API_KEY}`),
      ]);

      const auctionData = await auctionRes.json();
      const soldData = await soldRes.json();

      const prices     = (auctionData.rows || []).map(r => r.unitPrice).filter(Boolean);
      const soldPrices = (soldData.rows   || []).map(r => r.unitPrice).filter(Boolean);

      const avgPrice     = avg(prices);
      const avgSoldPrice = avg(soldPrices);

      return {
        key:               soul.key,
        name:              soul.name,
        exchange:          soul.exchange,
        lowest_price:      prices.length     ? Math.min(...prices)     : null,
        highest_price:     prices.length     ? Math.max(...prices)     : null,
        average_price:     avgPrice,
        lowest_sold_price: soldPrices.length ? Math.min(...soldPrices) : null,
        highest_sold_price:soldPrices.length ? Math.max(...soldPrices) : null,
        average_sold_price:avgSoldPrice,
        trade_value:      avgPrice     ? Math.round(avgPrice     / soul.exchange) : null,
        sold_trade_value: avgSoldPrice ? Math.round(avgSoldPrice / soul.exchange) : null,
        auction_count:    prices.length,
        sold_count:       soldPrices.length,
      };
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      data: results,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
