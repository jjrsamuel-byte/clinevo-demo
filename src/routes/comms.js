const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { clientId, type } = req.query;
  const filters = {};
  if (clientId) filters.clientId = clientId;
  if (type) filters.type = type;
  const comms = store.getAll('comms', filters);
  comms.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  res.json(comms);
});

router.post('/', (req, res) => {
  const comm = store.create('comms', { ...req.body, status: 'sent', sentAt: new Date().toISOString() });
  res.status(201).json(comm);
});

module.exports = router;
