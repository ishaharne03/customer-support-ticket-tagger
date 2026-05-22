# FastAPI application — defines all API routes
# This file only handles HTTP — no ML logic lives here

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from vector_store import qdrant, COLLECTION_NAME
from schemas import ClassifyRequest, ClassifyResponse
from schemas import CorrectionRequest, CorrectionResponse
from schemas import MetricsResponse
from classifier import classify_ticket
from vector_store import (
    store_correction,
    retrieve_corrections,
    build_correction_context,
    get_correction_count
)
from database import init_db, log_classification, get_metrics

# ── App initialization ────────────────────────────────────────────────────────
app = FastAPI(
    title="Customer Support Ticket Tagger API",
    description="DistilBERT + GPT-4o-mini ticket classification with RAG feedback loop",
    version="1.0.0"
)

# ── CORS middleware ───────────────────────────────────────────────────────────
# Required so the React frontend (running on localhost:5173) can call this API
# (running on localhost:8000) — browsers block cross-origin requests by default
# Interview answer: "CORS must be explicitly enabled for browser-based clients —
# server-to-server calls don't need it, only browser requests do"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # tighten this to specific domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup event ─────────────────────────────────────────────────────────────
# Runs once when the server starts — initializes the SQLite database
# Model and embedder are loaded at module import time in classifier.py
# and vector_store.py — so they're ready before the first request
@app.on_event("startup")
async def startup_event():
    init_db()
    print("API ready.")

# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    """Basic health check — confirms API is running"""
    return {"status": "ok", "message": "Ticket Tagger API is running"}

# ── POST /classify ────────────────────────────────────────────────────────────
@app.post("/classify", response_model=ClassifyResponse)
async def classify(request: ClassifyRequest):
    """
    Main classification endpoint.
    1. Retrieve similar past corrections from Qdrant
    2. Build correction context string for GPT
    3. Run full classification pipeline
    4. Log result to SQLite
    5. Return structured response

    Interview answer: "The endpoint is stateless — all state lives in
    Qdrant and SQLite. Any request can be replayed independently."
    """
    # Validate input — empty ticket text is useless
    if not request.ticket_text.strip():
        raise HTTPException(
            status_code=400,
            detail="ticket_text cannot be empty"
        )

    try:
        # Step 1 — Check for similar past corrections
        corrections      = retrieve_corrections(request.ticket_text)
        correction_ctx   = build_correction_context(corrections)

        # Step 2 — Run full pipeline
        result = classify_ticket(
            ticket_text=request.ticket_text,
            correction_context=correction_ctx
        )

        # Step 3 — Log to SQLite for metrics tracking
        log_classification(result, request.ticket_text)

        # Step 4 — Return response
        return ClassifyResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── PATCH /corrections ────────────────────────────────────────────────────────
@app.patch("/corrections", response_model=CorrectionResponse)
async def add_correction(request: CorrectionRequest):
    """
    Operator correction endpoint.
    Stores the corrected ticket in Qdrant as a vector embedding.
    Future similar tickets will retrieve this correction before classifying.

    Interview answer: "PATCH is semantically correct here — we are
    partially updating the system's knowledge, not creating a new resource"
    """
    # Validate categories are not the same
    if request.wrong_category == request.correct_category:
        raise HTTPException(
            status_code=400,
            detail="wrong_category and correct_category cannot be the same"
        )

    try:
        point_id = store_correction(
            ticket_text=request.ticket_text,
            wrong_category=request.wrong_category,
            correct_category=request.correct_category
        )
        return CorrectionResponse(
            status="stored",
            message=f"Correction stored. ID: {point_id}"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── GET /corrections ──────────────────────────────────────────────────────────
@app.get("/corrections")
async def get_corrections():
    """
    Returns all corrections stored in Qdrant.
    Used by the frontend correction history panel.
    Scrolls through all points in the collection and returns payloads.
    """
    try:
        collection_info = qdrant.get_collection(COLLECTION_NAME)
        if collection_info.points_count == 0:
            return {"corrections": []}

        # scroll() retrieves all points without a query vector
        # limit=100 is enough for a portfolio project
        results, _ = qdrant.scroll(
            collection_name=COLLECTION_NAME,
            limit=100,
            with_payload=True,
            with_vectors=False    # we don't need vectors, just metadata
        )

        corrections = [
            {
                "ticket_text":      r.payload["ticket_text"],
                "wrong_category":   r.payload["wrong_category"],
                "correct_category": r.payload["correct_category"]
            }
            for r in results
        ]
        return {"corrections": corrections}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── GET /metrics ──────────────────────────────────────────────────────────────
@app.get("/metrics", response_model=MetricsResponse)
async def metrics():
    """
    Live metrics endpoint.
    Aggregates classification history from SQLite and correction
    count from Qdrant and returns combined stats.

    Interview answer: "Metrics are computed on the fly from the database —
    no separate metrics store needed at this scale"
    """
    try:
        db_metrics = get_metrics()
        return MetricsResponse(
            total_classified=db_metrics["total_classified"],
            total_corrections=get_correction_count(),
            corrections_influenced=db_metrics["corrections_influenced"],
            auto_route_count=db_metrics["auto_route_count"],
            human_review_count=db_metrics["human_review_count"],
            escalate_count=db_metrics["escalate_count"],
            urgency_distribution=db_metrics["urgency_distribution"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))