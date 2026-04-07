require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/tickets',     require('./routes/tickets'));
app.use('/api/allocations', require('./routes/allocations'));
app.use('/api/capacity',    require('./routes/capacity'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Background jobs ───────────────────────────────────────────────────────────
const { runSync: hubspotSync } = require('./jobs/hubspot-sync');
const { runSync: everhourSync } = require('./jobs/everhour-sync');

// HubSpot sync every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('[cron] Running HubSpot sync...');
  hubspotSync();
});

// Everhour sync every 15 minutes
cron.schedule('*/15 * * * *', () => {
  console.log('[cron] Running Everhour sync...');
  everhourSync();
});

// ── Startup sync ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Wordie Resource Planner running on port ${PORT}`);
  console.log('Running initial sync...');
  await hubspotSync().catch(e => console.error('Initial HubSpot sync failed:', e.message));
  await everhourSync().catch(e => console.error('Initial Everhour sync failed:', e.message));
});
