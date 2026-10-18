/**
 * Nagar-Raksha (Graceful Degradation Planner)
 * Cyber Samvad Hackathon 2026 - Problem Statement 4: Smart City and Critical Infrastructure Cybersecurity
 * 
 * Main Application Logic (app.js)
 * Strict requirement: Plain JavaScript, runs directly in browser (file:// and web server compatible).
 * SIMULATION ONLY: No real devices or external networks connected.
 */

// ==========================================
// 1. APPLICATION STATE & DATA STORES
// ==========================================

let cityAssets = [];
let activeAlert = null;
let incidentLogs = [];
let incidentCounter = 1;
let continuityChart = null;

// Track repeated attack counts per asset { 'TS-01': 2 }
let assetAttackCounts = {};

// Response Checklist state for active incident
let incidentChecklistState = {
  step1: false, // Confirm alert details
  step2: false, // Apply safe fallback
  step3: false, // Notify responsible team
  step4: false, // Verify citizen service level
  step5: false, // Record incident
  notifiedTeamMessage: ""
};

// Recovery state machine for contained incidents
let recoveryState = {
  active: false,
  incidentId: null,
  assetId: null,
  steps: {
    a: false, // Keep asset in fallback until safe
    b: false, // Save logs as evidence
    c: false, // Verify device against trusted copy
    d: false, // Restore clean settings from backup
    e: false, // Change credentials and keys
    f: false, // Reconnect gradually
    g: false, // Watch period: 10-second countdown
    h: false  // Close incident
  },
  hashVerificationResult: null, // 'MATCH' or 'MISMATCH'
  reconnecting: false,
  reconnectStep: 0,
  watchTimer: null,
  watchSecondsLeft: 10
};

// Prevention readiness checklist (6 items)
let preventionItems = {
  patch: true,
  passwords: true,
  network: true,
  monitoring: true,
  backups: true,
  entrypoint: false
};

// ==========================================
// 2. INITIALIZATION & RESET
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  initSystem();
});

function initSystem() {
  // Deep clone initial assets so we can cleanly reset at any time
  cityAssets = JSON.parse(JSON.stringify(INITIAL_ASSETS));

  // Initialize attack frequencies
  assetAttackCounts = {};
  cityAssets.forEach(a => {
    assetAttackCounts[a.id] = 0;
  });

  // Reset states
  activeAlert = null;
  incidentLogs = [];
  incidentCounter = 1;
  resetIncidentChecklist();
  resetRecoveryState();

  // Initialize or re-render Chart.js Doughnut
  initChart();

  // Render Map, Services, Logs, Prevention
  renderMap();
  renderServiceBars();
  updateContinuityScore();
  renderAlertPanel();
  renderRecoveryPanel();
  renderLogTable();
  renderPreventionPanel();

  showToast("Nagar-Raksha initialized: All critical systems operating nominally.", "success");
}

function resetIncidentChecklist() {
  incidentChecklistState = {
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
    notifiedTeamMessage: ""
  };
  renderIncidentChecklist();
}

function resetRecoveryState() {
  if (recoveryState.watchTimer) {
    clearInterval(recoveryState.watchTimer);
  }
  recoveryState = {
    active: false,
    incidentId: null,
    assetId: null,
    steps: {
      a: false,
      b: false,
      c: false,
      d: false,
      e: false,
      f: false,
      g: false,
      h: false
    },
    hashVerificationResult: null,
    reconnecting: false,
    reconnectStep: 0,
    watchTimer: null,
    watchSecondsLeft: 10
  };
}

// ==========================================
// 3. PRIORITY SCORING & LOGIC FORMULAS
// ==========================================

/**
 * Priority formula strictly from specifications:
 * priorityScore = severity * criticality * urgency * (1 + people/50000)
 * Label thresholds:
 * >= 100: Critical
 * >= 30: High
 * >= 10: Medium
 * else: Low
 */
function calculatePriority(severity, criticality, urgency, people) {
  const peopleFactor = 1 + (people / 50000);
  const rawScore = severity * criticality * urgency * peopleFactor;
  const roundedScore = Math.round(rawScore * 10) / 10;

  let label = "Low";
  let badgeColor = "bg-emerald-950 text-emerald-400 border-emerald-700";
  let accentBorder = "border-emerald-500";

  if (roundedScore >= 100) {
    label = "Critical";
    badgeColor = "bg-rose-950 text-rose-300 border-rose-600 animate-pulse";
    accentBorder = "border-rose-500";
  } else if (roundedScore >= 30) {
    label = "High";
    badgeColor = "bg-amber-950 text-amber-300 border-amber-600";
    accentBorder = "border-amber-500";
  } else if (roundedScore >= 10) {
    label = "Medium";
    badgeColor = "bg-sky-950 text-sky-300 border-sky-600";
    accentBorder = "border-sky-500";
  }

  return {
    score: roundedScore,
    label: label,
    badgeColor: badgeColor,
    accentBorder: accentBorder,
    formulaBreakdown: `${severity} (sev) × ${criticality} (crit) × ${urgency} (urg) × (1 + ${people.toLocaleString()}/50,000) = ${roundedScore}`
  };
}

// ==========================================
// 4. ATTACK SIMULATION HANDLERS
// ==========================================

function simulateAttack(attackId) {
  const attackDef = SIMULATED_ATTACKS.find(a => a.id === attackId);
  if (!attackDef) return;

  const targetAsset = cityAssets.find(a => a.id === attackDef.assetId);
  if (!targetAsset) return;

  // Interruption Check during Watch Period (Recovery Step g)
  if (recoveryState.active && recoveryState.assetId === targetAsset.id && recoveryState.watchTimer) {
    handleWatchPeriodInterruption(targetAsset, attackDef);
    return;
  }

  // Repeat Attack Check: If asset is ALREADY in fallback or isolated
  if (targetAsset.mode !== "Normal") {
    handleRepeatAttackOnContainedAsset(targetAsset, attackDef);
    return;
  }

  // Standard First Attack
  assetAttackCounts[targetAsset.id] = (assetAttackCounts[targetAsset.id] || 0) + 1;
  const isRepeat = assetAttackCounts[targetAsset.id] >= 2;

  const priority = calculatePriority(
    attackDef.severity,
    targetAsset.criticality,
    attackDef.urgency,
    targetAsset.people
  );

  // Mark asset as under active attack
  targetAsset.underAttack = true;

  // Define 4 containment options strictly adhering to prompt
  const options = [
    {
      id: "opt-monitor",
      name: "Monitor only",
      stopsThreat: "No",
      serviceKept: 100,
      description: "Passive telemetry logging. Leaves attacker with active vector.",
      citizenImpact: "Zero immediate disruption to service (100% kept).",
      isSafe: false
    },
    {
      id: "opt-restrict",
      name: "Restrict remote access",
      stopsThreat: "Partly",
      serviceKept: 95,
      description: "Firewall external ingress IP. Does not prevent insider or bus pivot.",
      citizenImpact: "Minor latency in dynamic timing adjustments (95% kept).",
      isSafe: false
    },
    {
      id: "opt-fallback",
      name: "Switch to safe fallback",
      stopsThreat: "Yes",
      serviceKept: targetAsset.serviceKept,
      description: `Decouples network control plane. Initiates verified local '${targetAsset.fallback}'.`,
      citizenImpact: `Controlled degradation: retains essential ${targetAsset.serviceKept}% citizen throughput safely.`,
      isSafe: true
    },
    {
      id: "opt-isolate",
      name: "Full isolation",
      stopsThreat: "Yes",
      serviceKept: 0,
      description: "Complete power down / physical disconnection of device.",
      citizenImpact: "Severe: Citizens lose this service completely (0% kept).",
      isSafe: false,
      warning: "Not recommended: citizens lose this service completely"
    }
  ];

  // Recommendation rule:
  // "if Low, recommend Monitor only; otherwise the option that stops the threat with the highest service kept (the safe fallback)."
  let recommendedOptionId = "opt-fallback";
  if (priority.label === "Low") {
    recommendedOptionId = "opt-monitor";
  }

  activeAlert = {
    incidentId: `INC-${String(incidentCounter).padStart(3, '0')}`,
    attack: attackDef,
    asset: targetAsset,
    priority: priority,
    options: options,
    recommendedOptionId: recommendedOptionId,
    timestamp: getCurrentTimeString(),
    isRepeatTarget: isRepeat
  };

  // Reset checklist for new incident
  resetIncidentChecklist();

  // Re-render
  renderMap();
  renderAlertPanel();
  showToast(`[ALERT] ${priority.label} Incident detected on ${targetAsset.id} (${targetAsset.name})!`, "danger");
}

function handleRepeatAttackOnContainedAsset(asset, attackDef) {
  assetAttackCounts[asset.id] = (assetAttackCounts[asset.id] || 0) + 1;
  const count = assetAttackCounts[asset.id];

  // Visual status update: "Already contained: running offline"
  showToast(`Already contained: ${asset.id} is running offline in safe fallback mode. Repeat attempt neutralized without impact.`, "warning");

  // Add Incident Log entry: "Repeat attempt, no impact"
  const logEntry = {
    id: `INC-${String(incidentCounter++).padStart(3, '0')}`,
    time: getCurrentTimeString(),
    assetId: asset.id,
    assetName: asset.name,
    threat: `Repeat exploit: ${attackDef.threat}`,
    priority: "Low",
    actionTaken: "Repeat attempt, no impact (Already contained: running offline)",
    serviceLevelKept: `${asset.level}%`,
    status: "Contained",
    handledBy: "Operator 1",
    lessonsLearned: count >= 2 ? "Repeat target confirmed. Recommend keeping in safe fallback longer before any reconnect attempt." : "Autonomous offline fallback absorbed attack."
  };

  incidentLogs.unshift(logEntry);
  renderLogTable();
  renderMap();

  // If repeat target badge condition met
  if (count >= 2) {
    showToast(`⚠️ Asset ${asset.id} is a REPEAT TARGET (${count} attempts). Operator advisory: Keep in fallback longer.`, "warning");
  }
}

function triggerRepeatAttack() {
  // If an active alert or contained asset exists, repeat on it; else default to TS-01
  let targetId = "TS-01";
  if (activeAlert) {
    targetId = activeAlert.asset.id;
  } else if (recoveryState.active && recoveryState.assetId) {
    targetId = recoveryState.assetId;
  } else {
    // Pick first degraded asset or TS-01
    const degraded = cityAssets.find(a => a.mode !== "Normal");
    if (degraded) targetId = degraded.id;
  }

  // Find matching attack or default to A1
  const matchingAttack = SIMULATED_ATTACKS.find(a => a.assetId === targetId) || SIMULATED_ATTACKS[0];
  simulateAttack(matchingAttack.id);
}

// ==========================================
// 5. OPERATOR ACTIONS & CONTAINMENT
// ==========================================

function applyRecommendedOption() {
  if (!activeAlert) return;
  applyContainmentOption(activeAlert.recommendedOptionId);
}

function applyContainmentOption(optionId) {
  if (!activeAlert) return;

  const chosenOption = activeAlert.options.find(o => o.id === optionId);
  if (!chosenOption) return;

  const asset = cityAssets.find(a => a.id === activeAlert.asset.id);
  if (!asset) return;

  // Clear active attack pulse
  asset.underAttack = false;

  let finalStatus = "Contained";
  let actionDescription = "";

  if (chosenOption.id === "opt-monitor") {
    // Monitor only
    finalStatus = "Watching";
    actionDescription = "Monitor only (telemetry surveillance active)";
    asset.mode = "Normal (Monitoring)";
    asset.level = 100;
  } else if (chosenOption.id === "opt-restrict") {
    // Restrict remote access
    finalStatus = "Watching";
    actionDescription = "Restricted remote ingress network ACLs";
    asset.mode = "Restricted Network";
    asset.level = 95;
  } else if (chosenOption.id === "opt-fallback") {
    // Switch to safe fallback mode
    finalStatus = "Contained";
    actionDescription = `Switched to safe fallback (${asset.fallback})`;
    asset.mode = asset.fallback;
    asset.level = asset.serviceKept;
  } else if (chosenOption.id === "opt-isolate") {
    // Full isolation
    finalStatus = "Contained";
    actionDescription = "Full isolation: Device severed from network & powered off";
    asset.mode = "Full Isolation (Offline)";
    asset.level = 0;
  }

  // Auto-tick Incident Checklist steps 2 and 5 per specifications:
  // "checklist ticks automatically for steps 2 and 5."
  incidentChecklistState.step2 = (chosenOption.id === "opt-fallback" || chosenOption.id === "opt-isolate");
  incidentChecklistState.step5 = true;

  // Auto-populate simulated department dispatch for step 3
  const dept = activeAlert.attack.responsibleDept || "Emergency Infrastructure Operations";
  incidentChecklistState.notifiedTeamMessage = `${dept} notified via secure dispatch at ${getCurrentTimeString()}`;

  // Log the incident
  const currentIncidentId = activeAlert.incidentId;
  const logRow = {
    id: currentIncidentId,
    time: activeAlert.timestamp,
    assetId: asset.id,
    assetName: asset.name,
    threat: activeAlert.attack.threat,
    priority: activeAlert.priority.label,
    actionTaken: actionDescription,
    serviceLevelKept: `${asset.level}%`,
    status: finalStatus,
    handledBy: "Operator 1",
    lessonsLearned: chosenOption.id === "opt-fallback"
      ? `Graceful degradation kept ${asset.level}% citizen service while isolating the SCADA threat vector.`
      : (chosenOption.id === "opt-isolate" ? "Service completely halted. Manual restoration mandatory." : "Continuous telemetry monitored.")
  };

  incidentLogs.unshift(logRow);
  incidentCounter++;

  // If contained, initiate the Recovery Panel state machine
  if (finalStatus === "Contained") {
    setupRecoveryPanelForAsset(currentIncidentId, asset.id);
  }

  // Clear active alert after operator application
  activeAlert = null;

  // Update all visual dashboards
  renderMap();
  renderServiceBars();
  updateContinuityScore();
  renderAlertPanel();
  renderIncidentChecklist();
  renderLogTable();

  showToast(`Action confirmed: ${actionDescription}. Citizen service level: ${asset.level}%.`, "success");
}

// ==========================================
// 6. RESPONSE CHECKLIST INTERACTION
// ==========================================

function toggleIncidentChecklistStep(stepKey) {
  incidentChecklistState[stepKey] = !incidentChecklistState[stepKey];
  renderIncidentChecklist();
}

function notifyResponsibleTeamManual() {
  if (!incidentChecklistState.notifiedTeamMessage) {
    incidentChecklistState.notifiedTeamMessage = `Central Dispatch & Emergency Operations notified at ${getCurrentTimeString()} [SIMULATED ACK 200]`;
  }
  incidentChecklistState.step3 = true;
  renderIncidentChecklist();
  showToast("Simulated notification transmitted to emergency field department.", "info");
}

function renderIncidentChecklist() {
  const container = document.getElementById("incidentChecklistContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div class="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
        <div class="flex items-center space-x-2">
          <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-300">Standard Response Checklist</h3>
        </div>
        <span class="text-[11px] text-slate-400 font-mono">Incident Protocol v2.6</span>
      </div>

      <div class="space-y-2.5 text-xs text-slate-300">
        <!-- Step 1 -->
        <label class="flex items-start space-x-2.5 cursor-pointer hover:text-white transition-colors">
          <input type="checkbox" id="chk-step1" ${incidentChecklistState.step1 ? "checked" : ""} 
            onchange="toggleIncidentChecklistStep('step1')"
            class="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <div>
            <span class="font-medium text-slate-200">1. Confirm alert details & threat telemetry</span>
            <p class="text-[11px] text-slate-400">Verify authenticity of sensor alerts and operator console flags.</p>
          </div>
        </label>

        <!-- Step 2 -->
        <label class="flex items-start space-x-2.5 cursor-pointer hover:text-white transition-colors">
          <input type="checkbox" id="chk-step2" ${incidentChecklistState.step2 ? "checked" : ""} 
            onchange="toggleIncidentChecklistStep('step2')"
            class="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <div>
            <span class="font-medium text-slate-200">2. Apply safe fallback mode</span>
            <span class="ml-1 text-[10px] text-cyan-400 font-mono">(Auto-ticks on Containment)</span>
            <p class="text-[11px] text-slate-400">Isolate OT network and engage pre-validated local autonomy.</p>
          </div>
        </label>

        <!-- Step 3 -->
        <div class="flex items-start space-x-2.5">
          <input type="checkbox" id="chk-step3" ${incidentChecklistState.step3 ? "checked" : ""} 
            onchange="toggleIncidentChecklistStep('step3')"
            class="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer">
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="font-medium text-slate-200">3. Notify responsible department</span>
              <button onclick="notifyResponsibleTeamManual()" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] rounded text-cyan-300 border border-slate-700">
                Dispatch Alert
              </button>
            </div>
            <p class="text-[11px] text-slate-400">
              ${incidentChecklistState.notifiedTeamMessage ? `<span class="text-emerald-400 font-mono">${incidentChecklistState.notifiedTeamMessage}</span>` : "Automated notification to field response teams."}
            </p>
          </div>
        </div>

        <!-- Step 4 -->
        <label class="flex items-start space-x-2.5 cursor-pointer hover:text-white transition-colors">
          <input type="checkbox" id="chk-step4" ${incidentChecklistState.step4 ? "checked" : ""} 
            onchange="toggleIncidentChecklistStep('step4')"
            class="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <div>
            <span class="font-medium text-slate-200">4. Verify citizen service level continuity</span>
            <p class="text-[11px] text-slate-400">Validate real-time flow through fallback parameters (e.g. 60-80% kept).</p>
          </div>
        </label>

        <!-- Step 5 -->
        <label class="flex items-start space-x-2.5 cursor-pointer hover:text-white transition-colors">
          <input type="checkbox" id="chk-step5" ${incidentChecklistState.step5 ? "checked" : ""} 
            onchange="toggleIncidentChecklistStep('step5')"
            class="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <div>
            <span class="font-medium text-slate-200">5. Record incident & preserve audit evidence</span>
            <span class="ml-1 text-[10px] text-cyan-400 font-mono">(Auto-ticks on logging)</span>
            <p class="text-[11px] text-slate-400">Persist cryptographically signed incident event in municipal ledger.</p>
          </div>
        </label>
      </div>
    </div>
  `;
}

// ==========================================
// 7. TRUSTED FALLBACK COPY & CRYPTOGRAPHY
// ==========================================

function simulateTampering(targetAssetId) {
  // If not specified, tamper with the active alert asset or TS-01
  let assetId = targetAssetId;
  if (!assetId) {
    if (activeAlert) assetId = activeAlert.asset.id;
    else if (recoveryState.active) assetId = recoveryState.assetId;
    else assetId = "TS-01";
  }

  const asset = cityAssets.find(a => a.id === assetId);
  if (!asset) return;

  // Invalidate configuration by altering fallback settings
  asset.fallbackConfig.cycleSeconds = 999;
  asset.fallbackConfig.emergencyOverride = "UNAUTHORIZED_MALICIOUS_HOOK";
  asset.fallbackConfig.firmwareSignature = "INJECTED_TAMPERED_V99_EXPLOIT";

  // Recompute hash
  const tamperedHash = computeSHA256(JSON.stringify(asset.fallbackConfig));
  asset.trustedCopy.hash = tamperedHash;
  asset.trustedCopy.status = "Altered: do not trust";

  renderMap();
  renderRecoveryPanel();

  showToast(`[TAMPERING INJECTED] Asset ${asset.id} fallback configuration corrupted! SHA-256 hash altered. Badge status: "Altered: do not trust".`, "danger");
}

function restoreCleanSettings(assetId) {
  const asset = cityAssets.find(a => a.id === assetId);
  if (!asset) return;

  // Restore golden master configuration
  asset.fallbackConfig = JSON.parse(JSON.stringify(asset.baselineCleanConfig));
  asset.trustedCopy.hash = asset.baselineCleanHash;
  asset.trustedCopy.status = "Verified";

  renderMap();
  renderRecoveryPanel();

  showToast(`[RESTORED] Clean factory baseline settings restored on ${asset.id}. SHA-256 hash verified successfully.`, "success");
}

// ==========================================
// 8. RECOVERY WORKFLOW PANEL (Steps a to h)
// ==========================================

function setupRecoveryPanelForAsset(incidentId, assetId) {
  if (recoveryState.watchTimer) {
    clearInterval(recoveryState.watchTimer);
  }

  recoveryState = {
    active: true,
    incidentId: incidentId,
    assetId: assetId,
    steps: {
      a: false,
      b: false,
      c: false,
      d: false,
      e: false,
      f: false,
      g: false,
      h: false
    },
    hashVerificationResult: null,
    reconnecting: false,
    reconnectStep: 0,
    watchTimer: null,
    watchSecondsLeft: 10
  };

  renderRecoveryPanel();
}

function toggleRecoveryStepA() {
  if (!recoveryState.active) return;
  recoveryState.steps.a = !recoveryState.steps.a;
  renderRecoveryPanel();
}

function executeRecoveryStepB() {
  if (!recoveryState.active || !recoveryState.steps.a) return;

  // Save logs as evidence
  const logEntry = {
    id: `EVD-${String(incidentCounter++).padStart(3, '0')}`,
    time: getCurrentTimeString(),
    assetId: recoveryState.assetId,
    assetName: cityAssets.find(a => a.id === recoveryState.assetId)?.name || "",
    threat: "Forensic log export & memory dump",
    priority: "Low",
    actionTaken: "Evidence saved to cryptographically sealed forensic container",
    serviceLevelKept: `${cityAssets.find(a => a.id === recoveryState.assetId)?.level || 0}%`,
    status: "Contained",
    handledBy: "Operator 1",
    lessonsLearned: "Digital chain of custody established. PCAP & syslog hashes recorded."
  };

  incidentLogs.unshift(logEntry);
  recoveryState.steps.b = true;

  renderLogTable();
  renderRecoveryPanel();
  showToast("Forensic log snapshot saved as incident evidence.", "info");
}

function executeRecoveryStepC() {
  if (!recoveryState.active || !recoveryState.steps.b) return;

  const asset = cityAssets.find(a => a.id === recoveryState.assetId);
  if (!asset) return;

  // Recompute current hash and compare against clean golden baseline
  const currentHash = computeSHA256(JSON.stringify(asset.fallbackConfig));
  const isMatch = (currentHash === asset.baselineCleanHash);

  if (isMatch) {
    recoveryState.hashVerificationResult = "MATCH";
    asset.trustedCopy.status = "Verified";
    showToast(`Cryptographic Verification: SHA-256 MATCH (${currentHash.slice(0, 16)}...)`, "success");
  } else {
    recoveryState.hashVerificationResult = "MISMATCH";
    asset.trustedCopy.status = "Altered: do not trust";
    showToast(`Cryptographic Verification FAILED: SHA-256 MISMATCH! Unauthorized firmware alterations detected.`, "danger");
  }

  recoveryState.steps.c = true;
  renderMap();
  renderRecoveryPanel();
}

function executeRecoveryStepD() {
  if (!recoveryState.active || !recoveryState.steps.c) return;

  // Restore clean settings from backup
  restoreCleanSettings(recoveryState.assetId);
  recoveryState.hashVerificationResult = "MATCH";
  recoveryState.steps.d = true;

  renderRecoveryPanel();
}

function toggleRecoveryStepE() {
  if (!recoveryState.active || !recoveryState.steps.c) return;
  // If mismatch was detected, step d MUST be completed before step e
  if (recoveryState.hashVerificationResult === "MISMATCH" && !recoveryState.steps.d) {
    showToast("Must restore clean settings (Step d) before cycling credentials!", "warning");
    return;
  }

  recoveryState.steps.e = !recoveryState.steps.e;
  renderRecoveryPanel();
}

function executeRecoveryStepF() {
  // Unlocks only after steps a to e are satisfied
  const ready = recoveryState.steps.a &&
                recoveryState.steps.b &&
                recoveryState.steps.c &&
                (recoveryState.hashVerificationResult === "MATCH" || recoveryState.steps.d) &&
                recoveryState.steps.e;

  if (!ready) {
    showToast("Steps a through e must be completed before gradual reconnection!", "warning");
    return;
  }

  const asset = cityAssets.find(a => a.id === recoveryState.assetId);
  if (!asset) return;

  recoveryState.reconnecting = true;
  recoveryState.reconnectStep = 1;
  renderRecoveryPanel();

  const startLevel = asset.serviceKept;
  const intermediateLevel = Math.min(100, Math.round(startLevel + (100 - startLevel) / 2));

  showToast(`Gradual reconnection initiated for ${asset.id}: Raising to ${intermediateLevel}%...`, "info");

  // Step 1: Rise to intermediate level (e.g. 60 -> 80)
  setTimeout(() => {
    asset.level = intermediateLevel;
    asset.mode = `Reconnecting (${intermediateLevel}%)`;
    recoveryState.reconnectStep = 2;
    renderMap();
    renderServiceBars();
    updateContinuityScore();
    renderRecoveryPanel();

    // Step 2: Rise to 100%
    setTimeout(() => {
      asset.level = 100;
      asset.mode = "Pre-validation (100%)";
      recoveryState.reconnecting = false;
      recoveryState.steps.f = true;

      renderMap();
      renderServiceBars();
      updateContinuityScore();
      renderRecoveryPanel();
      showToast(`Reconnection completed: ${asset.id} operating at 100%. Starting mandatory 10-second watch period.`, "success");

      // Auto-start watch period (Step g)
      startWatchPeriod();
    }, 1000);
  }, 1000);
}

function startWatchPeriod() {
  if (!recoveryState.active || !recoveryState.steps.f) return;

  recoveryState.watchSecondsLeft = 10;
  if (recoveryState.watchTimer) clearInterval(recoveryState.watchTimer);

  renderRecoveryPanel();

  recoveryState.watchTimer = setInterval(() => {
    recoveryState.watchSecondsLeft--;

    if (recoveryState.watchSecondsLeft <= 0) {
      clearInterval(recoveryState.watchTimer);
      recoveryState.watchTimer = null;
      recoveryState.steps.g = true;

      const asset = cityAssets.find(a => a.id === recoveryState.assetId);
      if (asset) {
        asset.mode = "Normal";
      }

      renderMap();
      renderRecoveryPanel();
      showToast("10-second watch period passed with zero anomalies. Ready to close incident.", "success");
    } else {
      renderRecoveryPanel();
    }
  }, 1000);
}

function handleWatchPeriodInterruption(asset, attackDef) {
  if (recoveryState.watchTimer) {
    clearInterval(recoveryState.watchTimer);
    recoveryState.watchTimer = null;
  }

  // "If a new alert hits that asset during the watch, automatically return it to fallback and show 'Suspicious activity returned: back to safe fallback'."
  asset.mode = asset.fallback;
  asset.level = asset.serviceKept;
  asset.underAttack = true;

  // Reset steps f and g
  recoveryState.steps.f = false;
  recoveryState.steps.g = false;
  recoveryState.watchSecondsLeft = 10;

  // Add Incident Log entry
  const logEntry = {
    id: `INC-${String(incidentCounter++).padStart(3, '0')}`,
    time: getCurrentTimeString(),
    assetId: asset.id,
    assetName: asset.name,
    threat: `Suspicious activity re-detected: ${attackDef.threat}`,
    priority: "Critical",
    actionTaken: "Suspicious activity returned: back to safe fallback",
    serviceLevelKept: `${asset.level}%`,
    status: "Contained",
    handledBy: "Operator 1",
    lessonsLearned: "Automated defense tripped during watch period: asset safely isolated back to local offline loop."
  };

  incidentLogs.unshift(logEntry);

  renderMap();
  renderServiceBars();
  updateContinuityScore();
  renderLogTable();
  renderRecoveryPanel();

  showToast("Suspicious activity returned: back to safe fallback! System re-engaged offline protection.", "danger");
}

function closeIncidentStepH() {
  if (!recoveryState.active || !recoveryState.steps.g) return;

  const asset = cityAssets.find(a => a.id === recoveryState.assetId);
  if (asset) {
    asset.mode = "Normal";
    asset.level = 100;
    asset.underAttack = false;
  }

  // Update incident status in log
  const targetLog = incidentLogs.find(l => l.id === recoveryState.incidentId && l.status === "Contained");
  if (targetLog) {
    targetLog.status = "Resolved";
    targetLog.serviceLevelKept = "100%";
    targetLog.lessonsLearned = "Graceful degradation sustained citizen operations. Root-cause contained, firmware baseline verified, full service restored.";
  }

  recoveryState.steps.h = true;

  renderMap();
  renderServiceBars();
  updateContinuityScore();
  renderLogTable();
  renderRecoveryPanel();

  showToast(`Incident ${recoveryState.incidentId} formally RESOLVED. Lessons learned recorded.`, "success");
}

function renderRecoveryPanel() {
  const container = document.getElementById("recoveryPanelContainer");
  if (!container) return;

  if (!recoveryState.active) {
    container.innerHTML = `
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-center text-slate-400">
        <div class="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h4 class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Recovery Pipeline Inactive</h4>
        <p class="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
          The strict sequential recovery panel unlocks when an asset is in <span class="text-amber-400">Contained</span> safe fallback mode.
        </p>
      </div>
    `;
    return;
  }

  const asset = cityAssets.find(a => a.id === recoveryState.assetId) || {};
  const steps = recoveryState.steps;

  // Step prerequisites
  const canDoB = steps.a;
  const canDoC = steps.b;
  const canDoD = steps.c && (recoveryState.hashVerificationResult === "MISMATCH" || !steps.d);
  const canDoE = steps.c && (recoveryState.hashVerificationResult === "MATCH" || steps.d);
  const canDoRestore = steps.a && steps.b && steps.c && (recoveryState.hashVerificationResult === "MATCH" || steps.d) && steps.e;

  container.innerHTML = `
    <div class="bg-slate-900/90 border border-cyan-900/60 rounded-xl p-4 shadow-xl relative overflow-hidden">
      <!-- Glow Accent -->
      <div class="absolute -right-8 -top-8 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

      <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div>
          <div class="flex items-center space-x-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <h3 class="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Recovery Protocol: ${asset.id} (${asset.name})
            </h3>
          </div>
          <p class="text-[11px] text-slate-400 mt-0.5">
            Strict sequential recovery. Steps unlock in order to prevent premature exposure.
          </p>
        </div>
        <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
          ${recoveryState.incidentId}
        </span>
      </div>

      <div class="space-y-3 text-xs">
        <!-- Step a -->
        <div class="flex items-start space-x-2.5 p-2 rounded bg-slate-950/60 border ${steps.a ? 'border-emerald-800/80 bg-emerald-950/20' : 'border-slate-800'}">
          <input type="checkbox" id="rec-step-a" ${steps.a ? 'checked' : ''} onchange="toggleRecoveryStepA()"
            class="mt-1 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer">
          <label for="rec-step-a" class="flex-1 cursor-pointer">
            <span class="font-semibold text-slate-200">a. Keep asset in safe fallback until safe</span>
            <p class="text-[11px] text-slate-400">Maintain disconnected offline mode (${asset.serviceKept}% citizen throughput kept).</p>
          </label>
        </div>

        <!-- Step b -->
        <div class="flex items-center justify-between p-2 rounded bg-slate-950/60 border ${steps.b ? 'border-emerald-800/80 bg-emerald-950/20' : 'border-slate-800'} ${!canDoB ? 'opacity-50 pointer-events-none' : ''}">
          <div class="flex items-start space-x-2.5">
            <span class="text-sm ${steps.b ? 'text-emerald-400' : 'text-slate-500'} font-bold">b.</span>
            <div>
              <span class="font-semibold text-slate-200">Save logs as evidence</span>
              <p class="text-[11px] text-slate-400">Lock forensic packet captures and authorization logs.</p>
            </div>
          </div>
          <button onclick="executeRecoveryStepB()" ${steps.b ? 'disabled' : ''}
            class="px-2.5 py-1 text-[11px] font-medium rounded ${steps.b ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}">
            ${steps.b ? '✓ Evidence Saved' : 'Save Logs'}
          </button>
        </div>

        <!-- Step c -->
        <div class="p-2 rounded bg-slate-950/60 border ${steps.c ? (recoveryState.hashVerificationResult === 'MATCH' ? 'border-emerald-800/80 bg-emerald-950/20' : 'border-rose-800/80 bg-rose-950/20') : 'border-slate-800'} ${!canDoC ? 'opacity-50 pointer-events-none' : ''}">
          <div class="flex items-center justify-between">
            <div class="flex items-start space-x-2.5">
              <span class="text-sm ${steps.c ? 'text-emerald-400' : 'text-slate-500'} font-bold">c.</span>
              <div>
                <span class="font-semibold text-slate-200">Verify device against trusted copy</span>
                <p class="text-[11px] text-slate-400">Recompute SHA-256 hash vs signed baseline configuration.</p>
              </div>
            </div>
            <button onclick="executeRecoveryStepC()"
              class="px-2.5 py-1 text-[11px] font-medium rounded bg-cyan-600 hover:bg-cyan-500 text-white">
              Verify Hash
            </button>
          </div>
          ${steps.c ? `
            <div class="mt-2 pt-2 border-t border-slate-800 text-[11px] font-mono flex items-center justify-between">
              <span>SHA-256 Status:</span>
              ${recoveryState.hashVerificationResult === 'MATCH' ? `
                <span class="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  ✓ MATCH: Clean Baseline Verified
                </span>
              ` : `
                <span class="text-rose-400 font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                  ⚠ MISMATCH: Tampered Config Detected!
                </span>
              `}
            </div>
          ` : ''}
        </div>

        <!-- Step d -->
        <div class="flex items-center justify-between p-2 rounded bg-slate-950/60 border ${steps.d ? 'border-emerald-800/80 bg-emerald-950/20' : 'border-slate-800'} ${!canDoD ? 'opacity-50 pointer-events-none' : ''}">
          <div class="flex items-start space-x-2.5">
            <span class="text-sm ${steps.d ? 'text-emerald-400' : 'text-slate-500'} font-bold">d.</span>
            <div>
              <span class="font-semibold text-slate-200">Restore clean settings from backup</span>
              <p class="text-[11px] text-slate-400">Overwrites any tampered firmware/config with immutable master.</p>
            </div>
          </div>
          <button onclick="executeRecoveryStepD()" ${steps.d ? 'disabled' : ''}
            class="px-2.5 py-1 text-[11px] font-medium rounded ${steps.d ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-amber-600 hover:bg-amber-500 text-white'}">
            ${steps.d ? '✓ Clean Backup Restored' : 'Restore Clean Backup'}
          </button>
        </div>

        <!-- Step e -->
        <div class="flex items-start space-x-2.5 p-2 rounded bg-slate-950/60 border ${steps.e ? 'border-emerald-800/80 bg-emerald-950/20' : 'border-slate-800'} ${!canDoE ? 'opacity-50 pointer-events-none' : ''}">
          <input type="checkbox" id="rec-step-e" ${steps.e ? 'checked' : ''} onchange="toggleRecoveryStepE()"
            class="mt-1 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer">
          <label for="rec-step-e" class="flex-1 cursor-pointer">
            <span class="font-semibold text-slate-200">e. Change credentials and keys</span>
            <p class="text-[11px] text-slate-400">Revoke compromised JWT/SSH tokens; rotate mutual-TLS certificates.</p>
          </label>
        </div>

        <!-- Reconnect Action (Steps f, g, h) -->
        <div class="mt-4 pt-3 border-t border-slate-800 space-y-3">
          <!-- Step f Button -->
          <div class="flex items-center justify-between">
            <div>
              <span class="font-semibold text-slate-200">f. Reconnect gradually</span>
              <p class="text-[11px] text-slate-400">Rises level in steps: ${asset.serviceKept}% → 80% → 100%.</p>
            </div>
            <button onclick="executeRecoveryStepF()" 
              ${!canDoRestore || recoveryState.reconnecting || steps.f ? 'disabled' : ''}
              class="px-3 py-1.5 text-xs font-semibold rounded shadow-md transition-all ${
                canDoRestore && !steps.f
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }">
              ${recoveryState.reconnecting ? 'Reconnecting...' : (steps.f ? '✓ Reconnected (100%)' : 'Restore Normal Mode')}
            </button>
          </div>

          <!-- Step g Countdown -->
          <div class="p-2.5 rounded bg-slate-950/80 border ${steps.g ? 'border-emerald-800 bg-emerald-950/20' : (recoveryState.watchTimer ? 'border-cyan-500 bg-cyan-950/30 animate-pulse' : 'border-slate-800')}">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-semibold text-slate-200">g. Watch period: 10-second countdown</span>
                <p class="text-[11px] text-slate-400">Automated tripwire: Any attack during this watch triggers auto-fallback.</p>
              </div>
              <div class="text-right">
                ${recoveryState.watchTimer ? `
                  <span class="px-2 py-1 text-xs font-mono font-bold bg-cyan-900/80 text-cyan-200 rounded border border-cyan-700 animate-pulse">
                    Monitoring: ${recoveryState.watchSecondsLeft}s
                  </span>
                ` : (steps.g ? `
                  <span class="px-2 py-1 text-xs font-mono font-bold bg-emerald-900/80 text-emerald-200 rounded border border-emerald-700">
                    ✓ Clean 10s Window
                  </span>
                ` : `
                  <span class="text-xs text-slate-500 font-mono">Standby</span>
                `)}
              </div>
            </div>
          </div>

          <!-- Step h Close Incident -->
          <div class="flex items-center justify-between pt-1">
            <div>
              <span class="font-semibold text-slate-200">h. Close incident & archive</span>
              <p class="text-[11px] text-slate-400">Status marked Resolved; root cause & lessons captured.</p>
            </div>
            <button onclick="closeIncidentStepH()" 
              ${!steps.g || steps.h ? 'disabled' : ''}
              class="px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                steps.g && !steps.h
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }">
              ${steps.h ? '✓ Incident Resolved' : 'Close Incident'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 9. ALERT PANEL RENDERING
// ==========================================

function renderAlertPanel() {
  const container = document.getElementById("alertPanelContainer");
  if (!container) return;

  if (!activeAlert) {
    container.innerHTML = `
      <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-6 text-center shadow-lg">
        <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/80 flex items-center justify-center text-cyan-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 class="text-sm font-semibold text-slate-200">No Active Threat Ingress</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          All city assets currently operating under normal baseline telemetry. Trigger a simulated attack above to evaluate graceful degradation containment.
        </p>
      </div>
    `;
    return;
  }

  const { incidentId, attack, asset, priority, options, recommendedOptionId, isRepeatTarget } = activeAlert;

  container.innerHTML = `
    <div class="bg-slate-900/95 border-2 ${priority.accentBorder} rounded-xl p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
      <!-- Top Incident Tag & Badges -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-0.5 rounded text-xs font-bold font-mono ${priority.badgeColor} border">
            ${priority.label.toUpperCase()} (${priority.score})
          </span>
          <span class="text-xs font-mono text-slate-400">${incidentId}</span>
          ${isRepeatTarget ? `
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600 animate-pulse">
              🔁 REPEAT TARGET
            </span>
          ` : ''}
        </div>
        <span class="text-xs text-slate-400 font-mono">Alert Time: ${activeAlert.timestamp}</span>
      </div>

      <!-- Threat & Target Summary -->
      <div class="mb-4">
        <div class="flex items-baseline space-x-2">
          <h2 class="text-base font-bold text-white tracking-wide">${attack.threat}</h2>
        </div>
        <p class="text-xs text-cyan-400 font-medium mt-0.5">
          Target: <span class="text-white font-bold">${asset.id} ${asset.name}</span> (${asset.zone} • ${asset.service.toUpperCase()})
        </p>
        <p class="text-xs text-slate-300 mt-1.5 leading-relaxed bg-slate-950/60 p-2.5 rounded border border-slate-800 font-mono">
          ${attack.technicalDetails}
        </p>
      </div>

      <!-- Citizen Impact & Dependency Reason -->
      <div class="mb-4 p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
        <div class="flex items-center space-x-2 text-amber-300 text-xs font-semibold">
          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Citizen Impact & Critical Dependency:</span>
        </div>
        <p class="text-xs text-slate-200 mt-1">
          <span class="text-amber-200 font-semibold">${asset.note}</span>. Direct citizen exposure: <span class="font-bold text-white font-mono">${asset.people.toLocaleString()} citizens</span> affected if severed.
        </p>
        <div class="text-[11px] text-slate-400 mt-1 font-mono">
          Formula: ${priority.formulaBreakdown}
        </div>
      </div>

      <!-- Options Comparison Table -->
      <div class="mb-4">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Containment Options & Service Continuity</h4>
        <div class="space-y-2">
          ${options.map(opt => {
            const isRec = (opt.id === recommendedOptionId);
            return `
              <div class="relative p-3 rounded-lg border transition-all ${
                isRec
                  ? 'bg-gradient-to-r from-cyan-950/70 to-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="text-xs font-bold text-white">${opt.name}</span>
                    ${isRec ? `
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500 text-slate-950 tracking-wide uppercase">
                        ★ Recommended
                      </span>
                    ` : ''}
                  </div>
                  <div class="flex items-center space-x-3 text-xs font-mono">
                    <span class="${opt.stopsThreat === 'Yes' ? 'text-emerald-400' : (opt.stopsThreat === 'Partly' ? 'text-amber-400' : 'text-rose-400')}">
                      Stops: <span class="font-bold">${opt.stopsThreat}</span>
                    </span>
                    <span class="px-2 py-0.5 rounded font-bold ${opt.serviceKept >= 80 ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : (opt.serviceKept >= 50 ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-rose-950 text-rose-300 border border-rose-700')}">
                      Keeps: ${opt.serviceKept}%
                    </span>
                  </div>
                </div>

                <p class="text-[11px] text-slate-300 mt-1.5">${opt.description}</p>
                <p class="text-[11px] text-slate-400 mt-0.5">${opt.citizenImpact}</p>

                ${opt.warning ? `
                  <div class="mt-2 text-[11px] font-semibold text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-800/60 flex items-center space-x-1.5">
                    <span>⚠️</span>
                    <span>${opt.warning}</span>
                  </div>
                ` : ''}

                <div class="mt-2 text-right">
                  <button onclick="applyContainmentOption('${opt.id}')"
                    class="px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      isRec
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }">
                    ${isRec ? 'Confirm & Apply Recommended' : `Choose '${opt.name}'`}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Primary Action Confirmation -->
      <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
        <span class="text-[11px] text-slate-400 italic">Human operator confirmation mandatory before execution.</span>
        <button onclick="applyRecommendedOption()"
          class="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg shadow-lg hover:shadow-cyan-500/20 text-xs transition-all">
          Apply Recommended Safe Containment
        </button>
      </div>
    </div>
  `;
}

// ==========================================
// 10. MAP RENDERING & ASSET CARDS
// ==========================================

function renderMap() {
  const container = document.getElementById("assetCardsOverlay");
  if (!container) return;

  // Coordinate positions (% of SVG viewport) for each of the 6 assets
  const positions = {
    "TS-01": { top: "14%", left: "7%" },   // Zone A - Northwest
    "WP-01": { top: "27%", left: "28%" },  // Zone A - Northwest
    "TS-02": { top: "14%", left: "54%" },  // Zone B - Northeast
    "SL-02": { top: "27%", left: "74%" },  // Zone B - Northeast
    "WS-01": { top: "64%", left: "12%" },  // Zone C - Southwest
    "MS-01": { top: "64%", left: "62%" }   // Zone D - Southeast
  };

  container.innerHTML = cityAssets.map(asset => {
    const pos = positions[asset.id] || { top: "10%", left: "10%" };

    // Service Level Color Coding
    // Green = 100, Amber = 50-99, Red = below 50
    let levelBadgeColor = "bg-emerald-950 text-emerald-400 border-emerald-600";
    let cardBorder = "border-emerald-600";
    let statusLabel = "Optimal (100%)";

    if (asset.level < 50) {
      levelBadgeColor = "bg-rose-950 text-rose-300 border-rose-600";
      cardBorder = "border-rose-600";
      statusLabel = `Severed (${asset.level}%)`;
    } else if (asset.level < 100) {
      levelBadgeColor = "bg-amber-950 text-amber-300 border-amber-600";
      cardBorder = "border-amber-500";
      statusLabel = `Degraded (${asset.level}%)`;
    }

    // Active Attack Pulsing Red Outline
    const attackRing = asset.underAttack
      ? "ring-4 ring-rose-500 ring-opacity-80 animate-pulse border-rose-500 shadow-rose-900/50 shadow-xl"
      : "";

    // Trusted Copy Badge
    const isVerified = (asset.trustedCopy.status === "Verified");
    const trustedBadge = isVerified
      ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center space-x-1">
           <span>✓</span><span>Verified</span>
         </span>`
      : `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-600 font-bold flex items-center space-x-1 animate-pulse">
           <span>⚠</span><span>Altered: do not trust</span>
         </span>`;

    // Repeat Target Badge
    const repeatCount = assetAttackCounts[asset.id] || 0;
    const isRepeat = repeatCount >= 2;

    return `
      <div style="top: ${pos.top}; left: ${pos.left}; width: 175px;" 
        class="absolute z-20 bg-slate-900/95 backdrop-blur-md p-2.5 rounded-lg border ${cardBorder} ${attackRing} shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer"
        onclick="inspectAsset('${asset.id}')">
        
        <!-- Header -->
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold font-mono text-cyan-300">${asset.id}</span>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${levelBadgeColor} border">
            ${asset.level}%
          </span>
        </div>

        <div class="text-[11px] font-semibold text-slate-100 truncate" title="${asset.name}">${asset.name}</div>
        
        <!-- Mode & Status -->
        <div class="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span class="truncate max-w-[95px] text-amber-300 font-medium">${asset.mode}</span>
          <span class="uppercase text-[9px] font-mono text-slate-400">${asset.service}</span>
        </div>

        <!-- Service Bar Inside Box -->
        <div class="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
          <div class="h-full transition-all duration-500 ${asset.level >= 80 ? 'bg-emerald-500' : (asset.level >= 50 ? 'bg-amber-500' : 'bg-rose-500')}" 
            style="width: ${asset.level}%"></div>
        </div>

        <!-- Badges row -->
        <div class="mt-2 pt-1 border-t border-slate-800 flex items-center justify-between">
          ${trustedBadge}
          ${isRepeat ? `
            <span class="px-1 py-0.5 text-[9px] font-bold bg-amber-900 text-amber-200 rounded border border-amber-600" title="Targeted ${repeatCount} times">
              🔁 x${repeatCount}
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function inspectAsset(assetId) {
  const asset = cityAssets.find(a => a.id === assetId);
  if (!asset) return;

  // If asset has a simulated attack scenario, allow operator to trigger or review
  const matchingAttack = SIMULATED_ATTACKS.find(a => a.assetId === asset.id);
  if (matchingAttack && !activeAlert) {
    showToast(`Inspecting ${asset.id}: Ready for simulation or maintenance.`, "info");
  } else {
    showToast(`${asset.id} (${asset.name}): Mode: ${asset.mode}, Kept: ${asset.level}%, People: ${asset.people.toLocaleString()}.`, "info");
  }
}

// ==========================================
// 11. CONTINUITY SCORE & METERS
// ==========================================

function calculateServiceAverages() {
  const services = {
    traffic: [],
    water: [],
    lighting: [],
    transport: []
  };

  cityAssets.forEach(a => {
    if (services[a.service]) {
      services[a.service].push(a.level);
    }
  });

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  return {
    traffic: avg(services.traffic),
    water: avg(services.water),
    lighting: avg(services.lighting),
    transport: avg(services.transport)
  };
}

function calculateCityContinuityScore() {
  if (!cityAssets.length) return 100;
  const total = cityAssets.reduce((sum, a) => sum + a.level, 0);
  return Math.round(total / cityAssets.length);
}

function updateContinuityScore() {
  const score = calculateCityContinuityScore();
  const serviceAverages = calculateServiceAverages();

  // Update Doughnut Chart
  if (continuityChart) {
    continuityChart.data.datasets[0].data = [score, 100 - score];

    let chartColor = "#10b981"; // emerald
    if (score < 60) chartColor = "#ef4444"; // rose
    else if (score < 80) chartColor = "#f59e0b"; // amber

    continuityChart.data.datasets[0].backgroundColor = [chartColor, "#1e293b"];
    continuityChart.update();
  }

  // Update Center Text
  const scoreNumberEl = document.getElementById("continuityScoreNumber");
  const scoreLabelEl = document.getElementById("continuityScoreLabel");
  if (scoreNumberEl) {
    scoreNumberEl.textContent = `${score}%`;
    scoreNumberEl.className = `text-3xl font-extrabold font-mono ${score >= 80 ? 'text-emerald-400' : (score >= 60 ? 'text-amber-400' : 'text-rose-500 animate-pulse')}`;
  }
  if (scoreLabelEl) {
    scoreLabelEl.textContent = score >= 80 ? "Nominal Flow" : (score >= 60 ? "Degraded Flow" : "Critical Impairment");
  }

  // Escalation Banner:
  // "If score drops below 60%, show a banner 'Multiple services degraded: escalate to emergency team'."
  const bannerEl = document.getElementById("emergencyEscalationBanner");
  if (bannerEl) {
    if (score < 60) {
      bannerEl.classList.remove("hidden");
    } else {
      bannerEl.classList.add("hidden");
    }
  }

  renderServiceBars();
}

function renderServiceBars() {
  const avgs = calculateServiceAverages();

  const services = [
    { key: "traffic", label: "Traffic Signals", value: avgs.traffic, note: "TS-01, TS-02" },
    { key: "water", label: "Water Infrastructure", value: avgs.water, note: "WP-01, WS-01" },
    { key: "lighting", label: "Municipal Lighting", value: avgs.lighting, note: "SL-02" },
    { key: "transport", label: "Transit & Metro Feeds", value: avgs.transport, note: "MS-01" }
  ];

  const container = document.getElementById("serviceBarsContainer");
  if (!container) return;

  container.innerHTML = services.map(s => {
    let barColor = "bg-emerald-500";
    let textColor = "text-emerald-400";
    if (s.value < 50) {
      barColor = "bg-rose-500";
      textColor = "text-rose-400";
    } else if (s.value < 80) {
      barColor = "bg-amber-500";
      textColor = "text-amber-400";
    }

    return `
      <div>
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="text-slate-300 font-medium">${s.label} <span class="text-[10px] text-slate-400 font-mono">(${s.note})</span></span>
          <span class="font-mono font-bold ${textColor}">${s.value}%</span>
        </div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full transition-all duration-500 ${barColor}" style="width: ${s.value}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function initChart() {
  const canvas = document.getElementById("continuityChart");
  if (!canvas) return;

  if (continuityChart) {
    continuityChart.destroy();
  }

  const ctx = canvas.getContext("2d");
  continuityChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [100, 0],
        backgroundColor: ["#10b981", "#1e293b"],
        borderWidth: 0,
        circumference: 360,
        rotation: -90
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "78%",
      plugins: {
        tooltip: { enabled: false }
      }
    }
  });
}

// ==========================================
// 12. PREVENTION READINESS PANEL
// ==========================================

function togglePreventionItem(key) {
  preventionItems[key] = !preventionItems[key];
  renderPreventionPanel();
}

function renderPreventionPanel() {
  const container = document.getElementById("preventionPanelContainer");
  if (!container) return;

  const count = Object.values(preventionItems).filter(Boolean).length;
  const pct = Math.round((count / 6) * 100);

  let statusBadge = "bg-emerald-950 text-emerald-400 border-emerald-700";
  if (count < 3) statusBadge = "bg-rose-950 text-rose-400 border-rose-700";
  else if (count < 5) statusBadge = "bg-amber-950 text-amber-400 border-amber-700";

  container.innerHTML = `
    <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div class="flex items-center space-x-2">
          <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-300">Prevention Readiness Checklist</h3>
        </div>
        <span class="px-2 py-0.5 rounded text-xs font-mono font-bold border ${statusBadge}">
          Prevention readiness: ${count} of 6
        </span>
      </div>

      <!-- Readiness Bar -->
      <div class="w-full h-1.5 bg-slate-800 rounded-full mb-3 overflow-hidden">
        <div class="h-full bg-cyan-500 transition-all duration-300" style="width: ${pct}%"></div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs text-slate-300">
        <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
          <input type="checkbox" ${preventionItems.patch ? 'checked' : ''} onchange="togglePreventionItem('patch')"
            class="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <span>Patch and update</span>
        </label>
        <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
          <input type="checkbox" ${preventionItems.passwords ? 'checked' : ''} onchange="togglePreventionItem('passwords')"
            class="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <span>Strong passwords & 2-step</span>
        </label>
        <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
          <input type="checkbox" ${preventionItems.network ? 'checked' : ''} onchange="togglePreventionItem('network')"
            class="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <span>Network separation</span>
        </label>
        <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
          <input type="checkbox" ${preventionItems.monitoring ? 'checked' : ''} onchange="togglePreventionItem('monitoring')"
            class="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <span>Continuous monitoring</span>
        </label>
        <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
          <input type="checkbox" ${preventionItems.backups ? 'checked' : ''} onchange="togglePreventionItem('backups')"
            class="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <span>Offline backups</span>
        </label>
        <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
          <input type="checkbox" ${preventionItems.entrypoint ? 'checked' : ''} onchange="togglePreventionItem('entrypoint')"
            class="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0">
          <span>Find the entry point</span>
        </label>
      </div>
    </div>
  `;
}

// ==========================================
// 13. INCIDENT LOG TABLE
// ==========================================

function updateLessonsLearned(incidentId, newText) {
  const log = incidentLogs.find(l => l.id === incidentId);
  if (log) {
    log.lessonsLearned = newText;
  }
}

function renderLogTable() {
  const tbody = document.getElementById("incidentLogTableBody");
  if (!tbody) return;

  if (!incidentLogs.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-6 text-slate-500 text-xs italic">
          No incident events recorded yet. Simulation audit log is clean.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = incidentLogs.map(log => {
    let statusClass = "bg-amber-950 text-amber-300 border-amber-700";
    if (log.status === "Resolved") statusClass = "bg-emerald-950 text-emerald-300 border-emerald-700";
    else if (log.status === "Watching") statusClass = "bg-sky-950 text-sky-300 border-sky-700";

    let prioClass = "text-emerald-400";
    if (log.priority === "Critical") prioClass = "text-rose-400 font-bold";
    else if (log.priority === "High") prioClass = "text-amber-400 font-bold";

    return `
      <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors text-xs text-slate-300">
        <td class="py-2.5 px-3 font-mono font-bold text-cyan-400 whitespace-nowrap">${log.id}</td>
        <td class="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">${log.time}</td>
        <td class="py-2.5 px-3 font-semibold text-white whitespace-nowrap">${log.assetId} <span class="text-slate-400 font-normal">(${log.assetName})</span></td>
        <td class="py-2.5 px-3 text-slate-200 max-w-xs truncate" title="${log.threat}">${log.threat}</td>
        <td class="py-2.5 px-3 font-mono ${prioClass}">${log.priority}</td>
        <td class="py-2.5 px-3 text-slate-300">${log.actionTaken}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-cyan-300">${log.serviceLevelKept}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono border ${statusClass}">
            ${log.status}
          </span>
        </td>
        <td class="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">${log.handledBy}</td>
        <td class="py-2.5 px-3">
          <input type="text" value="${escapeHtml(log.lessonsLearned || '')}" 
            onchange="updateLessonsLearned('${log.id}', this.value)"
            placeholder="Type cause & preventative fix..."
            class="w-full bg-slate-950/80 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono">
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// 14. UTILITIES & TOAST ALERTS
// ==========================================

function getCurrentTimeString() {
  const d = new Date();
  return d.toTimeString().split(' ')[0]; // HH:MM:SS
}

function escapeHtml(string) {
  return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) return;

  const toast = document.createElement("div");
  let bg = "bg-slate-900 border-cyan-500 text-cyan-300";
  if (type === "danger") bg = "bg-rose-950 border-rose-600 text-rose-200";
  else if (type === "warning") bg = "bg-amber-950 border-amber-600 text-amber-200";
  else if (type === "success") bg = "bg-emerald-950 border-emerald-600 text-emerald-200";

  toast.className = `p-3 rounded-lg border shadow-xl text-xs flex items-center space-x-2 transition-all transform duration-300 translate-y-2 opacity-0 ${bg}`;
  toast.innerHTML = `
    <span class="font-bold">${type === 'danger' ? '🚨' : (type === 'warning' ? '⚠️' : (type === 'success' ? '✓' : 'ℹ'))}</span>
    <span class="flex-1">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  }, 10);

  // Remove toast after 4.5 seconds
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Expose functions globally for direct HTML event binding
window.simulateAttack = simulateAttack;
window.triggerRepeatAttack = triggerRepeatAttack;
window.simulateTampering = simulateTampering;
window.initSystem = initSystem;
window.applyRecommendedOption = applyRecommendedOption;
window.applyContainmentOption = applyContainmentOption;
window.inspectAsset = inspectAsset;
window.toggleIncidentChecklistStep = toggleIncidentChecklistStep;
window.notifyResponsibleTeamManual = notifyResponsibleTeamManual;
window.toggleRecoveryStepA = toggleRecoveryStepA;
window.executeRecoveryStepB = executeRecoveryStepB;
window.executeRecoveryStepC = executeRecoveryStepC;
window.executeRecoveryStepD = executeRecoveryStepD;
window.toggleRecoveryStepE = toggleRecoveryStepE;
window.executeRecoveryStepF = executeRecoveryStepF;
window.closeIncidentStepH = closeIncidentStepH;
window.togglePreventionItem = togglePreventionItem;
window.updateLessonsLearned = updateLessonsLearned;
