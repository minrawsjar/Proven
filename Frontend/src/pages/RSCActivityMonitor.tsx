import { useState, useEffect, useRef } from 'react'
import { createPublicClient, http, type Log, keccak256, toHex, decodeAbiParameters, formatEther } from 'viem'
import { useRSCMonitorStore } from '../store/rscMonitorStore.ts'
import {
  VESTING_HOOK_ADDRESS,
  RISK_GUARD_RSC_ADDRESS,
  UNICHAIN_RPC,
  LASNA_RPC,
  UNICHAIN_EXPLORER,
  LASNA_EXPLORER,
} from '../config/constants.ts'
import { vestingHookAbi, riskGuardRSCAbi } from '../config/contracts.ts'
import { formatAddress } from '../utils/format.ts'
import { Radio, Zap, ArrowRight, Pause, Play, ExternalLink, Layers, AlertTriangle, GitBranch, Wifi, WifiOff } from 'lucide-react'

/* ── Viem clients for direct polling ── */
const unichainClient = createPublicClient({ transport: http(UNICHAIN_RPC) })
const lasnaClient = createPublicClient({ transport: http(LASNA_RPC) })
const MONITOR_LOOKBACK_BLOCKS = 5_000_000n

/* ── Build a proper topic0 → event name map using keccak256 of event signatures ── */
const buildTopicMap = (): Record<string, string> => {
  const map: Record<string, string> = {}
  const allAbi = [...vestingHookAbi, ...riskGuardRSCAbi]

  for (const item of allAbi) {
    if ((item as any).type !== 'event') continue
    const evt = item as unknown as { name: string; inputs: Array<{ type: string }> }
    const sig = `${evt.name}(${evt.inputs.map((i: any) => i.type).join(',')})`
    const hash = keccak256(toHex(sig))
    map[hash] = evt.name
  }
  return map
}
const eventNameMap = buildTopicMap()

const guessEventName = (log: Log): string => {
  const topic0 = log.topics?.[0]
  if (!topic0) return 'Unknown'
  return eventNameMap[topic0] ?? `Event(${topic0.slice(0, 10)}...)`
}

const topicToAddress = (topic?: `0x${string}`): `0x${string}` | null => {
  if (!topic || topic.length !== 66) return null
  return `0x${topic.slice(26)}` as `0x${string}`
}

const extractRelatedTeam = (eventName: string, log: Log): `0x${string}` | null => {
  switch (eventName) {
    case 'PositionRegistered':
    case 'PositionLocked':
    case 'MilestoneUnlocked':
    case 'LockExtended':
    case 'WithdrawalsPaused':
    case 'UnlockAuthorized':
    case 'RiskScoreUpdated':
    case 'RiskElevated':
    case 'SignalTriggered':
    case 'ComboBonus':
      return topicToAddress(log.topics?.[1] as `0x${string}` | undefined)
    default:
      return null
  }
}

/** Decode PoolMetricsUpdated(bytes32, uint256 tvl, uint256 cumulativeVol, uint256 uniqueUsers) */
const decodePoolMetrics = (data: `0x${string}` | undefined): string => {
  if (!data || data === '0x') return ''
  try {
    const decoded = decodeAbiParameters(
      [{ name: 'tvl', type: 'uint256' }, { name: 'vol', type: 'uint256' }, { name: 'users', type: 'uint256' }],
      data as `0x${string}`,
    )
    const tvl = Number(formatEther(decoded[0])).toFixed(2)
    const vol = Number(formatEther(decoded[1])).toFixed(2)
    return `TVL: ${tvl} · Vol: ${vol} · Users: ${decoded[2].toString()}`
  } catch {
    return ''
  }
}

export function RSCActivityMonitor() {
  const {
    incomingEvents,
    rscResponses,
    stats,
    addIncomingEvent,
    addRSCResponse,
    setStats,
    setIncomingEvents,
    setRSCResponses,
  } = useRSCMonitorStore()

  const [projectFilter, setProjectFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [relayStatus, setRelayStatus] = useState<'checking' | 'active' | 'waiting'>('checking')
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  /* ── Direct polling for Unichain Hook events ── */
  useEffect(() => {
    if (isPaused) return
    let fromBlock = 0n

    const poll = async () => {
      try {
        const currentBlock = await unichainClient.getBlockNumber()
        if (fromBlock === 0n) fromBlock = currentBlock > MONITOR_LOOKBACK_BLOCKS ? currentBlock - MONITOR_LOOKBACK_BLOCKS : 0n

        const logs = await unichainClient.getLogs({
          address: VESTING_HOOK_ADDRESS,
          fromBlock,
          toBlock: currentBlock,
        })
        fromBlock = currentBlock + 1n

        for (const log of logs) {
          const evtName = guessEventName(log)
          const metricsInfo = evtName === 'PoolMetricsUpdated' ? decodePoolMetrics(log.data) : ''
          const relatedTeam = extractRelatedTeam(evtName, log)
          addIncomingEvent({
            id: `uni-${log.transactionHash}-${log.logIndex}`,
            timestamp: Date.now(),
            chain: 'UNICHAIN_SEPOLIA',
            blockNumber: Number(log.blockNumber),
            eventName: evtName,
            fromAddress: log.address,
            value: [
              relatedTeam ? `team:${relatedTeam}` : '',
              metricsInfo || (log.data?.slice(0, 22) ?? ''),
            ].filter(Boolean).join(' · '),
            txHash: log.transactionHash ?? '0x',
          })
        }
      } catch (err) {
        console.error('Unichain polling error:', err)
      }
    }

    poll()
    const interval = setInterval(poll, 12_000)
    return () => clearInterval(interval)
  }, [isPaused, addIncomingEvent])

  /* ── Direct polling for Lasna RSC events ── */
  useEffect(() => {
    if (isPaused) return
    let fromBlock = 0n

    const poll = async () => {
      try {
        const currentBlock = await lasnaClient.getBlockNumber()
        if (fromBlock === 0n) fromBlock = currentBlock > MONITOR_LOOKBACK_BLOCKS ? currentBlock - MONITOR_LOOKBACK_BLOCKS : 0n

        const logs = await lasnaClient.getLogs({
          address: RISK_GUARD_RSC_ADDRESS,
          fromBlock,
          toBlock: currentBlock,
        })
        fromBlock = currentBlock + 1n

        let reactCalls = 0
        let callbacks = 0
        let unlocks = 0
        let extensions = 0

        for (const log of logs) {
          reactCalls++
          const evtName = guessEventName(log)
          const relatedTeam = extractRelatedTeam(evtName, log)
          if (evtName.toLowerCase().includes('callback') || evtName.toLowerCase().includes('dispatch')) callbacks++
          if (evtName.toLowerCase().includes('unlock')) unlocks++
          if (evtName.toLowerCase().includes('extend') || evtName.toLowerCase().includes('lock')) extensions++

          addRSCResponse({
            id: `lasna-${log.transactionHash}-${log.logIndex}`,
            timestamp: Date.now(),
            signalId: 'S?',
            conditionChecked: relatedTeam ? `${evtName} · team:${relatedTeam}` : evtName,
            result: 'TRIGGERED',
            scoreChange: 0,
            newCompositeScore: 0,
            actionTaken: evtName,
            callbackTxHash: log.transactionHash ?? null,
            projectAddress: relatedTeam ?? log.address,
          })
        }

        setStats({
          totalReactCalls: stats.totalReactCalls + reactCalls,
          totalCallbacksDispatched: stats.totalCallbacksDispatched + callbacks,
          totalMilestonesUnlocked: stats.totalMilestonesUnlocked + unlocks,
          totalLockExtensionsApplied: stats.totalLockExtensionsApplied + extensions,
        })
      } catch (err) {
        console.error('Lasna polling error:', err)
      }
    }

    poll()
    const interval = setInterval(poll, 15_000)
    return () => clearInterval(interval)
  }, [isPaused, addRSCResponse, setStats])

  /* ── Poll RSC contract stats directly ── */
  useEffect(() => {
    if (isPaused) return
    const pollStats = async () => {
      try {
        const [reactCalls, callbacks] = await Promise.all([
          lasnaClient.readContract({
            address: RISK_GUARD_RSC_ADDRESS,
            abi: riskGuardRSCAbi,
            functionName: 'totalReactCalls',
          }),
          lasnaClient.readContract({
            address: RISK_GUARD_RSC_ADDRESS,
            abi: riskGuardRSCAbi,
            functionName: 'totalCallbacks',
          }),
        ])
        setStats({
          totalReactCalls: Number(reactCalls),
          totalCallbacksDispatched: Number(callbacks),
          totalMilestonesUnlocked: stats.totalMilestonesUnlocked,
          totalLockExtensionsApplied: stats.totalLockExtensionsApplied,
        })
        setRelayStatus(Number(reactCalls) > 0 ? 'active' : 'waiting')
      } catch (err) {
        console.error('RSC stats polling error:', err)
      }
    }
    pollStats()
    const interval = setInterval(pollStats, 10_000)
    return () => clearInterval(interval)
  }, [isPaused, setStats])

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (!autoScroll) return
    leftRef.current?.scrollTo({ top: leftRef.current.scrollHeight, behavior: 'smooth' })
    rightRef.current?.scrollTo({ top: rightRef.current.scrollHeight, behavior: 'smooth' })
  }, [incomingEvents.length, rscResponses.length, autoScroll])

  const statCards = [
    { label: 'React() Calls', value: stats.totalReactCalls, icon: Zap },
    { label: 'Callbacks Sent', value: stats.totalCallbacksDispatched, icon: ArrowRight },
    { label: 'Milestones Unlocked', value: stats.totalMilestonesUnlocked, icon: Layers },
    { label: 'Lock Extensions', value: stats.totalLockExtensionsApplied, icon: AlertTriangle },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <span className="inline-block bg-black text-[#DFFF00] font-black uppercase text-xs px-4 py-1 border-2 border-black mb-3">LIVE MONITOR</span>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">RSC Activity</h1>
            <p className="font-mono text-gray-600 dark:text-gray-400 mt-1">Dual-chain event stream — Unichain Sepolia ↔ Lasna</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Relay status */}
            <div className={`flex items-center gap-2 px-4 py-2 border-4 border-black dark:border-white font-bold uppercase text-xs ${relayStatus === 'active' ? 'bg-green-400 text-black' : relayStatus === 'waiting' ? 'bg-yellow-300 text-black' : 'bg-gray-200 dark:bg-[#1A1A1A]'}`}>
              {relayStatus === 'active' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              RSC RELAY: {relayStatus === 'active' ? 'ACTIVE' : relayStatus === 'waiting' ? 'WAITING' : 'CHECKING'}
            </div>
            {/* Live indicator */}
            <div className={`flex items-center gap-2 px-4 py-2 border-4 border-black dark:border-white font-bold uppercase text-sm ${isPaused ? 'bg-gray-200 dark:bg-[#1A1A1A]' : 'bg-[#DFFF00] text-black'}`}>
              <span className={`w-3 h-3 border-2 border-black dark:border-white ${isPaused ? 'bg-gray-400' : 'bg-[#FF3333] animate-pulse'}`} />
              {isPaused ? 'PAUSED' : 'LIVE'}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] p-5 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4 stroke-[2.5]" />
                <span className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{s.label}</span>
              </div>
              <span className="font-black text-3xl font-mono">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-6">
          <input
            className="flex-1 bg-white dark:bg-[#111] border-4 border-black dark:border-white px-4 py-3 font-mono text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-shadow"
            placeholder="Filter by project address 0x..."
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          />
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`border-4 border-black dark:border-white px-5 py-3 font-bold uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] active:translate-y-0 active:shadow-none transition-all flex items-center gap-2 ${isPaused ? 'bg-[#DFFF00] text-black' : 'bg-white dark:bg-[#111]'}`}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`border-4 border-black dark:border-white px-5 py-3 font-bold uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] active:translate-y-0 active:shadow-none transition-all ${autoScroll ? 'bg-black dark:bg-white text-[#DFFF00] dark:text-black' : 'bg-white dark:bg-[#111]'}`}
          >
            AUTO-SCROLL {autoScroll ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => { setIncomingEvents([]); setRSCResponses([]) }}
            className="border-4 border-[#FF3333] px-5 py-3 font-bold uppercase text-sm bg-white dark:bg-[#111] text-[#FF3333] shadow-[4px_4px_0px_0px_rgba(255,51,51,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(255,51,51,1)] active:translate-y-0 active:shadow-none transition-all"
          >
            CLEAR
          </button>
        </div>

        {/* Dual Column Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Unichain Events */}
          <div className="border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
            <div className="bg-[#DFFF00] border-b-4 border-black p-4 flex items-center gap-3">
              <Radio className="w-5 h-5 stroke-[2.5]" />
              <div>
                <h3 className="font-black uppercase text-sm text-black">Unichain Sepolia</h3>
                <p className="font-mono text-[10px] text-gray-700">VestingHook · Chain 1301</p>
              </div>
              <span className="ml-auto bg-black text-[#DFFF00] font-mono text-xs px-3 py-1 font-bold">
                {incomingEvents.length} EVENTS
              </span>
            </div>
            <div ref={leftRef} className="h-96 overflow-y-auto bg-white dark:bg-[#0A0A0A]">
              {incomingEvents.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-mono text-gray-400 text-sm">Waiting for hook events...</p>
                </div>
              ) : (
                <div className="divide-y-2 divide-black dark:divide-white">
                  {incomingEvents.filter((e) => {
                    if (!projectFilter) return true
                    const q = projectFilter.toLowerCase()
                    return (
                      e.fromAddress.toLowerCase().includes(q) ||
                      e.eventName.toLowerCase().includes(q) ||
                      e.value.toLowerCase().includes(q) ||
                      e.txHash.toLowerCase().includes(q)
                    )
                  }).map((evt) => (
                    <div key={evt.id} className="p-3 hover:bg-gray-50 dark:hover:bg-[#111] transition font-mono text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 border-2 border-black dark:border-white font-black text-[10px] ${evt.eventName === 'PoolMetricsUpdated' ? 'bg-[#DFFF00] text-black' : evt.eventName === 'CrashDetected' ? 'bg-[#FF3333] text-white' : evt.eventName === 'PositionRegistered' ? 'bg-blue-400 text-black' : 'bg-gray-200 dark:bg-[#1A1A1A]'}`}>{evt.eventName}</span>
                        <span className="text-gray-400">Block #{evt.blockNumber}</span>
                      </div>
                      {evt.value && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">{evt.value}</div>
                      )}
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <span>{formatAddress(evt.fromAddress)}</span>
                        {evt.txHash && evt.txHash !== '0x' && (
                          <a href={`${UNICHAIN_EXPLORER}/tx/${evt.txHash}`} target="_blank" rel="noopener noreferrer" className="hover:text-black dark:hover:text-white inline-flex items-center gap-1">
                            {evt.txHash.slice(0, 10)}... <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Lasna RSC Responses */}
          <div className="border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
            <div className="bg-black border-b-4 border-black dark:border-white p-4 flex items-center gap-3">
              <GitBranch className="w-5 h-5 stroke-[2.5] text-[#DFFF00]" />
              <div>
                <h3 className="font-black uppercase text-sm text-[#DFFF00]">Lasna RSC</h3>
                <p className="font-mono text-[10px] text-gray-400">RiskGuardRSC · Chain 5318007</p>
              </div>
              <span className="ml-auto bg-[#DFFF00] text-black font-mono text-xs px-3 py-1 font-bold">
                {rscResponses.length} RESPONSES
              </span>
            </div>
            <div ref={rightRef} className="h-96 overflow-y-auto bg-white dark:bg-[#0A0A0A]">
              {rscResponses.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-mono text-gray-400 text-sm">Waiting for RSC responses...</p>
                </div>
              ) : (
                <div className="divide-y-2 divide-black dark:divide-white">
                  {rscResponses.filter((r) => {
                    if (!projectFilter) return true
                    const q = projectFilter.toLowerCase()
                    return (
                      r.projectAddress.toLowerCase().includes(q) ||
                      r.conditionChecked.toLowerCase().includes(q) ||
                      r.actionTaken.toLowerCase().includes(q) ||
                      (r.callbackTxHash ?? '').toLowerCase().includes(q)
                    )
                  }).map((res) => (
                    <div key={res.id} className="p-3 hover:bg-gray-50 dark:hover:bg-[#111] transition font-mono text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 border-2 border-black dark:border-white font-black text-[10px] ${res.result === 'TRIGGERED' ? 'bg-[#FF3333] text-white' : 'bg-gray-200 dark:bg-[#1A1A1A]'}`}>
                          {res.result}
                        </span>
                        <span className="font-bold">{res.conditionChecked}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <span>Signal: {res.signalId}</span>
                        {res.actionTaken && <span>→ {res.actionTaken}</span>}
                        {res.callbackTxHash && (
                          <a href={`${LASNA_EXPLORER}/tx/${res.callbackTxHash}`} target="_blank" rel="noopener noreferrer" className="hover:text-black dark:hover:text-white inline-flex items-center gap-1 ml-auto">
                            TX <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {res.scoreChange !== 0 && (
                        <div className="mt-1 text-gray-400">
                          Score: {res.newCompositeScore} ({res.scoreChange > 0 ? '+' : ''}{res.scoreChange})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Architecture Note */}
        <div className="mt-8 p-5 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#111] font-mono text-xs text-gray-600 dark:text-gray-400">
          <span className="font-black text-black dark:text-white font-sans uppercase">How it works:</span> VestingHook events on Unichain (left) are picked up by the Reactive Network. The RSC evaluates 5 signals, computes a composite risk score, and dispatches callbacks (right). It either unlocks milestones or extends lock windows.
        </div>
        {relayStatus === 'waiting' && (
          <div className="mt-4 p-5 border-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 font-mono text-xs text-yellow-800 dark:text-yellow-300">
            <span className="font-black font-sans uppercase">⏳ Relay Status:</span> The Reactive Network relay has not yet delivered events to the RSC contract on Lasna (totalReactCalls = 0). Events are confirmed on Unichain. The relay will process them when the testnet infrastructure catches up. RSC contract: {formatAddress(RISK_GUARD_RSC_ADDRESS as `0x${string}`)}
          </div>
        )}
      </div>
    </div>
  )
}
