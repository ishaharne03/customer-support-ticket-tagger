# Pydantic models define the shape of every request and response in the API
# FastAPI uses these for automatic validation and documentation
# If a request is missing a required field, FastAPI returns a 422 error automatically
# Interview answer: "Pydantic schemas act as a contract between frontend and backend —
# they validate input before it reaches business logic"

from pydantic import BaseModel
from typing import Optional

# ── Request schemas (what the API receives) ───────────────────────────────────

class ClassifyRequest(BaseModel):
    """POST /classify — incoming ticket text"""
    ticket_text: str                    # required — the raw ticket content

class CorrectionRequest(BaseModel):
    """PATCH /corrections — operator submitting a correction"""
    ticket_text: str                    # the ticket that was misclassified
    wrong_category: str                 # what the model predicted
    correct_category: str               # what the operator says it should be

# ── Response schemas (what the API returns) ───────────────────────────────────

class ClassifyResponse(BaseModel):
    """Response from POST /classify"""
    category: str                       # predicted ticket category
    distilbert_prediction: str          # raw DistilBERT prediction before correction
    confidence: float                   # model confidence score (0.0 – 1.0)
    routing_tier: str                   # AUTO-ROUTE / HUMAN-REVIEW / ESCALATE
    urgency: str                        # LOW / MEDIUM / HIGH / CRITICAL
    explanation: str                    # GPT-generated one-sentence explanation
    correction_used: bool               # whether a past correction influenced result

class CorrectionResponse(BaseModel):
    """Response from PATCH /corrections"""
    status: str                         # "stored" on success
    message: str                        # human-readable confirmation

class MetricsResponse(BaseModel):
    """Response from GET /metrics"""
    total_classified: int               # total tickets classified since startup
    total_corrections: int              # total operator corrections stored
    corrections_influenced: int         # times a correction changed the prediction
    auto_route_count: int               # tickets that went to AUTO-ROUTE
    human_review_count: int             # tickets that went to HUMAN-REVIEW
    escalate_count: int                 # tickets that went to ESCALATE
    urgency_distribution: dict          # breakdown by urgency level