function renderTopbar() {
  const el = document.getElementById('topbar');
  const date = State.get('currentDate');
  const aiOpen = State.get('aiDrawerOpen');

  el.innerHTML = `
    <div class="topbar-left">
      <h3>Oakwood Veterinary Practice</h3>
      <span class="topbar-date">${State.formatDate(date)}</span>
    </div>
    <div class="topbar-right">
      <button class="btn btn-reset" id="btn-reset-demo">Reset Demo</button>
      <button class="btn btn-ai" id="btn-toggle-ai">
        <span class="ai-dot"></span>
        AI Receptionist
      </button>
    </div>
  `;

  document.getElementById('btn-toggle-ai').addEventListener('click', () => {
    State.set('aiDrawerOpen', !State.get('aiDrawerOpen'));
  });

  document.getElementById('btn-reset-demo').addEventListener('click', async () => {
    if (confirm('Reset all demo data to defaults?')) {
      await API.reset();
      State.set('aiMessages', []);
      State.set('aiActions', []);
      State.set('aiRunning', false);
      // Re-render current view
      State.set('currentView', State.get('currentView'));
    }
  });
}

State.on('aiDrawerOpen', (open) => {
  document.getElementById('app').classList.toggle('ai-open', open);
});

State.on('currentDate', () => renderTopbar());
