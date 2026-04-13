const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { clientId, species, search } = req.query;
  const filters = {};
  if (clientId) filters.clientId = clientId;
  if (species) filters.species = species;
  if (search) filters.search = search;
  res.json(store.getAll('patients', filters));
});

router.get('/:id', (req, res) => {
  const patient = store.getById('patients', req.params.id);
  if (!patient) return res.status(404).json({ error: 'Not found' });
  const client = store.getById('clients', patient.clientId);
  res.json({ ...patient, client });
});

router.post('/', (req, res) => {
  const patient = store.create('patients', req.body);
  res.status(201).json(patient);
});

module.exports = router;
