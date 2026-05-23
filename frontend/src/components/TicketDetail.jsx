// TicketDetail — full view when operator clicks a ticket
// Shows explanation, all metadata, and correction submission form

import { useState } from 'react'
import { X, Send, AlertCircle } from 'lucide-react'
import api from '../api'

const LABEL_CLASSES = [
  "Billing and Payments",
  "Customer Service",
  "IT Support",
  "Product Support",
  "Returns and Exchanges",
  "Sales and Pre-Sales",
  "Service Outages and Maintenance",
  "Technical Support"
]

export default function TicketDetail({ ticket, onClose, onCorrectionSubmitted }) {
  const [selectedCorrection, setSelectedCorrection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const urgencyColors = {
    CRITICAL: 'bg-red-500/20 text-red-400 border border-red-500/30',
    HIGH:     'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    MEDIUM:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    LOW:      'bg-green-500/20 text-green-400 border border-green-500/30',
  }

  const routingColors = {
    'AUTO-ROUTE':   'bg-green-500/20 text-green-400 border border-green-500/30',
    'HUMAN-REVIEW': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    'ESCALATE':     'bg-red-500/20 text-red-400 border border-red-500/30',
  }

  async function handleSubmitCorrection() {
    if (!selectedCorrection) {
      setError('Please select the correct category')
      return
    }
    if (selectedCorrection === ticket.distilbert_prediction && !ticket.correction_used) {
        setError('Selected category is the same as the model prediction — no correction needed')
        return
    }

    setSubmitting(true)
    setError('')

    try {
      await api.patch('/api/corrections', {
        ticket_text:      ticket.ticket_text,
        wrong_category:   ticket.distilbert_prediction,
        correct_category: selectedCorrection
      })
      setSubmitted(true)
      onCorrectionSubmitted()   // refresh metrics in parent
    } catch (err) {
      setError('Failed to submit correction. Is the API running?')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // Backdrop
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl
                      max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">Ticket Detail</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-semibold text-indigo-400 bg-indigo-500/10
                             border border-indigo-500/20 px-3 py-1 rounded-lg">
              {ticket.category}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${urgencyColors[ticket.urgency]}`}>
              {ticket.urgency}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${routingColors[ticket.routing_tier]}`}>
              {ticket.routing_tier}
            </span>
            {ticket.correction_used && (
              <span className="text-xs px-3 py-1 rounded-full font-medium
                               bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Correction Applied
              </span>
            )}
          </div>

          {/* Confidence bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Model Confidence</span>
              <span className="text-xs text-slate-300 font-mono">
                {(ticket.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-indigo-500 transition-all"
                style={{ width: `${ticket.confidence * 100}%` }}
              />
            </div>
          </div>

          {/* Ticket text */}
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
              Ticket Text
            </p>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-300
                            leading-relaxed max-h-40 overflow-y-auto">
              {ticket.ticket_text}
            </div>
          </div>

          {/* GPT Explanation */}
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
              AI Explanation
            </p>
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl
                            p-4 text-sm text-slate-300 leading-relaxed">
              {ticket.explanation}
            </div>
          </div>

          {/* DistilBERT raw prediction */}
          {ticket.distilbert_prediction !== ticket.category && (
            <div className="flex items-start gap-2 bg-yellow-500/5 border
                            border-yellow-500/20 rounded-xl p-3">
              <AlertCircle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-300">
                DistilBERT originally predicted{' '}
                <span className="font-semibold">{ticket.distilbert_prediction}</span>
                {' '}— overridden by past correction
              </p>
            </div>
          )}

          {/* Correction form */}
          <div className="border-t border-slate-800 pt-5">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide">
              Operator Correction
            </p>

            {submitted ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl
                              p-4 text-sm text-green-400 text-center">
                ✓ Correction stored — future similar tickets will use this
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selectedCorrection}
                  onChange={(e) => setSelectedCorrection(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg
                             px-3 py-2.5 text-sm text-slate-300 focus:outline-none
                             focus:border-indigo-500 transition-colors"
                >
                  <option value="">Select correct category...</option>
                  {LABEL_CLASSES.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>

                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}

                <button
                  onClick={handleSubmitCorrection}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600
                             hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500
                             text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  <Send size={14} />
                  {submitting ? 'Submitting...' : 'Submit Correction'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}