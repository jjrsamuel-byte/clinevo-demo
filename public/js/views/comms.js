// Communications view
const CommsView = {
  currentFilter: 'all',

  async render() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="view-header">
        <h2>Communications</h2>
      </div>
      <div class="filter-tabs" id="comms-filter">
        <button class="active" data-filter="all">All</button>
        <button data-filter="appointment_reminder">Reminders</button>
        <button data-filter="post_visit_followup">Follow-ups</button>
        <button data-filter="vaccination_due">Vaccination</button>
        <button data-filter="prescription_refill">Prescriptions</button>
      </div>
      <div id="comms-list"></div>
    `;

    document.querySelectorAll('#comms-filter button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#comms-filter button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.loadComms();
      });
    });

    await this.loadComms();
  },

  async loadComms() {
    const params = this.currentFilter !== 'all' ? { type: this.currentFilter } : {};
    const comms = await API.comms.list(params);

    const list = document.getElementById('comms-list');
    if (!list) return;

    if (comms.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>No communications yet</p>
        </div>
      `;
      return;
    }

    list.innerHTML = comms.map(c => NotificationCard.render(c)).join('');
  }
};

// SSE: new comms appear live
SSE.on('comms:created', () => {
  if (State.get('currentView') === 'comms') CommsView.loadComms();
});
