"""
Nagar-Raksha: Hospital Edition - End-to-End HTTP Server Integration Test
Tests the live FastAPI server over localhost:8000 using standard urllib.request
"""

import sys
import time
import json
import threading
import urllib.request
import urllib.error
import uvicorn
import main

# Ensure UTF-8 console output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def run_server():
    config = uvicorn.Config(main.app, host="127.0.0.1", port=8000, log_level="warning")
    server = uvicorn.Server(config)
    server.run()

def test_http():
    print("=" * 60)
    print("STARTING E2E HTTP INTEGRATION TEST ON LOCALHOST:8000")
    print("=" * 60)

    # Start server in background thread
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(2.0)  # Wait for server to bind

    base = "http://127.0.0.1:8000"

    # 1. Health check
    req = urllib.request.Request(f"{base}/api/health")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["status"] == "healthy"
        print("  [PASS] GET /api/health -> 200 OK (Service healthy)")

    # 2. Get Lifelines
    req = urllib.request.Request(f"{base}/api/lifelines")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert len(data["assets"]) == 5
        assert data["care_continuity_score"] == 100.0
        print("  [PASS] GET /api/lifelines -> 200 OK (5 assets received, 100% Care)")

    # 3. Serve Frontend HTML directly
    req = urllib.request.Request(f"{base}/")
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode("utf-8")
        assert "<title>Nagar-Raksha: Hospital Edition" in html
        assert "SIMULATION ONLY: no real systems are connected" in html
        print(f"  [PASS] GET / -> 200 OK (Served index.html: {len(html)} bytes)")

    # 4. Start Simulation via HTTP POST
    req = urllib.request.Request(f"{base}/api/simulation/start", method="POST", data=b"{}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["stage"] == 1
        print("  [PASS] POST /api/simulation/start -> 200 OK (Simulation started at Stage 1)")

    # 5. Advance to Stage 2 via HTTP POST
    req = urllib.request.Request(f"{base}/api/simulation/next-stage", method="POST", data=b"{}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["stage"] == 2
        print(f"  [PASS] POST /api/simulation/next-stage -> 200 OK (Stage 2 active, Care: {data['care_continuity_score']}%)")

    # 6. Advance to Stage 3 (Must pause automatically for operator)
    req = urllib.request.Request(f"{base}/api/simulation/next-stage", method="POST", data=b"{}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["stage"] == 3
        assert data["is_paused_for_operator"] is True
        print("  [PASS] POST /api/simulation/next-stage -> Stage 3 PAUSED for operator confirmation")

    # 7. Operator Action via HTTP POST
    action_payload = json.dumps({
        "asset_id": "SIG",
        "action": "fallback",
        "operator_notes": "Corridor traffic officers deployed"
    }).encode("utf-8")
    req = urllib.request.Request(f"{base}/api/simulation/operator-action", method="POST", data=action_payload)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["status"] == "success"
        assert data["simulation_status"] == "RUNNING"
        print(f"  [PASS] POST /api/simulation/operator-action -> 200 OK (SIG Fallback confirmed, Simulation unpaused)")

    # 8. Query Audit Logs from SQLite via HTTP GET
    req = urllib.request.Request(f"{base}/api/audit-logs")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert len(data["logs"]) >= 1
        print(f"  [PASS] GET /api/audit-logs -> 200 OK ({len(data['logs'])} persistent SQLite records returned)")

    # 9. Query Final Report via HTTP GET
    req = urllib.request.Request(f"{base}/api/simulation/report")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert "minimum_care_continuity_maintained" in data
        assert "total_hospital_blackout_seconds" in data
        print(f"  [PASS] GET /api/simulation/report -> 200 OK (Downtime: {data['total_hospital_blackout_seconds']}s, Min Care: {data['minimum_care_continuity_maintained']})")

    # 10. Reset System
    req = urllib.request.Request(f"{base}/api/simulation/reset", method="POST", data=b"{}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["status"] == "IDLE"
        print("  [PASS] POST /api/simulation/reset -> 200 OK (System reset to 100%)")

    print("\n" + "=" * 60)
    print("ALL E2E HTTP INTEGRATION TESTS PASSED WITH 100% SUCCESS! [OK]")
    print("=" * 60)

if __name__ == "__main__":
    test_http()
    sys.exit(0)
