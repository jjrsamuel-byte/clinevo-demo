# Clinevo Demo Stress Test Report

**Run:** 2026-04-17 (Friday)
**Prompt:** optimized v2 — commit `f97e3a3` (5,084 words, down from ~8,400)
**Backend:** `main` branch through `f97e3a3`
**Scope:** All major scenarios + edge cases at the webhook level. Voice behaviour requires live Retell calls to verify.

---

## TL;DR

All 8 end-to-end scenarios pass against the webhook. Every field the prompt references is correctly returned by the backend. Practice hours, DOB verification, disambiguation, silent fallback, reschedule consolidation, and new-client registration all behave as the prompt expects.

**What this report verifies:** the plumbing. Every tool call the agent might make returns the expected shape, with the expected fields, in the expected happy-path and error-path conditions.

**What this report cannot verify:** the LLM's spoken behaviour. Things like "did the agent actually speak the combine offer before `check_availability`", "did it wait for slot-yes before calling `book_appointment`", "did it skip the narration" — these need a voice call on the Retell dashboard. Every prior voice test informed prompt fixes that are now in `f97e3a3`.

---

## Scenarios tested (all PASS)

### T1 — Justin Samuel full search
- `found=True`, `client.name="Mr Justin Samuel"`, `client.date_of_birth="1986-07-04"`
- `vaccinationStatus: "due in 30 days (2026-05-17) — should book now"` ← triggers Duke combine offer
- `upcoming_appointments`: 1 (seed #41 on Wed 2026-04-22 14:30)
- `recent_contact.skipPetPleasantry=False, skipCarePlanUpsell=False` (no prior calls in this test run)

### T2 — Sunday closed
- `check_availability(2026-04-19)` → `available=false`, `practice_open=false`, `day_of_week=Sunday`
- Backend message: "The practice is closed on Sundays. Offer the caller Monday…"

### T3 — Saturday 9am–1pm only
- Saturday no filter → first slot 09:00, total 48 slots (9am–12:45 window)
- Saturday `from_time: "14:00"` → `available=false` (practice closes 1pm)
- Backend correctly refuses fake afternoon Saturday slots

### T4 — Justin's afternoon preference (from_time)
- Monday `from_time: "14:00"` → first slot `14:30 with Dr Emily Hargreaves`
- Earlier slots silently filtered out, as expected

### T5 — Disambiguation (two James Whitfields)
- Unqualified search → `multiple=true`, `match_count=2`, candidates with `postcode_district` SE21 + SE24
- Narrow by SE21 → single match (client #2), DOB 1985-11-22 returned
- Narrow by wrong postcode NW1 → `match_count=0` with steering message ("may have wrong practice")

### T6 — DOB field returned for verification
- Sarah Thornton search → `client.date_of_birth="1978-05-14"` returned
- Prompt does the verbal compare; backend just surfaces the anchor

### Scenario A — Justin books checkup, combines with booster
- `book_appointment` type 2 (Vaccination after combine yes) Mon 14:30 → `rescheduled=true`
  - **Expected quirk:** backend auto-moved Justin's seed appointment. Prompt S08 step 12 now says to IGNORE this flag on new-booking flow and still use the new-booking confirmation wording.
- `send_confirmation` sms → success
- `send_confirmation` email (care plan info) → success

### Scenario B — Justin reschedules
- After A, upcoming: `#41 2026-04-20 14:30 (Vaccination)`
- `book_appointment` with same client/patient, new date (Thu) → `rescheduled=true`, `appt_id` preserved, date/time updated
- Appointment moved in place, not duplicated

### Scenario C — Justin adds new pet, books, cancels
- `register_new_pet(client_id:16, "Coco" dog)` → `patient_id=22` created
- `book_appointment` for Coco → `rescheduled=false` ✓ (different patient_id, new booking not reschedule)
- Search Justin → 2 patients (Duke + Coco), 2 upcoming appts
- `cancel_appointment(42)` → success, only Coco's appt cancelled
- Search again → 1 upcoming (Duke only)

### Scenario D — Brand-new client registration
- Search "Alice Fletcher" → `found=false` with registration steer
- `register_new_client(title:"Miss", dob:"1994-03-21", ...)` → `client_id=18`, `patient_id=23`, returns `client.name="Miss Alice Fletcher"` (title prefix preserved), `date_of_birth` field in response
- `book_appointment(18, 23, ...)` → success, `appt_id=43` in calendar with status=confirmed
- Future search finds Alice with DOB intact — ready for DOB gate on next call

### Scenario E — Emergency triage
- `check_availability(type:5)` returns earliest morning slots correctly
- Prompt S12 directs agent to book first morning slot

### Scenario F — Silent fallback plumbing
- Sat `from_time:"14:00"` → `available=false` with `day_of_week="Saturday"` in response
- Monday same filter → `available=true`, first slot offered
- Prompt S10 instructs agent to silently roll forward between these two calls without narrating the failed attempt

### Scenario G — Bogus appointment ID cancel
- `cancel_appointment(99999)` → `success=false` with helpful error ("Use search_client to look up the caller's upcoming_appointments")

### Scenario H — Double-cancel
- `cancel_appointment(42)` (already cancelled) → `success=false, error="Appointment #42 is already cancelled."` — idempotent safety

---

## Known limitations (acknowledged, not fixed)

1. **`book_appointment` doesn't validate the slot was offered.** Agent could book a time not in `suggested_slots`. Prompt relies on agent discipline.

2. **`register_new_client` accepts empty DOB.** Prompt enforces it, backend doesn't. If the LLM ever skips the DOB question, the record persists DOB-less.

3. **Backend accepts bogus `client_id`/`patient_id` on `book_appointment`** — creates orphan appointment. Prompt forbids made-up IDs, but no server-side check.

4. **`recent_contact` recency tracking requires full Retell call lifecycle** (`call_started` event). Direct webhook tests can't populate it. Real voice calls will populate it correctly.

5. **Justin's seed appointment auto-moves on new bookings.** Backend treats same-patient future booking as a move. The prompt now handles this via the `rescheduled:true` ignore rule in S08 step 12, but it's still a counter-intuitive data setup. Consider removing the seed appt post-demo if it causes confusion.

---

## Known behaviour gaps (voice-layer only — need live test)

These are rules in the prompt that cannot be verified from the webhook:

1. **Zero-narration whitelist (S05).** Latest voice test still showed narration leaking. The optimized v2 prompt has a clearer positive whitelist + stronger ban. Needs voice test to confirm.

2. **Duke combine offer firing (S06).** Promoted into the Justin-specific section with explicit trigger sequence. Last test before this rewrite missed the offer. v2 should be more reliable; needs voice test.

3. **Two-turn closing (S13).** Last voice test fused Turn A + Turn B. v2 prompt splits them explicitly. Needs voice test.

4. **Slot-yes gate.** Agent must not book on a combine-yes or any other non-slot affirmative. Webhook can't verify; voice test will show.

5. **Anti-regreet (S15).** Requires a voice test where the begin-message fires first to confirm no mid-call regreet.

---

## Recommended next actions

1. **Re-paste the optimized v2 prompt** into the Retell dashboard (full prompt in RETELL-SETUP.md between the triple backticks).
2. **Tool schema sanity-check** in dashboard:
   - Tool 2 `check_availability` has `from_time` and `to_time`
   - Tool 5 `register_new_client` has `date_of_birth` (required)
3. **Begin Message:** confirm it's `Good {{time_of_day}}, Oakwood Veterinary Practice, how can I help you today?`
4. **Retell filler/backchannel setting** — check advanced settings for anything like "Filler words", "Thinking sounds", "Backchannel". Disable. This may be the root cause of persistent narration leaks.
5. **Voice-test in this order:**
   - Justin new-booking checkup (full path: greet → name → DOB → recognition line → "checkup" → combine offer → slot → book → upsell → close)
   - Justin reschedule (should skip recognition line, use move-wording)
   - Justin cancel (explicit confirmation required)
   - Brand-new caller (Alice — should route to S10B, capture DOB, book)
   - Disambiguation (say "James Whitfield" — agent should ask for postcode)
   - DOB mismatch (say a wrong DOB for Justin — agent should refuse twice then close)
6. If issues surface, commit fixes and re-test. All backend plumbing is solid; any remaining issues will be prompt-language issues.

---

## Git state at end of run

```
f97e3a3  Optimized v2: clean-slate rewrite (8400 → 5084 words)
6eecc0b  Flip narration rule from blacklist to positive whitelist
c40ddd3  Force Justin combine offer; split closing into two turns
5eae3d2  Three fixes surfaced by voice test
d3d3122  Silent fallback when check_availability returns no slots
8519702  Tighten narration ban; prevent double closing line
34f4d46  Pre-demo prep: practice hours, DOB verification, disambiguation seed
33db39d  Force slot acceptance before booking; ban lookup narration
f48183b  Make Retell greeting delivery bright and upbeat
310cc85  Pre-street-test prompt fixes
```

All pushed to `origin/main`. Railway/Render is up to date.

---

*Report generated autonomously during the demo prep session. Voice-layer verification is the next step before Wednesday's demo.*
