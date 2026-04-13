const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { search } = req.query;
  const filters = {};
  if (search) filters.search = search;
  const clients = store.getAll('clients', filters);
  res.json(clients);
});

router.get('/:id', (req, res) => {
  const client = store.getById('clients', req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  const patients = store.getAll('patients', { clientId: client.id });
  res.json({ ...client, patients });
});

router.post('/', (req, res) => {
  const client = store.create('clients', req.body);
  res.status(201).json(client);
});

module.exports = router;
