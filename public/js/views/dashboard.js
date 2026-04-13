// Management Dashboard view
const DashboardView = {
  async render() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="view-header">
        <h2>Clinevo AI Dashboard</h2>
      </div>
      <div id="dashboard-content"><div class="loading">Loading dashboard...</div></div>
    `;
    await this.loadDashboard();
  },

  async loadDashboard() {
    const [stats, calls] = await Promise.all([
      API.calls.stats(),
      API.calls.list()
    ]);

    const container = document.getElementById('dashboard-content');
    if (!container) return;

    const recentCalls = calls.slice(0, 8);

    const [clients, patients] = await Promise.all([
      API.clients.list(),
      API.patients.list()
    ]);
    const clientMap = {};
    clients.forEach(c => clientMap[c.id] = `${c.firstName} ${c.lastName}`);
    const patientMap = {};
    patients.forEach(p => patientMap[p.id] = p.name);

    // Revenue metrics
    const outboundCalls = calls.filter(c => c.direction === 'outbound');
    const reviewsSent = calls.filter(c => c.reviewSent).length;
    const carePlanLeads = calls.filter(c => c.carePlanInterest).length;
    const revenueRecovered = calls.reduce((sum, c) => sum + (c.revenueRecovered || 0), 0);
    const lapsedReactivated = calls.filter(c => c.outcome === 'lapsed_reactivation').length;
    const followUpCalls = calls.filter(c => c.outcome === 'post_surgery_followup').length;

    // Estimate missed revenue from lapsed patients not yet contacted
    const lapsedPatients = patients.filter(p => {
      if (!p.vaccinationDue) return false;
      const due = new Date(p.vaccinationDue);
      const now = new Date();
      const monthsOverdue = (now - due) / (1000 * 60 * 60 * 24 * 30);
      return monthsOverdue > 1;
    });

    container.innerHTML = `
      <!-- Stats Cards -->
      <div class="dash-stats-grid">
        <div class="dash-stat-card">
          <div class="dash-stat-value">${stats.total}</div>
          <div class="dash-stat-label">Total Calls</div>
        </div>
        <div class="dash-stat-card dash-stat-teal">
          <div class="dash-stat-value">${stats.completed}</div>
          <div class="dash-stat-label">Handled by AI</div>
        </div>
        <div class="dash-stat-card dash-stat-purple">
          <div class="dash-stat-value">${stats.resolutionRate}%</div>
          <div class="dash-stat-label">Resolution Rate</div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-value">${outboundCalls.length}</div>
          <div class="dash-stat-label">Outbound Calls</div>
        </div>
        <div class="dash-stat-card dash-stat-teal">
          <div class="dash-stat-value">${reviewsSent}</div>
          <div class="dash-stat-label">Reviews Sent</div>
        </div>
        <div class="dash-stat-card dash-stat-red">
          <div class="dash-stat-value">${stats.missed}</div>
          <div class="dash-stat-label">Missed</div>
        </div>
      </div>

      <!-- Revenue & Growth Section -->
      <div class="dash-revenue-banner">
        <div class="revenue-card revenue-recovered">
          <div class="revenue-icon">💰</div>
          <div>
            <div class="revenue-value">£${revenueRecovered}</div>
            <div class="revenue-label">Revenue Recovered</div>
            <div class="revenue-sub">from ${lapsedReactivated} lapsed client${lapsedReactivated !== 1 ? 's' : ''} reactivated</div>
          </div>
        </div>
        <div class="revenue-card revenue-reviews">
          <div class="revenue-icon">⭐</div>
          <div>
            <div class="revenue-value">${reviewsSent} Reviews</div>
            <div class="revenue-label">Google Review Links Sent</div>
            <div class="revenue-sub">Auto-sent after positive follow-up calls</div>
          </div>
        </div>
        <div class="revenue-card revenue-care">
          <div class="revenue-icon">🛡️</div>
          <div>
            <div class="revenue-value">${carePlanLeads} Leads</div>
            <div class="revenue-label">Care Plan Interest</div>
            <div class="revenue-sub">Clients interested in wellness plans</div>
          </div>
        </div>
        <div class="revenue-card revenue-lapsed">
          <div class="revenue-icon">⚠️</div>
          <div>
            <div class="revenue-value">${lapsedPatients.length} Patients</div>
            <div class="revenue-label">Overdue / Lapsed</div>
            <div class="revenue-sub">Est. £${lapsedPatients.length * 65} potential missed revenue</div>
          </div>
        </div>
      </div>

      <div class="dash-panels">
        <!-- Outcome Breakdown -->
        <div class="card">
          <h3 class="dash-section-title">Outcome Breakdown</h3>
          <div class="dash-outcome-list">
            ${this.renderOutcomeBar('Appointment Booked', stats.outcomes.appointment_booked || 0, stats.completed, 'var(--clinevo-purple)')}
            ${this.renderOutcomeBar('Info Provided', stats.outcomes.info_provided || 0, stats.completed, 'var(--signal-teal)')}
            ${this.renderOutcomeBar('Post-Surgery Follow-up', stats.outcomes.post_surgery_followup || 0, stats.completed, 'var(--forest-teal)')}
            ${this.renderOutcomeBar('Lapsed Reactivated', stats.outcomes.lapsed_reactivation || 0, stats.completed, 'var(--success)')}
            ${this.renderOutcomeBar('Callback Requested', stats.outcomes.callback_requested || 0, stats.completed, 'var(--warning)')}
            ${this.renderOutcomeBar('Emergency Escalated', stats.outcomes.emergency_escalated || 0, stats.completed, 'var(--danger)')}
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
          <h3 class="dash-section-title">Recent Activity</h3>
          <div class="dash-activity-feed">
            ${recentCalls.map(c => {
              const clientName = c.clientId ? (clientMap[c.clientId] || 'Unknown') : 'Unknown caller';
              const icon = this.outcomeIcon(c.outcome, c.status, c.direction);
              const reviewBadge = c.reviewSent ? ' ⭐' : '';
              return `
                <div class="dash-activity-item">
                  <span class="dash-activity-icon">${icon}</span>
                  <div class="dash-activity-body">
                    <div class="dash-activity-text">${c.resolution || c.notes}${reviewBadge}</div>
                    <div class="dash-activity-meta">${clientName} · ${c.date} ${c.startTime}${c.direction === 'outbound' ? ' · Outbound' : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Call Volume by Date -->
      <div class="card mt-16">
        <h3 class="dash-section-title">Call Volume</h3>
        <div class="dash-volume-chart">
          ${this.renderVolumeChart(stats.byDate)}
        </div>
      </div>
    `;
  },

  renderOutcomeBar(label, count, total, color) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="dash-outcome-row">
        <div class="dash-outcome-label">${label}</div>
        <div class="dash-outcome-bar-wrap">
          <div class="dash-outcome-bar" style="width:${pct}%; background:${color}"></div>
        </div>
        <div class="dash-outcome-count">${count} <span class="text-muted">(${pct}%)</span></div>
      </div>
    `;
  },

  renderVolumeChart(byDate) {
    const dates = Object.keys(byDate).sort();
    if (dates.length === 0) return '<div class="text-muted text-center">No data yet</div>';
    const maxVal = Math.max(...Object.values(byDate));

    return `
      <div class="dash-bar-chart">
        ${dates.map(d => {
          const val = byDate[d];
          const height = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
          const label = new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return `
            <div class="dash-bar-col">
              <div class="dash-bar-val">${val}</div>
              <div class="dash-bar" style="height:${height}%"></div>
              <div class="dash-bar-label">${label}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  outcomeIcon(outcome, status, direction) {
    if (status === 'missed') return '📵';
    if (direction === 'outbound') return '📤';
    const icons = {
      appointment_booked: '📅',
      info_provided: 'ℹ️',
      callback_requested: '📞',
      emergency_escalated: '🚨',
      post_surgery_followup: '🩺',
      lapsed_reactivation: '🔄'
    };
    return icons[outcome] || '📞';
  }
};

// SSE: refresh dashboard on new calls
SSE.on('calls:created', () => {
  if (State.get('currentView') === 'dashboard') DashboardView.loadDashboard();
});
