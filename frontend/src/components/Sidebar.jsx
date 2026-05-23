import { LayoutDashboard, Ticket, BarChart3, History } from 'lucide-react'

export default function Sidebar({ activePage, setActivePage }) {
  const navItems = [
    { id: 'tickets', label: 'Tickets', icon: Ticket },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
    { id: 'corrections', label: 'Corrections', icon: History },
  ]

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Ticket Tagger</p>
            <p className="text-xs text-slate-400">Operator Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePage(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activePage === id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-500">DistilBERT + GPT-4o-mini</p>
      </div>
    </aside>
  )
}