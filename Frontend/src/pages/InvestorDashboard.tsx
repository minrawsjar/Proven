import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useVerifyStore } from '../store/verifyStore'
import { Card } from '../components/Card'
import { ProgressBar } from '../components/ProgressBar'
import { Badge } from '../components/Badge'
import { Search, Siren, Target, ShieldCheck, ScrollText, Copy, Check } from 'lucide-react'

export function InvestorDashboard() {
  const { address } = useParams()
  const { selectedAddress, setSelectedAddress, poolData, setPoolData } = useVerifyStore()
  const [searchInput, setSearchInput] = useState(address || '')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSearch = async () => {
    if (!searchInput) return
    setLoading(true)
    setSelectedAddress(searchInput)
    setTimeout(() => {
      setPoolData({
        projectName: 'Nova Protocol',
        tokenSymbol: 'NOVA',
        tokenAddress: '0x123...',
        pairToken: 'USDC',
        feeTier: 0.3,
        totalLocked: 250000,
        currentUnlocked: 62500,
        unlockPercentage: 25,
        lockExtendedUntil: null,
        riskScore: 0,
        milestones: [
          { condition: 'TVL reaches $1,000,000', currentValue: 743000, threshold: 1000000, unlockAmount: 62500, isComplete: false },
          { condition: 'Trading Volume reaches $5,000,000', currentValue: 1200000, threshold: 5000000, unlockAmount: 125000, isComplete: false },
          { condition: '5,000 Unique Users', currentValue: 2847, threshold: 5000, unlockAmount: 62500, isComplete: false },
        ],
        monitoredWallets: ['0xdeployer...', '0xteam1...', '0xteam2...'],
        treasuryAddress: '0xtreasury...',
      })
      setLoading(false)
    }, 500)
  }

  useEffect(() => {
    if (address) { setSearchInput(address); handleSearch() }
  }, [address])

  const handleCopy = () => {
    const url = `${window.location.origin}/verify/${searchInput}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const riskColor = (score: number) =>
    score === 0 ? 'brand' : score < 30 ? 'neon-yellow' : score < 60 ? 'neon-orange' : 'neon-red'

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header + Search */}
      <div className="mb-12 animate-fade-up opacity-0">
        <Badge variant="purple" pulse className="mb-4">INVESTOR DASHBOARD</Badge>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Verify a Project</h1>
        <p className="text-white/30 mb-8">Paste a team address, pool, or token address</p>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              className="input-glow w-full !pl-12 font-mono"
              placeholder="0x..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button className="btn-primary px-8 py-3" onClick={handleSearch} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="60" strokeDashoffset="20" /></svg>
                Searching
              </span>
            ) : 'Search'}
          </button>
        </div>
      </div>

      {poolData && (
        <div className="space-y-6">
          {/* Rage Lock Banner */}
          {poolData.lockExtendedUntil && (
            <div className="animate-fade-up opacity-0 p-5 rounded-2xl bg-red-500/5 border border-red-500/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 animate-pulse" />
              <div className="flex items-start gap-4 ml-4">
                <Siren className="w-8 h-8 text-red-400 flex-shrink-0" />
                <div>
                  <h3 className="font-black text-red-400 text-lg mb-1">RAGE LOCK ACTIVE</h3>
                  <p className="text-red-200/60 text-sm mb-1">
                    Lock extended until <span className="text-red-300 font-mono">{poolData.lockExtendedUntil}</span> (12 days remaining)
                  </p>
                  <p className="text-red-200/40 text-sm">
                    Reason: Deployer wallet transferred 23% of holdings. Tx: <span className="text-red-300/60 font-mono">0x4a3b...</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lock Status Card */}
          <Card variant="glow" className="!p-8 animate-fade-up opacity-0">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black text-white">{poolData.projectName}</h2>
                <p className="text-white/30 font-mono text-sm mt-1">${poolData.tokenSymbol} / {poolData.pairToken} · {poolData.feeTier}% fee</p>
              </div>
              <Badge
                variant={poolData.lockExtendedUntil ? 'error' : poolData.unlockPercentage === 100 ? 'success' : 'success'}
                pulse={!poolData.lockExtendedUntil && poolData.unlockPercentage < 100}
              >
                {poolData.lockExtendedUntil ? 'RAGE LOCKED' : poolData.unlockPercentage === 100 ? 'FULLY UNLOCKED' : 'ACTIVE'}
              </Badge>
            </div>

            {/* 2x2 Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total LP Locked', value: `$${(poolData.totalLocked / 1000).toFixed(0)}k`, color: 'text-white', sub: 'Verify on-chain ↗' },
                { label: 'Currently Unlocked', value: `${poolData.unlockPercentage}%`, color: 'text-brand', sub: `$${(poolData.currentUnlocked / 1000).toFixed(0)}k released` },
                { label: 'Lock Extended', value: poolData.lockExtendedUntil || 'Never', color: 'text-white', sub: 'No extensions triggered' },
                { label: 'Risk Score', value: `${poolData.riskScore}/100`, color: `text-${riskColor(poolData.riskScore)}`, sub: poolData.riskScore === 0 ? 'All signals clear' : 'Active signals detected' },
              ].map((stat, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2">{stat.label}</p>
                  <p className={`text-2xl font-black font-mono ${stat.color}`}>{stat.value}</p>
                  <p className="text-white/20 text-xs mt-1">{stat.sub}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">Overall Unlock Progress</p>
              <ProgressBar value={poolData.unlockPercentage} color="gradient" size="lg" showLabel />
            </div>
          </Card>

          {/* Milestone Tracker */}
          <Card className="!p-8 animate-fade-up opacity-0">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Milestone Tracker</h3>
                <p className="text-white/30 text-sm">On-chain conditions monitored by Reactive SC</p>
              </div>
            </div>

            <div className="space-y-4">
              {poolData.milestones.map((m, i) => {
                const pct = Math.min((m.currentValue / m.threshold) * 100, 100)
                const colors: ('cyan' | 'purple' | 'green')[] = ['cyan', 'purple', 'green']
                return (
                  <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-white font-bold">{m.condition}</p>
                        <p className="text-white/30 text-sm font-mono mt-1">
                          {m.currentValue.toLocaleString()} / {m.threshold.toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={m.isComplete ? 'success' : 'info'}>
                        {m.isComplete ? <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Complete</span> : `${pct.toFixed(0)}%`}
                      </Badge>
                    </div>
                    <ProgressBar value={pct} color={colors[i]} size="md" />
                    <p className="text-white/20 text-xs mt-3 font-mono">
                      Unlocks {Math.round((m.unlockAmount / poolData.totalLocked) * 100)}% → ${(m.unlockAmount / 1000).toFixed(0)}k
                    </p>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Risk Score Panel */}
          <Card className="!p-8 animate-fade-up opacity-0">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Risk Score Analysis</h3>
                <p className="text-white/30 text-sm">5-signal composite monitored by Reactive Smart Contracts</p>
              </div>
            </div>

            {/* Gauge */}
            <div className="p-6 rounded-xl bg-void-50 border border-white/5 mb-6">
              <div className="flex items-end justify-between mb-4">
                <span className="text-white/40 text-sm">Risk Level</span>
                <span className={`text-4xl font-black font-mono text-${riskColor(poolData.riskScore)}`}>
                  {poolData.riskScore}
                </span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 flex">
                  <div className="flex-1 bg-brand/20" />
                  <div className="flex-1 bg-neon-yellow/20" />
                  <div className="flex-1 bg-neon-orange/20" />
                  <div className="flex-1 bg-neon-red/20" />
                </div>
                <div
                  className={`h-full rounded-full relative z-10 transition-all duration-1000 ${
                    poolData.riskScore === 0 ? 'bg-brand shadow-[0_0_12px_rgba(0,230,118,0.5)]' :
                    poolData.riskScore < 30 ? 'bg-neon-yellow shadow-[0_0_12px_rgba(234,179,8,0.5)]' :
                    poolData.riskScore < 60 ? 'bg-neon-orange shadow-[0_0_12px_rgba(249,115,22,0.5)]' :
                    'bg-neon-red shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  }`}
                  style={{ width: `${Math.max(poolData.riskScore, 2)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/20 mt-2 font-mono">
                <span>0 SAFE</span><span>25</span><span>50</span><span>75</span><span>100 DANGER</span>
              </div>
            </div>

            {/* Signal Rows */}
            <div className="space-y-2">
              {[
                { signal: 'S1', label: 'Large Holder Outflow', status: 'Inactive', points: 0, active: false },
                { signal: 'S2', label: 'Treasury Drain', status: 'Inactive', points: 0, active: false },
                { signal: 'S3', label: 'LP Withdrawal Attempt', status: 'Inactive', points: 0, active: false },
                { signal: 'S4', label: 'Liquidity Concentration', status: 'Active', points: 10, active: true },
                { signal: 'S5', label: 'Holder Dispersion', status: 'Inactive', points: 0, active: false },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl flex items-center justify-between text-sm transition-all duration-300 ${
                    item.active
                      ? 'bg-neon-orange/5 border border-neon-orange/20'
                      : 'bg-white/[0.02] border border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs font-bold ${item.active ? 'text-neon-orange' : 'text-white/20'}`}>
                      {item.signal}
                    </span>
                    <span className={item.active ? 'text-white' : 'text-white/30'}>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {item.active ? (
                      <span className="chip chip-orange">{item.status}</span>
                    ) : (
                      <span className="text-white/20 text-xs">{item.status}</span>
                    )}
                    <span className={`font-mono text-xs ${item.active ? 'text-neon-orange' : 'text-white/15'}`}>
                      +{item.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Event Log */}
          <Card className="!p-8 animate-fade-up opacity-0">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                <ScrollText className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Event Log</h3>
                <p className="text-white/30 text-sm">On-chain events for this position</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { timestamp: '2026-03-04 14:32', type: 'PositionLocked', desc: '250,000 USDC worth of LP locked in vault', tx: '0x7f2a...', variant: 'info' as const },
                { timestamp: '2026-03-04 14:25', type: 'RiskElevated', desc: 'Risk score reached 10. Liquidity concentration detected.', tx: '0x6e1b...', variant: 'warning' as const },
                { timestamp: '2026-03-04 12:10', type: 'MilestonesSet', desc: '3 milestones registered with Reactive SC', tx: '0x3c9d...', variant: 'purple' as const },
              ].map((event, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Badge variant={event.variant}>{event.type}</Badge>
                      <span className="text-white/20 text-xs font-mono">{event.timestamp}</span>
                    </div>
                    <span className="text-brand/40 text-xs font-mono hover:text-brand cursor-pointer transition">{event.tx} ↗</span>
                  </div>
                  <p className="text-white/50 text-sm">{event.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Share Button */}
          <div className="text-center animate-fade-up opacity-0">
            <button className="btn-primary px-8 py-2.5" onClick={handleCopy}>
              {copied ? <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Copied!</span> : <span className="inline-flex items-center gap-1.5"><Copy className="w-4 h-4" /> Copy Verification Link</span>}
            </button>
          </div>
        </div>
      )}

      {/* Empty States */}
      {selectedAddress && !poolData && (
        <Card className="!p-12 text-center animate-fade-up opacity-0">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-8 w-8 text-brand" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="60" strokeDashoffset="20" /></svg>
            <p className="text-white/30">Loading project data...</p>
          </div>
        </Card>
      )}

      {!selectedAddress && (
        <Card className="!p-16 text-center animate-fade-up opacity-0">
          <div className="flex flex-col items-center gap-4">
            <Search className="w-12 h-12 text-white/10" />
            <p className="text-white/30 text-lg">Enter a project address to begin verification</p>
            <p className="text-white/15 text-sm">Supports token address, pool address, or team wallet</p>
          </div>
        </Card>
      )}
    </div>
  )
}
