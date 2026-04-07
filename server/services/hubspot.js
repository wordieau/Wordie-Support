const axios = require('axios');

const hs = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}` },
});

// Pipeline stages mapped to allocation type
const HARD_STAGES = ['appointmentscheduled', 'qualifiedtobuy', 'presentationscheduled', 'closedwon'];

function allocationTypeFromStage(stage) {
  if (!stage) return 'SOFT';
  const s = stage.toLowerCase();
  return HARD_STAGES.some(h => s.includes(h)) ? 'HARD' : 'SOFT';
}

async function fetchAllTickets() {
  const tickets = [];
  let after = undefined;

  do {
    const body = {
      filterGroups: [],
      properties: ['subject', 'hubspot_owner_id', 'hs_pipeline_stage',
                   'time_estimate', 'start_date', 'due_date', 'createdate'],
      limit: 100,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
    };
    if (after) body.after = after;

    const { data } = await hs.post('/crm/v3/objects/tickets/search', body);
    tickets.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return tickets.map(mapTicket);
}

async function fetchTicket(id) {
  const { data } = await hs.get(`/crm/v3/objects/tickets/${id}`, {
    params: { properties: 'subject,hubspot_owner_id,hs_pipeline_stage,time_estimate,start_date,due_date' },
  });
  return mapTicket(data);
}

async function fetchOwners() {
  const { data } = await hs.get('/crm/v3/owners');
  return data.results.map(o => ({
    user_id: String(o.id),
    name: `${o.firstName} ${o.lastName}`.trim(),
    email: o.email,
  }));
}

function mapTicket(raw) {
  const p = raw.properties;
  return {
    id: raw.id,
    title: p.subject || '(Untitled)',
    owner_id: p.hubspot_owner_id ? String(p.hubspot_owner_id) : null,
    estimate_hours: p.time_estimate ? parseFloat(p.time_estimate) / 3600 : null,
    start_date: p.start_date || null,
    due_date: p.due_date || null,
    pipeline_stage: p.hs_pipeline_stage || null,
    allocation_type: allocationTypeFromStage(p.hs_pipeline_stage),
  };
}

module.exports = { fetchAllTickets, fetchTicket, fetchOwners };
