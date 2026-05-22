// MetricsPanel — live metrics from GET /metrics
// Shows total classified, corrections, routing distribution, urgency breakdown

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import axios from 'axios'

export default function MetricsPanel() {
  const [metrics, setMetrics]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  async function fetchMetrics() {
    setLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/metrics')
      setMetrics(response.data)
    } catch (err) {
      setError('Failed to load metrics. Is the API running?')
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount
  useEffect(() => { fetchMetrics() }, [])

  // ── Stat card component ───────────────────────────────────────────────────
  function StatCard({ label, value, sublabel, color = 'indigo' }) {
    const colors = {
      indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      green:  'bg-green-500/10  border-green-500/20  text-green-400',
      yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
      red:    'bg-red-500/10    border-red-500/20    text-red-400',
    }
    return (
      <div className={`border rounded-xl p-4 ${colors[color]}`}>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium mt-1">{label}</p>
        {sublabel && (
          <p className="text-xs opacity-60 mt-0.5">{sublabel}</p>
        )}
      </div>
    )
  }

  // ── Bar for distribution charts ───────────────────────────────────────────
  function DistributionBar({ label, count, total, color }) {
    const pct = total > 0 ? (count / total) * 100 : 0
    const barColors = {
      green:  'bg-green-500',
      yellow: 'bg-yellow-500',
      red:    'bg-red-500',
      orange: 'bg-orange-500',
      indigo: 'bg-indigo-500',
      blue:   'bg-blue-500',
    }
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-300">{label}</span>
          <span className="text-sm text-slate-400 font-mono">
            {count} <span className="text-slate-600">({pct.toFixed(1)}%)</span>
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${barColors[color]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4
                        text-sm text-red-400 text-center">
          {error}
        </div>
      </div>
    )
  }

  const total = metrics.total_classified

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Live Metrics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated from all classifications this session
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100
                     bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg
                     text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Total Classified"
          value={metrics.total_classified}
          color="indigo"
        />
        <StatCard
          label="Corrections Stored"
          value={metrics.total_corrections}
          sublabel="in Qdrant vector DB"
          color="green"
        />
        <StatCard
          label="Corrections Influenced"
          value={metrics.corrections_influenced}
          sublabel="RAG overrides"
          color="yellow"
        />
        <StatCard
          label="Auto-Routed"
          value={metrics.auto_route_count}
          sublabel={total > 0 ? `${((metrics.auto_route_count/total)*100).toFixed(1)}% of tickets` : '—'}
          color="green"
        />
      </div>

      {/* Routing distribution */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
          Routing Distribution
        </h2>
        <div className="space-y-3">
          <DistributionBar
            label="Auto-Route"
            count={metrics.auto_route_count}
            total={total}
            color="green"
          />
          <DistributionBar
            label="Human Review"
            count={metrics.human_review_count}
            total={total}
            color="yellow"
          />
          <DistributionBar
            label="Escalate"
            count={metrics.escalate_count}
            total={total}
            color="red"
          />
        </div>
      </div>

      {/* Urgency distribution */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
          Urgency Distribution
        </h2>
        {Object.keys(metrics.urgency_distribution).length === 0 ? (
          <p className="text-sm text-slate-600">No data yet</p>
        ) : (
          <div className="space-y-3">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => {
              const colorMap = {
                CRITICAL: 'red',
                HIGH: 'orange',
                MEDIUM: 'yellow',
                LOW: 'green'
              }
              return (
                <DistributionBar
                  key={level}
                  label={level}
                  count={metrics.urgency_distribution[level] || 0}
                  total={total}
                  color={colorMap[level]}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}