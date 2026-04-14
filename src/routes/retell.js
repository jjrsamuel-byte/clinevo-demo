const router = require('express').Router();
const store = require('../data/store');

// Create a web call — frontend calls this to get an access token
router.post('/web-call', async (req, res) => {
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;

  if (!apiKey || !agentId) {
    return res.status(400).json({ error: 'RETELL_API_KEY and RETELL_AGENT_ID environment variables required' });
  }

  try {
    const Retell = require('retell-sdk');
    const client = new Retell({ apiKey });

    // Inject the current date/time into the agent so it never has to ask.
    // These are consumed via {{today}}, {{tomorrow}}, etc. in the Retell system prompt.
    const now = new Date();
    const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(now); dayAfter.setDate(dayAfter.getDate() + 2);
    const dayOfWeek = now.toLocaleDateString('en-GB', { weekday: 'long' });
    const tomorrowDayOfWeek = tomorrow.toLocaleDateString('en-GB', { weekday: 'long' });
    const longDate = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    const webCall = await client.call.createWebCall({
      agent_id: agentId,
      metadata: { demo: true, source: 'clinevo-demo' },
      retell_llm_dynamic_variables: {
        today: toDateStr(now),
        tomorrow: toDateStr(tomorrow),
        day_after_tomorrow: toDateStr(dayAfter),
        day_of_week: dayOfWeek,
        tomorrow_day_of_week: tomorrowDayOfWeek,
        long_date: longDate,
        current_time: currentTime
      }
    });

    res.json({
      accessToken: webCall.access_token,
      callId: webCall.call_id
    });
  } catch (err) {
    console.error('Retell web call error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Webhook — Retell calls this when the agent uses a custom tool
router.post('/webhook', (req, res) => {
  // Log every incoming request so we can see exactly what Retell is sending.
  // Check Railway logs after a test call to debug shape mismatches.
  console.log('[retell webhook] body:', JSON.stringify(req.body));

  // Handle Retell's different webhook event types — persist the call to our
  // store so it shows up in the Call Log + Audit Log views during/after the call.
  if (req.body.event === 'call_started') {
    const c = req.body.call || {};
    const callId = c.call_id || c.callId;
    if (callId) {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      upsertCallByRetellId(callId, {
        callId,
        date: dateStr,
        startTime: timeStr,
        direction: 'inbound',
        status: 'in_progress',
        successful: false,
        sentiment: null,
        outcome: null,
        notes: 'Live AI receptionist call in progress',
        createdBy: 'ai-receptionist'
      });
    }
    return res.json({});
  }
  if (req.body.event === 'call_ended') {
    const c = req.body.call || {};
    const callId = c.call_id || c.callId;
    if (callId) {
      const existing = store.getAll('calls', { callId })[0];
      if (existing) {
        const now = new Date();
        const endTimeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        // Compute duration from startTime if present
        let duration = existing.duration;
        if (existing.startTime) {
          const [sh, sm] = existing.startTime.split(':').map(Number);
          const [eh, em] = endTimeStr.split(':').map(Number);
          duration = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
        }
        store.update('calls', existing.id, {
          endTime: endTimeStr,
          duration,
          status: 'completed',
          successful: existing.outcome === 'appointment_booked' || !!existing.successful
        });
      }
    }
    return res.json({});
  }
  if (req.body.event === 'call_analyzed') {
    // Retell sends post-call analysis: transcript, summary, sentiment, etc.
    const c = req.body.call || {};
    const callId = c.call_id || c.callId;
    if (callId) {
      const existing = store.getAll('calls', { callId })[0];
      if (existing) {
        const analysis = c.call_analysis || c.callAnalysis || {};
        store.update('calls', existing.id, {
          transcript: c.transcript || existing.transcript,
          summary: analysis.call_summary || analysis.summary || existing.summary,
          sentiment: analysis.user_sentiment || analysis.sentiment || existing.sentiment,
          resolution: existing.resolution || analysis.call_summary || null
        });
      }
    }
    return res.json({});
  }

  // Retell sends custom function calls in this shape:
  //   { name: "check_availability", args: { date: "tomorrow" }, call: {...} }
  // Custom LLM agents instead send:
  //   { tool_calls: [{ tool_call_id, tool_name, tool_parameters }] }
  // Detect which mode we're in so we can return the right response shape.
  const isCustomFunctionMode = typeof req.body.name === 'string' && req.body.tool_calls === undefined;

  const toolCalls = req.body.tool_calls || [];
  if (toolCalls.length === 0 && (req.body.tool_call_id || req.body.name)) {
    // Single tool call format — covers both Custom LLM single-call and Custom Function
    toolCalls.push({
      tool_call_id: req.body.tool_call_id || req.body.call_id || 'single',
      tool_name: req.body.tool_name || req.body.name,
      tool_parameters: req.body.tool_parameters || req.body.args || req.body.arguments || {}
    });
  }

  const results = [];

  // The Retell webhook payload puts the call object at req.body.call for tool
  // invocations as well as lifecycle events. Pull the call_id once so each tool
  // case can attach its work to the right call record.
  const retellCallId = req.body.call && (req.body.call.call_id || req.body.call.callId);

  for (const toolCall of toolCalls) {
    const { tool_call_id, tool_parameters } = toolCall;
    // Normalise tool name: Retell tool names are case-sensitive, but humans
    // configuring the agent in the dashboard often capitalise (e.g. Search_client).
    // Lowercase it before matching so the switch always hits.
    const tool_name = String(toolCall.tool_name || '').toLowerCase();
    let result;

    try {
      switch (tool_name) {
        case 'search_client': {
          const query = tool_parameters.name || tool_parameters.query || tool_parameters.search || '';
          const clients = store.getAll('clients', { search: query });
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
          const tom = new Date(now); tom.setDate(tom.getDate() + 1);
          const tomorrowStr = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`;

          if (clients.length > 0) {
            const client = clients[0];
            const patients = store.getAll('patients', { clientId: client.id });
            // Tie the live call record to this identified client + first patient
            // so Call Log / Audit Log can show who phoned in.
            attachIdentifiedClient(retellCallId, client.id, patients[0] && patients[0].id);
            result = {
              found: true,
              today: todayStr,
              tomorrow: tomorrowStr,
              client: {
                id: client.id,
                name: `${client.title || ''} ${client.firstName} ${client.lastName}`.trim(),
                phone: client.phone,
                notes: client.notes
              },
              patients: patients.map(p => {
                // Compute a friendly "is X due?" hint so the LLM can answer
                // questions like "is Duke due his jab?" without having to do
                // date arithmetic itself.
                let vaccinationStatus = null;
                if (p.vaccinationDue) {
                  const due = new Date(p.vaccinationDue);
                  const diffDays = Math.round((due - now) / 86400000);
                  if (diffDays < 0) vaccinationStatus = `OVERDUE by ${Math.abs(diffDays)} days (was due ${p.vaccinationDue})`;
                  else if (diffDays === 0) vaccinationStatus = `due today (${p.vaccinationDue})`;
                  else if (diffDays <= 30) vaccinationStatus = `due in ${diffDays} days (${p.vaccinationDue}) — should book now`;
                  else if (diffDays <= 90) vaccinationStatus = `due in ${diffDays} days (${p.vaccinationDue})`;
                  else vaccinationStatus = `not due yet — next jab ${p.vaccinationDue}`;
                }
                return {
                  id: p.id,
                  name: p.name,
                  species: p.species,
                  breed: p.breed,
                  weight: p.weight,
                  dateOfBirth: p.dateOfBirth,
                  microchip: p.microchip,
                  notes: p.notes,
                  alerts: p.alerts,
                  vaccinationDue: p.vaccinationDue,
                  vaccinationStatus
                };
              })
            };
          } else {
            result = { found: false, today: todayStr, tomorrow: tomorrowStr, message: `No client found matching "${query}". You can register them as a new client using the register_new_client tool.` };
          }

          // Broadcast action to SSE
          broadcastAction(store, `Searched PMS for client: "${query}"`, `GET /api/v1/clients?search=${query}`);
          break;
        }

        case 'register_new_client': {
          const p = tool_parameters;
          // Create the client
          const newClient = store.create('clients', {
            title: p.title || '',
            firstName: p.first_name || p.firstName || '',
            lastName: p.last_name || p.lastName || '',
            email: p.email || '',
            phone: p.phone || '',
            address: p.address || '',
            postcode: p.postcode || '',
            notes: p.notes || '',
            createdBy: 'ai-receptionist'
          });

          // Create the patient if pet details provided
          let newPatient = null;
          if (p.pet_name || p.petName) {
            newPatient = store.create('patients', {
              clientId: newClient.id,
              name: p.pet_name || p.petName || '',
              species: p.pet_species || p.petSpecies || 'Dog',
              breed: p.pet_breed || p.petBreed || 'Unknown',
              colour: p.pet_colour || p.petColour || '',
              sex: p.pet_sex || p.petSex || '',
              dateOfBirth: p.pet_dob || p.petDob || '',
              weight: p.pet_weight || p.petWeight || 0,
              microchip: '',
              notes: '',
              alerts: [],
              vaccinationDue: null,
              createdBy: 'ai-receptionist'
            });
          }

          result = {
            success: true,
            client: {
              id: newClient.id,
              name: `${newClient.firstName} ${newClient.lastName}`.trim(),
              phone: newClient.phone
            },
            patient: newPatient ? {
              id: newPatient.id,
              name: newPatient.name,
              species: newPatient.species,
              breed: newPatient.breed
            } : null,
            message: `New client ${newClient.firstName} ${newClient.lastName} registered${newPatient ? ` with patient ${newPatient.name}` : ''}`
          };
          broadcastAction(store, `Registered new client: ${newClient.firstName} ${newClient.lastName}${newPatient ? ` with ${newPatient.name}` : ''}`, 'POST /api/v1/clients');
          break;
        }

        case 'check_availability': {
          // Current date helper
          const now = new Date();
          const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const todayStr = toDateStr(now);
          const tomorrowDate = new Date(now); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrowStr = toDateStr(tomorrowDate);

          let date = todayStr;

          if (tool_parameters.date) {
            const raw = tool_parameters.date.trim().toLowerCase();
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
              date = raw;
            } else if (raw === 'today') {
              date = todayStr;
            } else if (raw === 'tomorrow') {
              date = tomorrowStr;
            } else {
              // Try parsing, but validate it's not a hallucinated date
              const parsed = new Date(tool_parameters.date.trim());
              if (!isNaN(parsed.getTime())) {
                date = toDateStr(parsed);
              } else {
                // Default to tomorrow if we can't parse (most callers want "soon")
                date = tomorrowStr;
              }
            }
          }
          // Optional time-of-day filter. Lets the agent honour caller
          // preferences like "afternoon only" or "after 2pm" by passing
          // from_time: "14:00" (and optionally to_time: "17:00").
          const parseHHMM = (v) => {
            if (!v) return null;
            const s = String(v).trim().toLowerCase();
            // Accept "14:00", "1400", "14", "2pm", "2 pm"
            let m = s.match(/^(\d{1,2}):?(\d{2})?$/);
            if (m) return Math.min(23, Math.max(0, parseInt(m[1], 10))) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
            m = s.match(/^(\d{1,2})\s*(am|pm)$/);
            if (m) {
              let h = parseInt(m[1], 10) % 12;
              if (m[2] === 'pm') h += 12;
              return h * 60;
            }
            if (s === 'morning') return null; // morning is the default 08:00 start
            if (s === 'afternoon') return 12 * 60;
            if (s === 'evening') return 17 * 60;
            return null;
          };
          const fromMin = parseHHMM(tool_parameters.from_time || tool_parameters.fromTime || tool_parameters.preferred_time || tool_parameters.preferredTime);
          const toMin = parseHHMM(tool_parameters.to_time || tool_parameters.toTime);
          console.log('check_availability: raw =', tool_parameters.date, '→ parsed =', date, '| from:', fromMin, 'to:', toMin, '(today is', todayStr, ')');
          const typeId = tool_parameters.appointment_type_id || tool_parameters.typeId || 1;
          const appts = store.getAll('appointments', { date });
          const staff = store.getAll('staff').filter(s => s.role.includes('Veterinary Surgeon'));
          const type = store.getById('appointment_types', typeId);
          const duration = type ? type.duration : 20;

          const slots = [];
          for (const vet of staff) {
            const vetAppts = appts.filter(a => a.staffId === vet.id && a.status !== 'cancelled');
            const busyTimes = new Set();
            for (const a of vetAppts) {
              const [h, m] = a.startTime.split(':').map(Number);
              const [eh, em] = a.endTime.split(':').map(Number);
              for (let t = h * 60 + m; t < eh * 60 + em; t += 15) {
                busyTimes.add(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
              }
            }
            for (let h = 8; h < 17; h++) {
              for (const m of [0, 15, 30, 45]) {
                const minOfDay = h * 60 + m;
                if (fromMin !== null && minOfDay < fromMin) continue;
                if (toMin !== null && minOfDay > toMin) continue;
                const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                if (!busyTimes.has(time)) {
                  slots.push({ staffId: vet.id, staffName: vet.name, date, startTime: time, specialisms: vet.specialisms });
                }
              }
            }
          }

          // Return clear, AI-friendly response with current date context
          const topSlots = slots.slice(0, 10);
          const dateLabel = date === todayStr ? 'today' : date === tomorrowStr ? 'tomorrow' : date;
          result = {
            available: topSlots.length > 0,
            total_available_slots: slots.length,
            today: todayStr,
            tomorrow: tomorrowStr,
            checking_date: date,
            suggested_slots: topSlots.map(s => `${s.startTime} with ${s.staffName}`),
            slots: topSlots,
            date,
            appointment_type: type ? type.name : 'Consultation',
            message: topSlots.length > 0
              ? `${slots.length} slots available ${dateLabel} (${date}). Here are some options: ${topSlots.slice(0, 3).map(s => `${s.startTime} with ${s.staffName}`).join(', ')}`
              : `No availability ${dateLabel} (${date}). Today is ${todayStr}, tomorrow is ${tomorrowStr}. Try another date.`
          };
          broadcastAction(store, `Checked availability for ${date}`, `GET /api/v1/availability?date=${date}`);
          break;
        }

        case 'book_appointment': {
          const p = tool_parameters;

          // Auto-fill defaults for demo robustness
          const now = new Date();
          const defaultDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
          const clientId = p.client_id || p.clientId || 0;
          const patientId = p.patient_id || p.patientId || 0;
          let staffId = p.staff_id || p.staffId;
          const startTime = p.start_time || p.startTime || p.time || '10:00';

          // Parse flexible date formats
          let date = defaultDate;
          if (p.date) {
            const raw = p.date.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
              date = raw;
            } else if (raw.toLowerCase() === 'tomorrow') {
              const tom = new Date(now);
              tom.setDate(tom.getDate() + 1);
              date = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`;
            } else {
              const parsed = new Date(raw);
              if (!isNaN(parsed.getTime())) {
                date = `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`;
              }
            }
          }

          // If no staff specified, pick first available vet
          if (!staffId) {
            const vets = store.getAll('staff').filter(s => s.role.includes('Veterinary Surgeon'));
            staffId = vets.length > 0 ? vets[0].id : 1;
          }

          const type = store.getById('appointment_types', p.appointment_type_id || p.typeId || 1);
          const duration = type ? type.duration : 20;
          const [sh, sm] = startTime.split(':').map(Number);
          const endMin = sh * 60 + sm + duration;
          const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

          const appt = store.create('appointments', {
            clientId,
            patientId,
            staffId,
            typeId: p.appointment_type_id || p.typeId || 1,
            date,
            startTime,
            endTime,
            status: 'confirmed',
            notes: p.notes || p.reason || '',
            createdBy: 'ai-receptionist'
          });

          const bookedStaff = store.getById('staff', appt.staffId);
          result = { success: true, appointment_id: appt.id, date: appt.date, time: appt.startTime, end_time: appt.endTime, vet: bookedStaff ? bookedStaff.name : 'TBC', message: `Appointment booked for ${appt.startTime} on ${appt.date}${bookedStaff ? ' with ' + bookedStaff.name : ''}` };
          broadcastAction(store, `Booked appointment #${appt.id}`, 'POST /api/v1/appointments');

          // Mark the live call record as a successful booking so Call Log / Audit
          // Log show the right outcome and resolution line.
          const apptType = store.getById('appointment_types', appt.typeId);
          const apptTypeLabel = apptType ? apptType.name : 'appointment';
          const patientForCall = store.getById('patients', appt.patientId);
          const patientName = patientForCall ? patientForCall.name : 'patient';
          attachBookingOutcome(retellCallId, {
            clientId: appt.clientId,
            patientId: appt.patientId,
            outcome: 'appointment_booked',
            successful: true,
            resolution: `Booked ${apptTypeLabel} for ${patientName}${bookedStaff ? ' with ' + bookedStaff.name : ''}, ${appt.date} ${appt.startTime}`,
            notes: appt.notes || `${apptTypeLabel} booked via AI receptionist`
          });
          break;
        }

        case 'send_confirmation': {
          const p = tool_parameters;
          const client = store.getById('clients', p.client_id || p.clientId);
          const comm = store.create('comms', {
            type: 'appointment_reminder',
            clientId: p.client_id || p.clientId,
            patientId: p.patient_id || p.patientId || 0,
            channel: p.channel || 'sms',
            message: p.message || `Appointment confirmed. We'll see you soon at Oakwood Veterinary Practice.`,
            status: 'sent',
            sentAt: new Date().toISOString()
          });

          result = { success: true, message: `Confirmation ${p.channel || 'sms'} sent to ${client ? client.firstName : 'client'}` };
          broadcastAction(store, `Sent confirmation ${p.channel || 'SMS'}`, 'POST /api/v1/comms');
          break;
        }

        default:
          result = { error: `Unknown tool: ${tool_name}` };
      }
    } catch (err) {
      console.error(`Tool ${tool_name} error:`, err);
      result = { error: err.message };
    }

    results.push({ tool_call_id, result });
  }

  // Custom Function mode: Retell expects the raw result JSON as the response
  // body — whatever we return becomes what the LLM "sees" from the function.
  // Custom LLM mode: Retell expects { tool_results: [{ tool_call_id, result: "<string>" }] }
  if (isCustomFunctionMode || (results.length === 1 && req.body.tool_calls === undefined)) {
    const single = results[0] ? results[0].result : { error: 'no tool result' };
    console.log('[retell webhook] responding (custom-function):', JSON.stringify(single));
    return res.json(single);
  }

  const llmPayload = { tool_results: results.map(r => ({ tool_call_id: r.tool_call_id, result: JSON.stringify(r.result) })) };
  console.log('[retell webhook] responding (custom-llm):', JSON.stringify(llmPayload));
  res.json(llmPayload);
});

// Fetch complete call details (transcript) from Retell after call ends
router.get('/call/:callId', async (req, res) => {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) return res.status(400).json({ error: 'RETELL_API_KEY not set' });

  try {
    const Retell = require('retell-sdk');
    const client = new Retell({ apiKey });
    const call = await client.call.retrieve(req.params.callId);

    // Log available fields for debugging
    const fields = Object.keys(call).filter(k => call[k] != null);
    console.log('Retell call fields:', fields.join(', '));

    // Try all possible transcript field names across SDK versions
    const transcriptObj = call.transcript_object || call.transcriptObject || call.transcript_with_tool_calls || [];
    const transcriptText = call.transcript || '';

    res.json({
      callId: call.call_id || call.callId,
      transcript: transcriptText,
      transcriptObject: transcriptObj,
      callAnalysis: call.call_analysis || call.callAnalysis || null,
      // Pass the raw call object so frontend can extract what it needs
      raw: call
    });
  } catch (err) {
    console.error('Retell call fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Check if Retell is configured
router.get('/status', (req, res) => {
  res.json({
    configured: !!(process.env.RETELL_API_KEY && process.env.RETELL_AGENT_ID),
    agentId: process.env.RETELL_AGENT_ID || null
  });
});

const { broadcast } = require('./events');
function broadcastAction(store, text, apiCall) {
  // Direct in-process broadcast — no HTTP round-trip, no failure mode.
  try {
    broadcast('retell:action', { text, apiCall });
  } catch (err) {
    console.error('[broadcastAction] broadcast failed:', err.message);
  }
}

// --- Call record helpers --------------------------------------------------
// The Retell webhook receives several events for the same call (call_started,
// each tool invocation, call_ended, call_analyzed). We persist the call as a
// single `calls` record keyed by Retell's call_id, and grow it as we go.

function upsertCallByRetellId(retellCallId, patch) {
  if (!retellCallId) return null;
  const existing = store.getAll('calls', { callId: retellCallId })[0];
  if (existing) {
    return store.update('calls', existing.id, patch);
  }
  return store.create('calls', { callId: retellCallId, ...patch });
}

function attachIdentifiedClient(retellCallId, clientId, patientId) {
  if (!retellCallId) return;
  const existing = store.getAll('calls', { callId: retellCallId })[0];
  // Only set client/patient if not already set, so the first match wins.
  const patch = {};
  if (clientId && (!existing || !existing.clientId)) patch.clientId = clientId;
  if (patientId && (!existing || !existing.patientId)) patch.patientId = patientId;
  if (Object.keys(patch).length === 0) return;
  upsertCallByRetellId(retellCallId, patch);
}

function attachBookingOutcome(retellCallId, fields) {
  if (!retellCallId) return;
  upsertCallByRetellId(retellCallId, fields);
}

module.exports = router;
