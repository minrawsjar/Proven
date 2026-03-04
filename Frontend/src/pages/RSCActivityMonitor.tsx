import { useEffect, useState } from 'react'
import { useRSCMonitorStore, type RSCEvent as IncomingEvent, type RSCResponse } from '../store/rscMonitorStore'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { Zap, Radio, Target, LockKeyhole, Search, Link2, BrainCircuit, BarChart3, Mail, RefreshCw, CheckCircle2, Lightbulb } from 'lucide-react'

export function RSCActivityMonitor() {
  const {
    incomingEvents,
    rscResponses,
    stats,
    setIncomingEvents,
    setRSCResponses,
  } = useRSCMonitorStore()

  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      const mockEvent: IncomingEvent = {
        id: `event-${Date.now()}`,
        timestamp: Date.now(),
        chain: Math.random() > 0.5 ? 'ETH_SEPOLIA' : 'UNICHAIN_SEPOLIA',
        blockNumber: 5000000 + Math.floor(Math.random() * 100),
        eventName: ['Transfer', 'PoolMetricsUpdated', 'Swap', 'AddLiquidity', 'RemoveLiquidity'][Math.floor(Math.random() * 5)],
        fromAddress: '0x' + Math.random().toString(16).slice(2, 10),
        value: `${Math.floor(Math.random() * 1000)}k`,
        txHash: '0x' + Math.random().toString(16).slice(2, 14),
      }
      setIncomingEvents([mockEvent])

      if (Math.random() > 0.4) {
        const triggered = Math.random() > 0.7
        const mockResponse: RSCResponse = {
          id: `response-${Date.now()}`,
          timestamp: Date.now(),
          signalId: `S${Math.floor(Math.random() * 5) + 1}`,
          conditionChecked: 'threshold comparison',
          result: triggered ? 'TRIGGERED' : 'BELOW_THRESHOLD',
          scoreChange: triggered ? Math.floor(Math.random() * 20) : 0,
          newCompositeScore: Math.floor(Math.random() * 50),
          actionTaken: Math.random() > 0.5 ? 'Callback dispatched: extendLock()' : 'Callback dispatched: updateRiskScore()',
          callbackTxHash: triggered ? '0x' + Math.random().toString(16).slice(2, 14) : null,
          projectAddress: '0x' + Math.random().toString(16).slice(2, 10),
        }
        setRSCResponses([mockResponse])
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [setIncomingEvents, setRSCResponses])

  useEffect(() => {
    const leftColumn = document.getElementById('left-column')
    if (leftColumn && autoScroll) leftColumn.scrollTop = 0
  }, [incomingEvents, autoScroll])

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10 animate-fade-up opacity-0">
        <Badge variant="purple" pulse className="mb-4">TECHNICAL VIEW</Badge>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">RSC Activity Monitor</h1>
        <p className="text-white/30">Real-time Reactive Smart Contract event stream from Kopli Testnet</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-up opacity-0">
        {[
          { label: 'React() Calls', value: stats.totalReactCalls, color: 'brand', Icon: Zap },
          { label: 'Callbacks Dispatched', value: stats.totalCallbacksDispatched, color: 'brand', Icon: Radio },
          { label: 'Milestones Unlocked', value: stats.totalMilestonesUnlocked, color: 'brand-light', Icon: Target },
          { label: 'Lock Extensions', value: stats.totalLockExtensionsApplied, color: 'neon-orange', Icon: LockKeyhole },
        ].map((stat, i) => (
          <div key={i} className="glow-card !p-5 text-center">
            <stat.Icon className={`w-5 h-5 text-${stat.color} mx-auto`} />
            <div className={`text-3xl font-black font-mono text-${stat.color} mt-2`}>{stat.value}</div>
            <p className="text-white/30 text-xs mt-1 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="glass p-4 rounded-2xl mb-8 flex gap-4 items-center animate-fade-up opacity-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            type="text"
            placeholder="Filter by project or signal..."
            className="input-glow w-full !pl-10 !py-2.5 !text-sm"
            onChange={(e) => setSelectedProject(e.target.value || null)}
          />
        </div>
        <label className="flex items-center gap-2.5 text-white/40 cursor-pointer select-none shrink-0">
          <div className="relative">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-white/10 rounded-full peer-checked:bg-brand/30 transition" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white/30 rounded-full peer-checked:translate-x-4 peer-checked:bg-brand transition-all shadow-sm" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider">Auto-scroll</span>
        </label>
        <div className="flex items-center gap-2 shrink-0">
          <span className="live-dot" />
          <span className="text-brand text-xs font-semibold uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-up opacity-0">
        {/* Left Column: Incoming Events */}
        <Card className="!p-0 overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <h3 className="text-white font-bold">Incoming Events</h3>
            </div>
            <span className="text-white/20 text-xs font-mono">{incomingEvents.length} events</span>
          </div>
          <div id="left-column" className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
            {incomingEvents.length === 0 ? (
              <div className="text-center py-16">
                <Radio className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/20">Waiting for events...</p>
              </div>
            ) : (
              incomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-brand/20 transition-all duration-300 animate-fade-up opacity-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`chip ${event.chain === 'UNICHAIN_SEPOLIA' ? 'chip-cyan' : 'chip-purple'} !text-[10px]`}>
                      {event.chain === 'UNICHAIN_SEPOLIA' ? <span className="inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> UNICHAIN</span> : <span className="inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> ETH</span>}
                    </span>
                    <span className="text-white/15 text-[10px] font-mono ml-auto">Block #{event.blockNumber}</span>
                  </div>
                  <p className="font-bold text-white text-sm">{event.eventName}</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 text-[11px] font-mono">
                    <div>
                      <span className="text-white/20">From: </span>
                      <span className="text-white/40">{event.fromAddress}</span>
                    </div>
                    <div>
                      <span className="text-white/20">Value: </span>
                      <span className="text-brand/60">{event.value}</span>
                    </div>
                  </div>
                  <p className="text-white/10 text-[10px] font-mono mt-2">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Right Column: RSC Responses */}
        <Card className="!p-0 overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <h3 className="text-white font-bold">RSC Responses</h3>
            </div>
            <span className="text-white/20 text-xs font-mono">{rscResponses.length} responses</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
            {rscResponses.length === 0 ? (
              <div className="text-center py-16">
                <BrainCircuit className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/20">Waiting for RSC evaluations...</p>
              </div>
            ) : (
              rscResponses.map((response) => (
                <div
                  key={response.id}
                  className={`p-4 rounded-xl border transition-all duration-300 animate-fade-up opacity-0 ${
                    response.result === 'TRIGGERED'
                      ? 'bg-brand/5 border-brand/20'
                      : 'bg-white/[0.02] border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white/40">{response.signalId}</span>
                      <span className="text-white/10">•</span>
                      <span className="text-white font-semibold text-sm">
                        {response.signalId === 'S1' ? 'Holder Outflow' :
                         response.signalId === 'S2' ? 'Treasury Drain' :
                         response.signalId === 'S3' ? 'LP Withdrawal' :
                         response.signalId === 'S4' ? 'Liq. Concentration' : 'Dispersion'}
                      </span>
                    </div>
                    <Badge variant={response.result === 'TRIGGERED' ? 'success' : 'neutral'}>
                      {response.result === 'TRIGGERED' ? <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3" /> TRIGGERED</span> : 'BELOW'}
                    </Badge>
                  </div>
                  {response.result === 'TRIGGERED' && (
                    <div className="p-2.5 rounded-lg bg-brand/5 border border-brand/10 mt-2">
                      <p className="text-brand/70 text-xs font-mono">{response.actionTaken}</p>
                    </div>
                  )}
                  <p className="text-white/10 text-[10px] font-mono mt-2">
                    {new Date(response.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Live Demo Guide */}
      <Card variant="glass" className="!p-6 mt-8 animate-fade-up opacity-0">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-brand" />
          <h3 className="font-bold text-white">How This Works</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { step: '01', text: 'On-chain events arrive from Unichain Sepolia', Icon: Mail },
            { step: '02', text: 'Kopli RSC evaluates each against 5 signals', Icon: BrainCircuit },
            { step: '03', text: 'Triggered signals dispatch callback transactions', Icon: Zap },
            { step: '04', text: 'Risk scores update, milestones unlock, or locks extend', Icon: RefreshCw },
            { step: '05', text: 'All activity is verifiable on-chain in real time', Icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.step} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
              <item.Icon className="w-6 h-6 text-brand/40 mx-auto mb-2" />
              <span className="text-brand/40 font-mono text-[10px] font-bold">{item.step}</span>
              <p className="text-white/40 text-xs mt-1 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="text-white/20 text-xs mt-4 text-center font-mono">
                    <Lightbulb className="w-3.5 h-3.5 text-brand/40 inline mr-1.5" />Events are simulated for demo. In production, these stream from Kopli RPC at reactive.network
        </p>
      </Card>
    </div>
  )
}
