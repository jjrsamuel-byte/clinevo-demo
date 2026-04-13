const { buildSystemPrompt } = require('./system-prompt');

async function handleLiveMessage(message, history, store) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { message: 'Live AI mode requires an ANTHROPIC_API_KEY environment variable.', actions: [] };
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const systemPrompt = buildSystemPrompt(store);
  const actions = [];

  const tools = [
    {
      name: 'search_clients',
      description: 'Search for a client by name, phone, or email in the practice management system',
      input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Search term' } }, required: ['query'] }
    },
    {
      name: 'search_patients',
      description: 'Search for a patient (animal) by name or species',
      input_schema: { type: 'object', properties: { search: { type: 'string' }, clientId: { type: 'integer' } }, required: [] }
    },
    {
      name: 'check_availability',
      description: 'Find available appointment slots for a given date and appointment type',
      input_schema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' }, typeId: { type: 'integer', description: 'Appointment type ID: 1=Routine, 2=Vaccination, 3=Nurse Check, 4=Dental, 5=Emergency, 6=Surgery, 7=Behaviour' } }, required: ['date'] }
    },
    {
      name: 'book_appointment',
      description: 'Book an appointment in the PMS',
      input_schema: {
        type: 'object',
        properties: {
          clientId: { type: 'integer' },
          patientId: { type: 'integer' },
          staffId: { type: 'integer' },
          typeId: { type: 'integer' },
          date: { type: 'string' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['clientId', 'patientId', 'typeId', 'date', 'startTime', 'endTime']
      }
    },
    {
      name: 'send_message',
      description: 'Send an SMS or email confirmation to a client',
      input_schema: {
        type: 'object',
        properties: {
          clientId: { type: 'integer' },
          patientId: { type: 'integer' },
          channel: { type: 'string', enum: ['sms', 'email'] },
          message: { type: 'string' }
        },
        required: ['clientId', 'channel', 'message']
      }
    }
  ];

  // Build messages
  const messages = history.map(h => ({ role: h.role, content: h.content }));
  messages.push({ role: 'user', content: message });

  // Call Claude with tools — handle tool use loop
  let currentMessages = [...messages];
  let finalText = '';

  for (let i = 0; i < 5; i++) { // Max 5 tool-use rounds
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages
    });

    // Extract text and tool use
    let hasToolUse = false;
    const toolResults = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        finalText = block.text;
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        const result = await executeTool(block.name, block.input, store, actions);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }

    if (!hasToolUse) break;

    // Continue with tool results
    currentMessages.push({ role: 'assistant', content: response.content });
    currentMessages.push({ role: 'user', content: toolResults });
  }

  return { message: finalText, actions };
}

async function executeTool(name, input, store, actions) {
  switch (name) {
    case 'search_clients': {
      actions.push({ text: `Searching clients: "${input.query}"`, apiCall: `GET /api/v1/clients?search=${input.query}` });
      return store.getAll('clients', { search: input.query });
    }
    case 'search_patients': {
      actions.push({ text: `Searching patients`, apiCall: 'GET /api/v1/patients' });
      const filters = {};
      if (input.search) filters.search = input.search;
      if (input.clientId) filters.clientId = input.clientId;
      return store.getAll('patients', filters);
    }
    case 'check_availability': {
      actions.push({ text: `Checking availability for ${input.date}`, apiCall: `GET /api/v1/availability?date=${input.date}` });
      // Simplified availability check
      const appts = store.getAll('appointments', { date: input.date });
      const staff = store.getAll('staff').filter(s => s.role.includes('Veterinary Surgeon'));
      const slots = [];
      for (const vet of staff) {
        const vetAppts = appts.filter(a => a.staffId === vet.id);
        const busyTimes = new Set(vetAppts.map(a => a.startTime));
        for (let h = 8; h < 17; h++) {
          for (const m of ['00', '15', '30', '45']) {
            const time = `${String(h).padStart(2, '0')}:${m}`;
            if (!busyTimes.has(time)) {
              slots.push({ staffId: vet.id, staffName: vet.name, date: input.date, startTime: time });
            }
          }
        }
      }
      return slots.slice(0, 10);
    }
    case 'book_appointment': {
      actions.push({ text: `Booking appointment`, apiCall: 'POST /api/v1/appointments' });
      return store.create('appointments', {
        ...input,
        status: 'confirmed',
        createdBy: 'ai-receptionist'
      });
    }
    case 'send_message': {
      actions.push({ text: `Sending ${input.channel} to client`, apiCall: 'POST /api/v1/comms' });
      return store.create('comms', {
        type: 'appointment_reminder',
        clientId: input.clientId,
        patientId: input.patientId || 0,
        channel: input.channel,
        message: input.message
      });
    }
    default:
      return { error: 'Unknown tool' };
  }
}

module.exports = { handleLiveMessage };
