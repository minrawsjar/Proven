import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Lock, TrendingUp, CheckCircle, AlertTriangle, Activity } from 'lucide-react'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { NetworkSphere } from '../components/NetworkSphere'

const TICKER_ITEMS = [
  { event: 'MILESTONEUNLOCKED', project: '$NOVA', time: '0.45 AGO' },
  { event: 'NEWPOSITIONCREATED', detail: '0xAA...F20', time: '2.15 AGO' },
  { event: 'MILESTONEUNLOCKED', project: '$DRIFT', time: '4.30 AGO' },
  { event: 'LOCKEXTENDED', project: '$WAVE', time: '8.12 AGO' },
  { event: 'NEWPOSITIONCREATED', detail: '0x3B...E91', time: '12.00 AGO' },
  { event: 'MILESTONEUNLOCKED', project: '$SPARK', time: '15.22 AGO' },
]

export function Home() {
  const [items] = useState([...TICKER_ITEMS, ...TICKER_ITEMS])

  return (
    <div className="relative">
      {/* Floating particles background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-20">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-brand rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ═══ HERO ═══ */}
      <section className="relative pt-20 pb-32 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left column */}
            <div className="space-y-8 z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/30">
                <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                <span className="text-sm text-brand font-medium">Built on Unichain</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white">
                The Performance-Vested{' '}
                <span className="text-brand">Liquidity Layer</span>{' '}
                for Unichain
              </h1>

              <p className="text-lg text-white/40 leading-relaxed max-w-lg">
                A better place to launch your token. Liquidity secured by milestones, not time — verified autonomously by Reactive Smart Contracts.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  to="/launch"
                  className="px-8 py-4 rounded-lg bg-brand text-void font-semibold hover:bg-brand-light transition-all hover:shadow-xl hover:shadow-brand/50"
                >
                  Launch Pool
                </Link>
                <Link
                  to="/verify"
                  className="px-8 py-4 rounded-lg border border-brand/30 text-white font-semibold hover:bg-brand/10 transition-all"
                >
                  View Dashboard
                </Link>
              </div>

              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-3xl font-bold text-brand font-mono">
                    <AnimatedCounter end={14.2} prefix="$" suffix="M" decimals={1} />
                  </div>
                  <div className="text-sm text-white/40">Total Value Locked</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-brand font-mono">
                    <AnimatedCounter end={124} prefix="" suffix="" decimals={0} />
                  </div>
                  <div className="text-sm text-white/40">Active Positions</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-brand font-mono">
                    <AnimatedCounter end={892} prefix="" suffix="" decimals={0} />
                  </div>
                  <div className="text-sm text-white/40">Milestones Completed</div>
                </div>
              </div>
            </div>

            {/* Right column — 3D sphere */}
            <div className="relative h-[500px] flex items-center justify-center">
              <NetworkSphere />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LIVE TICKER ═══ */}
      <section className="py-4 border-y border-surface-border overflow-hidden">
        <div className="ticker-wrap">
          <div className="ticker-content gap-6">
            {items.map((item, i) => (
              <div key={i} className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                <span className="live-dot !w-1.5 !h-1.5" />
                <span className="text-brand font-semibold">{item.event}</span>
                <span className="text-white/50">
                  {item.project ? `FOR ${item.project}` : `BY ${item.detail}`}
                </span>
                <span className="text-white/20">• {item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ $SQUID CASE STUDY ═══ */}
      <section className="py-20 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl p-8 md:p-12 border border-neon-red/30 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.03))' }}
          >
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-full bg-neon-red/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-neon-red" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">The $SQUID Rug Pull</h2>
                <p className="text-white/50">BBC-documented $2.1M scam that could have been prevented</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-neon-red">What Happened</h3>
                <ul className="space-y-3 text-white/50">
                  <li className="flex items-start gap-2">
                    <span className="text-neon-red mt-1">•</span>
                    <span>Token launched with standard time-locked liquidity (7 days)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-red mt-1">•</span>
                    <span>Developers waited out the lock period while hype built</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-red mt-1">•</span>
                    <span>$2.1M drained in minutes after unlock, BBC featured the story</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-red mt-1">•</span>
                    <span>Investors left with worthless tokens and no recourse</span>
                  </li>
                </ul>
                <a
                  href="https://www.bbc.com/news/business-59129466"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-neon-red/70 hover:text-neon-red text-sm font-medium mt-2 transition-colors"
                >
                  Read more on BBC ↗
                </a>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-brand">With Proven Protocol</h3>
                <ul className="space-y-3 text-white/50">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
                    <span>Liquidity locked behind performance milestones, not time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
                    <span>Continuous monitoring of on-chain metrics and rug signals</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
                    <span>Automated "Rage Lock" extends lock if suspicious activity detected</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
                    <span>Transparent dashboard shows real-time progress and risk scores</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-20 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand text-xs font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Three steps to <span className="text-brand">trustless</span> token launches
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Lock */}
            <div className="relative">
              <div className="rounded-2xl border border-surface-border bg-surface p-8 hover:border-brand/50 transition-all hover:shadow-lg hover:shadow-brand/10">
                <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
                  <Lock className="w-8 h-8 text-brand" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">1. Lock</h3>
                <p className="text-white/40 mb-6 leading-relaxed">
                  Token teams deposit liquidity into a Uniswap v4 pool via Proven's vault. LP tokens are held by a smart contract with milestone-based unlock conditions.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>Set custom milestones (TVL, volume, users)</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>Define unlock percentages per milestone</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>Configure monitoring wallets</span>
                  </div>
                </div>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-brand to-transparent" />
            </div>

            {/* Prove */}
            <div className="relative">
              <div className="rounded-2xl border border-surface-border bg-surface p-8 hover:border-brand/50 transition-all hover:shadow-lg hover:shadow-brand/10">
                <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
                  <Activity className="w-8 h-8 text-brand" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">2. Prove</h3>
                <p className="text-white/40 mb-6 leading-relaxed">
                  Reactive Smart Contracts continuously monitor real on-chain metrics across chains. They watch for milestone completion AND rug signals.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>Cross-chain verification (Unichain ↔ Kopli)</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>Real-time rug signal detection</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>Automated risk scoring</span>
                  </div>
                </div>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-brand to-transparent" />
            </div>

            {/* Unlock */}
            <div className="relative">
              <div className="rounded-2xl border border-surface-border bg-surface p-8 hover:border-brand/50 transition-all hover:shadow-lg hover:shadow-brand/10">
                <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
                  <CheckCircle className="w-8 h-8 text-brand" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">3. Unlock</h3>
                <p className="text-white/40 mb-6 leading-relaxed">
                  When milestones are verified, the RSC authorizes partial LP release. If suspicious activity detected, lock period extends automatically.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>Progressive unlock based on performance</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>"Rage Lock" for suspicious activity</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>Transparent unlock events</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHY PROVEN ═══ */}
      <section className="py-20 px-4 relative" style={{ background: 'rgba(10, 31, 20, 0.3)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why Proven Protocol?</h2>
            <p className="text-lg text-white/40">Milestones &gt; Timelocks</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-xl border border-surface-border bg-surface p-6 hover:border-brand/30 transition-all">
              <Shield className="w-10 h-10 text-brand mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Secured by Milestones</h3>
              <p className="text-sm text-white/40">
                Liquidity unlocks based on real performance metrics, not arbitrary time periods
              </p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface p-6 hover:border-brand/30 transition-all">
              <AlertTriangle className="w-10 h-10 text-brand mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Rug-Proof Launches</h3>
              <p className="text-sm text-white/40">
                Continuous monitoring with automatic lock extensions for suspicious activity
              </p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface p-6 hover:border-brand/30 transition-all">
              <Activity className="w-10 h-10 text-brand mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Cross-Chain Verification</h3>
              <p className="text-sm text-white/40">
                Powered by Reactive Smart Contracts on Kopli/Reactive Network
              </p>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface p-6 hover:border-brand/30 transition-all">
              <TrendingUp className="w-10 h-10 text-brand mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Built on Uniswap v4</h3>
              <p className="text-sm text-white/40">
                Leverages hooks and Unichain L2 for optimal performance and security
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA SECTION ═══ */}
      <section className="py-32 px-4 relative">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Launch with Confidence?
          </h2>
          <p className="text-xl text-white/40 mb-12 max-w-xl mx-auto">
            Join the teams building trust through performance-vested liquidity
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/launch"
              className="px-10 py-5 rounded-lg bg-brand text-void font-semibold hover:bg-brand-light transition-all hover:shadow-2xl hover:shadow-brand/50 text-lg"
            >
              Launch Your Pool 🚀
            </Link>
            <a
              href="https://docs.reactive.network"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 rounded-lg border border-brand/30 text-white font-semibold hover:bg-brand/10 transition-all text-lg"
            >
              Read the Docs
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-surface-border/50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-void" />
                </div>
                <span className="text-lg font-semibold text-white">Proven Protocol</span>
              </div>
              <p className="text-sm text-white/30 leading-relaxed">
                The performance-vested liquidity layer for Unichain. Built with Reactive Smart Contracts and Uni v4 Hooks.
              </p>
            </div>

            <div>
              <h4 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/30">
                <li><Link to="/launch" className="hover:text-brand transition-colors">Launch Pool</Link></li>
                <li><Link to="/verify" className="hover:text-brand transition-colors">Dashboard</Link></li>
                <li><Link to="/monitor" className="hover:text-brand transition-colors">RSC Monitor</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-white/30">
                <li><a href="https://docs.reactive.network" target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-brand transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-brand transition-colors">Whitepaper</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-white/30">
                <li><a href="#" className="hover:text-brand transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-brand transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-brand transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-surface-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/20">
            <p>© 2025 Proven Protocol. All rights reserved.</p>
            <div className="flex gap-6">
              <span>Unichain</span>
              <span>·</span>
              <span>Reactive Network</span>
              <span>·</span>
              <span>Uni v4 Hooks</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
