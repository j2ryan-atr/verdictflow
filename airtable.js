module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token  = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || 'appZcKc43KfFhOUad';
  const table  = process.env.AIRTABLE_TABLE   || 'Data';

  if (!token) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN environment variable not set' });
  }

  try {
    if (req.method === 'GET') {
      const max = req.query.maxRecords || 100;
      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?maxRecords=${max}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.error) return res.status(400).json({ error: data.error.message || data.error });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { fields } = req.body;
      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      });
      const data = await response.json();
      if (data.error) return res.status(400).json({ error: data.error.message || data.error });
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
