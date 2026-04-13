const router = require('express').Router();
const store = require('../data/store');

const clients = [];

router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  res.write('event: connected\ndata: {}\n\n');

  const listener = (event) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  };

  store.on('change', listener);
  clients.push({ res, listener });

  req.on('close', () => {
    store.off('change', listener);
    const idx = clients.findIndex(c => c.res === res);
    if (idx !== -1) clients.splice(idx, 1);
  });
});

// Broadcast arbitrary events (used by AI receptionist)
router.post('/broadcast', (req, res) => {
  const { type, data } = req.body;
  for (const client of clients) {
    client.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  res.json({ ok: true });
});

module.exports = router;
