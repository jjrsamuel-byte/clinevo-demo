const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { clientId, type } = req.query;
  const filters = {};
  if (clientId) filters.clientId = clientId;
  if (type) filters.type = type;
  const comms = store.getAll('comms', filters);
  comms.sort((a, b) => {
    const da = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const db = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    // Pending (no sentAt) goes to top so they're visible
    if (!a.sentAt && b.sentAt) return -1;
    if (a.sentAt && !b.sentAt) return 1;
    return db - da;
  });
  res.json(comms);
});

router.post('/', (req, res) => {
  const comm = store.create('comms', { ...req.body, status: 'sent', sentAt: new Date().toISOString() });
  res.status(201).json(comm);
});

router.post('/send-all', (req, res) => {
  const comms = store.getAll('comms');
  let sent = 0;
  comms.forEach(c => {
    if (c.status === 'pending') {
      store.update('comms', c.id, { status: 'sent', sentAt: new Date().toISOString() });
      sent++;
    }
  });
  res.json({ ok: true, sent });
});

module.exports = router;
