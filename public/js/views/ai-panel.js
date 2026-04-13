// AI Receptionist panel
const AIPanel = {
  retellAvailable: false,
  _lastTranscript: [],

  async render() {
    const drawer = document.getElementById('ai-drawer');
    const aiMode = State.get('aiMode');
    const running = State.get('aiRunning');
    const modeInfo = await API.ai.mode();
    const retellStatus = await API.retell.status();
    this.retellAvailable = retellStatus.configured;

    const isVoiceMode = aiMode === 'voice';
    const isCallActive = running && isVoiceMode;

    drawer.innerHTML = `
      <div class="ai-drawer-header">
        <h3>
          <span class="ai-dot" style="width:8px;height:8px;background:var(--signal-teal);border-radius:50%;display:inline-block${isCallActive ? ';animation:pulse-dot 1s infinite' : ''}"></span>
          AI Receptionist
        </h3>
        <button class="btn btn-ghost btn-sm" id="ai-close">✕</button>
      </div>

      <div class="ai-drawer-controls">
        <div class="flex gap-8 items-center">
          <select class="ai-scenario-select" id="ai-mode-select">
            <option value="scripted" ${aiMode === 'scripted' ? 'selected' : ''}>Scripted Demo</option>
            ${modeInfo.liveAvailable ? `<option value="live" ${aiMode === 'live' ? 'selected' : ''}>Live AI (Text)</option>` : ''}
            ${this.retellAvailable ? `<option value="voice" ${aiMode === 'voice' ? 'selected' : ''}>Live Voice Call</option>` : ''}
          </select>
        </div>

        ${aiMode === 'scripted' ? `
          <div id="ai-scenario-picker">
            <select class="ai-scenario-select" id="ai-scenario-select">
              <option value="">Select a scenario...</option>
              <option value="emergency">🚨 Emergency — Dog eaten chocolate</option>
              <option value="routine">📅 Routine — Annual vaccination booking</option>
              <option value="faq">❓ FAQ — Opening hours & pricing</option>
            </select>
          </div>
        ` : ''}

        <div class="ai-drawer-buttons">
          ${isVoiceMode ? `
            <button class="btn ${isCallActive ? 'btn-danger' : 'btn-teal'} btn-sm" id="ai-start">
              ${isCallActive ? '🔴 End Call' : '📞 Start Call'}
            </button>
          ` : `
            <button class="btn btn-teal btn-sm" id="ai-start" ${running ? 'disabled' : ''}>${running ? 'Running...' : 'Start Demo'}</button>
          `}
          <button class="btn btn-secondary btn-sm" id="ai-reset">Reset</button>
        </div>
      </div>

      ${isCallActive ? `
        <div class="voice-call-status" id="voice-call-status">
          <div class="voice-visualiser">
            <div class="voice-bars">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="voice-label">Listening...</div>
          </div>
        </div>
      ` : ''}

      <div class="ai-chat-area" id="ai-chat-area">
        ${State.get('aiMessages').length === 0 ? `
          <div class="ai-status">
            <div class="status-icon">${isVoiceMode ? '📞' : '🎙️'}</div>
            <p>${isVoiceMode
              ? 'Click "Start Call" to speak with the AI receptionist through your microphone'
              : 'Select a scenario and click "Start Demo" to simulate an incoming phone call'
            }</p>
          </div>
        ` : ''}
      </div>

      <div class="ai-action-log" id="ai-action-log" style="${State.get('aiActions').length ? '' : 'display:none'}">
        <h4>PMS Actions</h4>
        <div id="ai-actions-list"></div>
      </div>

      ${aiMode === 'live' ? `
        <div class="ai-live-input">
          <input type="text" id="ai-live-msg" placeholder="Type as the caller..." ${running ? '' : 'disabled'}>
          <button class="btn btn-primary btn-sm" id="ai-live-send" ${running ? '' : 'disabled'}>Send</button>
        </div>
      ` : ''}
    `;

    // Re-render existing messages
    if (State.get('aiMessages').length > 0) {
      ChatTranscript.render(State.get('aiMessages'), document.getElementById('ai-chat-area'));
    }

    // Re-render existing actions
    if (State.get('aiActions').length > 0) {
      this.renderActions();
    }

    // Event listeners
    document.getElementById('ai-close').addEventListener('click', () => {
      if (RetellCall.active) RetellCall.stop();
      State.set('aiDrawerOpen', false);
    });

    document.getElementById('ai-mode-select').addEventListener('change', (e) => {
      State.set('aiMode', e.target.value);
      AIPanel.render();
    });

    document.getElementById('ai-start').addEventListener('click', () => this.startDemo());
    document.getElementById('ai-reset').addEventListener('click', () => this.resetDemo());

    // Live text mode send
    const liveInput = document.getElementById('ai-live-msg');
    const liveSend = document.getElementById('ai-live-send');
    if (liveInput && liveSend) {
      liveSend.addEventListener('click', () => this.sendLiveMessage());
      liveInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.sendLiveMessage();
      });
    }
  },

  async startDemo() {
    const mode = State.get('aiMode');

    if (mode === 'scripted') {
      const scenarioId = document.getElementById('ai-scenario-select').value;
      if (!scenarioId) return alert('Please select a scenario');

      State.set('aiRunning', true);
      State.set('aiMessages', []);
      State.set('aiActions', []);
      await API.ai.startScenario(scenarioId);
      AIPanel.render();

    } else if (mode === 'voice') {
      if (RetellCall.active) {
        // End active call
        await RetellCall.stop();
        State.set('aiRunning', false);
        const msgs = State.get('aiMessages');
        msgs.push({ role: 'system', text: 'Call ended' });
        State.set('aiMessages', msgs);
        AIPanel.render();
        return;
      }

      State.set('aiRunning', true);
      State.set('aiMessages', [{ role: 'system', text: '📞 Connecting voice call...' }]);
      State.set('aiActions', []);
      this._lastTranscript = [];
      AIPanel.render();

      try {
        // Set up Retell event listeners
        RetellCall.on('started', () => {
          const msgs = State.get('aiMessages');
          msgs.push({ role: 'system', text: '🟢 Call connected — speak into your microphone' });
          State.set('aiMessages', msgs);
          const chatArea = document.getElementById('ai-chat-area');
          if (chatArea) ChatTranscript.render(msgs, chatArea);
          // Update voice label
          const label = document.querySelector('.voice-label');
          if (label) label.textContent = 'Connected — speak now';
        });

        RetellCall.on('ended', () => {
          State.set('aiRunning', false);
          const msgs = State.get('aiMessages');
          msgs.push({ role: 'system', text: 'Call ended' });
          State.set('aiMessages', msgs);
          AIPanel.render();
        });

        RetellCall.on('agent_talking', (isTalking) => {
          const label = document.querySelector('.voice-label');
          if (label) label.textContent = isTalking ? 'AI Receptionist speaking...' : 'Listening...';
          const bars = document.querySelector('.voice-bars');
          if (bars) bars.classList.toggle('active', isTalking);
        });

        RetellCall.on('transcript', (transcript) => {
          this._updateTranscriptFromRetell(transcript);
        });

        RetellCall.on('error', (error) => {
          console.error('Retell call error:', error);
          const msgs = State.get('aiMessages');
          msgs.push({ role: 'system', text: 'Call error: ' + (error.message || error) });
          State.set('aiMessages', msgs);
          State.set('aiRunning', false);
          AIPanel.render();
        });

        await RetellCall.start();
      } catch (err) {
        State.set('aiRunning', false);
        const msgs = State.get('aiMessages');
        msgs.push({ role: 'system', text: 'Failed to start call: ' + err.message });
        State.set('aiMessages', msgs);
        AIPanel.render();
      }

    } else {
      // Live text mode
      State.set('aiRunning', true);
      State.set('aiMessages', [
        { role: 'system', text: 'Live AI mode — type messages as the caller' },
        { role: 'ai', text: 'Good morning, Oakwood Veterinary Practice, how can I help you today?' }
      ]);
      State.set('aiActions', []);
      ChatTranscript.render(State.get('aiMessages'), document.getElementById('ai-chat-area'));
      AIPanel.render();
    }
  },

  _updateTranscriptFromRetell(transcript) {
    // Convert Retell transcript array to our message format
    // Only add new utterances
    const newMessages = [];
    for (let i = this._lastTranscript.length; i < transcript.length; i++) {
      const utt = transcript[i];
      newMessages.push({
        role: utt.role === 'agent' ? 'ai' : 'caller',
        text: utt.content
      });
    }
    this._lastTranscript = [...transcript];

    if (newMessages.length > 0) {
      const msgs = State.get('aiMessages');
      msgs.push(...newMessages);
      State.set('aiMessages', msgs);
      const chatArea = document.getElementById('ai-chat-area');
      if (chatArea) ChatTranscript.render(msgs, chatArea);
    }
  },

  async resetDemo() {
    if (RetellCall.active) await RetellCall.stop();
    await API.ai.stopScenario();
    this._lastTranscript = [];
    // Clear Retell event listeners
    RetellCall._listeners = {};
    State.set('aiRunning', false);
    State.set('aiMessages', []);
    State.set('aiActions', []);
    AIPanel.render();
  },

  async sendLiveMessage() {
    const input = document.getElementById('ai-live-msg');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    const messages = State.get('aiMessages');
    messages.push({ role: 'caller', text: message });
    State.set('aiMessages', messages);
    ChatTranscript.render(messages, document.getElementById('ai-chat-area'));

    ChatTranscript.addTypingIndicator(document.getElementById('ai-chat-area'));

    try {
      const history = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text
      }));

      const response = await API.ai.chat(message, history);
      ChatTranscript.removeTypingIndicator();

      if (response.actions) {
        const actions = State.get('aiActions');
        actions.push(...response.actions);
        State.set('aiActions', actions);
        this.renderActions();
      }

      messages.push({ role: 'ai', text: response.message });
      State.set('aiMessages', messages);
      ChatTranscript.render(messages, document.getElementById('ai-chat-area'));
    } catch (err) {
      ChatTranscript.removeTypingIndicator();
      messages.push({ role: 'system', text: 'Error: ' + err.message });
      State.set('aiMessages', messages);
      ChatTranscript.render(messages, document.getElementById('ai-chat-area'));
    }
  },

  renderActions() {
    const actions = State.get('aiActions');
    const logEl = document.getElementById('ai-action-log');
    const listEl = document.getElementById('ai-actions-list');
    if (!logEl || !listEl) return;

    logEl.style.display = '';
    listEl.innerHTML = actions.map(a => `
      <div class="action-item ${a.apiCall ? 'action-api' : ''}">
        <span class="action-icon">${a.apiCall ? '⚡' : '→'}</span>
        <span>${a.text}${a.apiCall ? ` <code>${a.apiCall}</code>` : ''}</span>
      </div>
    `).join('');
    listEl.scrollTop = listEl.scrollHeight;
  }
};

// Handle SSE AI steps (scripted scenarios)
SSE.on('ai:step', (data) => {
  const messages = State.get('aiMessages');
  const actions = State.get('aiActions');

  if (data.role === 'action') {
    actions.push({ text: data.text, apiCall: data.apiCall || '' });
    State.set('aiActions', actions);
    AIPanel.renderActions();
  } else {
    messages.push({ role: data.role, text: data.text });
    State.set('aiMessages', messages);
    const chatArea = document.getElementById('ai-chat-area');
    if (chatArea) ChatTranscript.render(messages, chatArea);
  }

  if (data.done) {
    State.set('aiRunning', false);
    const msgs = State.get('aiMessages');
    msgs.push({ role: 'system', text: 'Call ended' });
    State.set('aiMessages', msgs);
    const chatArea = document.getElementById('ai-chat-area');
    if (chatArea) ChatTranscript.render(msgs, chatArea);
  }
});

// Handle SSE Retell actions (from webhook tool calls)
SSE.on('retell:action', (data) => {
  const actions = State.get('aiActions');
  actions.push({ text: data.text, apiCall: data.apiCall || '' });
  State.set('aiActions', actions);
  AIPanel.renderActions();
});

// Re-render panel when drawer opens
State.on('aiDrawerOpen', (open) => {
  if (open) AIPanel.render();
});
