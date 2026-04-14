// Server-Sent Events client
const SSE = {
  source: null,
  listeners: {},

  connect() {
    this.source = new EventSource('/api/v1/events');

    this.source.addEventListener('connected', () => {
      console.log('SSE connected');
    });

    // Store change events
    const changeTypes = [
      'appointments:created', 'appointments:updated', 'appointments:removed',
      'comms:created',
      'calls:created', 'calls:updated',
      'clients:created', 'clients:updated',
      'patients:created', 'patients:updated',
      'reset'
    ];

    for (const type of changeTypes) {
      this.source.addEventListener(type, (e) => {
        const data = JSON.parse(e.data);
        this._notify(type, data);
      });
    }

    // AI events
    this.source.addEventListener('ai:step', (e) => {
      const data = JSON.parse(e.data);
      this._notify('ai:step', data);
    });

    // Retell voice-call tool actions (search_client, check_availability, book_appointment, etc.)
    this.source.addEventListener('retell:action', (e) => {
      const data = JSON.parse(e.data);
      this._notify('retell:action', data);
    });

    this.source.onerror = () => {
      console.log('SSE reconnecting...');
    };
  },

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  },

  off(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  },

  _notify(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
    // Also notify wildcard listeners
    (this.listeners['*'] || []).forEach(fn => fn(event, data));
  }
};
