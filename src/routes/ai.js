const router = require('express').Router();
const store = require('../data/store');
const { getScenarios, runScenarioStep } = require('../ai/scripted-scenarios');
const { handleLiveMessage } = require('../ai/live-mode');

// List available scenarios
router.get('/scenarios', (req, res) => {
  res.json(getScenarios());
});

// Start a scripted scenario
let activeScenario = null;
let scenarioTimer = null;

router.post('/scenario/start', (req, res) => {
  const { scenarioId } = req.body;
  const scenarios = getScenarios();
  const scenario = scenarios.find(s => s.id === scenarioId);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  // Clear any running scenario
  if (scenarioTimer) clearTimeout(scenarioTimer);

  activeScenario = {
    id: scenarioId,
    stepIndex: 0,
    steps: require('../ai/scripted-scenarios').getSteps(scenarioId),
    running: true
  };

  // Start stepping through
  scheduleNextStep(req);

  res.json({ ok: true, scenario: scenario.title, totalSteps: activeScenario.steps.length });
});

router.post('/scenario/stop', (req, res) => {
  if (scenarioTimer) clearTimeout(scenarioTimer);
  activeScenario = null;
  res.json({ ok: true });
});

function scheduleNextStep(req) {
  if (!activeScenario || activeScenario.stepIndex >= activeScenario.steps.length) {
    activeScenario = null;
    return;
  }

  const step = activeScenario.steps[activeScenario.stepIndex];
  const delay = activeScenario.stepIndex === 0 ? 500 : step.delay;

  scenarioTimer = setTimeout(async () => {
    if (!activeScenario) return;

    const result = await runScenarioStep(step, store);
    activeScenario.stepIndex++;

    // Broadcast the step via SSE
    const http = require('http');
    const postData = JSON.stringify({ type: 'ai:step', data: { ...result, stepIndex: activeScenario ? activeScenario.stepIndex : 0 } });
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/api/v1/events/broadcast',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };
    const r = http.request(options);
    r.write(postData);
    r.end();

    scheduleNextStep(req);
  }, delay);
}

// Live AI mode
router.post('/chat', async (req, res) => {
  const { message, history } = req.body;
  try {
    const response = await handleLiveMessage(message, history, store);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if live mode is available
router.get('/mode', (req, res) => {
  res.json({
    liveAvailable: !!process.env.ANTHROPIC_API_KEY,
    scriptedAvailable: true
  });
});

module.exports = router;
