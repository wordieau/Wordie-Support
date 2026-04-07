const router = require('express').Router();
const pool = require('../db');
const { distributeTicket } = require('../services/allocation-engine');

// GET /api/allocations?from=&to= — all allocations in range, grouped by user
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    const { rows } = await pool.query(`
      SELECT
        da.user_id,
        da.date,
        da.planned_hours,
        da.is_override,
        t.id AS ticket_id,
        t.title,
        t.allocation_type,
        t.due_date,
        COALESCE(SUM(te.actual_hours), 0) AS actual_hours
      FROM daily_allocations da
      JOIN tickets t ON t.id = da.ticket_id
      LEFT JOIN time_entries te ON te.ticket_id = da.ticket_id AND te.date = da.date AND te.user_id = da.user_id
      WHERE da.date BETWEEN $1 AND $2
      GROUP BY da.user_id, da.date, da.planned_hours, da.is_override, t.id, t.title, t.allocation_type, t.due_date
      ORDER BY da.user_id, da.date
    `, [from, to]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/allocations — move a ticket (update date range + optionally reassign)
router.patch('/', async (req, res) => {
  try {
    const { ticket_id, new_start_date, new_due_date, new_owner_id } = req.body;

    // Update the ticket
    const updates = ['start_date = $2', 'due_date = $3', 'updated_at = NOW()'];
    const params = [ticket_id, new_start_date, new_due_date];

    if (new_owner_id) {
      updates.push(`owner_id = $${params.length + 1}`);
      params.push(new_owner_id);
    }

    const { rows } = await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found' });

    await distributeTicket(rows[0]);
    res.json({ message: 'Allocation updated', ticket: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
