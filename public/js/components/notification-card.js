// Notification card renderer
const NotificationCard = {
  typeLabels: {
    appointment_reminder: 'Appointment Reminder',
    vaccination_due: 'Vaccination Due',
    post_visit_followup: 'Follow-up',
    prescription_refill: 'Prescription Refill'
  },

  typeIcons: {
    appointment_reminder: '📅',
    vaccination_due: '💉',
    post_visit_followup: '📋',
    prescription_refill: '💊'
  },

  render(comm) {
    const timeAgo = this.formatTimeAgo(comm.sentAt);
    const icon = this.typeIcons[comm.type] || '📩';
    const label = this.typeLabels[comm.type] || comm.type;

    return `
      <div class="notification-card type-${comm.type}">
        <div class="notification-header">
          <span class="notification-type">${icon} ${label}</span>
          <span class="notification-time">${timeAgo}</span>
        </div>
        <div class="notification-message">${comm.message}</div>
        <div class="notification-meta">
          <span>📤 ${comm.channel.toUpperCase()}</span>
          <span>✅ ${comm.status}</span>
        </div>
      </div>
    `;
  },

  formatTimeAgo(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
};
