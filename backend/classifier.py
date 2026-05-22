# Loads DistilBERT model and runs the full classification pipeline
# This file is the core ML logic — kept separate from FastAPI routes
# Interview answer: "Separating ML logic from API routes follows the
# single responsibility principle — the classifier doesn't know about HTTP,
# the routes don't know about tensors"

import os
import json
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()   # loads OPENAI_API_KEY from backend/.env

# ── Constants ─────────────────────────────────────────────────────────────────
MODEL_PATH   = os.path.join(os.path.dirname(__file__), "models", "ticket-classifier")
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"
CLIENT       = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ── Label encoder classes — must match training order exactly ─────────────────
# These are the 8 classes after dropping rare categories in Phase 1
# Order must match what sklearn's LabelEncoder assigned during training
# LabelEncoder sorts alphabetically — so this list is alphabetically sorted
LABEL_CLASSES = [
    "Billing and Payments",
    "Customer Service",
    "IT Support",
    "Product Support",
    "Returns and Exchanges",
    "Sales and Pre-Sales",
    "Service Outages and Maintenance",
    "Technical Support"
]

# ── Routing thresholds from Phase 1 evaluation ───────────────────────────────
# Derived from percentile analysis of actual model confidence distribution
# Max confidence was ~0.52 — standard 85/60 thresholds don't apply
HIGH_CONF = 0.301   # top 25% percentile from Phase 1
LOW_CONF  = 0.236   # 40th percentile from Phase 1

# ── Load model and tokenizer once at startup ─────────────────────────────────
# Loading is expensive — we do it once when the server starts, not per request
# Interview answer: "Model loading takes 2-3 seconds — doing it per request
# would make the API unusably slow. Loading once at startup is standard practice"
print(f"Loading model from {MODEL_PATH}...")
print(f"Device: {DEVICE}")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model     = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model     = model.to(DEVICE)
model.eval()   # eval mode disables dropout — required for consistent inference

print("Model loaded successfully.")

# ── Routing logic ─────────────────────────────────────────────────────────────
def get_routing_tier(confidence: float) -> str:
    """
    Map confidence score to routing tier.
    Thresholds are data-driven from Phase 1 percentile analysis.
    """
    if confidence >= HIGH_CONF:
        return "AUTO-ROUTE"
    elif confidence >= LOW_CONF:
        return "HUMAN-REVIEW"
    else:
        return "ESCALATE"

# ── GPT explanation ───────────────────────────────────────────────────────────
def get_gpt_explanation(
    ticket_text: str,
    predicted_category: str,
    confidence: float,
    routing_tier: str
) -> str:
    """
    Post-hoc explanation from GPT-4o-mini.
    GPT explains the model's decision — it does NOT classify.
    temperature=0.3 keeps explanations factual and consistent.
    """
    prompt = f"""You are an AI assistant explaining customer support ticket classifications.

A ticket classifier predicted the category for the following ticket.
Write ONE sentence explaining why this ticket fits that category,
based only on what is written in the ticket text.

Ticket: {ticket_text[:500]}
Predicted Category: {predicted_category}
Model Confidence: {confidence:.1%}
Routing Decision: {routing_tier}

Write exactly one sentence starting with 'This ticket was classified as'."""

    response = CLIENT.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100,
        temperature=0.3
    )
    return response.choices[0].message.content.strip()

# ── GPT urgency scorer ────────────────────────────────────────────────────────
def get_urgency_score(ticket_text: str, predicted_category: str) -> str:
    """
    GPT-4o-mini assigns urgency level based on ticket content and category.
    max_tokens=10 — we only need one word, minimizes cost.
    Includes validation fallback in case GPT returns unexpected output.
    """
    prompt = f"""You are an expert customer support triage specialist.
Analyze this support ticket and assign an urgency level.

Ticket: {ticket_text[:500]}
Predicted Category: {predicted_category}

Urgency levels:
- CRITICAL: Business operations halted, data loss, security breach, entire system down
- HIGH: Significant disruption, multiple users affected, no workaround available
- MEDIUM: Single user affected, partial functionality, workaround exists
- LOW: General inquiry, minor inconvenience, cosmetic issue

Respond with ONLY one word: CRITICAL, HIGH, MEDIUM, or LOW."""

    response = CLIENT.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=10,
        temperature=0.1
    )
    urgency = response.choices[0].message.content.strip().upper()

    for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        if level in urgency:
            return level

    return "MEDIUM"   # safe default

# ── Main classification function ──────────────────────────────────────────────
def classify_ticket(ticket_text: str, correction_context: str = "") -> dict:
    """
    Full classification pipeline:
    1. DistilBERT → category + confidence + routing
    2. If correction context exists → GPT adjusts prediction
    3. GPT → explanation + urgency

    correction_context is passed in from vector_store.py when a
    similar past correction is found above the similarity threshold.
    """
    # Step 1 — DistilBERT inference
    inputs = tokenizer(
        ticket_text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True
    ).to(DEVICE)
    inputs.pop("token_type_ids", None)

    with torch.no_grad():
        outputs = model(**inputs)

    probs               = torch.softmax(outputs.logits, dim=-1).cpu().numpy()[0]
    predicted_idx       = int(np.argmax(probs))
    confidence          = float(np.max(probs))
    distilbert_category = LABEL_CLASSES[predicted_idx]
    routing_tier        = get_routing_tier(confidence)

    # Step 2 — If correction context provided, let GPT adjust
    correction_used = False
    if correction_context:
        correction_used = True
        prompt = f"""You are a customer support ticket classifier.
A classifier predicted: {distilbert_category}

However, similar tickets were previously corrected by human operators:
{correction_context}

Valid categories: {', '.join(LABEL_CLASSES)}
Ticket: {ticket_text[:400]}

Based on the past corrections, what is the correct category?
Respond with ONLY the category name, exactly as listed above."""

        response = CLIENT.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=20,
            temperature=0.1
        )
        final_category = response.choices[0].message.content.strip()

        # Validate — fall back to DistilBERT if GPT returns invalid category
        if final_category not in LABEL_CLASSES:
            final_category = distilbert_category
    else:
        final_category = distilbert_category

    # Step 3 — Explanation + urgency on final category
    explanation = get_gpt_explanation(
        ticket_text, final_category, confidence, routing_tier
    )
    urgency = get_urgency_score(ticket_text, final_category)

    return {
        "category":               final_category,
        "distilbert_prediction":  distilbert_category,
        "confidence":             round(confidence, 4),
        "routing_tier":           routing_tier,
        "urgency":                urgency,
        "explanation":            explanation,
        "correction_used":        correction_used
    }