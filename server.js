const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/v1/auth', require('./src/routes/auth'));
app.use('/api/v1/appointments', require('./src/routes/appointments'));
app.use('/api/v1/clients', require('./src/routes/clients'));
app.use('/api/v1/patients', require('./src/routes/patients'));
app.use('/api/v1/staff', require('./src/routes/staff'));
app.use('/api/v1/availability', require('./src/routes/availability'));
app.use('/api/v1/appointment-types', require('./src/routes/appointment-types'));
app.use('/api/v1/comms', require('./src/routes/comms'));
app.use('/api/v1/events', require('./src/routes/events'));
app.use('/api/v1/ai', require('./src/routes/ai'));
app.use('/api/v1/retell', require('./src/routes/retell'));

// Reset endpoint
const store = require('./src/data/store');
app.post('/api/v1/reset', (req, res) => {
  store.reset();
  res.json({ ok: true, message: 'Demo data reset' });
});

// Health check
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start comms engine
const { startCommsEngine } = require('./src/comms/engine');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Clinevo Demo running on http://localhost:${PORT}`);
  startCommsEngine();
});
