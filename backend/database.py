# SQLite database for tracking classification metrics
# Stores every classification result so GET /metrics can return live stats
# Interview answer: "I used SQLite because it requires no server setup —
# it's a single file on disk, perfect for a single-instance deployment.
# For multi-instance production I would switch to PostgreSQL"

import sqlite3
import os
from datetime import datetime

# ── Database file path ────────────────────────────────────────────────────────
# Stored inside backend/ folder — excluded from git via .gitignore
DB_PATH = os.path.join(os.path.dirname(__file__), "metrics.db")

def get_connection():
    """
    Create and return a SQLite connection.
    check_same_thread=False required for FastAPI — multiple async threads
    may access the same connection simultaneously
    """
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def init_db():
    """
    Create the classifications table if it doesn't exist.
    Called once when the FastAPI server starts.
    IF NOT EXISTS makes this safe to call on every restart.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS classifications (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_text         TEXT NOT NULL,
            category            TEXT NOT NULL,
            distilbert_pred     TEXT NOT NULL,
            confidence          REAL NOT NULL,
            routing_tier        TEXT NOT NULL,
            urgency             TEXT NOT NULL,
            correction_used     INTEGER NOT NULL,  -- 0 or 1, SQLite has no boolean
            created_at          TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()
    print("Database initialized.")

def log_classification(result: dict, ticket_text: str):
    """
    Insert one classification result into the database.
    Called after every POST /classify request.
    correction_used stored as 1/0 — SQLite doesn't have a boolean type.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO classifications (
            ticket_text, category, distilbert_pred, confidence,
            routing_tier, urgency, correction_used, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        ticket_text,
        result["category"],
        result["distilbert_prediction"],
        result["confidence"],
        result["routing_tier"],
        result["urgency"],
        1 if result["correction_used"] else 0,
        datetime.utcnow().isoformat()
    ))

    conn.commit()
    conn.close()

def get_metrics() -> dict:
    """
    Aggregate metrics from all classification records.
    Returns counts by routing tier, urgency, and correction usage.
    Called by GET /metrics endpoint.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Total classifications
    cursor.execute("SELECT COUNT(*) FROM classifications")
    total_classified = cursor.fetchone()[0]

    # Times a correction influenced the result
    cursor.execute(
        "SELECT COUNT(*) FROM classifications WHERE correction_used = 1"
    )
    corrections_influenced = cursor.fetchone()[0]

    # Routing tier breakdown
    cursor.execute("""
        SELECT routing_tier, COUNT(*)
        FROM classifications
        GROUP BY routing_tier
    """)
    routing_rows = cursor.fetchall()
    routing = {row[0]: row[1] for row in routing_rows}

    # Urgency breakdown
    cursor.execute("""
        SELECT urgency, COUNT(*)
        FROM classifications
        GROUP BY urgency
    """)
    urgency_rows = cursor.fetchall()
    urgency_dist = {row[0]: row[1] for row in urgency_rows}

    conn.close()

    return {
        "total_classified":      total_classified,
        "corrections_influenced": corrections_influenced,
        "auto_route_count":      routing.get("AUTO-ROUTE", 0),
        "human_review_count":    routing.get("HUMAN-REVIEW", 0),
        "escalate_count":        routing.get("ESCALATE", 0),
        "urgency_distribution":  urgency_dist
    }