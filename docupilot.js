module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.DOCUPILOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DOCUPILOT_API_KEY environment variable not set' });
  }

  try {
    if (req.method === 'GET') {
      const response = await fetch('https://api.docupilot.app/api/v1/templates/', {
        headers: { 'X-Auth-Token': apiKey }
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { templateId, data: docData, format } = req.body;
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });

      const response = await fetch(
        `https://api.docupilot.app/api/v1/templates/${templateId}/create-document/`,
        {
          method: 'POST',
          headers: {
            'X-Auth-Token': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ data: docData || {}, output_type: format || 'pdf' })
        }
      );
      const result = await response.json();
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
