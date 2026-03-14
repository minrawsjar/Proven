import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ShieldAlert,
  Activity,
  Lock,
  Database,
  Zap,
  ChevronRight,
  Github,
  Twitter,
  Disc,
  Users,
  DollarSign,
  BarChart3,
  Eye,
} from 'lucide-react'
import { ProvenLogo } from '../components/ProvenLogo'

export function Home() {
  return (
    <div className="bg-white dark:bg-[#0A0A0A] text-black dark:text-white font-sans selection:bg-[#DFFF00] selection:text-black overflow-x-hidden">

      {/* ═══ SECTION 01: HERO ═══ */}
      <section className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8 relative">
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-[#DFFF00] border-4 border-black dark:border-white -z-10" />
            <div className="absolute top-20 right-10 w-16 h-16 bg-black dark:bg-white -z-10 hidden lg:block" />

            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] mb-8">
              Time does not <br />
              <span className="bg-[#DFFF00] text-black px-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] inline-block mt-4 transform -rotate-2">
                equal trust.
              </span>
            </h1>

            <p className="text-2xl md:text-3xl font-bold max-w-3xl mb-12 leading-tight border-l-8 border-black dark:border-white pl-6">
              Performance-vested liquidity. Standard time-locks are obsolete.
              Proven Protocol ties LP unlocks strictly to on-chain performance
              milestones. Monitored autonomously. Executed cross-chain.
            </p>

            <div className="flex flex-col sm:flex-row gap-6">
              <Link
                to="/launch"
                className="font-bold uppercase tracking-wide border-4 border-black px-8 py-4 flex items-center justify-center gap-3 transition-all duration-200 ease-in-out bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]"
              >
                Deploy Liquidity <ArrowRight size={20} className="stroke-[3]" />
              </Link>
              <a
                href="https://github.com/minrawsjar/Proven"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold uppercase tracking-wide border-4 border-black dark:border-white px-8 py-4 flex items-center justify-center gap-3 transition-all duration-200 ease-in-out bg-white dark:bg-[#0A0A0A] text-black dark:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] active:translate-y-0 active:translate-x-0 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]"
              >
                Read Whitepaper <Database size={20} className="stroke-[3]" />
              </a>
            </div>
          </div>

          {/* Live Telemetry Card */}
          <div className="lg:col-span-4 hidden lg:block">
            <div className="border-4 border-black bg-[#DFFF00] text-black p-6 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <div className="border-b-4 border-black pb-4 mb-4 flex justify-between items-center">
                <span className="font-mono font-bold">LIVE TELEMETRY</span>
                <Activity className="animate-pulse" />
              </div>
              <div className="space-y-4 font-mono">
                <div className="flex justify-between">
                  <span>TVL PROTECTED</span>
                  <span className="font-black">$14.2M</span>
                </div>
                <div className="flex justify-between">
                  <span>ACTIVE POSITIONS</span>
                  <span className="font-black">124</span>
                </div>
                <div className="flex justify-between text-[#FF3333]">
                  <span>MILESTONES VERIFIED</span>
                  <span className="font-black">892</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 02: THE PROBLEM ═══ */}
      <section className="bg-black dark:bg-white text-white dark:text-black py-32 px-6 border-y-4 border-black dark:border-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-16 text-center">
            The Architecture of a{' '}
            <span className="text-[#FF3333] border-b-8 border-[#FF3333]">Rug Pull</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: Lock,
                title: '30/90/180 Day Locks',
                desc: 'Every token launch uses time-locks. Teams lock LP for a set duration. When the timer expires, they extract the liquidity. No conditions. No monitoring.',
              },
              {
                step: '02',
                icon: Activity,
                title: 'Zero Accountability',
                desc: 'Current protocols allow teams to pull liquidity regardless of whether the project delivered utility, achieved TVL, or retained a single user.',
              },
              {
                step: '03',
                icon: ShieldAlert,
                title: 'Systemic Extraction',
                desc: 'The $SQUID exploit drained $2.1M from 40,000 investors using standard time-locked contracts. The timer expired. The liquidity vanished.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-black dark:bg-white text-white dark:text-black border-4 border-white dark:border-black shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] dark:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 flex flex-col h-full hover:-translate-y-2 hover:-translate-x-2 hover:shadow-[12px_12px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-6">
                  <item.icon size={48} className="stroke-[2]" />
                  <span className="text-4xl font-black">{item.step}</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-4">{item.title}</h3>
                <p className="font-mono text-lg leading-relaxed text-gray-300 dark:text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 03: THE SOLUTION ═══ */}
      <section className="bg-[#DFFF00] py-32 px-6 border-b-4 border-black text-black">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] mb-8">
                Replacing time <br /> with metrics.
              </h2>
              <p className="text-xl font-bold mb-10 border-l-4 border-black pl-6">
                Proven shifts custody control from passive timers to active
                milestones. A launching team defines exact KPIs — TVL targets,
                volume thresholds, and unique holder counts. LP tokens unlock
                progressively only when real on-chain data proves these milestones
                have been achieved.
              </p>

              <div className="space-y-6">
                {[
                  { title: '01. LOCK', desc: "Deposit LP into Proven's vault. Set milestones and unlock percentages." },
                  { title: '02. PROVE', desc: 'Reactive Smart Contracts monitor pool metrics cross-chain every block.' },
                  { title: '03. UNLOCK', desc: 'Milestones met → LP released. Rug signals fired → lock extended.' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                  >
                    <ChevronRight className="stroke-[4] flex-shrink-0" />
                    <div>
                      <h4 className="font-black uppercase text-xl">{item.title}</h4>
                      <p className="font-mono font-bold text-gray-700">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock LP Unlock UI */}
            <div className="bg-white border-8 border-black p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
              <div className="border-b-4 border-black pb-4 mb-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter">LP Unlock Schedule</h3>
              </div>

              <div className="space-y-8">
                <div>
                  <div className="flex justify-between font-mono font-bold mb-2">
                    <span>MILESTONE 1: $1M TVL</span>
                    <span>25% UNLOCK</span>
                  </div>
                  <div className="w-full bg-gray-200 border-4 border-black h-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-[#DFFF00] border-r-4 border-black w-full" />
                    <span className="absolute inset-0 flex items-center justify-center font-black z-10">ACHIEVED</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-mono font-bold mb-2">
                    <span>MILESTONE 2: $5M VOLUME</span>
                    <span>50% UNLOCK</span>
                  </div>
                  <div className="w-full bg-gray-200 border-4 border-black h-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-[#DFFF00] border-r-4 border-black w-[60%]" />
                    <span className="absolute inset-0 flex items-center justify-center font-black z-10">60% PROGRESS</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-mono font-bold mb-2">
                    <span>MILESTONE 3: 5K USERS</span>
                    <span>25% UNLOCK</span>
                  </div>
                  <div className="w-full bg-gray-200 border-4 border-black h-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-black border-r-4 border-black w-[15%]" />
                    <span className="absolute inset-0 flex items-center justify-center font-black text-gray-500 z-10 mix-blend-difference">
                      15% PROGRESS
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 04: ARCHITECTURE ═══ */}
      <section className="bg-gray-200 dark:bg-[#111] py-32 px-6 border-b-4 border-black dark:border-white font-mono">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black uppercase font-sans tracking-tighter mb-4">
              Dual-Chain Infrastructure
            </h2>
            <p className="text-xl font-bold bg-black dark:bg-white text-white dark:text-black inline-block px-4 py-2">
              Isolating risk computation from asset custody. 4 Contracts. 2 Chains. Zero central points of failure.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Origin Chain */}
            <div className="border-4 border-black dark:border-white bg-white dark:bg-[#0A0A0A] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
              <div className="bg-black dark:bg-white text-white dark:text-black p-4 border-b-4 border-black dark:border-white text-center">
                <h3 className="text-2xl font-black font-sans uppercase tracking-widest">
                  Unichain Sepolia: Custody
                </h3>
              </div>
              <div className="p-8 space-y-8">
                <div>
                  <h4 className="font-bold text-xl mb-2 flex items-center gap-2">
                    <span className="bg-[#DFFF00] text-black px-2 border-2 border-black">01</span> VESTING HOOK
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    Uniswap v4 hook. Intercepts addLiquidity → locks LP in vault.
                    Intercepts removeLiquidity → blocks unless unlocked. Tracks
                    cumulative volume, unique swappers, and price on every swap.
                  </p>
                </div>
                <div className="h-1 w-full bg-black dark:bg-white" />
                <div>
                  <h4 className="font-bold text-xl mb-2 flex items-center gap-2">
                    <span className="bg-[#DFFF00] text-black px-2 border-2 border-black">02</span> PROVEN CALLBACK
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    Bridge receiver. Accepts cross-chain callbacks from the Lasna
                    RSC via Reactive Network's callback proxy. Dispatches
                    authorizeUnlock, extendLock, or pauseWithdrawals to the hook.
                  </p>
                </div>
              </div>
            </div>

            {/* Reactive Chain */}
            <div className="border-4 border-black dark:border-white bg-white dark:bg-[#0A0A0A] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
              <div className="bg-black text-[#DFFF00] p-4 border-b-4 border-black dark:border-white text-center">
                <h3 className="text-2xl font-black font-sans uppercase tracking-widest">
                  Lasna Testnet: Computation
                </h3>
              </div>
              <div className="p-8 space-y-8">
                <div>
                  <h4 className="font-bold text-xl mb-2 flex items-center gap-2">
                    <span className="bg-black text-white px-2 border-2 border-black dark:border-white">03</span> RISKGUARD RSC
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    The autonomous monitor. Subscribes to VestingHook events
                    cross-chain. Runs a 5-signal rug detection system with
                    composite scoring, time-based decay, and combo bonuses.
                  </p>
                </div>
                <div className="h-1 w-full bg-black dark:bg-white" />
                <div>
                  <h4 className="font-bold text-xl mb-2 flex items-center gap-2">
                    <span className="bg-black text-white px-2 border-2 border-black dark:border-white">04</span> TIERED DISPATCH
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    Score ≥ 30 → extend lock. Score ≥ 60 → pause withdrawals.
                    Score ≥ 80 → full rage lock. Milestones met → authorize
                    progressive LP release via cross-chain callback.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 05: 5-SIGNAL SYSTEM ═══ */}
      <section className="py-32 px-6 border-b-4 border-black dark:border-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4">
              5-Signal Detection
            </h2>
            <p className="text-xl font-bold bg-black dark:bg-white text-white dark:text-black inline-block px-4 py-2">
              Each signal contributes 0–20 points to a composite score. Above 50 triggers automatic intervention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { id: 'S1', icon: Users, label: 'Large Holder Outflow', trigger: '>15% of supply moved in 24h' },
              { id: 'S2', icon: DollarSign, label: 'Treasury Drain', trigger: 'Treasury balance drops >20%' },
              { id: 'S3', icon: ShieldAlert, label: 'LP Withdrawal', trigger: 'Any removeLiquidity() call' },
              { id: 'S4', icon: BarChart3, label: 'Liquidity Concentration', trigger: 'Top 3 wallets hold >60%' },
              { id: 'S5', icon: Eye, label: 'Holder Dispersion', trigger: 'Unique holders drop >10%' },
            ].map((signal) => (
              <div
                key={signal.id}
                className="bg-white dark:bg-[#0A0A0A] border-4 border-black dark:border-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-2 hover:-translate-x-2 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[10px_10px_0px_0px_rgba(255,255,255,1)] transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <signal.icon size={32} className="stroke-[2]" />
                  <span className="text-2xl font-black font-mono">{signal.id}</span>
                </div>
                <h4 className="font-black uppercase text-lg mb-2">{signal.label}</h4>
                <p className="font-mono text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{signal.trigger}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 06: RAGE LOCK ═══ */}
      <section className="bg-[#FF3333] py-32 px-6 border-b-8 border-black text-black overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)',
            backgroundPosition: '0 0, 20px 20px',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="max-w-5xl mx-auto relative z-10 bg-white border-8 border-black p-8 md:p-16 shadow-[24px_24px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 hover:rotate-0 transition-transform duration-500">
          <div className="flex items-center gap-6 mb-8">
            <ShieldAlert size={64} className="text-[#FF3333] animate-pulse flex-shrink-0" />
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black">
              The Rage Lock
            </h2>
          </div>

          <p className="text-2xl font-bold mb-10 leading-tight text-black">
            If the founding team behaves, milestones unlock LP progressively. If
            the Reactive Chain detects anomaly thresholds — synchronized insider
            dumping, sudden liquidity reduction, or contract manipulation — the
            protocol intervenes.
          </p>

          <div className="bg-black text-white p-8 border-4 border-black relative">
            <div className="absolute -top-4 -right-4 bg-[#DFFF00] text-black font-black uppercase px-4 py-2 border-4 border-black transform rotate-6">
              SYSTEM OVERRIDE
            </div>
            <h4 className="text-2xl font-black text-[#FF3333] mb-4 uppercase tracking-widest flex items-center gap-3">
              <Zap className="fill-[#FF3333]" /> Rage Lock Initiated
            </h4>
            <p className="font-mono text-xl leading-relaxed">
              Existing KPI progress is automatically overridden. Lock durations
              are forcefully extended. Retail liquidity is frozen and protected
              until trust is re-established.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-black dark:bg-white text-white dark:text-black py-16 px-6 border-t-8 border-black dark:border-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 font-mono">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <ProvenLogo size={28} className="shrink-0" />
              <span className="text-3xl font-black uppercase tracking-tighter font-sans">
                Proven Protocol
              </span>
            </div>
            <p className="text-xl font-bold bg-white dark:bg-black text-black dark:text-white inline-block px-4 py-2 uppercase font-sans mb-8">
              Trust via Execution.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h5 className="font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">Protocol</h5>
            <Link to="/launch" className="hover:text-[#DFFF00] hover:translate-x-2 transition-transform flex items-center gap-2">
              <ChevronRight size={16} /> Launch Pool
            </Link>
            <Link to="/verify" className="hover:text-[#DFFF00] hover:translate-x-2 transition-transform flex items-center gap-2">
              <ChevronRight size={16} /> Dashboard
            </Link>
            <Link to="/monitor" className="hover:text-[#DFFF00] hover:translate-x-2 transition-transform flex items-center gap-2">
              <ChevronRight size={16} /> RSC Monitor
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            <h5 className="font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">Community</h5>
            <a href="#" className="hover:text-[#DFFF00] hover:translate-x-2 transition-transform flex items-center gap-2">
              <Twitter size={16} /> Twitter / X
            </a>
            <a href="#" className="hover:text-[#DFFF00] hover:translate-x-2 transition-transform flex items-center gap-2">
              <Disc size={16} /> Discord
            </a>
            <a
              href="https://github.com/minrawsjar/Proven"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#DFFF00] hover:translate-x-2 transition-transform flex items-center gap-2"
            >
              <Github size={16} /> Github
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t-4 border-white dark:border-black flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-gray-500 dark:text-gray-400">
            <ProvenLogo size={16} className="shrink-0" />
            <p>© 2026 PROVEN PROTOCOL. BUILT FOR DECENTRALIZED ACCOUNTABILITY.</p>
          </div>
          <div className="flex gap-6 font-mono text-sm text-gray-500 dark:text-gray-400">
            <span>Unichain Sepolia</span>
            <span>·</span>
            <span>Reactive Network</span>
            <span>·</span>
            <span>Uniswap v4</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
