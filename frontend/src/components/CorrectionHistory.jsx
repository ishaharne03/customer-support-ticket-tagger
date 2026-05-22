// CorrectionHistory — shows all past corrections stored in Qdrant
// Demonstrates the feedback loop visually — operators can see what the system learned
// Data comes from GET /metrics which returns total_corrections count
// Individual corrections fetched from new GET /corrections endpoint we'll add

import { useState, useEffect } from 'react'
import { History, RefreshCw, Loader2, ArrowRight } from 'lucide-react'
import axios from 'axios'

export default function CorrectionHistory() {
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  async function fetchCorrections() {
    setLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/corrections')
      setCorrections(response.data.corrections)
    } catch (err) {
      setError('Failed to load corrections. Is the API running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCorrections() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
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

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Correction History</h1>
          <p className="text-sm text-slate-400 mt-1">
            Past operator corrections stored in Qdrant vector DB
          </p>
        </div>
        <button
          onClick={fetchCorrections}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100
                     bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg
                     text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-6">
        <p className="text-xs text-indigo-300 leading-relaxed">
          Each correction is stored as a vector embedding in Qdrant.
          When a new ticket arrives, the system retrieves similar past corrections
          and uses them to adjust the prediction — without retraining the model.
        </p>
      </div>

      {/* Corrections list */}
      {corrections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center
                          justify-center mb-4">
            <History size={20} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No corrections stored yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Classify a ticket and submit an operator correction to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">
            {corrections.length} correction{corrections.length !== 1 ? 's' : ''} stored
          </p>
          {corrections.map((correction, i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4"
            >
              {/* Wrong → Correct */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium
                                 bg-red-500/10 text-red-400 border border-red-500/20">
                  {correction.wrong_category}
                </span>
                <ArrowRight size={14} className="text-slate-500 flex-shrink-0" />
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium
                                 bg-green-500/10 text-green-400 border border-green-500/20">
                  {correction.correct_category}
                </span>
              </div>

              {/* Ticket text preview */}
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {correction.ticket_text}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3
                              border-t border-slate-800">
                <span className="text-xs text-slate-600">
                  Stored in Qdrant · cosine similarity retrieval
                </span>
                <span className="text-xs text-indigo-400">
                  #{i + 1}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}