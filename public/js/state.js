// Simple reactive state store
const State = {
  _data: {
    currentView: 'calendar',
    currentDate: new Date().toISOString().split('T')[0],
    calendarMode: 'day',
    aiDrawerOpen: false,
    aiMode: 'scripted', // 'scripted' | 'live'
    aiRunning: false,
    aiMessages: [],
    aiActions: [],
    staff: [],
    appointmentTypes: [],
    // Lookup caches
    _clientCache: {},
    _patientCache: {}
  },
  _listeners: {},

  get(key) {
    return this._data[key];
  },

  set(key, value) {
    this._data[key] = value;
    (this._listeners[key] || []).forEach(fn => fn(value));
  },

  on(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(fn);
  },

  // Helpers
  async loadLookups() {
    const [staff, types] = await Promise.all([
      API.staff.list(),
      API.appointmentTypes.list()
    ]);
    this.set('staff', staff);
    this.set('appointmentTypes', types);
  },

  getStaffById(id) {
    return this._data.staff.find(s => s.id === Number(id));
  },

  getTypeById(id) {
    return this._data.appointmentTypes.find(t => t.id === Number(id));
  },

  async getClient(id) {
    if (this._data._clientCache[id]) return this._data._clientCache[id];
    const client = await API.clients.get(id);
    this._data._clientCache[id] = client;
    return client;
  },

  async getPatient(id) {
    if (this._data._patientCache[id]) return this._data._patientCache[id];
    const patient = await API.patients.get(id);
    this._data._patientCache[id] = patient;
    return patient;
  },

  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  },

  getSpeciesIcon(species) {
    const icons = { Cat: '🐱', Dog: '🐕', Rabbit: '🐰', 'Guinea Pig': '🐹' };
    return icons[species] || '🐾';
  }
};
