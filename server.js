const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const AT_TOKEN = process.env.AIRTABLE_TOKEN;
const AT_BASE  = process.env.AIRTABLE_BASE_ID || 'appZcKc43KfFhOUad';
const AT_TABLE = process.env.AIRTABLE_TABLE   || 'Data';
const DP_KEY   = process.env.DOCUPILOT_API_KEY;
const DP_TMPL  = process.env.DOCUPILOT_DEFAULT_TEMPLATE || '105675';

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
    const tmpl = templateId || DP_TMPL;
    const r = await fetch(`https://api.docupilot.app/api/v1/templates/${tmpl}/create-document/`, {
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
      First_Name    : f['First Name']      || '',
      Middle_Name   : f['Middle Name']     || '',
      Last_Name     : f['Last Name']       || '',
      Other         : f['Other']           || f['Ticket ID'] || '',
      Court_Date    : f['Court Date']      || f['Citation Date'] || '',
      Citation_Date : f['Citation Date']   || '',
      Court         : f['Court']           || '',
      County        : f['County']          || '',
      Ticket_Type   : f['Ticket Type']     || '',
      Notes         : f['Notes']           || '',
      Source        : f['Source']          || '',
      Contact_Date  : f['Contact Date']    || '',
      date          : new Date().toLocaleDateString('en-US'),
    };
    const steps = [
      '✓ Airtable record fetched: ' + record.id,
      '✓ Client: ' + mapped.First_Name + ' ' + mapped.Last_Name,
      '✓ Citation: ' + mapped.Other,
      '✓ ' + Object.keys(mapped).length + ' fields mapped to Docupilot variables',
    ];
    const tmplId = req.body.templateId || DP_TMPL;
    if(!tmplId) return res.json({ success: true, steps, airtableRecord: record.id, warning: 'No template ID' });
    steps.push('Sending to Docupilot template ' + tmplId + '...');
    const dpR = await fetch(`https://api.docupilot.app/api/v1/templates/${tmplId}/create-document/`, {
      method: 'POST',
      headers: { 'X-Auth-Token': DP_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: mapped, output_type: 'pdf' })
    });
    const dpData = await dpR.json();
    if(dpData.error) throw new Error('Docupilot: ' + JSON.stringify(dpData.error));
    steps.push('✓ Document generated successfully');
    res.json({ success: true, steps, airtableRecord: record.id, document: dpData });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(process.env.PORT || 3000, () => console.log('VerdictFlow running on port', process.env.PORT || 3000));
