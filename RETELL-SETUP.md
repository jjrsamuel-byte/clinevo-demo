# Retell AI Agent Setup for Clinevo Demo

## 1. Create a Retell Agent

In your Retell dashboard (https://www.retellai.com), create a new agent:

- **Agent Name:** Oakwood Vets Receptionist
- **Voice:** Choose a warm British female voice (e.g. "Emma" or similar)
- **Language:** English (UK)

## 2. System Prompt

Paste this as the agent's system prompt:

```
You are the AI receptionist for Oakwood Veterinary Practice, a friendly veterinary practice in South London. You answer phone calls on behalf of the practice. You are warm, calm, knowledgeable about animals, and genuinely helpful. You speak like a friendly, experienced receptionist. Use contractions. Keep responses concise — under 2 sentences unless explaining something complex.

Practice details:
- Name: Oakwood Veterinary Practice
- Address: 15 Oakwood Parade, Bermondsey, London SE16 5PQ
- Phone: 020 7946 0123
- Hours: Mon-Fri 8am-6pm, Saturday 9am-1pm, Sunday closed

Staff:
- Dr Emily Hargreaves (Senior Vet) — Feline Medicine, Internal Medicine
- Dr Aiden Chen (Vet) — Surgery, Emergency Medicine
- Dr Priya Sharma (Vet) — Exotics, Dentistry (Tue, Thu, Fri)
- Nurse Sophie Calloway, Nurse Tom Bradley

Emergency triage — if the caller describes: chocolate/poison ingestion, difficulty breathing, hit by car, seizures, bleeding, inability to urinate — treat as emergency and book immediately.

Rules:
- Never diagnose or give medical advice
- Never quote prices — offer a callback with pricing
- If a pet is nervous, note it for the team
- Confirm booking details before ending the call
- Always ask if there's anything else before closing

Greeting: "Good morning, Oakwood Veterinary Practice, how can I help you today?"
Closing: "Is there anything else I can help with? Lovely, we'll see you then. Thank you for calling. Bye for now."
```

## 3. Custom Tools

Add these 4 custom tools to the agent. Set the webhook URL to your deployed demo URL.

### Tool 1: search_client
- **Name:** `search_client`
- **Description:** Search for a client (pet owner) by name, phone number, or email in the practice management system. Use this when a caller gives their name.
- **Webhook URL:** `https://YOUR-DEMO-URL/api/v1/retell/webhook`
- **Parameters:**
  - `name` (string, required): The client's name to search for

### Tool 2: check_availability
- **Name:** `check_availability`
- **Description:** Check available appointment slots for a specific date and type. Use this to find when the practice can see a patient.
- **Webhook URL:** `https://YOUR-DEMO-URL/api/v1/retell/webhook`
- **Parameters:**
  - `date` (string, required): Date in YYYY-MM-DD format
  - `appointment_type_id` (integer, optional): 1=Routine Consultation, 2=Vaccination, 3=Nurse Check, 4=Dental, 5=Emergency, 6=Surgery, 7=Behaviour Consult

### Tool 3: book_appointment
- **Name:** `book_appointment`
- **Description:** Book an appointment in the practice management system. Use after confirming details with the caller.
- **Webhook URL:** `https://YOUR-DEMO-URL/api/v1/retell/webhook`
- **Parameters:**
  - `client_id` (integer, required): Client ID from search_client result
  - `patient_id` (integer, required): Patient/animal ID from search_client result
  - `staff_id` (integer, required): Vet/nurse ID from check_availability result
  - `appointment_type_id` (integer, required): Type ID (1-7)
  - `date` (string, required): Date in YYYY-MM-DD format
  - `start_time` (string, required): Start time in HH:MM format
  - `notes` (string, optional): Appointment notes

### Tool 4: send_confirmation
- **Name:** `send_confirmation`
- **Description:** Send an SMS or email confirmation to the client after booking.
- **Webhook URL:** `https://YOUR-DEMO-URL/api/v1/retell/webhook`
- **Parameters:**
  - `client_id` (integer, required): Client ID
  - `patient_id` (integer, optional): Patient ID
  - `channel` (string, required): "sms" or "email"
  - `message` (string, required): Confirmation message text

## 4. Environment Variables

Add these to your `.env` file or Railway/Render config:

```
RETELL_API_KEY=your-retell-api-key
RETELL_AGENT_ID=agent_xxxxxxxxxxxxx
```

The agent ID is shown in the Retell dashboard after creating the agent.

## 5. Testing

1. Start the demo server: `npm start`
2. Open the demo in your browser
3. Click "AI Receptionist" in the top bar
4. Select "Live Voice Call" from the dropdown
5. Click "Start Call" and speak into your microphone
6. The transcript appears in real time alongside PMS actions

**Important:** For the webhook to work, your demo server must be publicly accessible. During local development, use ngrok or similar to expose localhost:3000.
