const router = require('express').Router();
const pool = require('../db');
const { runSync } = require('../jobs/hubspot-sync');

// GET /api/tickets — all tickets with their allocations and actuals
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.*,
        COALESCE(
          json_agg(
            json_build_object(
              'date', da.date,
              'planned_hours', da.planned_hours,
              'is_override', da.is_override
            ) ORDER BY da.date
          ) FILTER (WHERE da.id IS NOT NULL), '[]'
        ) AS allocations,
        COALESCE(SUM(te.actual_hours), 0) AS total_actual_hours
      FROM tickets t
      LEFT JOIN daily_allocations da ON da.ticket_id = t.id
      LEFT JOIN time_entries te ON te.ticket_id = t.id
      GROUP BY t.id
      ORDER BY t.due_date ASC NULLS LAST
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*,
        COALESCE(
          json_agg(
            json_build_object('date', da.date, 'planned_hours', da.planned_hours,
              'actual_hours', COALESCE(te_day.actual, 0))
            ORDER BY da.date
          ) FILTER (WHERE da.id IS NOT NULL), '[]'
        ) AS days,
        COALESCE(SUM(te.actual_hours), 0) AS total_actual_hours
      FROM tickets t
      LEFT JOIN daily_allocations da ON da.ticket_id = t.id
      LEFT JOIN LATERAL (
        SELECT SUM(actual_hours) as actual FROM time_entries
        WHERE ticket_id = t.id AND date = da.date
      ) te_day ON TRUE
      LEFT JOIN time_entries te ON te.ticket_id = t.id
      WHERE t.id = $1
      GROUP BY t.id
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/sync — trigger a manual HubSpot sync
router.post('/sync', async (req, res) => {
  res.json({ message: 'Sync started' });
  runSync(); // fire and forget
});

module.exports = router;
