// TicketQueue — main tickets view
// Operator pastes a ticket or uses sample tickets to classify
// Supports auto-refresh, filter by urgency/routing, sort by confidence
// Clicking a ticket opens TicketDetail for full view and correction

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Inbox, RefreshCw, SlidersHorizontal } from 'lucide-react'
import axios from 'axios'
import TicketCard from './TicketCard'
import TicketDetail from './TicketDetail'

// ── Sample tickets for one-click portfolio demo ───────────────────────────────
const SAMPLE_TICKETS = [
  {
    label: 'Billing dispute',
    text: 'Dear Billing Department, I have been charged twice for my monthly subscription this month. My account number is ACC-4892 and the duplicate charge of $49.99 appeared on my credit card statement on the 15th. I have already contacted my bank but they advised me to reach out to you first. Please refund the duplicate charge as soon as possible.'
  },
  {
    label: 'Network outage',
    text: 'Dear Support Team, We are experiencing a complete network outage affecting all our enterprise systems. Our Cisco router has stopped responding and we need immediate assistance to restore connectivity across all departments. This is critically impacting our operations.'
  },
  {
    label: 'Return request',
    text: 'Dear Customer Service, I would like to return my Dell XPS 13 laptop purchased last week. The display was malfunctioning right out of the box. My order number is ORD-7823. Please advise on how to proceed with the return and refund process.'
  },
  {
    label: 'Software crash',
    text: 'Dear Tech Support, My accounting software keeps crashing every time I try to export a PDF report. I have tried reinstalling the application twice but the issue persists. This is severely affecting my daily work. Please provide a solution urgently.'
  }
]

export default function TicketQueue() {
  const [ticketText, setTicketText]         = useState('')
  const [tickets, setTickets]               = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const [autoRefresh, setAutoRefresh]       = useState(false)
  const [showFilters, setShowFilters]       = useState(false)

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterUrgency, setFilterUrgency]   = useState('ALL')
  const [filterRouting, setFilterRouting]   = useState('ALL')
  const [sortBy, setSortBy]                 = useState('newest')

  const intervalRef = useRef(null)
  const autoRefreshIndex = useRef(0)

  // ── Auto-refresh effect ───────────────────────────────────────────────────
  // Cycles through sample tickets every 30 seconds when enabled
  // Simulates a live incoming ticket queue for demo purposes
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        const sample = SAMPLE_TICKETS[autoRefreshIndex.current % SAMPLE_TICKETS.length]
        autoRefreshIndex.current += 1
        handleClassifyText(sample.text)
      }, 30000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh])

  // ── Core classify function — accepts text directly ────────────────────────
  async function handleClassifyText(text) {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const response = await axios.post('/api/classify', {
        ticket_text: text
      })
      setTickets(prev => [{
        ...response.data,
        ticket_text: text,
        id: Date.now()
      }, ...prev])
    } catch (err) {
      setError('Classification failed. Make sure the API is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  // ── Classify from textarea ────────────────────────────────────────────────
  async function handleClassify() {
    if (!ticketText.trim()) {
      setError('Please enter ticket text')
      return
    }
    await handleClassifyText(ticketText)
    setTicketText('')
  }

  // Ctrl+Enter to submit
  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.ctrlKey) handleClassify()
  }

  // ── Filter and sort logic ─────────────────────────────────────────────────
  const filteredTickets = tickets
    .filter(t => filterUrgency === 'ALL' || t.urgency === filterUrgency)
    .filter(t => filterRouting === 'ALL' || t.routing_tier === filterRouting)
    .sort((a, b) => {
      if (sortBy === 'confidence_high') return b.confidence - a.confidence
      if (sortBy === 'confidence_low')  return a.confidence - b.confidence
      return 0   // 'newest' — already in insertion order
    })

  // ── Filter button component ───────────────────────────────────────────────
  function FilterButton({ label, active, onClick }) {
    return (
      <button
        onClick={onClick}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          active
            ? 'bg-indigo-600 border-indigo-500 text-white'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-100'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Incoming Tickets</h1>
          <p className="text-sm text-slate-400 mt-1">
            {tickets.length > 0
              ? `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} classified`
              : 'Paste a support ticket below to classify it'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg
                        border transition-colors ${
              showFilters
                ? 'bg-slate-700 border-slate-600 text-slate-100'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-100'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filter
          </button>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg
                        border transition-colors ${
              autoRefresh
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-100'
            }`}
          >
            <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
            {autoRefresh ? 'Live' : 'Auto'}
          </button>
        </div>
      </div>

      {/* ── Filter panel ──────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 space-y-3">
          {/* Urgency filter */}
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
              Urgency
            </p>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
                <FilterButton
                  key={level}
                  label={level}
                  active={filterUrgency === level}
                  onClick={() => setFilterUrgency(level)}
                />
              ))}
            </div>
          </div>

          {/* Routing filter */}
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
              Routing
            </p>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'AUTO-ROUTE', 'HUMAN-REVIEW', 'ESCALATE'].map(tier => (
                <FilterButton
                  key={tier}
                  label={tier}
                  active={filterRouting === tier}
                  onClick={() => setFilterRouting(tier)}
                />
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
              Sort by
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'newest',          label: 'Newest first' },
                { id: 'confidence_high', label: 'Confidence ↑' },
                { id: 'confidence_low',  label: 'Confidence ↓' },
              ].map(opt => (
                <FilterButton
                  key={opt.id}
                  label={opt.label}
                  active={sortBy === opt.id}
                  onClick={() => setSortBy(opt.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sample ticket buttons ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <p className="text-xs text-slate-500 w-full">Quick test:</p>
        {SAMPLE_TICKETS.map((sample, i) => (
          <button
            key={i}
            onClick={() => setTicketText(sample.text)}
            className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700
                       text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-lg
                       transition-colors"
          >
            {sample.label}
          </button>
        ))}
      </div>

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
        <textarea
          value={ticketText}
          onChange={(e) => setTicketText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste ticket text here... (Ctrl+Enter to classify)"
          rows={5}
          className="w-full bg-transparent text-sm text-slate-300 placeholder-slate-600
                     resize-none focus:outline-none leading-relaxed"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-slate-600">Ctrl+Enter to classify</p>
          )}
          <button
            onClick={handleClassify}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500
                       disabled:bg-slate-700 disabled:text-slate-500 text-white
                       text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {loading ? 'Classifying...' : 'Classify'}
          </button>
        </div>
      </div>

      {/* ── Ticket queue ──────────────────────────────────────────────────── */}
      {filteredTickets.length === 0 && tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center
                          justify-center mb-4">
            <Inbox size={20} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No tickets classified yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Use a quick test button or paste a ticket above
          </p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">
            No tickets match the current filters
          </p>
          <button
            onClick={() => { setFilterUrgency('ALL'); setFilterRouting('ALL') }}
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => setSelectedTicket(ticket)}
            />
          ))}
        </div>
      )}

      {/* ── Ticket detail modal ───────────────────────────────────────────── */}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onCorrectionSubmitted={() => setSelectedTicket(null)}
        />
      )}
    </div>
  )
}