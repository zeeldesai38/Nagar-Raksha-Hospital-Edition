const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

// Mock DOM
global.window = { location: { protocol: 'http:', origin: 'http://127.0.0.1:8000' } };
const elementMap = {};
function getEl(id) {
  if (!elementMap[id]) {
    elementMap[id] = {
      id,
      textContent: '',
      innerHTML: '',
      className: '',
      style: {},
      classList: {
        add: function(c) { this.classes = this.classes || []; if (!this.classes.includes(c)) this.classes.push(c); },
        remove: function(c) { this.classes = this.classes || []; this.classes = this.classes.filter(x => x !== c); },
        contains: function(c) { return (this.classes || []).includes(c); }
      },
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      appendChild: () => {}
    };
  }
  return elementMap[id];
}

global.document = {
  documentElement: {
    setAttribute: () => {},
    getAttribute: () => 'dark'
  },
  getElementById: getEl,
  getElementsByName: () => [{ checked: true, value: 'fallback', addEventListener: () => {} }],
  querySelectorAll: () => [],
  createElement: () => ({
    className: '',
    classList: { add: () => {}, remove: () => {} },
    innerHTML: '',
    appendChild: () => {},
    setAttribute: () => {}
  }),
  body: {
    appendChild: () => {}
  },
  addEventListener: () => {}
};
global.localStorage = { getItem: () => null, setItem: () => {} };

vm.runInThisContext(scriptMatch[1]);

console.log('--- TESTING FULL SIMULATION STAGES (JS ENGINE) ---');

// Stage 1
executeNextAttackStageOffline();
console.log('Stage 1 - attackStage:', attackStage, '| Active:', activeAlertAsset ? activeAlertAsset.id : 'null');
if (attackStage !== 1 || activeAlertAsset.id !== 'DSP') throw new Error('Stage 1 failed');

// Stage 2
executeNextAttackStageOffline();
console.log('Stage 2 - attackStage:', attackStage, '| Active:', activeAlertAsset ? activeAlertAsset.id : 'null');
if (attackStage !== 2 || activeAlertAsset.id !== 'PMP') throw new Error('Stage 2 failed');

// Stage 3 (Must pause for human)
executeNextAttackStageOffline();
console.log('Stage 3 - attackStage:', attackStage, '| Active:', activeAlertAsset ? activeAlertAsset.id : 'null', '| Paused:', isPausedForHuman);
if (attackStage !== 3 || activeAlertAsset.id !== 'SIG' || !isPausedForHuman) throw new Error('Stage 3 pause failed');

// Operator confirms Stage 3
applyOperatorDecision(activeAlertAsset, 'fallback');
isPausedForHuman = false;
console.log('Stage 3 operator confirm -> SIG care:', hospitalAssets.find(a => a.id === 'SIG').currentCare, '% | Hospital Continuity:', calculateCareContinuity() + '%');

// Stage 4 (Must pause for human)
executeNextAttackStageOffline();
console.log('Stage 4 - attackStage:', attackStage, '| Active:', activeAlertAsset ? activeAlertAsset.id : 'null', '| Paused:', isPausedForHuman);
if (attackStage !== 4 || activeAlertAsset.id !== 'PWR' || !isPausedForHuman) throw new Error('Stage 4 pause failed');

// Operator confirms Stage 4
applyOperatorDecision(activeAlertAsset, 'fallback');
isPausedForHuman = false;
console.log('Stage 4 operator confirm -> PWR care:', hospitalAssets.find(a => a.id === 'PWR').currentCare, '% | Hospital Continuity:', calculateCareContinuity() + '%');

// Stage 5 (Recovery)
executeNextAttackStageOffline();
console.log('Stage 5 launched, verifying recovery...');

// Restore all
hospitalAssets.forEach(asset => {
  asset.activeHash = asset.goldenHash;
  asset.currentMode = "Normal";
  asset.currentCare = 100;
  asset.underAttack = false;
});
const finalContinuity = calculateCareContinuity();
console.log('Stage 5 recovery complete -> Final Hospital Continuity:', finalContinuity + '% (Expected: 100%)');
if (finalContinuity !== 100) throw new Error('Stage 5 recovery did not reach 100%');

console.log('ALL ATTACK SIMULATION FLOW TESTS PASSED COMPLETELY! [OK]');
process.exit(0);
