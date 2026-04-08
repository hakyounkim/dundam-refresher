export default async function handler(req, res) {
  const { server = 'adven', name } = req.query;

  if (!name) {
    return res.status(400).json({ error: '캐릭터명/모험단명을 입력하세요' });
  }

  try {
    const url = `https://dundam.xyz/dat/searchData.jsp?name=${encodeURIComponent(name)}&server=${encodeURIComponent(server)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
      },
      body: '{}',
    });
    const text = await response.text();
    const data = JSON.parse(text.trim());

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
