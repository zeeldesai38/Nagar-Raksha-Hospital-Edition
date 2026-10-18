"""
Nagar-Raksha: Hospital Edition - Database Layer (SQLite)
Cyber Samvad Hackathon 2026 - Problem Statement 4: Critical Infrastructure Cybersecurity

Provides persistent storage for:
- Incidents (simulated threats, priority scores, labels)
- Operator Actions (containment decisions, sign-offs, care impact)
- Audit Logs (chronological, immutable event trail)
- Simulation Runs (start/stop times, actual calculated downtime, care minimums)
"""

import sqlite3
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path(__file__).parent / "nagar_raksha.db"

def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: Path = DB_PATH):
    """Initializes tables with proper schemas and indexes."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        
        # Incidents Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                stage INTEGER DEFAULT 0,
                asset_id TEXT NOT NULL,
                asset_name TEXT NOT NULL,
                threat TEXT NOT NULL,
                severity INTEGER NOT NULL,
                criticality INTEGER NOT NULL,
                urgency INTEGER NOT NULL,
                dependent_population INTEGER NOT NULL,
                priority_score REAL NOT NULL,
                priority_label TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'DETECTED'
            )
        """)

        # Operator Actions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operator_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id INTEGER,
                asset_id TEXT NOT NULL,
                action_taken TEXT NOT NULL,
                care_kept INTEGER NOT NULL,
                stops_threat TEXT NOT NULL,
                operator_notes TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents(id)
            )
        """)

        # Audit Logs Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                asset_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                description TEXT NOT NULL,
                priority_score REAL NOT NULL,
                care_continuity_after REAL NOT NULL
            )
        """)

        # Simulation Runs Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                status TEXT NOT NULL,
                min_care_continuity REAL DEFAULT 100.0,
                total_downtime_seconds REAL DEFAULT 0.0,
                summary TEXT
            )
        """)

        conn.commit()

def record_incident(
    asset_id: str,
    asset_name: str,
    threat: str,
    severity: int,
    criticality: int,
    urgency: int,
    dependent_population: int,
    priority_score: float,
    priority_label: str,
    stage: int = 0,
    status: str = "DETECTED",
    db_path: Path = DB_PATH
) -> int:
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO incidents (
                timestamp, stage, asset_id, asset_name, threat, severity, criticality,
                urgency, dependent_population, priority_score, priority_label, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            timestamp, stage, asset_id, asset_name, threat, severity, criticality,
            urgency, dependent_population, priority_score, priority_label, status
        ))
        conn.commit()
        return cursor.lastrowid

def update_incident_status(incident_id: int, status: str, db_path: Path = DB_PATH):
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE incidents SET status = ? WHERE id = ?", (status, incident_id))
        conn.commit()

def record_operator_action(
    asset_id: str,
    action_taken: str,
    care_kept: int,
    stops_threat: str,
    operator_notes: str = "",
    incident_id: Optional[int] = None,
    db_path: Path = DB_PATH
) -> int:
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO operator_actions (
                incident_id, asset_id, action_taken, care_kept, stops_threat, operator_notes, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            incident_id, asset_id, action_taken, care_kept, stops_threat, operator_notes, timestamp
        ))
        conn.commit()
        return cursor.lastrowid

def record_audit_log(
    asset_id: str,
    event_type: str,
    description: str,
    priority_score: float,
    care_continuity_after: float,
    db_path: Path = DB_PATH
) -> int:
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO audit_logs (
                timestamp, asset_id, event_type, description, priority_score, care_continuity_after
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            timestamp, asset_id, event_type, description, priority_score, care_continuity_after
        ))
        conn.commit()
        return cursor.lastrowid

def get_audit_logs(limit: int = 100, db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, timestamp, asset_id, event_type, description, priority_score, care_continuity_after
            FROM audit_logs
            ORDER BY id DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def clear_simulation_history(db_path: Path = DB_PATH):
    """Resets audit and active incident history for fresh simulation runs."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM incidents")
        cursor.execute("DELETE FROM operator_actions")
        cursor.execute("DELETE FROM audit_logs")
        conn.commit()

def start_simulation_run(db_path: Path = DB_PATH) -> int:
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO simulation_runs (started_at, status, min_care_continuity, total_downtime_seconds)
            VALUES (?, 'RUNNING', 100.0, 0.0)
        """, (timestamp,))
        conn.commit()
        return cursor.lastrowid

def update_simulation_run(
    run_id: int,
    status: str,
    min_care: float,
    downtime_sec: float,
    summary: str = "",
    db_path: Path = DB_PATH
):
    completed_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S") if status in ("COMPLETED", "RESET") else None
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE simulation_runs
            SET status = ?, min_care_continuity = ?, total_downtime_seconds = ?, summary = ?, completed_at = COALESCE(?, completed_at)
            WHERE id = ?
        """, (status, min_care, downtime_sec, summary, completed_at, run_id))
        conn.commit()

# Self-initialize schema upon import
init_db()
