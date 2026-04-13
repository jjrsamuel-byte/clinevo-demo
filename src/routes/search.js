const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ clients: [], patients: [] });

  const query = q.toLowerCase();

  // Search clients
  const clients = store.getAll('clients', {}).filter(c => {
    const searchable = [c.firstName, c.lastName, c.phone, c.email].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(query);
  }).slice(0, 5);

  // Search patients
  const patients = store.getAll('patients', {}).filter(p => {
    const searchable = [p.name, p.breed, p.species].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(query);
  }).slice(0, 5);

  // Enrich results with related data
  const enrichedClients = clients.map(c => {
    const pets = store.getAll('patients', {}).filter(p => p.clientId === c.id);
    return { ...c, type: 'client', petNames: pets.map(p => p.name).join(', ') };
  });

  const enrichedPatients = patients.map(p => {
    const client = store.getById('clients', p.clientId);
    return { ...p, type: 'patient', ownerName: client ? `${client.firstName} ${client.lastName}` : 'Unknown' };
  });

  res.json({ clients: enrichedClients, patients: enrichedPatients });
});

// Full client profile with all interactions
router.get('/profile/:clientId', (req, res) => {
  const clientId = Number(req.params.clientId);
  const client = store.getById('clients', clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const patients = store.getAll('patients', {}).filter(p => p.clientId === clientId);
  const patientIds = patients.map(p => p.id);

  // Get all calls for this client
  const calls = store.getAll('calls', {}).filter(c => c.clientId === clientId);
  calls.sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));

  // Get all comms for this client's patients
  const comms = store.getAll('comms', {}).filter(c => c.clientId === clientId || patientIds.includes(c.patientId));
  comms.sort((a, b) => {
    const da = a.sentAt || '2099-01-01';
    const db = b.sentAt || '2099-01-01';
    return db.localeCompare(da);
  });

  // Get all appointments for this client
  const appointments = store.getAll('appointments', {}).filter(a => a.clientId === clientId);
  appointments.sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));

  res.json({
    client,
    patients,
    calls,
    comms,
    appointments
  });
});

module.exports = router;
