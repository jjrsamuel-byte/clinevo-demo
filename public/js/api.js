// API client for mock ezyVet PMS
const API = {
  base: '/api/v1',

  async get(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${this.base}${path}${qs ? '?' + qs : ''}`;
    const res = await fetch(url);
    return res.json();
  },

  async post(path, data) {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async put(path, data) {
    const res = await fetch(`${this.base}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async del(path) {
    const res = await fetch(`${this.base}${path}`, { method: 'DELETE' });
    return res.json();
  },

  // Convenience methods
  appointments: {
    list: (params) => API.get('/appointments', params),
    listRange: (dateFrom, dateTo) => API.get('/appointments', { dateFrom, dateTo }),
    get: (id) => API.get(`/appointments/${id}`),
    create: (data) => API.post('/appointments', data),
    update: (id, data) => API.put(`/appointments/${id}`, data),
    cancel: (id) => API.del(`/appointments/${id}`)
  },
  search: {
    global: (q) => API.get('/search', { q })
  },
  clients: {
    list: (params) => API.get('/clients', params),
    get: (id) => API.get(`/clients/${id}`)
  },
  patients: {
    list: (params) => API.get('/patients', params),
    get: (id) => API.get(`/patients/${id}`)
  },
  staff: {
    list: (params) => API.get('/staff', params),
    get: (id) => API.get(`/staff/${id}`)
  },
  availability: {
    list: (params) => API.get('/availability', params)
  },
  appointmentTypes: {
    list: () => API.get('/appointment-types')
  },
  comms: {
    list: (params) => API.get('/comms', params)
  },
  ai: {
    scenarios: () => API.get('/ai/scenarios'),
    startScenario: (scenarioId) => API.post('/ai/scenario/start', { scenarioId }),
    stopScenario: () => API.post('/ai/scenario/stop'),
    chat: (message, history) => API.post('/ai/chat', { message, history }),
    mode: () => API.get('/ai/mode')
  },
  calls: {
    list: (params) => API.get('/calls', params),
    get: (id) => API.get(`/calls/${id}`),
    stats: () => API.get('/calls/stats')
  },
  retell: {
    status: () => API.get('/retell/status'),
    createWebCall: () => API.post('/retell/web-call')
  },
  reset: () => API.post('/reset')
};
