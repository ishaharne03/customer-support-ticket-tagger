// ── frontend/src/api.js ───────────────────────────────────────────────────────
// Central API configuration
// In development: Vite proxies /api → http://127.0.0.1:8000
// In production: /api calls go directly to FastAPI on same server

import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

export default api