const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const AT_TOKEN  = process.env.AIRTABLE_TOKEN;
const AT_BASE   = process.env.AIRTABLE_BASE_ID || 'appZcKc43KfFhOUad';
const AT_TABLE  = process.env.AIRTABLE_TABLE   || 'Data';
const DP_KEY    = process.env.DOCUPILOT_API_KEY;
const BASE = 'https://lojr.docupilot.app/dashboard/documents/create/c190d67a/';
const DP_URLS = {
  '105675': BASE + '212946f7', // LVJC Civil Infraction Response
  '105696': BASE + '9dd71595', // Bunkerville CFA (Criminal)
  '105697': BASE + 'e9a64bef', // Laughlin CFA (Criminal)
  '105698': BASE + '238660ae', // Moapa CFA (Criminal)
  '105699': BASE + 'ce954cdb', // Moapa Valley CFA (Criminal)
  '105700': BASE + '12a17499', // Searchlight CFA (Criminal)
  '105701': BASE + '818b53e3', // Goodsprings CFA (Criminal)
  '105704': BASE + 'b4dd0dc7', // Bunkerville WEP (Civil)
  '105705': BASE + 'ca9d4bfc', // Goodsprings WEP (Civil)
  '105706': BASE + 'c07d5f9f', // Laughlin WEP (Civil)
  '105707': BASE + '5f7c99e1', // Moapa WEP (Civil)
  '105708': BASE + '91ec5015', // Moapa Valley WEP (Civil)
  '105709': BASE + 'c7f35d9a', // Searchlight WEP (Civil)
};
function getDpUrl(tmplId) { return DP_URLS[tmplId] || DP_URLS['105675']; }

function mapFields(f) {
  return {
    First_Name   : f['First Name']    || '',
    Middle_Name  : f['Middle Name']   || '',
    Last_Name    : f['Last Name']     || '',
    Other        : f['Other']         || f['Ticket ID'] || '',
    Court_Date   : f['Court Date']    || f['Citation Date'] || '',
    Citation_Date: f['Citation Date'] || '',
    Court        : f['Court']         || '',
    County       : f['County']        || '',
    Ticket_Type  : f['Ticket Type']   || '',
    Notes        : f['Notes']         || '',
    Source       : f['Source']        || '',
    Contact_Date : f['Contact Date']  || '',
    date         : new Date().toLocaleDateString('en-US'),
  };
}

app.get('/api/airtable', async (req, res) => {
  try {
    const r = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}?maxRecords=100`, {
      headers: { Authorization: `Bearer ${AT_TOKEN}` }
    });
    const data = await r.json();
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/airtable', async (req, res) => {
  try {
    const r = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: req.body.fields })
    });
    const data = await r.json();
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/docupilot', async (req, res) => {
  try {
    const r = await fetch('https://api.docupilot.app/api/v1/templates/', {
      headers: { 'X-Auth-Token': DP_KEY }
    });
    const data = await r.json();
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/docupilot', async (req, res) => {
  try {
    const { data: docData } = req.body;
    const url = getDpUrl(tmpl) + '?download=true';
    console.log('Docupilot URL:', url);
    console.log('Docupilot data:', JSON.stringify(docData));
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
    console.log('Docupilot status:', r.status);
    console.log('Docupilot headers:', JSON.stringify([...r.headers.entries()]));
    const text = await r.text();
    console.log('Docupilot response preview:', text.substring(0, 200));
    // Check if it's a file download or JSON
    const contentType = r.headers.get('content-type') || '';
    if(contentType.includes('application/json')) {
      const result = JSON.parse(text);
      res.json(result);
    } else if(contentType.includes('pdf') || contentType.includes('octet')) {
      // Return the file URL from headers or as base64
      const location = r.headers.get('content-location') || r.headers.get('location') || '';
      res.json({ success: true, file_url: location, content_type: contentType });
    } else {
      try {
        const result = JSON.parse(text);
        res.json(result);
      } catch(e) {
        res.json({ success: true, raw: text.substring(0, 500) });
      }
    }
  } catch(e) {
    console.error('Docupilot error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/pipeline', async (req, res) => {
  try {
    const r = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}?maxRecords=1`, {
      headers: { Authorization: `Bearer ${AT_TOKEN}` }
    });
    const atData = await r.json();
    if(atData.error) throw new Error(atData.error.message);
    const record = atData.records[0];
    const mapped = mapFields(record.fields);
    const steps = [
      '✓ Airtable record fetched: ' + record.id,
      '✓ Client: ' + mapped.First_Name + ' ' + mapped.Last_Name,
      '✓ Citation: ' + mapped.Other,
      '✓ ' + Object.keys(mapped).length + ' fields mapped',
      'Sending to Docupilot...'
    ];
    const dpR = await fetch(getDpUrl(tmplId) + '?download=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapped)
    });
    const contentType = dpR.headers.get('content-type') || '';
    const location = dpR.headers.get('content-location') || dpR.headers.get('location') || '';
    const text = await dpR.text();
    console.log('Pipeline DP status:', dpR.status, 'content-type:', contentType);
    console.log('Pipeline DP location:', location);
    console.log('Pipeline DP response:', text.substring(0, 300));
    let dpData = {};
    try { dpData = JSON.parse(text); } catch(e) { dpData = { raw: text.substring(0,200) }; }
    if(location) dpData.file_url = location;
    steps.push('✓ Document generated successfully');
    res.json({ success: true, steps, airtableRecord: record.id, document: dpData });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(process.env.PORT || 3000, () => console.log('VerdictFlow running on port', process.env.PORT || 3000));
