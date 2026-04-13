// Retell Web Call manager
const RetellCall = {
  client: null,
  active: false,
  callId: null,

  async start() {
    // Get access token from our server
    const res = await fetch('/api/v1/retell/web-call', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    this.callId = data.callId;

    // Create Retell web client
    // The SDK is loaded globally as RetellWebClient from the CDN
    this.client = new window.RetellWebClient();

    // Set up event listeners
    this.client.on('call_started', () => {
      this.active = true;
      this._emit('started');
    });

    this.client.on('call_ended', () => {
      this.active = false;
      this._emit('ended');
    });

    this.client.on('agent_start_talking', () => {
      this._emit('agent_talking', true);
    });

    this.client.on('agent_stop_talking', () => {
      this._emit('agent_talking', false);
    });

    this.client.on('update', (update) => {
      // Handle transcript from Retell SDK (various field names across versions)
      if (update.transcript) {
        this._emit('transcript', update.transcript);
      }
    });

    // Some Retell SDK versions fire 'transcript' directly
    this.client.on('transcript', (transcript) => {
      if (Array.isArray(transcript)) {
        this._emit('transcript', transcript);
      }
    });

    this.client.on('error', (error) => {
      console.error('Retell error:', error);
      this._emit('error', error);
    });

    // Start the call
    await this.client.startCall({
      accessToken: data.accessToken
    });

    return data.callId;
  },

  async stop() {
    if (this.client) {
      await this.client.stopCall();
      this.active = false;
      this.client = null;
    }
  },

  // Simple event emitter
  _listeners: {},

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  },

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }
};
