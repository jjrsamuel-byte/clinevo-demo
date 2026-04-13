// Chat transcript renderer for AI panel
const ChatTranscript = {
  render(messages, container) {
    container.innerHTML = messages.map(msg => {
      if (msg.role === 'system') {
        return `<div class="chat-message system">${msg.text}</div>`;
      }
      if (msg.role === 'action') {
        return ''; // Actions rendered separately
      }
      const roleLabel = msg.role === 'ai' ? 'AI Receptionist' : 'Caller';
      return `
        <div class="chat-message ${msg.role}">
          <div class="chat-role">${roleLabel}</div>
          ${msg.text}
        </div>
      `;
    }).join('');

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
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
