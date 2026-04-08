export default async function handler(req, res) {
  const { server, key } = req.query;

  if (!server || !key) {
    return res.status(400).json({ error: 'server와 key가 필요합니다' });
  }

  try {
    const url = `https://dundam.xyz/dat//viewData.jsp?image=${encodeURIComponent(key)}&server=${encodeURIComponent(server)}&reset=true&force=true`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' },
      body: '{}',
    });
    const text = await response.text();
    let refreshTime = null;
    try { refreshTime = JSON.parse(text).refreshTime ?? null; } catch {}

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ ok: response.ok, status: response.status, key, server, refreshTime });
  } catch (e) {
    return res.status(500).json({ error: e.message, key, server });
  }
}
