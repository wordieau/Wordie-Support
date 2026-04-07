const pool = require('../db');
const { fetchAllTickets, fetchOwners } = require('../services/hubspot');
const { distributeTicket } = require('../services/allocation-engine');

async function syncOwners() {
  const owners = await fetchOwners();
  for (const owner of owners) {
    await pool.query(
      `INSERT INTO user_capacity (user_id, name, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET name = $2, email = $3`,
      [owner.user_id, owner.name, owner.email]
    );
  }
  console.log(`[HubSpot] Synced ${owners.length} owners`);
}

async function syncTickets() {
  const tickets = await fetchAllTickets();

  for (const ticket of tickets) {
    await pool.query(
      `INSERT INTO tickets (id, title, owner_id, estimate_hours, start_date, due_date, pipeline_stage, allocation_type, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = $2, owner_id = $3, estimate_hours = $4,
         start_date = $5, due_date = $6, pipeline_stage = $7,
         allocation_type = $8, updated_at = NOW()`,
      [ticket.id, ticket.title, ticket.owner_id, ticket.estimate_hours,
       ticket.start_date, ticket.due_date, ticket.pipeline_stage, ticket.allocation_type]
    );
    await distributeTicket(ticket);
  }

  console.log(`[HubSpot] Synced ${tickets.length} tickets`);
  return tickets.length;
}

async function runSync() {
  try {
    await syncOwners();
    await syncTickets();
  } catch (err) {
    console.error('[HubSpot sync error]', err.message);
  }
}

module.exports = { runSync };
