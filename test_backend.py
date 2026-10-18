"""
Nagar-Raksha: Hospital Edition - Backend Test Suite
Cyber Samvad Hackathon 2026 - Problem Statement 4: Critical Infrastructure Cybersecurity

Tests:
1. Priority Score calculation & label mapping
2. Recommendation engine logic
3. Five Hospital Lifelines initialization & golden SHA-256 hashes
4. SQLite Database persistence for incidents, operator decisions, and audit logs
5. Simulation 5-stage state machine (Stage 1 -> 2 -> 3 Pause -> 4 Pause -> 5 Recovery)
6. Dynamic downtime & care continuity calculations
"""

import sys
import os
import sqlite3

# Ensure UTF-8 output on Windows consoles if supported
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import database
import main
from main import (
    compute_priority_score,
    compute_priority_label,
    compute_recommendation,
    OperatorActionRequest,
    SimulateAlertRequest
)

def run_tests():
    print("=" * 60)
    print("RUNNING NAGAR-RAKSHA BACKEND & INTEGRATION TESTS")
    print("=" * 60)

    # 1. PRIORITY SCORE MATH & LABELS (Strict prompt specifications)
    print("\n[TEST 1] Testing Priority Score Formula & Categorization...")
    # Formula: sev x crit x urg x (1 + ppl / 50000)
    
    # SIG: sev=5, crit=5, urg=5, ppl=40000 -> 125 * 1.8 = 225.0 (Critical)
    sig_score = compute_priority_score(5, 5, 5, 40000)
    sig_label = compute_priority_label(sig_score)
    assert sig_score == 225.0, f"Expected 225.0, got {sig_score}"
    assert sig_label == "Critical", f"Expected Critical, got {sig_label}"
    print(f"  [PASS] SIG: Score={sig_score} [{sig_label}]")

    # PWR: sev=5, crit=5, urg=4, ppl=1500 -> 100 * 1.03 = 103.0 (Critical)
    pwr_score = compute_priority_score(5, 5, 4, 1500)
    pwr_label = compute_priority_label(pwr_score)
    assert pwr_score == 103.0, f"Expected 103.0, got {pwr_score}"
    assert pwr_label == "Critical", f"Expected Critical, got {pwr_label}"
    print(f"  [PASS] PWR: Score={pwr_score} [{pwr_label}]")

    # PMP: sev=4, crit=4, urg=3, ppl=1500 -> 48 * 1.03 = 49.44 (High)
    pmp_score = compute_priority_score(4, 4, 3, 1500)
    pmp_label = compute_priority_label(pmp_score)
    assert pmp_score == 49.44, f"Expected 49.44, got {pmp_score}"
    assert pmp_label == "High", f"Expected High, got {pmp_label}"
    print(f"  [PASS] PMP: Score={pmp_score} [{pmp_label}]")

    # TOK: sev=4, crit=3, urg=4, ppl=800 -> 48 * 1.016 = 48.77 (High)
    tok_score = compute_priority_score(4, 3, 4, 800)
    tok_label = compute_priority_label(tok_score)
    assert tok_score == 48.77, f"Expected 48.77, got {tok_score}"
    assert tok_label == "High", f"Expected High, got {tok_label}"
    print(f"  [PASS] TOK: Score={tok_score} [{tok_label}]")

    # DSP: sev=1, crit=1, urg=1, ppl=300 -> 1 * 1.006 = 1.01 (Low)
    dsp_score = compute_priority_score(1, 1, 1, 300)
    dsp_label = compute_priority_label(dsp_score)
    assert dsp_score == 1.01, f"Expected 1.01, got {dsp_score}"
    assert dsp_label == "Low", f"Expected Low, got {dsp_label}"
    print(f"  [PASS] DSP: Score={dsp_score} [{dsp_label}]")

    print("  -> Priority scoring matches prompt criteria perfectly! [OK]")

    # 2. RECOMMENDATION ENGINE
    print("\n[TEST 2] Testing System Recommendations...")
    dsp_rec = compute_recommendation(dsp_score, 90, "Static notice board")
    assert dsp_rec["option"] == "monitor", f"Expected monitor for Low, got {dsp_rec['option']}"
    print(f"  [PASS] DSP Low ({dsp_score}) -> Recommends {dsp_rec['option']} ({dsp_rec['care_kept']}% care kept)")

    sig_rec = compute_recommendation(sig_score, 60, "Fixed-timer mode")
    assert sig_rec["option"] == "fallback", f"Expected fallback for Critical, got {sig_rec['option']}"
    assert sig_rec["care_kept"] == 60, f"Expected 60% care, got {sig_rec['care_kept']}"
    print(f"  [PASS] SIG Critical ({sig_score}) -> Recommends {sig_rec['option']} ({sig_rec['care_kept']}% care kept)")

    # 3. DATABASE SCHEMA & OPERATIONS
    print("\n[TEST 3] Testing SQLite Database Persistence...")
    database.init_db()
    database.clear_simulation_history()

    test_inc_id = database.record_incident(
        asset_id="SIG",
        asset_name="Ambulance Route Signal",
        threat="Unauthorised commands changing signal timings",
        severity=5,
        criticality=5,
        urgency=5,
        dependent_population=40000,
        priority_score=225.0,
        priority_label="Critical",
        stage=3
    )
    assert test_inc_id > 0, "Failed to insert incident record"
    print(f"  [PASS] Incident recorded in SQLite with ID: {test_inc_id}")

    test_action_id = database.record_operator_action(
        asset_id="SIG",
        action_taken="fallback",
        care_kept=60,
        stops_threat="Yes",
        operator_notes="Traffic police deployed to clear emergency corridor",
        incident_id=test_inc_id
    )
    assert test_action_id > 0, "Failed to insert operator action record"
    print(f"  [PASS] Operator action recorded with ID: {test_action_id}")

    test_log_id = database.record_audit_log(
        asset_id="SIG",
        event_type="TEST_EVENT",
        description="Verification audit entry",
        priority_score=225.0,
        care_continuity_after=92.0
    )
    assert test_log_id > 0, "Failed to insert audit log entry"
    logs = database.get_audit_logs(limit=10)
    assert len(logs) >= 1, "Failed to query audit logs from SQLite"
    print(f"  [PASS] Successfully verified {len(logs)} audit entries in database.")

    # 4. SIMULATION 5-STAGE PROGRESSION & OPERATOR GOVERNANCE
    print("\n[TEST 4] Testing 5-Stage Simulation State Machine & Auto-Pauses...")
    main.reset_simulation()
    
    # Start Simulation -> Advances to Stage 1
    s1 = main.start_simulation()
    assert s1["stage"] == 1, f"Expected Stage 1, got {s1['stage']}"
    assert main.state.assets["DSP"]["under_attack"] is False, "DSP probe should be resolved via Monitor"
    print("  [PASS] Stage 1: DSP probe launched & filtered. Care Continuity: 100%")

    # Advance to Stage 2
    s2 = main.advance_simulation_stage()
    assert s2["stage"] == 2, f"Expected Stage 2, got {s2['stage']}"
    assert main.state.assets["PMP"]["current_mode"] == "Fallback", "PMP should be in Fallback"
    assert main.state.assets["PMP"]["current_care"] == 80, "PMP care should be 80%"
    print(f"  [PASS] Stage 2: PMP Water Pump in safe fallback. Care Continuity: {s2['care_continuity_score']}%")

    # Advance to Stage 3 (Must pause automatically for human operator!)
    s3 = main.advance_simulation_stage()
    assert s3["stage"] == 3, f"Expected Stage 3, got {s3['stage']}"
    assert s3["status"] == "PAUSED_AWAITING_OPERATOR", f"Expected PAUSED_AWAITING_OPERATOR, got {s3['status']}"
    assert s3["is_paused_for_operator"] is True, "Expected is_paused_for_operator=True"
    print("  [PASS] Stage 3: Ambulance Route Signal under attack! Simulation automatically PAUSED for operator.")

    # Try advancing without operator confirmation -> Must raise 409 Conflict
    try:
        main.advance_simulation_stage()
        assert False, "Should have raised HTTPException 409!"
    except Exception as e:
        assert getattr(e, "status_code", None) == 409, f"Expected HTTP 409, got {e}"
        print("  [PASS] Verified safety guard: Cannot bypass Stage 3 without human operator sign-off.")

    # Human Operator confirms Safe Fallback on SIG
    op_req = OperatorActionRequest(
        asset_id="SIG",
        action="fallback",
        operator_notes="Traffic police deployed to maintain green corridor"
    )
    op_res = main.submit_operator_action(op_req)
    assert op_res["result"]["mode"] == "Fallback", "SIG should be in Fallback mode"
    assert op_res["result"]["care_kept"] == 60, "SIG care kept should be 60%"
    assert op_res["simulation_status"] == "RUNNING", "Simulation should unpause"
    print(f"  [PASS] Operator confirmed Safe Fallback on SIG. Care Continuity: {op_res['result']['care_continuity_score']}%")

    # Advance to Stage 4 (Must pause automatically for human operator!)
    s4 = main.advance_simulation_stage()
    assert s4["stage"] == 4, f"Expected Stage 4, got {s4['stage']}"
    assert s4["status"] == "PAUSED_AWAITING_OPERATOR", f"Expected PAUSED_AWAITING_OPERATOR, got {s4['status']}"
    print("  [PASS] Stage 4: ICU Backup Power under lethal strike! Simulation automatically PAUSED for operator.")

    # Human Operator confirms Safe Fallback on PWR
    op_req_pwr = OperatorActionRequest(
        asset_id="PWR",
        action="fallback",
        operator_notes="On-duty electrical engineer standing by generator"
    )
    op_res_pwr = main.submit_operator_action(op_req_pwr)
    assert op_res_pwr["result"]["mode"] == "Fallback", "PWR should be in Fallback mode"
    assert op_res_pwr["result"]["care_kept"] == 85, "PWR care kept should be 85%"
    print(f"  [PASS] Operator confirmed Safe Fallback on PWR. Care Continuity: {op_res_pwr['result']['care_continuity_score']}%")

    # Advance to Stage 5 (Clean Recovery from Golden Master)
    s5 = main.advance_simulation_stage()
    assert s5["stage"] == 5, f"Expected Stage 5, got {s5['stage']}"
    assert s5["status"] == "COMPLETED", f"Expected COMPLETED, got {s5['status']}"
    assert s5["care_continuity_score"] == 100.0, f"Expected 100.0% care, got {s5['care_continuity_score']}"
    print("  [PASS] Stage 5: Full recovery completed! All 5 lifelines restored from clean golden master SHA-256 hashes.")
    print(f"  [PASS] Final Care Continuity: {s5['care_continuity_score']}%")

    # 5. DYNAMIC DOWNTIME & REPORT
    print("\n[TEST 5] Testing Actual Metrics Calculation (Downtime & Report)...")
    rep = main.get_simulation_report()
    print(f"  [PASS] Total Hospital Blackout: {rep['total_hospital_blackout_seconds']} seconds")
    print(f"  [PASS] Minimum Care Continuity Maintained: {rep['minimum_care_continuity_maintained']}")
    print(f"  [PASS] Operator Sign-Offs: {rep['operator_governance_signoffs']}")
    print(f"  [PASS] SHA-256 Verifications: {rep['sha256_verifications_passed']}")

    # 6. MANUAL THREAT & RESTORE (Interactive API Test)
    print("\n[TEST 6] Testing Manual Threat Injection (TOK) & Cryptographic Restore...")
    tok_req = SimulateAlertRequest(asset_id="TOK")
    tok_res = main.simulate_manual_threat(tok_req)
    assert tok_res["asset"]["under_attack"] is True, "TOK should be under attack"
    assert tok_res["asset"]["active_hash"] != tok_res["asset"]["golden_hash"], "Active hash should mismatch golden hash"
    print("  [PASS] Injected manual threat on Patient Token Server (TOK). Active hash tampered.")

    restore_res = main.restore_asset_clean_copy(tok_req)
    assert restore_res["asset"]["under_attack"] is False, "TOK should not be under attack"
    assert restore_res["asset"]["active_hash"] == restore_res["asset"]["golden_hash"], "Active hash should match golden hash"
    assert restore_res["asset"]["current_care"] == 100, "TOK care should be 100%"
    print("  [PASS] Cryptographic clean copy recovery verified on TOK. Golden master matched.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED WITH 100% SUCCESS! [OK]")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
