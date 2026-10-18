const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('No script tag found!');
  process.exit(1);
}

// Mock browser objects for Node testing
global.window = { location: { protocol: 'http:', origin: 'http://127.0.0.1:8000' } };
global.document = {
  documentElement: {
    setAttribute: () => {},
    getAttribute: () => 'dark'
  },
  getElementById: (id) => ({
    textContent: '',
    className: '',
    style: {},
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => {}
  }),
  getElementsByName: () => [],
  querySelectorAll: () => [],
  createElement: () => ({
    className: '',
    classList: { add: () => {}, remove: () => {} },
    innerHTML: '',
    appendChild: () => {}
  }),
  addEventListener: () => {}
};
global.localStorage = { getItem: () => null, setItem: () => {} };

// Run in this context so var/const in root script attach to sandbox
vm.runInThisContext(scriptMatch[1]);

console.log('=== VALIDATING 5 HOSPITAL LIFELINES ===');
console.log('Total Assets:', INITIAL_HOSPITAL_LIFELINES.length);

INITIAL_HOSPITAL_LIFELINES.forEach(a => {
  const score = calculatePriorityScore(a);
  const prio = getPriorityLabel(score);
  const rec = getSystemRecommendation(score, a);
  console.log(
    `Asset [${a.id}] ${a.name}:\n` +
    `  - Criticality: ${a.crit}/5, People: ${a.ppl}, Severity: ${a.sev}, Urgency: ${a.urg}\n` +
    `  - Calculated Priority Score: ${score} -> Label: [${prio.label}]\n` +
    `  - Safe Fallback: "${a.fb}" (${a.kept}% care kept)\n` +
    `  - System Recommendation: ${rec.option.toUpperCase()} (${rec.reason})\n`
  );
});

const initialContinuity = calculateCareContinuity();
console.log('Initial Care Continuity Score:', initialContinuity + '% (Expected 100%)');

const shaTest = computeSHA256('test');
const expectedTestHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
console.log('Pure JS SHA-256 Self-Test:', shaTest === expectedTestHash ? 'PASSED [OK]' : 'FAILED [ERR]');

// Verify prompt requirements:
// SIG and PWR Critical, PMP and TOK High, DSP Low.
const sig = INITIAL_HOSPITAL_LIFELINES.find(a => a.id === 'SIG');
const pwr = INITIAL_HOSPITAL_LIFELINES.find(a => a.id === 'PWR');
const pmp = INITIAL_HOSPITAL_LIFELINES.find(a => a.id === 'PMP');
const tok = INITIAL_HOSPITAL_LIFELINES.find(a => a.id === 'TOK');
const dsp = INITIAL_HOSPITAL_LIFELINES.find(a => a.id === 'DSP');

const sigPrio = getPriorityLabel(calculatePriorityScore(sig)).label;
const pwrPrio = getPriorityLabel(calculatePriorityScore(pwr)).label;
const pmpPrio = getPriorityLabel(calculatePriorityScore(pmp)).label;
const tokPrio = getPriorityLabel(calculatePriorityScore(tok)).label;
const dspPrio = getPriorityLabel(calculatePriorityScore(dsp)).label;

console.log('\nChecking strict categorization from prompt:');
console.log('SIG Critical?:', sigPrio === 'Critical' ? 'YES [OK]' : 'NO (' + sigPrio + ')');
console.log('PWR Critical?:', pwrPrio === 'Critical' ? 'YES [OK]' : 'NO (' + pwrPrio + ')');
console.log('PMP High?:', pmpPrio === 'High' ? 'YES [OK]' : 'NO (' + pmpPrio + ')');
console.log('TOK High?:', tokPrio === 'High' ? 'YES [OK]' : 'NO (' + tokPrio + ')');
console.log('DSP Low?:', dspPrio === 'Low' ? 'YES [OK]' : 'NO (' + dspPrio + ')');

if (sigPrio === 'Critical' && pwrPrio === 'Critical' && pmpPrio === 'High' && tokPrio === 'High' && dspPrio === 'Low') {
  console.log('\nALL STRICT PROMPT CRITERIA FULLY MET! [OK]');
} else {
  console.error('\nMISMATCH in prompt criteria!');
  process.exit(1);
}
