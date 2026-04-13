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
        <svg width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
          <path d="M17.63,14.77 A9,9 0 1 1 17.63,5.23" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2.2"/>
          <path d="M14.75,12.97 A5.6,5.6 0 1 1 14.75,7.03" fill="none" stroke="#45C4BC" stroke-width="1.5"/>
          <path d="M12.37,11.48 A2.8,2.8 0 1 1 12.37,8.52" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>
        </svg>
        Clinevo AI
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
      State.set('currentView', State.get('currentView'));
    }
  });
}

State.on('aiDrawerOpen', (open) => {
  document.getElementById('app').classList.toggle('ai-open', open);
});

State.on('currentDate', () => renderTopbar());
