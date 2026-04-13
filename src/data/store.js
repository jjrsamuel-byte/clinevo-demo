const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

class Store extends EventEmitter {
  constructor() {
    super();
    this.data = {};
    this.counters = {};
    this.load();
  }

  load() {
    const seedDir = __dirname;
    const collections = ['clients', 'patients', 'staff', 'appointments', 'appointment-types', 'comms', 'calls'];
    for (const col of collections) {
      const file = path.join(seedDir, `seed-${col}.json`);
      const key = col.replace('-', '_');
      this.data[key] = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.counters[key] = Math.max(0, ...this.data[key].map(r => r.id)) + 1;
    }
  }

  reset() {
    this.load();
    this.emit('change', { type: 'reset', data: {} });
  }

  getAll(collection, filters = {}) {
    let items = [...(this.data[collection] || [])];
    for (const [key, val] of Object.entries(filters)) {
      if (val === undefined || val === '') continue;
      if (key === 'search') {
        const q = val.toLowerCase();
        items = items.filter(item => {
          const searchable = [item.name, item.firstName, item.lastName, item.phone, item.email]
            .filter(Boolean).join(' ').toLowerCase();
          return searchable.includes(q);
        });
      } else {
        items = items.filter(item => String(item[key]) === String(val));
      }
    }
    return items;
  }

  getById(collection, id) {
    return (this.data[collection] || []).find(item => item.id === Number(id));
  }

  create(collection, data) {
    const id = this.counters[collection]++;
    const record = { id, ...data, createdAt: new Date().toISOString() };
    this.data[collection].push(record);
    this.emit('change', { type: `${collection}:created`, data: record });
    return record;
  }

  update(collection, id, updates) {
    const idx = (this.data[collection] || []).findIndex(item => item.id === Number(id));
    if (idx === -1) return null;
    Object.assign(this.data[collection][idx], updates, { updatedAt: new Date().toISOString() });
    const record = this.data[collection][idx];
    this.emit('change', { type: `${collection}:updated`, data: record });
    return record;
  }

  remove(collection, id) {
    const idx = (this.data[collection] || []).findIndex(item => item.id === Number(id));
    if (idx === -1) return false;
    const [record] = this.data[collection].splice(idx, 1);
    this.emit('change', { type: `${collection}:removed`, data: record });
    return true;
  }
}

module.exports = new Store();
