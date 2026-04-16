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

  // Get comms for this patient
  const comms = store.getAll('comms', { patientId: String(patient.id) });
  comms.sort((a, b) => new Date(b.sentAt || '2099-01-01') - new Date(a.sentAt || '2099-01-01'));
  const lastComm = comms.find(c => c.status === 'sent') || null;
  const nextComm = comms.find(c => c.status === 'pending') || null;

  // Get calls for this patient
  const calls = store.getAll('calls', { patientId: String(patient.id) })
    .filter(c => c.date && c.startTime);
  calls.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  const lastCall = calls[0] || null;

  // Last action = most recent of lastComm or lastCall
  let lastAction = null;
  if (lastComm && lastCall) {
    const commDate = new Date(lastComm.sentAt);
    const callDate = new Date(lastCall.date + 'T' + lastCall.startTime);
    lastAction = commDate > callDate
      ? { type: 'comm', date: lastComm.sentAt, description: lastComm.message.substring(0, 80) }
      : { type: 'call', date: lastCall.date + 'T' + lastCall.startTime, description: lastCall.resolution || lastCall.notes || 'Phone call' };
  } else if (lastComm) {
    lastAction = { type: 'comm', date: lastComm.sentAt, description: lastComm.message.substring(0, 80) };
  } else if (lastCall) {
    lastAction = { type: 'call', date: lastCall.date + 'T' + lastCall.startTime, description: lastCall.resolution || lastCall.notes || 'Phone call' };
  }

  res.json({ ...patient, client, lastAction, nextComm, lastCall });
});

router.post('/', (req, res) => {
  const patient = store.create('patients', req.body);
  res.status(201).json(patient);
});

module.exports = router;
