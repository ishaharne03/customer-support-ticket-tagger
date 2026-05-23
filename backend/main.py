# ── backend/main.py ───────────────────────────────────────────────────────────
# FastAPI application — defines all API routes
# All API routes use /api prefix so static file mount doesn't conflict
# Static mount is last — catches everything not matched by API routes

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

from backend.schemas import ClassifyRequest, ClassifyResponse
from backend.schemas import CorrectionRequest, CorrectionResponse
from backend.schemas import MetricsResponse
from backend.classifier import classify_ticket
from backend.vector_store import (
    store_correction,
    retrieve_corrections,
    build_correction_context,
    get_correction_count,
    qdrant,
    COLLECTION_NAME
)
from backend.database import init_db, log_classification, get_metrics

# ── App initialization ────────────────────────────────────────────────────────
app = FastAPI(
    title="Customer Support Ticket Tagger API",
    description="DistilBERT + GPT-4o-mini ticket classification with RAG feedback loop",
    version="1.0.0"
)

# ── CORS middleware ───────────────────────────────────────────────────────────
# Required so browser-based clients can call the API
# allow_origins=["*"] is fine for portfolio — tighten in real production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup event ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    init_db()
    print("API ready.")

# ── API Router with /api prefix ───────────────────────────────────────────────
# All API routes live under /api so the static file mount at /
# doesn't intercept them
# Interview answer: "The /api prefix separates data endpoints from
# static file serving — a standard pattern for single-server SPAs"
router = APIRouter(prefix="/api")

# ── GET /api/health ───────────────────────────────────────────────────────────
@router.get("/health")
async def health():
    """Health check — confirms API is running"""
    return {"status": "ok", "message": "Ticket Tagger API is running"}

# ── POST /api/classify ────────────────────────────────────────────────────────
@router.post("/classify", response_model=ClassifyResponse)
async def classify(request: ClassifyRequest):
    """
    Main classification endpoint.
    1. Retrieve similar past corrections from Qdrant
    2. Build correction context string for GPT
    3. Run full classification pipeline
    4. Log result to SQLite
    5. Return structured response
    """
    if not request.ticket_text.strip():
        raise HTTPException(
            status_code=400,
            detail="ticket_text cannot be empty"
        )
    try:
        corrections    = retrieve_corrections(request.ticket_text)
        correction_ctx = build_correction_context(corrections)
        result         = classify_ticket(
            ticket_text=request.ticket_text,
            correction_context=correction_ctx
        )
        log_classification(result, request.ticket_text)
        return ClassifyResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── PATCH /api/corrections ────────────────────────────────────────────────────
@router.patch("/corrections", response_model=CorrectionResponse)
async def add_correction(request: CorrectionRequest):
    """
    Operator correction endpoint.
    Stores corrected ticket in Qdrant as a vector embedding.
    Future similar tickets will retrieve this correction before classifying.
    """
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

# ── GET /api/corrections ──────────────────────────────────────────────────────
@router.get("/corrections")
async def get_corrections():
    """
    Returns all corrections stored in Qdrant.
    Used by the frontend correction history panel.
    """
    try:
        if qdrant.get_collection(COLLECTION_NAME).points_count == 0:
            return {"corrections": []}

        results, _ = qdrant.scroll(
            collection_name=COLLECTION_NAME,
            limit=100,
            with_payload=True,
            with_vectors=False
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

# ── GET /api/metrics ──────────────────────────────────────────────────────────
@router.get("/metrics", response_model=MetricsResponse)
async def metrics():
    """
    Live metrics endpoint.
    Aggregates from SQLite and Qdrant.
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

# ── Register router ───────────────────────────────────────────────────────────
app.include_router(router)

# ── Serve React frontend ──────────────────────────────────────────────────────
# Must be LAST — StaticFiles catches everything not matched by API routes above
# In production FastAPI serves the built React files directly
# Interview answer: "For single-instance deployment, serving static files
# from FastAPI is simpler than adding Nginx. At scale I would use a CDN."
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")