const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { date, staffId, status } = req.query;
  const filters = {};
  if (date) filters.date = date;
  if (staffId) filters.staffId = staffId;
  if (status) filters.status = status;
  res.json(store.getAll('appointments', filters));
});

router.get('/:id', (req, res) => {
  const appt = store.getById('appointments', req.params.id);
  if (!appt) return res.status(404).json({ error: 'Not found' });
  res.json(appt);
});

router.post('/', (req, res) => {
  const appt = store.create('appointments', req.body);
  res.status(201).json(appt);
});

router.put('/:id', (req, res) => {
  const appt = store.update('appointments', req.params.id, req.body);
  if (!appt) return res.status(404).json({ error: 'Not found' });
  res.json(appt);
});

router.delete('/:id', (req, res) => {
  const ok = store.remove('appointments', req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
