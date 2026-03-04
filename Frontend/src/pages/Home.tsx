import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Lock, TrendingUp, CheckCircle, AlertTriangle, Activity, ArrowRight, XCircle, Eye, Zap, BarChart3, Users, DollarSign, ShieldAlert, ArrowUpRight } from 'lucide-react'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { NetworkSphere } from '../components/NetworkSphere'

const TICKER_ITEMS = [
  { event: 'MILESTONE_UNLOCKED', project: '$NOVA', detail: 'TVL hit $1M', time: '2m' },
  { event: 'POSITION_CREATED', project: '$DRIFT', detail: '250k USDC locked', time: '5m' },
  { event: 'MILESTONE_UNLOCKED', project: '$SPARK', detail: '5,000 users reached', time: '12m' },
  { event: 'LOCK_EXTENDED', project: '$WAVE', detail: 'Rug signal S2 triggered', time: '18m' },
  { event: 'POSITION_CREATED', project: '$ORBIT', detail: '500k USDC locked', time: '24m' },
  { event: 'RISK_UPDATED', project: '$NOVA', detail: 'Score: 0/100', time: '31m' },
]

export function Home() {
  const [items] = useState([...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS])

  return (
    <div className="relative">

      {/* ═══ HERO ═══ */}
      <section className="relative pt-24 pb-32 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/8 border border-brand/20">
                <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                <span className="text-sm text-brand/80 font-medium">Live on Unichain Sepolia</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.12] text-white tracking-tight">
                Performance-Vested{' '}
                <span className="text-brand">Liquidity</span>{' '}
                for Token Launches
              </h1>

              <p className="text-base text-white/40 leading-relaxed max-w-md">
                Lock LP tokens in a smart vault. They unlock only when real on-chain milestones are hit — TVL, volume, users. Verified autonomously by Reactive Smart Contracts.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/launch"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand text-void font-semibold text-sm hover:bg-brand-light transition-all hover:shadow-lg hover:shadow-brand/30"
                >
                  Launch Pool <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/verify"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/10 text-white/70 font-semibold text-sm hover:border-white/20 hover:text-white transition-all"
                >
                  Verify a Project
                </Link>
              </div>

              <div className="flex gap-10 pt-4">
                {[
                  { end: 14.2, prefix: '$', suffix: 'M', decimals: 1, label: 'Total Value Locked' },
                  { end: 124, prefix: '', suffix: '', decimals: 0, label: 'Active Positions' },
                  { end: 892, prefix: '', suffix: '', decimals: 0, label: 'Milestones Verified' },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="text-2xl font-bold text-white font-mono">
                      <AnimatedCounter end={stat.end} prefix={stat.prefix} suffix={stat.suffix} decimals={stat.decimals} />
                    </div>
                    <div className="text-xs text-white/30 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative h-[480px] flex items-center justify-center">
              <NetworkSphere />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MARQUEE TICKER ═══ */}
      <section className="border-y border-white/5 bg-void-50/50 overflow-hidden">
        <div className="marquee-container">
          <div className="marquee-track">
            {items.map((item, i) => (
              <div key={i} className="marquee-item">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  item.event === 'LOCK_EXTENDED' ? 'bg-neon-orange' :
                  item.event === 'RISK_UPDATED' ? 'bg-neon-cyan' : 'bg-brand'
                }`} />
                <span className={`font-mono text-xs font-semibold ${
                  item.event === 'LOCK_EXTENDED' ? 'text-neon-orange/80' :
                  item.event === 'RISK_UPDATED' ? 'text-neon-cyan/80' : 'text-brand/80'
                }`}>{item.event}</span>
                <span className="text-white/60 text-xs">{item.project}</span>
                <span className="text-white/20 text-xs">{item.detail}</span>
                <span className="text-white/10 text-xs">{item.time} ago</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DUAL TIMELINE — THE CORE VISUAL ═══ */}
      <section className="py-24 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand text-xs font-semibold uppercase tracking-widest mb-3">Why This Matters</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Same token launch. Two very different outcomes.
            </h2>
            <p className="text-white/30 max-w-2xl mx-auto">
              The $SQUID rug pull drained $2.1M from 40,000 investors using a simple time-lock.
              Here's exactly what happened — and how Proven would have stopped it.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* LEFT: Rug Pull Timeline */}
            <div className="rounded-2xl border border-neon-red/20 bg-neon-red/[0.02] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-neon-red/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-neon-red" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Without Proven</h3>
                  <p className="text-white/30 text-xs">$SQUID — Time-locked liquidity</p>
                </div>
              </div>

              <div className="space-y-0">
                {[
                  { day: 'Day 0', title: 'Token launches', desc: 'LP locked for 7 days via standard time-lock. No conditions, no monitoring.', data: '$2.1M locked', status: 'neutral' as const },
                  { day: 'Day 1–6', title: 'Hype builds, team stays silent', desc: 'Price pumps 230x. Deployer wallet quietly pre-approves LP removal. No alerts — nobody is watching.', data: '0 signals checked', status: 'warning' as const },
                  { day: 'Day 7', title: 'Time-lock expires', desc: 'Lock expires at 00:00 UTC. Team removes 100% of liquidity in a single transaction within 4 minutes.', data: '100% LP removed', status: 'danger' as const },
                  { day: 'Day 7+', title: '$2.1M gone. 40,000 victims.', desc: 'Token price crashes to $0. Investors hold worthless tokens. BBC reports on the scam.', data: 'Price: $0.00', status: 'danger' as const },
                ].map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                        step.status === 'danger' ? 'border-neon-red bg-neon-red/30' :
                        step.status === 'warning' ? 'border-neon-orange bg-neon-orange/20' :
                        'border-white/20 bg-white/5'
                      }`} />
                      {i < 3 && <div className="w-px h-full bg-white/5 min-h-[60px]" />}
                    </div>
                    <div className="pb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold text-white/30 uppercase">{step.day}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          step.status === 'danger' ? 'bg-neon-red/10 text-neon-red' :
                          step.status === 'warning' ? 'bg-neon-orange/10 text-neon-orange' :
                          'bg-white/5 text-white/30'
                        }`}>{step.data}</span>
                      </div>
                      <p className="text-white text-sm font-semibold mb-1">{step.title}</p>
                      <p className="text-white/30 text-xs leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="https://www.bbc.com/news/business-59129466"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-neon-red/50 hover:text-neon-red text-xs font-medium transition-colors mt-2"
              >
                BBC: Squid Game cryptocurrency collapses in apparent scam <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>

            {/* RIGHT: Protected Timeline */}
            <div className="rounded-2xl border border-brand/20 bg-brand/[0.02] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">With Proven</h3>
                  <p className="text-white/30 text-xs">Same token — milestone-vested liquidity</p>
                </div>
              </div>

              <div className="space-y-0">
                {[
                  { day: 'Day 0', title: 'Token launches via Proven', desc: 'LP locked with 3 milestones: TVL $1M (25%), Volume $5M (50%), 5K Users (25%). RSC starts monitoring.', data: '3 milestones set', status: 'active' as const },
                  { day: 'Day 1–6', title: 'RSC detects rug signals', desc: 'Signal S1: Deployer pre-approves LP removal. Signal S2: 23% of team tokens moved to fresh wallet. Risk score jumps to 68/100.', data: 'Risk: 68/100', status: 'warning' as const },
                  { day: 'Day 7', title: 'Rage Lock triggered', desc: 'RSC automatically extends lock by 30 days. Callback tx dispatched on-chain. Team cannot touch LP. Dashboard shows full details.', data: 'Lock extended +30d', status: 'protected' as const },
                  { day: 'Day 37', title: 'Community decides', desc: 'If milestones still unmet — LP stays locked. If team proves growth (TVL $1M+), partial unlock begins. Investors stay protected.', data: '0% unlocked', status: 'active' as const },
                ].map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                        step.status === 'protected' ? 'border-brand bg-brand/30' :
                        step.status === 'warning' ? 'border-neon-orange bg-neon-orange/20' :
                        'border-brand/40 bg-brand/10'
                      }`} />
                      {i < 3 && <div className="w-px h-full bg-brand/10 min-h-[60px]" />}
                    </div>
                    <div className="pb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold text-white/30 uppercase">{step.day}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          step.status === 'protected' ? 'bg-brand/10 text-brand' :
                          step.status === 'warning' ? 'bg-neon-orange/10 text-neon-orange' :
                          'bg-brand/5 text-brand/60'
                        }`}>{step.data}</span>
                      </div>
                      <p className="text-white text-sm font-semibold mb-1">{step.title}</p>
                      <p className="text-white/30 text-xs leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 p-3 rounded-lg bg-brand/5 border border-brand/10">
                <p className="text-brand/60 text-[11px] font-mono leading-relaxed">
                  5 signals monitored: S1 Holder Outflow · S2 Treasury Drain · S3 LP Withdrawal · S4 Liquidity Concentration · S5 Holder Dispersion
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHAT TRIGGERS PROTECTION ═══ */}
      <section className="py-20 px-4 relative" style={{ background: 'rgba(10, 31, 20, 0.2)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand text-xs font-semibold uppercase tracking-widest mb-3">Under The Hood</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              What exactly does the RSC monitor?
            </h2>
          </div>

          <div className="grid md:grid-cols-5 gap-3">
            {[
              { signal: 'S1', label: 'Large Holder Outflow', trigger: '>15% of supply moved in 24h', icon: Users },
              { signal: 'S2', label: 'Treasury Drain', trigger: 'Treasury balance drops >20%', icon: DollarSign },
              { signal: 'S3', label: 'LP Withdrawal', trigger: 'Any removeLiquidity() call', icon: ShieldAlert },
              { signal: 'S4', label: 'Liquidity Concentration', trigger: 'Top 3 wallets hold >60%', icon: BarChart3 },
              { signal: 'S5', label: 'Holder Dispersion', trigger: 'Unique holders drop >10%', icon: Eye },
            ].map((item) => (
              <div key={item.signal} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-brand/20 transition-all group">
                <div className="flex items-center gap-2 mb-3">
                  <item.icon className="w-4 h-4 text-brand/60 group-hover:text-brand transition-colors" />
                  <span className="font-mono text-[10px] font-bold text-white/20">{item.signal}</span>
                </div>
                <p className="text-white text-xs font-semibold mb-1.5">{item.label}</p>
                <p className="text-white/25 text-[11px] leading-relaxed font-mono">{item.trigger}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-white/15 text-xs mt-8 font-mono">
            Each signal contributes 0–20 points to a composite risk score. Score above 50 triggers automatic lock extension.
          </p>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-24 px-4 relative">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand text-xs font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Three steps to trustless liquidity
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Lock',
                icon: Lock,
                desc: 'Deposit LP tokens into Proven\'s vault. Set milestones — TVL targets, volume thresholds, user counts — and the unlock % for each.',
                detail: 'Uniswap v4 pool + Proven vault contract',
              },
              {
                step: '02',
                title: 'Prove',
                icon: Activity,
                desc: 'Reactive Smart Contracts on Kopli monitor on-chain metrics cross-chain. They evaluate 5 signals every block and compute a composite risk score.',
                detail: 'Kopli Testnet → Unichain Sepolia',
              },
              {
                step: '03',
                title: 'Unlock',
                icon: CheckCircle,
                desc: 'When milestones are verified on-chain, the RSC authorizes partial LP release. If rug signals fire, the lock extends automatically.',
                detail: 'Progressive unlock or Rage Lock',
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="rounded-2xl border border-white/5 bg-white/[0.015] p-7 hover:border-brand/20 transition-all group h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-brand/8 flex items-center justify-center group-hover:bg-brand/15 transition-colors">
                      <item.icon className="w-5 h-5 text-brand" />
                    </div>
                    <span className="font-mono text-xs text-white/10 font-bold">{item.step}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-white/35 text-sm leading-relaxed mb-4">{item.desc}</p>
                  <p className="text-brand/30 text-[11px] font-mono">{item.detail}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-white/10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-24 px-4 relative">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">
            Ready to launch with confidence?
          </h2>
          <p className="text-white/30 text-base mb-10 max-w-lg mx-auto">
            Join the teams building trust through performance-vested liquidity on Unichain.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/launch"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-brand text-void font-semibold text-sm hover:bg-brand-light transition-all hover:shadow-lg hover:shadow-brand/30"
            >
              Launch Your Pool <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://docs.reactive.network"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 text-white/60 font-semibold text-sm hover:border-white/20 hover:text-white transition-all"
            >
              Read the Docs <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/5 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-void" />
                </div>
                <span className="text-sm font-semibold text-white">Proven Protocol</span>
              </div>
              <p className="text-xs text-white/25 leading-relaxed">
                Performance-vested liquidity for Unichain. Built with Reactive Smart Contracts and Uniswap v4 Hooks.
              </p>
            </div>

            <div>
              <h4 className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-4">Product</h4>
              <ul className="space-y-2 text-xs text-white/25">
                <li><Link to="/launch" className="hover:text-white/50 transition-colors">Launch Pool</Link></li>
                <li><Link to="/verify" className="hover:text-white/50 transition-colors">Dashboard</Link></li>
                <li><Link to="/monitor" className="hover:text-white/50 transition-colors">RSC Monitor</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-4">Resources</h4>
              <ul className="space-y-2 text-xs text-white/25">
                <li><a href="https://docs.reactive.network" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white/50 transition-colors">Whitepaper</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-4">Community</h4>
              <ul className="space-y-2 text-xs text-white/25">
                <li><a href="#" className="hover:text-white/50 transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-white/50 transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-white/50 transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-[11px] text-white/15">
            <p>© 2025 Proven Protocol. All rights reserved.</p>
            <div className="flex gap-4">
              <span>Unichain</span>
              <span>·</span>
              <span>Reactive Network</span>
              <span>·</span>
              <span>Uniswap v4</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
