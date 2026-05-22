# Manages Qdrant vector database for storing and retrieving operator corrections
# Kept completely separate from classifier.py — vector store doesn't know about
# the ML model, classifier doesn't know about Qdrant

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
import uuid
import os

# ── Constants ─────────────────────────────────────────────────────────────────
COLLECTION_NAME  = "ticket_corrections"
SIMILARITY_THRESHOLD = 0.85   # minimum cosine similarity to use a correction
TOP_K            = 3          # retrieve top 3 most similar corrections

# ── Persistent file-based Qdrant ──────────────────────────────────────────────
# Unlike the notebook which used in-memory Qdrant (lost on restart),
# the API uses file-based storage so corrections persist across server restarts
# Interview answer: "In-memory is fine for prototyping but production needs
# persistence — I used Qdrant's local file storage for the API"
QDRANT_PATH = os.path.join(os.path.dirname(__file__), "qdrant_storage")

# ── Load embedding model once at startup ─────────────────────────────────────
print("Loading embedding model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
VECTOR_SIZE = embedder.get_embedding_dimension()
print(f"Embedder loaded. Vector size: {VECTOR_SIZE}")

# ── Initialize Qdrant client ──────────────────────────────────────────────────
qdrant = QdrantClient(path=QDRANT_PATH)

# Create collection if it doesn't exist yet
# This runs on every server start — safe because it checks first
existing = [c.name for c in qdrant.get_collections().collections]
if COLLECTION_NAME not in existing:
    qdrant.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=VECTOR_SIZE,
            distance=Distance.COSINE
        )
    )
    print(f"Collection '{COLLECTION_NAME}' created.")
else:
    count = qdrant.get_collection(COLLECTION_NAME).points_count
    print(f"Collection '{COLLECTION_NAME}' loaded. Existing corrections: {count}")


# ── Store a correction ────────────────────────────────────────────────────────
def store_correction(
    ticket_text: str,
    wrong_category: str,
    correct_category: str
) -> str:
    """
    Embed ticket text and store correction in Qdrant.
    Returns the UUID of the stored point for confirmation.
    uuid4 generates a unique ID — Qdrant requires unique IDs per point.
    """
    vector   = embedder.encode(ticket_text).tolist()
    point_id = str(uuid.uuid4())

    qdrant.upsert(
        collection_name=COLLECTION_NAME,
        points=[PointStruct(
            id=point_id,
            vector=vector,
            payload={
                "ticket_text":      ticket_text,
                "wrong_category":   wrong_category,
                "correct_category": correct_category
            }
        )]
    )
    return point_id


# ── Retrieve similar corrections ──────────────────────────────────────────────
def retrieve_corrections(ticket_text: str) -> list:
    """
    Search Qdrant for past corrections similar to the incoming ticket.
    Returns a list of correction dicts above the similarity threshold.
    Empty list if no corrections exist or none are similar enough.
    """
    # Skip search if collection is empty — avoids unnecessary embedding call
    if qdrant.get_collection(COLLECTION_NAME).points_count == 0:
        return []

    vector  = embedder.encode(ticket_text).tolist()
    results = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        limit=TOP_K,
        with_payload=True
    ).points

    # Filter by threshold and format for classifier.py
    relevant = [
        {
            "wrong_category":   r.payload["wrong_category"],
            "correct_category": r.payload["correct_category"],
            "similarity":       round(r.score, 3)
        }
        for r in results if r.score >= SIMILARITY_THRESHOLD
    ]
    return relevant


# ── Build correction context string for GPT ───────────────────────────────────
def build_correction_context(corrections: list) -> str:
    """
    Format retrieved corrections into a string for GPT prompt injection.
    Returns empty string if no corrections — classifier handles this case.
    """
    if not corrections:
        return ""

    return "\n".join([
        f"- Similar ticket was corrected from '{c['wrong_category']}' "
        f"to '{c['correct_category']}' (similarity: {c['similarity']})"
        for c in corrections
    ])


# ── Get total correction count ────────────────────────────────────────────────
def get_correction_count() -> int:
    """Returns total number of corrections stored — used by GET /metrics"""
    return qdrant.get_collection(COLLECTION_NAME).points_count