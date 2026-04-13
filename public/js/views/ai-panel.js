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

      ${this._getScriptHtml(aiMode, running) || ''}

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

    // Script panel toggle
    const scriptToggle = document.getElementById('ai-script-toggle');
    if (scriptToggle) {
      scriptToggle.addEventListener('click', () => {
        const body = document.getElementById('ai-script-body');
        if (body) {
          const collapsed = body.style.display === 'none';
          body.style.display = collapsed ? '' : 'none';
          scriptToggle.textContent = collapsed ? '▼' : '▶';
        }
      });
    }

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

          // Save the full transcript to call log
          this._saveCallTranscript();

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
    // Handle various SDK versions: content/text field, role naming
    if (!Array.isArray(transcript)) return;

    const newMessages = [];
    for (let i = this._lastTranscript.length; i < transcript.length; i++) {
      const utt = transcript[i];
      if (!utt) continue;
      const role = (utt.role === 'agent' || utt.role === 'assistant') ? 'ai' : 'caller';
      const text = utt.content || utt.text || utt.message || '';
      if (!text) continue;
      newMessages.push({ role, text });
    }
    this._lastTranscript = [...transcript];

    if (newMessages.length > 0) {
      const msgs = State.get('aiMessages');
      msgs.push(...newMessages);
      State.set('aiMessages', msgs);
      const chatArea = document.getElementById('ai-chat-area');
      if (chatArea) {
        ChatTranscript.render(msgs, chatArea);
        chatArea.scrollTop = chatArea.scrollHeight;
      }
    }
  },

  async _saveCallTranscript() {
    // Build transcript text from collected messages
    const msgs = State.get('aiMessages').filter(m => m.role === 'ai' || m.role === 'caller');
    if (msgs.length === 0) return;

    const transcriptText = msgs.map(m => {
      const role = m.role === 'ai' ? 'AI' : 'Caller';
      return `${role}: ${m.text}`;
    }).join('\n');

    // Build a summary from the conversation
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      await API.post('/calls', {
        clientId: 0,
        patientId: 0,
        callId: `live_${Date.now()}`,
        date: dateStr,
        startTime: timeStr,
        endTime: timeStr,
        duration: Math.ceil(msgs.length * 0.3),
        status: 'completed',
        outcome: 'info_provided',
        resolution: 'Live voice call via Clinevo AI',
        summary: `Live voice call with ${msgs.length} exchanges. ${msgs.filter(m => m.role === 'ai').length} AI responses, ${msgs.filter(m => m.role === 'caller').length} caller messages.`,
        successful: true,
        sentiment: 'neutral',
        notes: 'Live Retell voice call',
        transcript: transcriptText,
        createdBy: 'ai-receptionist',
        direction: 'inbound'
      });
    } catch (err) {
      console.error('Failed to save call transcript:', err);
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

  _getScriptHtml(mode, running) {
    if (mode !== 'scripted' || !running) return '';
    const scenarioSelect = document.getElementById('ai-scenario-select');
    const scenarioId = scenarioSelect ? scenarioSelect.value : State.get('_activeScenarioId');
    if (!scenarioId) return '';
    State.set('_activeScenarioId', scenarioId);

    const scripts = {
      emergency: [
        { role: 'ai', text: 'Good morning, Oakwood Veterinary Practice, how can I help you today?' },
        { role: 'caller', text: "Hi, I'm really worried — my dog's just eaten a whole bar of dark chocolate about 20 minutes ago. He's a small cockapoo, about 8kg. What should I do?" },
        { role: 'ai', text: "I completely understand your worry, and you've done the right thing calling us straight away. Chocolate can be very dangerous for dogs, especially dark chocolate. Can you tell me roughly how much he ate and how he's behaving right now?" },
        { role: 'caller', text: "It was a 100g bar of 70% dark chocolate. He seems okay at the moment but he's panting a bit and quite restless." },
        { role: 'ai', text: "Right, at that dose for an 8kg dog, this is definitely something we need to see urgently. The sooner we can treat him, the better the outcome. I'm going to get him booked in as an emergency right now. Can I take your name please?" },
        { role: 'caller', text: "It's James Whitfield. Rufus is the dog's name." },
        { role: 'action', text: 'Search PMS for client → Book emergency slot with Dr Chen → Send confirmation SMS' },
        { role: 'ai', text: "That's all booked. I've got Rufus in with Dr Chen as an emergency. Please bring him straight in — don't try to make him sick yourself, the vet will handle that safely." },
        { role: 'caller', text: "Yes, I've been before. I'll head straight there now. Thank you so much." },
        { role: 'ai', text: "I've sent you a confirmation text as well. Drive safely, and we'll have the team ready for Rufus when you arrive." }
      ],
      routine: [
        { role: 'ai', text: 'Good morning, Oakwood Veterinary Practice, how can I help you today?' },
        { role: 'caller', text: "Hi there, I'd like to book my cat in for her annual vaccination please. Her name's Biscuit." },
        { role: 'ai', text: "Of course! Let me pull up Biscuit's records. Can I take your name?" },
        { role: 'caller', text: "It's Sarah Thornton." },
        { role: 'action', text: 'Search PMS for client → Check availability → Book vaccination with Dr Hargreaves' },
        { role: 'ai', text: "I've got a few options for you. There's a slot with Dr Hargreaves on Tuesday at 9:15am, or Wednesday at 10:00am. Which would suit you better?" },
        { role: 'caller', text: "Tuesday at 9:15 sounds perfect." },
        { role: 'ai', text: "That's booked for you — Biscuit with Dr Hargreaves on Tuesday at 9:15am. I've flagged that she can be a little nervous, so the team will have a quiet room ready with some Feliway." },
        { role: 'caller', text: "Oh that's lovely, thank you so much." },
        { role: 'ai', text: "You're welcome! I've sent you a confirmation text. We'll see you and Biscuit on Tuesday. Bye for now." }
      ],
      faq: [
        { role: 'ai', text: 'Good afternoon, Oakwood Veterinary Practice, how can I help you today?' },
        { role: 'caller', text: "Hi, I've just moved to the area and I'm looking for a new vet for my rabbits. Do you see rabbits?" },
        { role: 'ai', text: "Welcome to the area! Yes, we absolutely do see rabbits. We have Dr Priya Sharma who specialises in exotics, including rabbits." },
        { role: 'caller', text: "That's great. What are your opening hours? And do you do Saturday appointments?" },
        { role: 'ai', text: "We're open Monday to Friday, 8am until 6pm, and Saturdays 9am to 1pm. Dr Sharma is usually in on Tuesdays, Thursdays, and Fridays." },
        { role: 'caller', text: "And how much is a routine consultation for a rabbit?" },
        { role: 'ai', text: "I don't have the exact pricing to hand, but I can have one of the team call you back with the full fee schedule. Would you like me to arrange that?" },
        { role: 'caller', text: "Yes please. My name is Lisa and my number is 07855 332211." },
        { role: 'action', text: 'Create callback note for new client enquiry' },
        { role: 'ai', text: "I've made a note for the team to call you back, Lisa. They'll ring you usually within a few hours." }
      ]
    };

    const lines = scripts[scenarioId];
    if (!lines) return '';

    return `
      <div class="ai-script-panel" id="ai-script-panel">
        <div class="ai-script-header">
          <h4>Full Script</h4>
          <button class="btn btn-ghost btn-sm" id="ai-script-toggle">▼</button>
        </div>
        <div class="ai-script-body" id="ai-script-body">
          ${lines.map(l => `
            <div class="script-line script-${l.role}">
              <span class="script-role">${l.role === 'ai' ? 'AI' : l.role === 'caller' ? 'Caller' : '⚡ Action'}</span>
              <span class="script-text">${l.text}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
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

    // Save scripted call transcript to call log
    AIPanel._saveCallTranscript();
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
