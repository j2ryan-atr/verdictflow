module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const atToken    = process.env.AIRTABLE_TOKEN;
  const atBase     = process.env.AIRTABLE_BASE_ID || 'appZcKc43KfFhOUad';
  const atTable    = process.env.AIRTABLE_TABLE   || 'Data';
  const dpKey      = process.env.DOCUPILOT_API_KEY;
  const templateId = (req.body && req.body.templateId) || process.env.DOCUPILOT_DEFAULT_TEMPLATE;

  const steps = [];

  try {
    // STEP 1 — Fetch from Airtable
    steps.push('Fetching record from Airtable...');
    const atRes  = await fetch(
      `https://api.airtable.com/v0/${atBase}/${encodeURIComponent(atTable)}?maxRecords=1`,
      { headers: { Authorization: `Bearer ${atToken}` } }
    );
    const atData = await atRes.json();
    if (atData.error) throw new Error(`Airtable: ${atData.error.message || atData.error}`);
    const record = atData.records && atData.records[0];
    if (!record) throw new Error('No records found in Airtable table');
    steps.push(`Record fetched: ${record.id}`);

    // STEP 2 — Map fields
    steps.push('Mapping fields...');
    const f = record.fields;
    const mapped = {
      client_first_name : f['First Name']       || f['first_name']       || '',
      client_last_name  : f['Last Name']        || f['last_name']        || '',
      client_email      : f['Email']            || f['email']            || '',
      client_phone      : f['Phone']            || f['phone']            || '',
      ticket_num        : f['Citation Number']  || f['Citation']         || '',
      violation         : f['Violation Type']   || f['Violation']        || '',
      court_date        : f['Court Date']       || f['court_date']       || '',
      court_name        : f['Jurisdiction']     || f['Court']            || '',
      officer           : f['Issuing Officer']  || f['Officer']          || '',
      notes             : f['Notes']            || f['notes']            || '',
      ...f
    };
    steps.push(`${Object.keys(mapped).length} fields mapped`);

    // STEP 3 — Send to Docupilot
    if (!templateId) {
      steps.push('No template ID set — skipping document generation');
      return res.status(200).json({ success: true, steps, record: record.id, warning: 'Set DOCUPILOT_DEFAULT_TEMPLATE to enable doc generation' });
    }

    steps.push(`Sending to Docupilot template ${templateId}...`);
    const dpRes  = await fetch(
      `https://api.docupilot.app/api/v1/templates/${templateId}/create-document/`,
      {
        method: 'POST',
        headers: { 'X-Auth-Token': dpKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: mapped, output_type: 'pdf' })
      }
    );
    const dpData = await dpRes.json();
    if (dpData.error) throw new Error(`Docupilot: ${dpData.error}`);
    steps.push('Document generated successfully');

    return res.status(200).json({
      success: true,
      steps,
      airtableRecord: record.id,
      document: dpData
    });

  } catch (err) {
    return res.status(500).json({ success: false, steps, error: err.message });
  }
};
