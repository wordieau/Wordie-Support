const pool = require('../db');

const WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWorkingDaysBetween(startDate, dueDate) {
  const days = [];
  const cur = new Date(startDate);
  const end = new Date(dueDate);
  while (cur <= end) {
    const dow = DAY_NAMES[cur.getDay()];
    if (WORKING_DAYS.includes(dow)) {
      days.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

async function distributeTicket(ticket) {
  if (!ticket.estimate_hours || !ticket.start_date || !ticket.due_date || !ticket.owner_id) return;

  const days = getWorkingDaysBetween(ticket.start_date, ticket.due_date);
  if (!days.length) return;

  const hoursPerDay = Math.round((ticket.estimate_hours / days.length) * 100) / 100;

  const client = await pool.connect();
  try {
    // Remove existing non-override allocations for this ticket
    await client.query(
      'DELETE FROM daily_allocations WHERE ticket_id = $1 AND is_override = FALSE',
      [ticket.id]
    );

    // Insert new distribution
    for (const date of days) {
      await client.query(
        `INSERT INTO daily_allocations (ticket_id, user_id, date, planned_hours)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ticket_id, user_id, date) DO UPDATE SET planned_hours = $4`,
        [ticket.id, ticket.owner_id, date, hoursPerDay]
      );
    }
  } finally {
    client.release();
  }
}

async function getUtilisation(userId, from, to) {
  const { rows } = await pool.query(
    `SELECT date, SUM(planned_hours) as planned, 0 as actual
     FROM daily_allocations
     WHERE user_id = $1 AND date BETWEEN $2 AND $3
     GROUP BY date ORDER BY date`,
    [userId, from, to]
  );

  const { rows: actuals } = await pool.query(
    `SELECT date, SUM(actual_hours) as actual
     FROM time_entries
     WHERE user_id = $1 AND date BETWEEN $2 AND $3
     GROUP BY date`,
    [userId, from, to]
  );

  const actualMap = {};
  actuals.forEach(a => { actualMap[a.date.toISOString().slice(0,10)] = parseFloat(a.actual); });

  return rows.map(r => {
    const date = r.date.toISOString().slice(0, 10);
    return {
      date,
      planned_hours: parseFloat(r.planned),
      actual_hours: actualMap[date] || 0,
    };
  });
}

module.exports = { distributeTicket, getUtilisation };
