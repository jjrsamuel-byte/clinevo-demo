function getScenarios() {
  return [
    { id: 'emergency', title: 'Emergency — Dog eaten chocolate', description: 'A panicked owner calls about their cockapoo eating dark chocolate. AI triages, finds the patient, and books an emergency slot.' },
    { id: 'routine', title: 'Routine — Annual vaccination booking', description: 'A client calls to book their cat\'s annual vaccination. AI searches for available slots and books the appointment.' },
    { id: 'faq', title: 'FAQ — Opening hours & pricing', description: 'A potential new client calls to ask about opening hours, services, and whether the practice sees rabbits.' }
  ];
}

function getSteps(scenarioId) {
  const scenarios = {
    emergency: [
      { delay: 500, role: 'system', text: '📞 Incoming call...' },
      { delay: 2000, role: 'ai', text: 'Good morning, Oakwood Veterinary Practice, how can I help you today?' },
      { delay: 3500, role: 'caller', text: "Hi, I'm really worried — my dog's just eaten a whole bar of dark chocolate about 20 minutes ago. He's a small cockapoo, about 8kg. What should I do?" },
      { delay: 2500, role: 'ai', text: "I completely understand your worry, and you've done the right thing calling us straight away. Chocolate can be very dangerous for dogs, especially dark chocolate. Can you tell me roughly how much he ate and how he's behaving right now?" },
      { delay: 3000, role: 'caller', text: "It was a 100g bar of 70% dark chocolate. He seems okay at the moment but he's panting a bit and quite restless." },
      { delay: 2000, role: 'ai', text: "Right, at that dose for an 8kg dog, this is definitely something we need to see urgently. The sooner we can treat him, the better the outcome. I'm going to get him booked in as an emergency right now. Can I take your name please?" },
      { delay: 2000, role: 'caller', text: "It's James Whitfield. Rufus is the dog's name." },
      { delay: 1000, role: 'action', text: 'Searching PMS for client: James Whitfield...', apiCall: 'GET /api/v1/clients?search=whitfield', execute: async (store) => {
        return store.getAll('clients', { search: 'whitfield' });
      }},
      { delay: 1500, role: 'ai', text: "I've got you here, Mr Whitfield — and I can see Rufus, your apricot cockapoo. Let me find the next available emergency slot for you." },
      { delay: 1000, role: 'action', text: 'Finding emergency appointment slot...', apiCall: 'GET /api/v1/availability?typeId=5', execute: async (store) => {
        // Find today's date
        const today = new Date().toISOString().split('T')[0];
        const allStaff = store.getAll('staff');
        const emergencyVet = allStaff.find(s => s.specialisms && s.specialisms.includes('Emergency Medicine'));
        return { today, vetId: emergencyVet ? emergencyVet.id : 2 };
      }},
      { delay: 1500, role: 'action', text: 'Booking emergency appointment with Dr Chen...', apiCall: 'POST /api/v1/appointments', execute: async (store) => {
        const today = new Date().toISOString().split('T')[0];
        // Find a time that works — check what's on Dr Chen's schedule
        const existing = store.getAll('appointments', { date: today, staffId: '2' });
        let slotTime = '10:30';
        // Find a free 30-min slot
        const busyTimes = existing.map(a => a.startTime);
        const possibleSlots = ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00'];
        for (const s of possibleSlots) {
          if (!busyTimes.includes(s)) { slotTime = s; break; }
        }
        const [h, m] = slotTime.split(':').map(Number);
        const endTime = `${String(h + (m + 30 >= 60 ? 1 : 0)).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`;

        return store.create('appointments', {
          clientId: 2,
          patientId: 3,
          staffId: 2,
          typeId: 5,
          date: today,
          startTime: slotTime,
          endTime: endTime,
          status: 'confirmed',
          notes: 'EMERGENCY — Chocolate ingestion (100g 70% dark chocolate, 20 mins ago). 8kg cockapoo. Panting, restless. Treat urgently.',
          createdBy: 'ai-receptionist'
        });
      }},
      { delay: 2000, role: 'ai', text: "That's all booked. I've got Rufus in with Dr Chen as an emergency. Please bring him straight in — don't try to make him sick yourself, the vet will handle that safely. Do you know where we are?" },
      { delay: 2000, role: 'caller', text: "Yes, I've been before. I'll head straight there now. Thank you so much." },
      { delay: 1000, role: 'action', text: 'Sending emergency confirmation SMS to Mr Whitfield...', apiCall: 'POST /api/v1/comms', execute: async (store) => {
        return store.create('comms', {
          type: 'appointment_reminder',
          clientId: 2,
          patientId: 3,
          channel: 'sms',
          message: "URGENT: Rufus's emergency appointment is confirmed with Dr Chen. Please come straight to Oakwood Veterinary Practice. Don't induce vomiting — the vet will handle treatment. Call 020 7946 0123 if you need directions."
        });
      }},
      { delay: 1500, role: 'ai', text: "I've sent you a confirmation text as well. Drive safely, and we'll have the team ready for Rufus when you arrive. Is there anything else I can help with?" },
      { delay: 1500, role: 'caller', text: "No, that's everything. Thank you for being so quick." },
      { delay: 1500, role: 'ai', text: "You're very welcome. We'll take good care of him. See you shortly, Mr Whitfield. Bye for now.", done: true }
    ],

    routine: [
      { delay: 500, role: 'system', text: '📞 Incoming call...' },
      { delay: 2000, role: 'ai', text: 'Good morning, Oakwood Veterinary Practice, how can I help you today?' },
      { delay: 3000, role: 'caller', text: "Hi there, I'd like to book my cat in for her annual vaccination please. Her name's Biscuit." },
      { delay: 2000, role: 'ai', text: "Of course! Let me pull up Biscuit's records. Can I take your name?" },
      { delay: 1500, role: 'caller', text: "It's Sarah Thornton." },
      { delay: 1000, role: 'action', text: 'Searching PMS for client: Sarah Thornton...', apiCall: 'GET /api/v1/clients?search=thornton', execute: async (store) => {
        return store.getAll('clients', { search: 'thornton' });
      }},
      { delay: 1500, role: 'ai', text: "Lovely, I've got you here Mrs Thornton, and I can see Biscuit — your British Shorthair. I can see her vaccination is coming up. I've got a note that you prefer morning appointments — shall I look for a morning slot?" },
      { delay: 2000, role: 'caller', text: "Yes please, mornings are much better for us. Any day next week would work." },
      { delay: 1000, role: 'action', text: 'Checking availability for vaccination appointments next week...', apiCall: 'GET /api/v1/availability?typeId=2', execute: async (store) => {
        // Just log, actual booking below
        return {};
      }},
      { delay: 2000, role: 'ai', text: "I've got a few options for you. There's a slot with Dr Hargreaves on Tuesday at 9:15am, or Wednesday at 10:00am. Dr Hargreaves is our feline medicine specialist, so she's lovely with cats. Which would suit you better?" },
      { delay: 2000, role: 'caller', text: "Tuesday at 9:15 sounds perfect." },
      { delay: 1000, role: 'action', text: 'Booking vaccination appointment — Tuesday 9:15am with Dr Hargreaves...', apiCall: 'POST /api/v1/appointments', execute: async (store) => {
        // Find next Tuesday
        const today = new Date();
        const daysUntilTuesday = (2 - today.getDay() + 7) % 7 || 7;
        const tuesday = new Date(today);
        tuesday.setDate(today.getDate() + daysUntilTuesday);
        const dateStr = tuesday.toISOString().split('T')[0];

        return store.create('appointments', {
          clientId: 1,
          patientId: 1,
          staffId: 1,
          typeId: 2,
          date: dateStr,
          startTime: '09:15',
          endTime: '09:30',
          status: 'confirmed',
          notes: 'Annual vaccination booster. Note: nervous cat — prepare quiet room, feliway.',
          createdBy: 'ai-receptionist'
        });
      }},
      { delay: 1500, role: 'ai', text: "That's booked for you — Biscuit with Dr Hargreaves on Tuesday at 9:15am for her annual vaccination. I can see from Biscuit's notes that she can be a little nervous, so I've flagged that with the team and they'll have a quiet room ready with some Feliway." },
      { delay: 1000, role: 'action', text: 'Sending booking confirmation SMS...', apiCall: 'POST /api/v1/comms', execute: async (store) => {
        const today = new Date();
        const daysUntilTuesday = (2 - today.getDay() + 7) % 7 || 7;
        const tuesday = new Date(today);
        tuesday.setDate(today.getDate() + daysUntilTuesday);
        const dateStr = tuesday.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

        return store.create('comms', {
          type: 'appointment_reminder',
          clientId: 1,
          patientId: 1,
          channel: 'sms',
          message: `Hi Sarah, Biscuit's vaccination is booked for ${dateStr} at 9:15am with Dr Hargreaves at Oakwood Veterinary Practice. Please bring her vaccination card. Reply C to confirm or call 020 7946 0123 to reschedule.`
        });
      }},
      { delay: 2000, role: 'caller', text: "Oh that's lovely, thank you so much. She does get quite stressed so that's really helpful." },
      { delay: 1500, role: 'ai', text: "Not to worry at all, we see lots of nervous cats and we're very used to making them feel comfortable. I've also sent you a confirmation text. Is there anything else I can help with?" },
      { delay: 1500, role: 'caller', text: "No, that's everything. Thanks very much!" },
      { delay: 1500, role: 'ai', text: "You're welcome! We'll see you and Biscuit on Tuesday. Bye for now.", done: true }
    ],

    faq: [
      { delay: 500, role: 'system', text: '📞 Incoming call...' },
      { delay: 2000, role: 'ai', text: 'Good afternoon, Oakwood Veterinary Practice, how can I help you today?' },
      { delay: 3000, role: 'caller', text: "Hi, I've just moved to the area and I'm looking for a new vet for my rabbits. Do you see rabbits?" },
      { delay: 2000, role: 'ai', text: "Welcome to the area! Yes, we absolutely do see rabbits. We have Dr Priya Sharma on the team who specialises in exotics, including rabbits, so they'd be in very good hands. Can I help you with anything else about the practice?" },
      { delay: 2500, role: 'caller', text: "That's great to hear. What are your opening hours? And do you do Saturday appointments?" },
      { delay: 2000, role: 'ai', text: "We're open Monday to Friday, 8am until 6pm, and yes, we do have Saturday hours — 9am to 1pm. Dr Sharma is usually in on Tuesdays, Thursdays, and Fridays, so those would be the best days for rabbit appointments." },
      { delay: 2500, role: 'caller', text: "And how much is a routine consultation for a rabbit?" },
      { delay: 2000, role: 'ai', text: "I don't have the exact pricing to hand, but I can have one of the team call you back with the full fee schedule. Our exotics consultations do include a thorough health check. Would you like me to arrange that callback?" },
      { delay: 2000, role: 'caller', text: "Yes please, that would be helpful. My name is Lisa and my number is 07855 332211." },
      { delay: 1000, role: 'action', text: 'Creating callback note for new client enquiry...', apiCall: 'POST /api/v1/comms', execute: async (store) => {
        return store.create('comms', {
          type: 'post_visit_followup',
          clientId: 0,
          patientId: 0,
          channel: 'phone',
          message: 'CALLBACK REQUEST: New client Lisa (07855 332211) — recently moved to area, has rabbits, enquiring about exotics consultations and pricing. Please call back with fee schedule. Interested in Dr Sharma.'
        });
      }},
      { delay: 1500, role: 'ai', text: "I've made a note for the team to call you back, Lisa. They'll ring you on 07855 332211, usually within a few hours. Is there anything else you'd like to know?" },
      { delay: 2000, role: 'caller', text: "No, that's all for now. Thanks for your help!" },
      { delay: 1500, role: 'ai', text: "You're very welcome! We look forward to meeting you and your rabbits. Bye for now.", done: true }
    ]
  };

  return scenarios[scenarioId] || [];
}

async function runScenarioStep(step, store) {
  let result = { role: step.role, text: step.text, done: step.done || false };

  if (step.execute) {
    try {
      await step.execute(store);
    } catch (err) {
      console.error('Scenario step error:', err);
    }
  }

  if (step.apiCall) {
    result.apiCall = step.apiCall;
  }

  return result;
}

module.exports = { getScenarios, getSteps, runScenarioStep };
