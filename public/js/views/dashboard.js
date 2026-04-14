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
    const today = State.get('currentDate');
    const tomorrow = (() => {
      const d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })();

    const [stats, calls, tomorrowAppts] = await Promise.all([
      API.calls.stats(),
      API.calls.list(),
      API.appointments.list({ date: tomorrow })
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

    // Pre-cache patients for tomorrow's appointments
    const tomorrowPatientIds = [...new Set(tomorrowAppts.map(a => a.patientId))];
    await Promise.all(tomorrowPatientIds.map(id => State.getPatient(id)));

    // New clients created by AI
    const newClients = clients.filter(c => c.createdBy === 'ai-receptionist');
    const newPatients = patients.filter(p => p.createdBy === 'ai-receptionist');

    // Revenue metrics
    const outboundCalls = calls.filter(c => c.direction === 'outbound');
    const reviewsSent = calls.filter(c => c.reviewSent).length;
    const carePlanLeads = calls.filter(c => c.carePlanInterest).length;
    const revenueRecovered = calls.reduce((sum, c) => sum + (c.revenueRecovered || 0), 0);
    const lapsedReactivated = calls.filter(c => c.outcome === 'lapsed_reactivation').length;
    const followUpCalls = calls.filter(c => c.outcome === 'post_surgery_followup').length;
    const noshowRebooked = calls.filter(c => c.outcome === 'noshow_rebooked' || c.outcome === 'cancellation_rebooked').length;
    const noshowPending = calls.filter(c => c.outcome === 'noshow_pending').length;
    const noshowRevenue = calls.filter(c => c.outcome === 'noshow_rebooked' || c.outcome === 'cancellation_rebooked').reduce((s, c) => s + (c.revenueRecovered || 0), 0);

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
        <div class="dash-stat-card dash-stat-green">
          <div class="dash-stat-value">${newClients.length}</div>
          <div class="dash-stat-label">New Clients</div>
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
        <div class="revenue-card revenue-noshow">
          <div class="revenue-icon">📅</div>
          <div>
            <div class="revenue-value">${noshowRebooked} Rebooked</div>
            <div class="revenue-label">No-shows & Cancellations</div>
            <div class="revenue-sub">${noshowPending} pending · £${noshowRevenue} recovered</div>
          </div>
        </div>
        <div class="revenue-card revenue-new-clients">
          <div class="revenue-icon">👤</div>
          <div>
            <div class="revenue-value">${newClients.length} Client${newClients.length !== 1 ? 's' : ''}</div>
            <div class="revenue-label">New Registrations by AI</div>
            <div class="revenue-sub">${newPatients.length} patient${newPatients.length !== 1 ? 's' : ''} registered · auto-created during calls</div>
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

      <!-- Practice Manager Briefing -->
      <div class="dash-panels">
        <!-- Tomorrow's Schedule -->
        <div class="card">
          <h3 class="dash-section-title">📋 Tomorrow <span class="text-small text-muted">(${new Date(tomorrow + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })})</span></h3>
          ${tomorrowAppts.length === 0
            ? '<div class="text-muted text-center" style="padding:12px">No appointments booked</div>'
            : `<div class="dash-tomorrow-list" style="max-height:260px;overflow-y:auto">
                ${tomorrowAppts.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(a => {
                  const staff = State.getStaffById(a.staffId);
                  const type = State.getTypeById(a.typeId);
                  const patient = State._data._patientCache[a.patientId];
                  const patientName = patient ? patient.name : '...';
                  const alerts = patient && patient.alerts && patient.alerts.length
                    ? patient.alerts.map(al => `<span class="tag tag-alert" style="font-size:9px">${al}</span>`).join(' ')
                    : '';
                  const isAiBooked = a.createdBy === 'ai-receptionist';
                  return `
                    <div class="briefing-appt-row">
                      <span class="briefing-time">${a.startTime}</span>
                      <span class="briefing-patient">${patientName}</span>
                      <span class="tag" style="background:${type ? type.colour : '#888'};color:white;font-size:10px">${type ? type.name : 'Appt'}</span>
                      <span class="briefing-staff">${staff ? staff.name.replace('Dr ', '').replace('Nurse ', '') : ''}</span>
                      ${isAiBooked ? '<span class="tag tag-species" style="font-size:9px">🤖 AI</span>' : ''}
                      ${alerts}
                    </div>
                  `;
                }).join('')}
              </div>`
          }
        </div>

        <!-- Key Info from Today -->
        <div class="card">
          <h3 class="dash-section-title">🔔 Practice Manager Briefing</h3>
          <div class="briefing-alerts">
            ${this.generateBriefingAlerts(calls, patients, clients, clientMap, patientMap)}
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
            ${this.renderOutcomeBar('No-show Rebooked', (stats.outcomes.noshow_rebooked || 0) + (stats.outcomes.cancellation_rebooked || 0), stats.completed, '#E67E22')}
            ${this.renderOutcomeBar('No-show Pending', stats.outcomes.noshow_pending || 0, stats.completed, '#95A5A6')}
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

      <!-- Enquiry Type + Volume by Date side by side -->
      <div class="dash-panels">
        <div class="card">
          <h3 class="dash-section-title">Call Volume by Enquiry Type</h3>
          <div class="dash-enquiry-grid">
            ${this.renderEnquiryTypeBreakdown(calls)}
          </div>
        </div>
        <div class="card">
          <h3 class="dash-section-title">Call Volume by Date</h3>
          <div class="dash-volume-chart">
            ${this.renderVolumeChart(stats.byDate)}
          </div>
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

  generateBriefingAlerts(calls, patients, clients, clientMap, patientMap) {
    const today = State.get('currentDate');
    const todaysCalls = calls.filter(c => c.date === today);
    const alerts = [];

    // Emergency calls today
    const emergencies = todaysCalls.filter(c => c.outcome === 'emergency_escalated');
    emergencies.forEach(c => {
      alerts.push({
        icon: '🚨',
        type: 'urgent',
        text: `Emergency: ${patientMap[c.patientId] || 'Unknown'} (${clientMap[c.clientId] || 'Unknown'}) — ${c.resolution || 'Emergency case'}`,
        detail: c.notes || ''
      });
    });

    // Missed calls today
    const missed = todaysCalls.filter(c => c.status === 'missed');
    if (missed.length > 0) {
      alerts.push({
        icon: '📵',
        type: 'warning',
        text: `${missed.length} missed call${missed.length > 1 ? 's' : ''} today — no voicemail left`,
        detail: 'Consider checking if these were potential emergencies'
      });
    }

    // Callbacks pending
    const callbacks = todaysCalls.filter(c => c.outcome === 'callback_requested');
    callbacks.forEach(c => {
      alerts.push({
        icon: '📞',
        type: 'action',
        text: `Callback needed: ${clientMap[c.clientId] || 'Unknown'} re: ${patientMap[c.patientId] || 'patient'}`,
        detail: c.resolution || c.notes || ''
      });
    });

    // Anxious/concerned clients today
    const anxious = todaysCalls.filter(c => c.sentiment === 'anxious' || c.sentiment === 'concerned');
    anxious.forEach(c => {
      if (!emergencies.find(e => e === c)) {
        alerts.push({
          icon: '😟',
          type: 'info',
          text: `${c.sentiment} client: ${clientMap[c.clientId] || 'Unknown'} about ${patientMap[c.patientId] || 'their pet'}`,
          detail: c.summary || c.resolution || ''
        });
      }
    });

    // Reviews sent today
    const reviews = todaysCalls.filter(c => c.reviewSent);
    if (reviews.length > 0) {
      alerts.push({
        icon: '⭐',
        type: 'positive',
        text: `${reviews.length} Google review link${reviews.length > 1 ? 's' : ''} sent today after positive follow-up calls`,
        detail: reviews.map(c => clientMap[c.clientId] || 'Unknown').join(', ')
      });
    }

    // Revenue recovered today
    const revenue = todaysCalls.filter(c => c.revenueRecovered);
    if (revenue.length > 0) {
      const total = revenue.reduce((s, c) => s + c.revenueRecovered, 0);
      alerts.push({
        icon: '💰',
        type: 'positive',
        text: `£${total} revenue recovered from ${revenue.length} reactivated lapsed client${revenue.length > 1 ? 's' : ''}`,
        detail: ''
      });
    }

    // No-shows/cancellations followed up today
    const noshows = todaysCalls.filter(c => c.outcome === 'noshow_rebooked' || c.outcome === 'cancellation_rebooked' || c.outcome === 'noshow_pending');
    if (noshows.length > 0) {
      const rebooked = noshows.filter(c => c.rebookStatus === 'rebooked');
      const pending = noshows.filter(c => c.rebookStatus === 'pending');
      alerts.push({
        icon: '📅',
        type: rebooked.length > 0 ? 'positive' : 'warning',
        text: `No-show/cancellation follow-ups: ${rebooked.length} rebooked, ${pending.length} pending`,
        detail: noshows.map(c => {
          const name = clientMap[c.clientId] || 'Unknown';
          const pet = patientMap[c.patientId] || '';
          if (c.rebookStatus === 'rebooked') return `${name} (${pet}) — rebooked ${c.rebookDate}`;
          return `${name} (${pet}) — awaiting callback`;
        }).join('; ')
      });
    }

    // Care plan interest
    const carePlan = todaysCalls.filter(c => c.carePlanInterest);
    if (carePlan.length > 0) {
      alerts.push({
        icon: '🛡️',
        type: 'action',
        text: `${carePlan.length} client${carePlan.length > 1 ? 's' : ''} expressed interest in wellness/care plans`,
        detail: carePlan.map(c => clientMap[c.clientId] || 'Unknown').join(', ') + ' — follow up to convert'
      });
    }

    // New clients registered by AI today
    const todaysNewClients = clients.filter(c => c.createdBy === 'ai-receptionist' && c.createdAt && c.createdAt.startsWith(today));
    if (todaysNewClients.length > 0) {
      alerts.push({
        icon: '👤',
        type: 'positive',
        text: `${todaysNewClients.length} new client${todaysNewClients.length > 1 ? 's' : ''} registered by AI during calls`,
        detail: todaysNewClients.map(c => `${c.firstName} ${c.lastName}`).join(', ')
      });
    }

    if (alerts.length === 0) {
      return '<div class="text-muted text-center" style="padding:16px">No alerts for today</div>';
    }

    const typeClass = { urgent: 'briefing-urgent', warning: 'briefing-warning', action: 'briefing-action', info: 'briefing-info', positive: 'briefing-positive' };

    return alerts.map(a => `
      <div class="briefing-alert ${typeClass[a.type] || ''}">
        <span class="briefing-alert-icon">${a.icon}</span>
        <div class="briefing-alert-body">
          <div class="briefing-alert-text">${a.text}</div>
          ${a.detail ? `<div class="briefing-alert-detail">${a.detail}</div>` : ''}
        </div>
      </div>
    `).join('');
  },

  renderEnquiryTypeBreakdown(calls) {
    const types = [
      { key: 'appointment_booked', label: 'Appointment Booking', icon: '📅', colour: 'var(--clinevo-purple)' },
      { key: 'emergency_escalated', label: 'Emergency', icon: '🚨', colour: 'var(--danger)' },
      { key: 'info_provided', label: 'General Enquiry', icon: 'ℹ️', colour: 'var(--signal-teal)' },
      { key: 'callback_requested', label: 'Callback Request', icon: '📞', colour: 'var(--warning)' },
      { key: 'post_surgery_followup', label: 'Post-Surgery Follow-up', icon: '🩺', colour: 'var(--forest-teal)' },
      { key: 'lapsed_reactivation', label: 'Lapsed Client Reactivation', icon: '🔄', colour: 'var(--success)' },
      { key: 'noshow_rebooked', label: 'No-show Rebooked', icon: '📋', colour: '#E67E22' },
      { key: 'noshow_pending', label: 'No-show Pending', icon: '⏳', colour: '#95A5A6' },
      { key: 'cancellation_rebooked', label: 'Cancellation Rebooked', icon: '↩️', colour: '#8E44AD' }
    ];

    const completedCalls = calls.filter(c => c.status === 'completed');
    const missedCalls = calls.filter(c => c.status === 'missed');
    const total = calls.length;

    // Count each type
    const typeCounts = types.map(t => {
      const count = completedCalls.filter(c => c.outcome === t.key).length;
      return { ...t, count };
    }).filter(t => t.count > 0);

    // Add missed calls
    if (missedCalls.length > 0) {
      typeCounts.push({ key: 'missed', label: 'Missed Calls', icon: '📵', colour: 'var(--danger)', count: missedCalls.length });
    }

    // Sort by count descending
    typeCounts.sort((a, b) => b.count - a.count);

    if (typeCounts.length === 0) return '<div class="text-muted text-center">No call data</div>';

    const maxCount = Math.max(...typeCounts.map(t => t.count));

    return typeCounts.map(t => {
      const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
      const barPct = maxCount > 0 ? Math.round((t.count / maxCount) * 100) : 0;
      return `
        <div class="enquiry-type-row">
          <div class="enquiry-type-info">
            <div class="enquiry-type-label">${t.label}</div>
            <div class="enquiry-type-bar-wrap">
              <div class="enquiry-type-bar" style="width:${barPct}%;background:${t.colour}"></div>
            </div>
          </div>
          <div class="enquiry-type-count">
            <span class="enquiry-type-num">${t.count}</span>
            <span class="enquiry-type-pct">${pct}%</span>
          </div>
        </div>
      `;
    }).join('');
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

// SSE: refresh dashboard on new calls or new clients
SSE.on('calls:created', () => {
  if (State.get('currentView') === 'dashboard') DashboardView.loadDashboard();
});
SSE.on('clients:created', () => {
  if (State.get('currentView') === 'dashboard') DashboardView.loadDashboard();
});
SSE.on('patients:created', () => {
  if (State.get('currentView') === 'dashboard') DashboardView.loadDashboard();
});
