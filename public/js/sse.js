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
      'comms:created', 'reset'
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
