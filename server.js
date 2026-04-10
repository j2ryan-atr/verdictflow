const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const AT_TOKEN = process.env.AIRTABLE_TOKEN;
const AT_BASE  = process.env.AIRTABLE_BASE_ID || 'appZcKc43KfFhOUad';
const AT_TABLE = process.env.AIRTABLE_TABLE   || 'Data';
const DP_KEY   = process.env.DOCUPILOT_API_KEY;

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
    const { templateId, data: docData, format } = req.body;
    const r = await fetch(`https://api.docupilot.app/api/v1/templates/${templateId}/create-document/`, {
      method: 'POST',
      headers: { 'X-Auth-Token': DP_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: docData, output_type: format || 'pdf' })
    });
    const result = await r.json();
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pipeline', async (req, res) => {
  try {
    const r = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}?maxRecords=1`, {
      headers: { Authorization: `Bearer ${AT_TOKEN}` }
    });
    const atData = await r.json();
    if(atData.error) throw new Error(atData.error.message);
    const record = atData.records[0];
    const f = record.fields;
    const mapped = {
      client_first_name: f['First Name']||'', client_last_name: f['Last Name']||'',
      client_email: f['Email']||'', ticket_num: f['Citation Number']||'',
      violation: f['Violation Type']||'', court_date: f['Court Date']||'',
      court_name: f['Jurisdiction']||'', officer: f['Issuing Officer']||'',
      notes: f['Notes']||'', ...f
    };
    const steps = ['✓ Airtable record fetched: ' + record.id, '✓ ' + Object.keys(mapped).length + ' fields mapped'];
    const tmplId = req.body.templateId || process.env.DOCUPILOT_DEFAULT_TEMPLATE;
    if(!tmplId) return res.json({ success: true, steps, airtableRecord: record.id, warning: 'No template ID set' });
    const dpR = await fetch(`https://api.docupilot.app/api/v1/templates/${tmplId}/create-document/`, {
      method: 'POST',
      headers: { 'X-Auth-Token': DP_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: mapped, output_type: 'pdf' })
    });
    const dpData = await dpR.json();
    steps.push('✓ Document generated');
    res.json({ success: true, steps, airtableRecord: record.id, document: dpData });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.listen(process.env.PORT || 3000, () => console.log('VerdictFlow running'));
