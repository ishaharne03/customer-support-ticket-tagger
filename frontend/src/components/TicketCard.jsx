// TicketCard — displays a single ticket in the queue
// Shows category badge, confidence bar, urgency badge, routing tier
// Clicking the card opens the full detail view

export default function TicketCard({ ticket, onClick }) {

  // ── Badge colors by urgency ──────────────────────────────────────────────
  const urgencyColors = {
    CRITICAL: 'bg-red-500/20 text-red-400 border border-red-500/30',
    HIGH:     'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    MEDIUM:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    LOW:      'bg-green-500/20 text-green-400 border border-green-500/30',
  }

  // ── Badge colors by routing tier ─────────────────────────────────────────
  const routingColors = {
    'AUTO-ROUTE':   'bg-green-500/20 text-green-400 border border-green-500/30',
    'HUMAN-REVIEW': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    'ESCALATE':     'bg-red-500/20 text-red-400 border border-red-500/30',
  }

  // ── Confidence bar color ──────────────────────────────────────────────────
  const confidenceColor =
    ticket.confidence >= 0.301 ? 'bg-green-500' :
    ticket.confidence >= 0.236 ? 'bg-yellow-500' :
    'bg-red-500'

  return (
    <div
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer
                 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all"
    >
      {/* Top row — category + badges */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-sm font-semibold text-indigo-400 bg-indigo-500/10
                         border border-indigo-500/20 px-2.5 py-1 rounded-lg">
          {ticket.category}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyColors[ticket.urgency]}`}>
            {ticket.urgency}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${routingColors[ticket.routing_tier]}`}>
            {ticket.routing_tier}
          </span>
        </div>
      </div>

      {/* Ticket text preview */}
      <p className="text-sm text-slate-300 line-clamp-2 mb-3">
        {ticket.ticket_text}
      </p>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Confidence</span>
          <span className="text-xs text-slate-400 font-mono">
            {(ticket.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${confidenceColor}`}
            style={{ width: `${ticket.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Correction used indicator */}
      {ticket.correction_used && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span className="text-xs text-indigo-400">Correction applied</span>
        </div>
      )}
    </div>
  )
}