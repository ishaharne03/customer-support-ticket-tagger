# Customer Support Ticket Tagger

> Production-grade NLP system — fine-tuned DistilBERT + GPT-4o-mini + RAG feedback loop + React operator dashboard

**Live Demo:** `http://44.213.120.49:8000`

---

## What This Is

A full-stack AI system that automatically classifies customer support tickets, scores urgency, generates natural language explanations, and improves over time through operator corrections — without retraining the model.

Built as a portfolio project to demonstrate end-to-end ML engineering: from fine-tuning a transformer model to deploying a production API on AWS EC2.

---

## Architecture

```
Incoming Ticket
       │
       ├──▶ Qdrant Vector DB
       │        └── Retrieve similar past corrections (cosine similarity > 0.85)
       │                    │
       ├──▶ DistilBERT ─────┴──▶ Category + Confidence Score
       │        │
       │        ├── Correction context exists?
       │        │       YES → GPT-4o-mini adjusts prediction
       │        │       NO  → Use DistilBERT prediction directly
       │        │
       ├──▶ Routing Tier (data-driven percentile thresholds)
       │        ├── AUTO-ROUTE   (confidence > 30.1%)
       │        ├── HUMAN-REVIEW (confidence 23.6% – 30.1%)
       │        └── ESCALATE     (confidence < 23.6%)
       │
       ├──▶ GPT-4o-mini → One-sentence post-hoc explanation
       │
       └──▶ GPT-4o-mini → Urgency score (Low / Medium / High / Critical)
```

---

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Data preparation, DistilBERT fine-tuning, evaluation metrics | ✅ Complete |
| 2 | ConfidenceIQ — routing tiers + GPT-4o-mini explanations | ✅ Complete |
| 3 | Two-stage urgency scoring with GPT-4o-mini | ✅ Complete |
| 4 | FeedbackLoop — RAG-based correction retrieval via Qdrant | ✅ Complete |
| 5 | FastAPI backend — classify, corrections, metrics endpoints | ✅ Complete |
| 6 | React + Tailwind operator dashboard | ✅ Complete |
| 7 | Docker + AWS EC2 deployment | ✅ Complete |

---

## Model Performance

| Metric | Value |
|--------|-------|
| Dataset | 334 tickets, 8 classes |
| Accuracy | 46% |
| Macro F1 | 0.41 |
| Class weighting | Inverse-frequency |
| Best class | Billing and Payments (F1: 1.00) |

**Honest note:** Low F1 on minority classes (10 samples each) is expected and intentional — this is a production-realistic dataset with severe class imbalance. The routing tier and RAG correction layer exist specifically to compensate for model uncertainty.

---

## Key Design Decisions

**Why DistilBERT over DeBERTa-v3?**
DeBERTa-v3-base has 184M parameters — too large to converge on 334 training samples. DistilBERT (66M parameters) is right-sized for small datasets. Model selection must match dataset scale.

**Why two separate models for category and urgency?**
Multi-task learning would require redesigning the training pipeline. Two focused models are more debuggable and independently swappable. Urgency requires reasoning about business impact — GPT handles this better than a classifier on sparse data.

**Why RAG instead of retraining?**
The model never retrains. When an operator corrects a prediction, the correction is stored as a vector embedding in Qdrant. Future similar tickets retrieve this correction at inference time. The system adapts via retrieval — not weight updates.

**Why percentile-based routing thresholds?**
Phase 1 evaluation revealed all confidence scores clustered between 0.20–0.52. Standard thresholds (85%/60%) would route 100% of tickets to ESCALATE. Data-driven percentile thresholds (75th/40th percentile) produce a meaningful routing distribution.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Classifier | DistilBERT (fine-tuned, HuggingFace) |
| Explainability | GPT-4o-mini (post-hoc explanations) |
| Urgency Scoring | GPT-4o-mini (separate pipeline) |
| Vector DB | Qdrant + SentenceTransformers (all-MiniLM-L6-v2) |
| Backend | FastAPI + SQLite |
| Frontend | React 18 + Tailwind CSS + Vite |
| Deployment | Docker + AWS EC2 t2.micro |

---

## API Endpoints

```
POST   /api/classify      — classify a ticket (category + urgency + explanation + routing)
PATCH  /api/corrections   — store an operator correction in Qdrant
GET    /api/corrections   — retrieve all past corrections
GET    /api/metrics       — live classification stats from SQLite
GET    /api/health        — health check
```

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker Desktop

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### Docker (full stack)
```bash
cd frontend && npm run build && cd ..
docker build -t ticket-tagger .
docker run -p 8000:8000 -e OPENAI_API_KEY=sk-your-key ticket-tagger
# Full app at http://localhost:8000
```

---

## Dataset

[Kaggle — Customer Support Ticket Tagging](https://www.kaggle.com/datasets/warcoder/customer-support-ticket-tagging)

334 tickets across 8 categories after dropping classes with fewer than 10 samples.
Classes dropped: General Inquiry (2 samples), Human Resources (2 samples).

---

## Project Structure

```
customer-support-ticket-tagger/
├── backend/
│   ├── models/ticket-classifier/   # Fine-tuned DistilBERT weights
│   ├── main.py                     # FastAPI routes
│   ├── classifier.py               # DistilBERT inference + GPT calls
│   ├── vector_store.py             # Qdrant operations
│   ├── database.py                 # SQLite metrics logging
│   ├── schemas.py                  # Pydantic request/response models
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── TicketQueue.jsx     # Main classify interface
│       │   ├── TicketCard.jsx      # Queue item component
│       │   ├── TicketDetail.jsx    # Full ticket view + correction form
│       │   ├── MetricsPanel.jsx    # Live stats dashboard
│       │   └── CorrectionHistory.jsx # Past corrections from Qdrant
│       └── api.js                  # Axios base config
├── Customer_Support_Ticket_Tagger.ipynb  # Training notebook (Phases 1-4)
├── Dockerfile                      # Multi-stage build
├── railway.json                    # Railway deployment config
└── README.md
```

---

