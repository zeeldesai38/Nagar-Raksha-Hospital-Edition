# Nagar-Raksha: Hospital Edition
### Cyber Samvad Hackathon 2026 • Problem Statement 4: Smart City and Critical Infrastructure Cybersecurity

> **TAGLINE:** *"An attacker keeps attacking. We prevent, contain and recover, and patient care keeps running."*

---

## 1. Executive Summary & Core Philosophy

In critical hospital infrastructure, **shutting a system down to stop a cyber attack can hurt patients more than the attack itself**. When traditional IT cybersecurity responds to an intrusion by isolating a network or cutting power, ventilators in ICUs stop running, surgical suites go dark, and emergency ambulances are turned away.

**Nagar-Raksha (नगर-रक्षा)** implements **Graceful Degradation & Healthcare Resilience**:
1. **PREVENT**: Edge filters and preventative controls absorb reconnaissance noise without interrupting clinical operations.
2. **CONTAIN**: What gets through is transitioned into deterministic **Safe Fallback Modes**, supported by physical **"By-Hand" Staff Playbooks**.
3. **GOVERN**: A human operator confirms every containment decision (human-in-the-loop governance).
4. **RECOVER**: Devices are cryptographically verified against a clean **Golden Master SHA-256 Hash** before returning to full normal operations.
5. **KEEP RUNNING**: The hospital **never suffers 100% blackout**. Care continuity stays high throughout multi-stage cyber assaults.

---

## 2. Full-Stack Architecture

```mermaid
graph TD
    Client["Frontend Dashboard (index.html)<br>Live Hospital Telemetry • Light/Dark Mode • Sound FX"]
    FastAPI["FastAPI Backend (main.py)<br>Simulation Engine • Priority Math • Cryptographic SHA-256"]
    DB[("SQLite Database (nagar_raksha.db)<br>Incidents • Operator Decisions • Audit Logs • Runs")]

    Client <-->|REST API (JSON)| FastAPI
    FastAPI <-->|SQL Queries / Persistence| DB
```

- **Frontend (`index.html`)**: Interactive dashboard with real-time telemetry, 5-stage attack simulator, visual 4-second countdowns, operator governance dialogs, and jury reporting modals. Works both connected to FastAPI and offline via standalone fallback.
- **Backend (`main.py`)**: Python FastAPI application exposing 12 REST endpoints, implementing deterministic priority math, SHA-256 cryptographic checking, and automated pause enforcement.
- **Database (`database.py` / `nagar_raksha.db`)**: Persistent SQLite database storing incidents, operator audit records, and simulation run metrics across restarts.
- **Zero Real-Device Connectivity**: 100% simulated, secure, and compliant with hackathon guidelines.

---

## 3. Hospital Critical Lifelines & Priority Scoring

Priority scores are computed deterministically using the formula:
$$\text{Priority Score} = \text{sev} \times \text{crit} \times \text{urg} \times \left(1 + \frac{\text{ppl}}{50\,000}\right)$$

Thresholds: $\ge 100 \rightarrow$ **Critical**, $\ge 30 \rightarrow$ **High**, $\ge 10 \rightarrow$ **Medium**, $< 10 \rightarrow$ **Low**.

| ID | Name | Protects | Crit | Ppl | Sev | Urg | Score | Label | Safe Fallback Mode | Care Kept | Staff Playbook |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **SIG** | Ambulance Route Signal | Ambulance access corridor | 5 | 40,000 | 5 | 5 | **225.0** | **Critical** | Fixed-timer mode | 60% | Traffic police keep ambulance lane clear |
| **PWR** | Backup Power Controller | Power for ICU and OT | 5 | 1,500 | 5 | 4 | **103.0** | **Critical** | Manual generator start | 85% | Engineer starts generator by hand if mains fails |
| **PMP** | Water Pump Controller | Water for wards & sanitation | 4 | 1,500 | 4 | 3 | **49.44** | **High** | Manual valve control | 80% | Maintenance team runs valves by hand |
| **TOK** | Patient Token Server | OPD queue & triage | 3 | 800 | 4 | 4 | **48.77** | **High** | Paper tokens at counters | 50% | Counter staff hand out paper tokens; runners carry slips |
| **DSP** | Waiting-Room Display | Information screens | 1 | 300 | 1 | 1 | **1.01** | **Low** | Static notice board | 90% | Staff announce by voice |

### Decision Engine Options
1. **Monitor only**: Stops threat: No, Care kept: 100%
2. **Restrict remote access**: Stops threat: Partly, Care kept: 95%
3. **Switch to safe fallback (Recommended)**: Stops threat: Yes, Care kept: `asset.kept%`
4. **Full isolation**: Stops threat: Yes, Care kept: 0% *(⚠️ Not recommended: causes total hospital shutdown)*

---

## 4. Quick Start Guide (Windows Local Setup)

### Prerequisites
- Python 3.10+ (Python 3.14 recommended)
- Node.js (Optional, for running offline JavaScript tests)

### 1. Install Dependencies
```powershell
pip install fastapi uvicorn pydantic
```

### 2. Start the FastAPI Backend Server
From the project directory:
```powershell
python -m uvicorn main:app --reload --port 8000
```
* The API will be available at: `http://127.0.0.1:8000`
* Interactive API Documentation (Swagger): `http://127.0.0.1:8000/docs`

### 3. Open the Dashboard
Open your browser and navigate to:
```
http://127.0.0.1:8000
```
*(The dashboard can also be run offline by double-clicking `index.html` directly).*

---

## 5. Automated Verification & Testing

The project includes four automated test suites validating backend logic, HTTP endpoints, database persistence, and client logic:

### Test 1: Python Backend Unit & State Machine Test
Tests priority math, recommendation engine, SQLite persistence, auto-pauses at stages 3 & 4, and metric computations:
```powershell
python test_backend.py
```
*Expected Output:*
```
[TEST 1] Testing Priority Score Formula & Categorization...
  [PASS] SIG: Score=225.0 [Critical]
  [PASS] PWR: Score=103.0 [Critical]
  [PASS] PMP: Score=49.44 [High]
  [PASS] TOK: Score=48.77 [High]
  [PASS] DSP: Score=1.01 [Low]
...
ALL TESTS PASSED WITH 100% SUCCESS! [OK]
```

### Test 2: Live End-to-End HTTP Integration Test
Launches the FastAPI server on localhost:8000 and tests API responses, static file serving, and SQLite persistence over HTTP:
```powershell
python test_http_integration.py
```
*Expected Output:*
```
  [PASS] GET /api/health -> 200 OK (Service healthy)
  [PASS] GET /api/lifelines -> 200 OK (5 assets received, 100% Care)
  [PASS] GET / -> 200 OK (Served index.html)
  [PASS] POST /api/simulation/start -> 200 OK
  [PASS] POST /api/simulation/next-stage -> Stage 3 PAUSED for operator confirmation
  [PASS] POST /api/simulation/operator-action -> 200 OK (Simulation unpaused)
  [PASS] GET /api/audit-logs -> 200 OK (Persistent SQLite records returned)
ALL E2E HTTP INTEGRATION TESTS PASSED WITH 100% SUCCESS! [OK]
```

### Test 3: Client-Side Logic & State Machine Tests
Validates offline JavaScript mathematical formulas and 5-stage simulation engine:
```powershell
node test_logic.js
node test_sim.js
```

---

## 6. REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Serves the single-page frontend application (`index.html`). |
| `GET` | `/api/health` | Service health check and metadata. |
| `GET` | `/api/lifelines` | Live operational state and care delivery of all 5 hospital lifelines. |
| `GET` | `/api/simulation/status` | Current stage, pause status, elapsed time, and real-time care continuity score. |
| `POST` | `/api/simulation/start` | Initializes a new simulation run in SQLite and launches Stage 1. |
| `POST` | `/api/simulation/next-stage` | Advances simulation stage (auto-pauses with HTTP 409 guard at Stages 3 & 4). |
| `POST` | `/api/simulation/pause` | Manually pauses simulation timer. |
| `POST` | `/api/simulation/resume` | Resumes paused simulation timer. |
| `POST` | `/api/simulation/reset` | Resets all lifelines to 100% baseline and resets simulation state. |
| `POST` | `/api/simulation/operator-action` | Submits human operator decision, applies fallback, updates SQLite, and unpauses. |
| `POST` | `/api/alerts/simulate` | Injects manual threat on any asset (e.g. `TOK` Patient Token Server). |
| `POST` | `/api/recovery/restore` | Cryptographically verifies config against clean Golden Master SHA-256 and restores 100% normal. |
| `GET` | `/api/audit-logs` | Retrieves chronological audit events from SQLite. |
| `GET` | `/api/audit-logs/export` | Generates full JSON audit report from SQLite database. |
| `GET` | `/api/simulation/report` | Computes jury resilience report (actual blackout seconds, minimum care continuity, operator sign-offs). |

---

## 7. Hackathon Jury Demonstration Script (5-Minute Walkthrough)

1. **Safety Banner & Philosophy**: Point out the top red banner (`SIMULATION ONLY: no real systems are connected`). Explain why shutting down a hospital to stop an attack kills patients, and introduce the philosophy of *Graceful Degradation*.
2. **Dashboard Overview**: Show the 5 lifelines, their criticality levels, population served, and initial 100% Care Continuity Score. Note the green indicator showing `FastAPI + SQLite Active`.
3. **Launch Simulation**: Click **"Start Attack"**:
   - **Stage 1 (DSP Display)**: Show how low-priority brute force ($1.01$) is filtered at the perimeter without disturbing patients.
   - **Stage 2 (PMP Water Pump)**: Corrupt telemetry ($49.44$) transitions pump to safe manual valve control ($80\%$ care kept).
   - **Stage 3 Automatic Pause (SIG Route Signal)**: Emphasize the auto-pause on Critical threat ($225.0$). Explain to the jury why total shutdown halts ambulances, and click **"Confirm Safe Fallback"** ($60\%$ care kept, traffic police playbook active).
   - **Stage 4 Automatic Pause (PWR ICU Power)**: Show the lethal threat ($103.0$) attempting to disable backup generators. Confirm safe fallback ($85\%$ care kept, on-duty engineer standing by).
   - **Stage 5 Clean Recovery**: Watch all 5 lifelines restore from clean Golden Master SHA-256 hashes to 100% normal.
4. **Jury Report**: Show the summary modal demonstrating:
   - **0.0 Seconds Total Hospital Blackout**
   - **85.0% Minimum Care Continuity Maintained**
   - **43,800+ Citizens Protected**
   - **100% Human Operator Sign-Off**
5. **Database Audit Trail**: Click **"Export Audit Log"** to show real persistent SQLite event logs recorded during the demonstration.
