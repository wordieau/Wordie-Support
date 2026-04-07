const router = require('express').Router();
const pool = require('../db');
const { getUtilisation } = require('../services/allocation-engine');

// GET /api/capacity?from=2026-04-07&to=2026-04-11
// Returns all team members with their daily utilisation for the date range
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    const { rows: users } = await pool.query('SELECT * FROM user_capacity ORDER BY name');

    const result = await Promise.all(users.map(async user => {
      const days = await getUtilisation(user.user_id, from, to);
      const totalPlanned = days.reduce((s, d) => s + d.planned_hours, 0);
      const totalActual  = days.reduce((s, d) => s + d.actual_hours, 0);
      const capacity     = user.weekly_hours || 40;
      const utilPct      = capacity > 0 ? Math.round((totalPlanned / capacity) * 100) : 0;

      return {
        ...user,
        days,
        total_planned_hours: totalPlanned,
        total_actual_hours: totalActual,
        utilisation_pct: utilPct,
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/capacity/users — just the list of team members
router.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM user_capacity ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/capacity/users/:id — update weekly hours
router.patch('/users/:id', async (req, res) => {
  try {
    const { weekly_hours } = req.body;
    const { rows } = await pool.query(
      'UPDATE user_capacity SET weekly_hours = $1 WHERE user_id = $2 RETURNING *',
      [weekly_hours, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
