// Staff view
const StaffView = {
  async render() {
    const main = document.getElementById('main');
    const staff = State.get('staff');

    const today = new Date().toISOString().split('T')[0];
    const todayAppts = await API.appointments.list({ date: today });

    main.innerHTML = `
      <div class="view-header">
        <h2>Staff</h2>
      </div>
      <div class="card-grid">
        ${staff.map(s => {
          const apptCount = todayAppts.filter(a => a.staffId === s.id && a.status !== 'cancelled').length;
          const dow = new Date().getDay();
          const isWorking = s.workingDays.includes(dow === 0 ? 7 : dow);
          const initials = s.name.replace(/Dr |Nurse /, '').split(' ').map(w => w[0]).join('');

          return `
            <div class="staff-card">
              <div class="staff-header">
                <div class="staff-avatar" style="background:${s.colour}">${initials}</div>
                <div>
                  <div class="staff-name">${s.name}</div>
                  <div class="staff-role">${s.role}</div>
                </div>
              </div>
              <div class="flex items-center gap-8 mb-8">
                <span class="availability-dot ${isWorking && s.available ? 'available' : isWorking ? 'busy' : 'off'}"></span>
                <span class="text-small">${isWorking && s.available ? 'Available' : isWorking ? 'Busy' : 'Day off'}</span>
              </div>
              ${s.specialisms.length ? `
                <div class="mb-8">
                  ${s.specialisms.map(sp => `<span class="tag tag-species">${sp}</span>`).join(' ')}
                </div>
              ` : ''}
              <div class="text-small text-muted">
                ${isWorking ? `${s.startTime} – ${s.endTime} · ${apptCount} appointment${apptCount !== 1 ? 's' : ''} today` : 'Not working today'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
};
