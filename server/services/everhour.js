const axios = require('axios');

const eh = axios.create({
  baseURL: 'https://api.everhour.com',
  headers: { 'X-Invision-Api-Token': process.env.EVERHOUR_API_KEY },
});

async function fetchTimeEntries(from, to) {
  const entries = [];
  let page = 1;

  while (true) {
    const { data } = await eh.get('/team/time', {
      params: { from, to, limit: 200, page },
    });
    if (!data.length) break;
    entries.push(...data);
    if (data.length < 200) break;
    page++;
  }

  return entries
    .filter(e => e.time && e.user && e.date)
    .map(e => ({
      id: String(e.id),
      user_id: String(e.user),
      date: e.date,
      actual_hours: e.time / 3600,
      task_id: e.task ? String(e.task.id) : null,
      task_name: e.task ? e.task.name : null,
    }));
}

async function fetchTeamMembers() {
  const { data } = await eh.get('/team/members');
  return data.map(m => ({
    everhour_id: String(m.id),
    name: m.name,
    email: m.email,
  }));
}

// Match Everhour entry to a HubSpot ticket ID via task name convention [HS-{id}]
function extractTicketId(taskName) {
  if (!taskName) return null;
  const match = taskName.match(/\[HS-(\d+)\]/);
  return match ? match[1] : null;
}

module.exports = { fetchTimeEntries, fetchTeamMembers, extractTicketId };
