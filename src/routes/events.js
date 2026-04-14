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

// In-process broadcast — preferred, avoids any self-HTTP-loop fragility.
// Other modules in the same Node process can `require('./events').broadcast(type, data)`
// to push an SSE event to every connected client without an HTTP round-trip.
function broadcast(type, data) {
  for (const client of clients) {
    try {
      client.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error('[events] broadcast write failed for one client:', err.message);
    }
  }
}

// Legacy HTTP broadcast — kept for backwards compatibility with anything
// still calling /api/v1/events/broadcast over HTTP.
router.post('/broadcast', (req, res) => {
  const { type, data } = req.body;
  broadcast(type, data);
  res.json({ ok: true });
});

module.exports = router;
module.exports.broadcast = broadcast;
