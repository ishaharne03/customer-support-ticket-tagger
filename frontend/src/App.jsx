import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TicketQueue from './components/TicketQueue'
import MetricsPanel from './components/MetricsPanel'
import CorrectionHistory from './components/CorrectionHistory'

export default function App() {
  const [activePage, setActivePage] = useState('tickets')

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 overflow-y-auto">
        {activePage === 'tickets'     && <TicketQueue />}
        {activePage === 'metrics'     && <MetricsPanel />}
        {activePage === 'corrections' && <CorrectionHistory />}
      </main>
    </div>
  )
}