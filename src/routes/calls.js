const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { status, outcome, date } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (outcome) filters.outcome = outcome;
  if (date) filters.date = date;
  const calls = store.getAll('calls', filters);
  calls.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return b.startTime.localeCompare(a.startTime);
  });
  res.json(calls);
});

router.get('/stats', (req, res) => {
  const calls = store.getAll('calls');
  const today = new Date().toISOString().split('T')[0];

  const total = calls.length;
  const completed = calls.filter(c => c.status === 'completed').length;
  const missed = calls.filter(c => c.status === 'missed').length;
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);
  const avgDuration = completed > 0 ? Math.round(totalDuration / completed) : 0;

  const todayCalls = calls.filter(c => c.date === today);
  const todayTotal = todayCalls.length;
  const todayCompleted = todayCalls.filter(c => c.status === 'completed').length;

  // Outcome breakdown
  const outcomes = {};
  calls.filter(c => c.outcome).forEach(c => {
    outcomes[c.outcome] = (outcomes[c.outcome] || 0) + 1;
  });

  // Calls by date (last 7 days)
  const byDate = {};
  calls.forEach(c => {
    byDate[c.date] = (byDate[c.date] || 0) + 1;
  });

  // Resolution rate
  const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.json({
    total,
    completed,
    missed,
    avgDuration,
    todayTotal,
    todayCompleted,
    resolutionRate,
    outcomes,
    byDate
  });
});

router.get('/:id', (req, res) => {
  const call = store.getById('calls', req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  res.json(call);
});

router.post('/', (req, res) => {
  const call = store.create('calls', req.body);
  res.status(201).json(call);
});

module.exports = router;
