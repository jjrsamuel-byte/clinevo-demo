// Chat transcript renderer for AI panel
const ChatTranscript = {
  _lastRendered: [],

  render(messages, container, forceFullRender = false) {
    // Fast path: full re-render when structure changes dramatically or forced
    if (forceFullRender || this._lastRendered.length === 0 || !container.children.length) {
      container.innerHTML = messages.map((msg, i) => this._renderMsg(msg, i)).join('');
      this._lastRendered = messages.map(m => ({ role: m.role, text: m.text }));
      container.scrollTop = container.scrollHeight;
      return;
    }

    // Diff-based update: only touch what changed
    let needsScroll = false;
    const existing = container.children;

    // Update existing messages if text changed
    const minLen = Math.min(this._lastRendered.length, messages.length);
    for (let i = 0; i < minLen; i++) {
      if (i < existing.length && this._lastRendered[i].text !== messages[i].text) {
        existing[i].outerHTML = this._renderMsg(messages[i], i);
      }
    }

    // Remove extra old messages
    while (container.children.length > messages.length) {
      container.removeChild(container.lastChild);
    }

    // Append new messages
    if (messages.length > this._lastRendered.length) {
      const frag = document.createDocumentFragment();
      for (let i = this._lastRendered.length; i < messages.length; i++) {
        const div = document.createElement('div');
        div.innerHTML = this._renderMsg(messages[i], i);
        if (div.firstChild) frag.appendChild(div.firstChild);
      }
      container.appendChild(frag);
      needsScroll = true;
    }

    this._lastRendered = messages.map(m => ({ role: m.role, text: m.text }));
    if (needsScroll) container.scrollTop = container.scrollHeight;
  },

  _renderMsg(msg, idx) {
    if (msg.role === 'system') {
      return `<div class="chat-message system" data-idx="${idx}">${msg.text}</div>`;
    }
    if (msg.role === 'action') return '';
    const roleLabel = msg.role === 'ai' ? 'AI Receptionist' : 'Caller';
    return `
      <div class="chat-message ${msg.role}" data-idx="${idx}">
        <div class="chat-role">${roleLabel}</div>
        ${msg.text}
      </div>
    `;
  },

  addTypingIndicator(container) {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  },

  removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }
};
