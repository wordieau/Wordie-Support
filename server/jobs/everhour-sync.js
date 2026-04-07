const pool = require('../db');
const { fetchTimeEntries, extractTicketId } = require('../services/everhour');

async function syncEntries() {
  // Sync last 90 days
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const entries = await fetchTimeEntries(from, to);

  // Build ticket ID map from DB for name-based fallback matching
  const { rows: dbTickets } = await pool.query('SELECT id, title FROM tickets');
  const titleMap = {};
  dbTickets.forEach(t => { titleMap[t.title.toLowerCase()] = t.id; });

  let matched = 0;
  for (const entry of entries) {
    // Try to match to a ticket
    let ticketId = extractTicketId(entry.task_name);
    if (!ticketId && entry.task_name) {
      ticketId = titleMap[entry.task_name.toLowerCase()] || null;
    }

    await pool.query(
      `INSERT INTO time_entries (id, ticket_id, user_id, date, actual_hours)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET actual_hours = $5, ticket_id = $2`,
      [entry.id, ticketId, entry.user_id, entry.date, entry.actual_hours]
    );
    if (ticketId) matched++;
  }

  console.log(`[Everhour] Synced ${entries.length} entries, ${matched} matched to tickets`);
}

async function runSync() {
  try {
    await syncEntries();
  } catch (err) {
    console.error('[Everhour sync error]', err.message);
  }
}

module.exports = { runSync };
