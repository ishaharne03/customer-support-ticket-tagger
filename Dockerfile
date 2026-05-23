# ── Dockerfile ────────────────────────────────────────────────────────────────
# Multi-stage build:
# Stage 1 — builds the React frontend into static files
# Stage 2 — runs FastAPI and serves the static files
# Interview answer: "Multi-stage builds keep the final image small —
# Node.js and build tools are discarded after the frontend is compiled"

# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy package files first — Docker caches this layer
# If package.json hasn't changed, npm install is skipped on rebuild
COPY frontend/package*.json ./
RUN npm install

# Copy source and build
COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/dist/

# ── Stage 2: FastAPI backend + serve frontend ─────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by transformers and sentence-transformers
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch FIRST and separately
# CPU-only version is ~500MB vs ~2.5GB for CUDA version
# t2.micro has 1GB RAM — CUDA libraries would never fit
# Interview answer: "I used CPU-only PyTorch on EC2 free tier to stay
# within the 1GB RAM limit — GPU inference is not needed for our model size"
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy and install remaining Python dependencies
# Copied before source code — cached unless requirements.txt changes
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code including model weights
COPY backend/ ./backend/

# Copy built React frontend into backend's static folder
# FastAPI serves these files directly — no separate web server needed
COPY --from=frontend-builder /app/frontend/dist ./backend/static/

# Expose port 8000
EXPOSE 8000

# PYTHONPATH tells Python that /app is the root
# so 'backend.main' resolves correctly
ENV PYTHONPATH=/app

# Railway and other platforms set PORT dynamically
# We read it from environment with 8000 as fallback
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}