import { useEffect, useState, useCallback } from 'react'
import { useAccount, useNetwork, useSwitchNetwork, usePublicClient, useWalletClient } from 'wagmi'
import { getWalletClient as getCoreWalletClient, getPublicClient as getCorePublicClient } from '@wagmi/core'
import { createPublicClient, http, parseAbiItem, decodeFunctionData, type Log } from 'viem'
import { useVerifyStore, type OnChainEvent } from '../store/verifyStore.ts'
import { useRSCMonitorStore } from '../store/rscMonitorStore.ts'
import { unichainSepolia, lasnaTestnet } from '../config/wagmi.ts'
import { vestingHookAbi, riskGuardRSCAbi, erc20Abi, poolManagerAbi, poolModifyLiquidityTestAbi } from '../config/contracts.ts'
import {
  VESTING_HOOK_ADDRESS,
  CALLBACK_RECEIVER_ADDRESS,
  RISK_GUARD_RSC_ADDRESS,
  LASNA_RPC,
  UNICHAIN_RPC,
  CONDITION_TYPE_MAP,
  POOL_MANAGER_ADDRESS,
  POOL_MODIFY_LIQUIDITY_TEST_ADDRESS,
} from '../config/constants.ts'
import {
  buildPoolKey,
  computePoolId,
  computeSqrtPriceX96,
  fullRangeTicks,
  sortTokens,
  type PoolKeyTuple,
} from '../utils/pool.ts'

/* ═══════════════════════════════════════════════════════════════════════════════
 *  1. Wallet connection helper
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const useWallet = () => {
  const { address, isConnected, isConnecting } = useAccount()
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()

  const isWrongNetwork = isConnected && chain?.id !== unichainSepolia.id

  const ensureCorrectNetwork = useCallback(() => {
    if (isWrongNetwork && switchNetwork) {
      switchNetwork(unichainSepolia.id)
    }
  }, [isWrongNetwork, switchNetwork])

  return {
    address,
    isConnected,
    isConnecting,
    chain,
    isWrongNetwork,
    ensureCorrectNetwork,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  2. Viem public clients (one per chain)
 * ═══════════════════════════════════════════════════════════════════════════════ */

const unichainClient = createPublicClient({
  chain: unichainSepolia,
  transport: http(UNICHAIN_RPC),
})

const lasnaClient = createPublicClient({
  chain: lasnaTestnet,
  transport: http(LASNA_RPC),
})

const lockExtendRelayedEvent = parseAbiItem(
  'event LockExtendRelayed(address indexed team, uint32 penaltyDays)',
)

const pauseWithdrawalsRelayedEvent = parseAbiItem(
  'event PauseWithdrawalsRelayed(address indexed team, uint32 pauseHours)',
)

const signalTriggeredEvent = parseAbiItem(
  'event SignalTriggered(address indexed team, uint8 signalId, uint16 points)',
)

const milestoneUnlockedEvent = parseAbiItem(
  'event MilestoneUnlocked(address indexed team, uint8 indexed milestoneId, uint8 newUnlockedPct)',
)

const positionRegisteredEvent = parseAbiItem(
  'event PositionRegistered(address indexed team, address indexed tokenAddr, bytes32 indexed poolId)',
)

/** Small delay so MetaMask's internal nonce tracker can catch up between sequential TXs */
const nonceSafeWait = (ms = 2500) => new Promise((r) => setTimeout(r, ms))

/* ═══════════════════════════════════════════════════════════════════════════════
 *  3. Token metadata reader
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface TokenInfo {
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
}

export const useTokenInfo = (tokenAddress?: `0x${string}`) => {
  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') return
    let cancelled = false

    const fetch = async () => {
      setLoading(true)
      try {
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          unichainClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'name' }),
          unichainClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'symbol' }),
          unichainClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
          unichainClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'totalSupply' }),
        ])
        if (!cancelled) setInfo({ name, symbol, decimals, totalSupply } as TokenInfo)
      } catch {
        if (!cancelled) setInfo(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [tokenAddress])

  return { info, loading }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  4. Read on-chain position data from VestingHook
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface PositionData {
  team: `0x${string}`
  tokenAddr: `0x${string}`
  lpAmount: bigint
  registeredAt: bigint
  lockExtendedUntil: bigint
  unlockedPct: number
}

export interface MilestoneConfig {
  conditionType: number
  threshold: bigint
  unlockPct: number
  complete: boolean
}

export const usePositionData = (teamAddress?: string) => {
  const [data, setData] = useState<PositionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvedTeam, setResolvedTeam] = useState<`0x${string}` | null>(null)

  useEffect(() => {
    if (!teamAddress) return
    let cancelled = false
    const addr = teamAddress as `0x${string}`

    const fetch = async () => {
      setLoading(true)
      setError(null)
      setResolvedTeam(null)
      try {
        const readByTeam = async (team: `0x${string}`) => {
          const [position, unlockedPct] = await Promise.all([
            unichainClient.readContract({
              address: VESTING_HOOK_ADDRESS,
              abi: vestingHookAbi,
              functionName: 'positions',
              args: [team],
            }),
            unichainClient.readContract({
              address: VESTING_HOOK_ADDRESS,
              abi: vestingHookAbi,
              functionName: 'unlockedPctByTeam',
              args: [team],
            }),
          ])

          const [pTeam, tokenAddr, lpAmount, registeredAt, lockExtendedUntil] = position as [
            `0x${string}`, `0x${string}`, bigint, bigint, bigint,
          ]

          return {
            team: pTeam,
            tokenAddr,
            lpAmount,
            registeredAt,
            lockExtendedUntil,
            unlockedPct: Number(unlockedPct),
          } satisfies PositionData
        }

        let resolved = await readByTeam(addr)

        const isEmptyPosition =
          resolved.team === '0x0000000000000000000000000000000000000000' || resolved.registeredAt === 0n

        if (isEmptyPosition) {
          try {
            const owner = await unichainClient.readContract({
              address: addr,
              abi: [
                {
                  type: 'function',
                  name: 'owner',
                  inputs: [],
                  outputs: [{ name: '', type: 'address' }],
                  stateMutability: 'view',
                },
              ] as const,
              functionName: 'owner',
            }) as `0x${string}`

            if (
              owner &&
              owner !== '0x0000000000000000000000000000000000000000' &&
              owner.toLowerCase() !== addr.toLowerCase()
            ) {
              const ownerPosition = await readByTeam(owner)
              const ownerHasPosition =
                ownerPosition.team !== '0x0000000000000000000000000000000000000000' &&
                ownerPosition.registeredAt > 0n

              if (ownerHasPosition) {
                resolved = ownerPosition
                if (!cancelled) setResolvedTeam(owner)
              }
            }
          } catch {
            // Ignore non-ownable contracts or EOAs.
          }
        }

        if (!cancelled) {
          setData(resolved)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to read position')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [teamAddress])

  return { data, loading, error, resolvedTeam }
}

export const useMilestoneConfig = (teamAddress?: string) => {
  const [milestones, setMilestones] = useState<MilestoneConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!teamAddress) return
    let cancelled = false
    const addr = teamAddress as `0x${string}`

    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await Promise.all(
          [0n, 1n, 2n].map((i) =>
            unichainClient.readContract({
              address: VESTING_HOOK_ADDRESS,
              abi: vestingHookAbi,
              functionName: 'positions',
              args: [addr, i],
            }),
          ),
        )

        const parsed = rows.map((m) => {
          const [conditionType, threshold, unlockPct, complete] = m as [number, bigint, number, boolean]
          return {
            conditionType: Number(conditionType),
            threshold: BigInt(threshold),
            unlockPct: Number(unlockPct),
            complete: Boolean(complete),
          }
        })

        if (!cancelled) setMilestones(parsed)
      } catch (err) {
        try {
          const currentBlock = await unichainClient.getBlockNumber()
          const windowSize = 9_500n // Unichain RPC rejects getLogs ranges > 10_000 blocks.
          let cursor = currentBlock
          let latest: Log | undefined

          for (let i = 0; i < 600; i++) {
            const fromBlock = cursor > windowSize ? cursor - windowSize : 0n
            const logs = await unichainClient.getLogs({
              address: VESTING_HOOK_ADDRESS,
              event: positionRegisteredEvent,
              args: { team: addr },
              fromBlock,
              toBlock: cursor,
            })

            if (logs.length > 0) {
              latest = logs[logs.length - 1] as Log
              break
            }

            if (fromBlock === 0n) break
            cursor = fromBlock - 1n
          }

          if (!latest?.transactionHash) throw new Error('No registration tx found for this team')

          const tx = await unichainClient.getTransaction({ hash: latest.transactionHash })
          const decoded = decodeFunctionData({ abi: vestingHookAbi, data: tx.input })

          if (decoded.functionName !== 'registerVestingPosition') {
            throw new Error('Latest registration tx could not be decoded')
          }

          const rawMilestones = decoded.args?.[0] as readonly unknown[] | undefined
          if (!rawMilestones || rawMilestones.length !== 3) {
            throw new Error('Registration tx missing milestone payload')
          }

          const parsed = rawMilestones.map((row) => {
            const r = row as {
              conditionType?: number | bigint
              threshold?: number | bigint
              unlockPct?: number | bigint
              complete?: boolean
              [k: number]: unknown
            }
            const conditionType = Number(r.conditionType ?? r[0] ?? 0)
            const threshold = BigInt((r.threshold ?? r[1] ?? 0) as number | bigint)
            const unlockPct = Number(r.unlockPct ?? r[2] ?? 0)
            const complete = Boolean(r.complete ?? r[3] ?? false)
            return { conditionType, threshold, unlockPct, complete }
          })

          if (!cancelled) {
            setMilestones(parsed)
            setError(null)
          }
        } catch {
          if (!cancelled) {
            setMilestones([])
            setError(err instanceof Error ? err.message : 'Milestone getter unavailable on this hook deployment')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    const interval = setInterval(fetch, 15_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [teamAddress])

  return { milestones, loading, error }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  5. Read RSC composite score from Lasna
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const useRiskScore = (teamAddress?: string) => {
  const [score, setScore] = useState<number>(0)
  const [tier, setTier] = useState<number>(0)

  useEffect(() => {
    if (!teamAddress) return
    let cancelled = false
    const addr = teamAddress as `0x${string}`

    const fetch = async () => {
      let resolvedScore = 0
      let resolvedTier = 0

      // Primary source: direct reads from RSC storage.
      try {
        const [compositeScore, dispatchedTier] = await Promise.all([
          lasnaClient.readContract({
            address: RISK_GUARD_RSC_ADDRESS,
            abi: riskGuardRSCAbi,
            functionName: 'getRiskScore',
            args: [addr],
          }),
          lasnaClient.readContract({
            address: RISK_GUARD_RSC_ADDRESS,
            abi: riskGuardRSCAbi,
            functionName: 'getLastDispatchedTier',
            args: [addr],
          }),
        ])

        resolvedScore = Number(compositeScore)
        resolvedTier = Number(dispatchedTier)
      } catch {
        // Keep trying fallback sources.
      }

      // Fallback source: callback relay events on Unichain.
      if (resolvedScore === 0 && resolvedTier === 0) {
        try {
          const currentBlock = await unichainClient.getBlockNumber()
          const fromBlock = currentBlock > 300_000n ? currentBlock - 300_000n : 0n

          const [lockRelays, pauseRelays] = await Promise.all([
            unichainClient.getLogs({
              address: CALLBACK_RECEIVER_ADDRESS,
              event: lockExtendRelayedEvent,
              args: { team: addr },
              fromBlock,
              toBlock: currentBlock,
            }),
            unichainClient.getLogs({
              address: CALLBACK_RECEIVER_ADDRESS,
              event: pauseWithdrawalsRelayedEvent,
              args: { team: addr },
              fromBlock,
              toBlock: currentBlock,
            }),
          ])

          const latestLockBlock = lockRelays.length ? lockRelays[lockRelays.length - 1].blockNumber ?? 0n : 0n
          const latestPauseBlock = pauseRelays.length ? pauseRelays[pauseRelays.length - 1].blockNumber ?? 0n : 0n

          if (latestLockBlock > 0n || latestPauseBlock > 0n) {
            if (latestLockBlock >= latestPauseBlock) {
              resolvedScore = 75
              resolvedTier = 3
            } else {
              resolvedScore = 50
              resolvedTier = 2
            }
          }
        } catch {
          // Continue to secondary fallback.
        }
      }

      // Secondary fallback: infer risk from hook lock state.
      if (resolvedScore === 0 && resolvedTier === 0) {
        try {
          const position = await unichainClient.readContract({
            address: VESTING_HOOK_ADDRESS,
            abi: vestingHookAbi,
            functionName: 'positions',
            args: [addr],
          })

          const lockExtendedUntil = (position as readonly unknown[])[4] as bigint
          const now = BigInt(Math.floor(Date.now() / 1000))

          if (lockExtendedUntil > now) {
            const sevenDays = 7n * 24n * 60n * 60n
            if (lockExtendedUntil - now > sevenDays) {
              resolvedScore = 75
              resolvedTier = 3
            } else {
              resolvedScore = 50
              resolvedTier = 2
            }
          }
        } catch {
          // Keep defaults.
        }
      }

      if (!cancelled) {
        setScore(resolvedScore)
        setTier(resolvedTier)
      }
    }
    fetch()
    const interval = setInterval(fetch, 15_000) // poll every 15s
    return () => { cancelled = true; clearInterval(interval) }
  }, [teamAddress])

  return { score, tier }
}

export const useRugSignals = (teamAddress?: string) => {
  const [occurredSignals, setOccurredSignals] = useState<string[]>([])
  const [lastTxBySignal, setLastTxBySignal] = useState<Record<string, string>>({})
  const [triggerMetaBySignal, setTriggerMetaBySignal] = useState<Record<string, {
    source: 'rsc' | 'callback' | 'hook-fallback'
    txHash?: string
    blockNumber?: bigint
    points?: number
    label: string
  }>>({})

  useEffect(() => {
    if (!teamAddress) return
    let cancelled = false
    const addr = teamAddress as `0x${string}`

    const fetch = async () => {
      const nextOccurred = new Set<string>()
      const nextTx: Record<string, string> = {}
      const nextMeta: Record<string, {
        source: 'rsc' | 'callback' | 'hook-fallback'
        txHash?: string
        blockNumber?: bigint
        points?: number
        label: string
      }> = {}

      // Primary source: exact signal events from RSC on Lasna.
      try {
        const currentRscBlock = await lasnaClient.getBlockNumber()
        const fromRscBlock = currentRscBlock > 300_000n ? currentRscBlock - 300_000n : 0n

        const signalLogs = await lasnaClient.getLogs({
          address: RISK_GUARD_RSC_ADDRESS,
          event: signalTriggeredEvent,
          args: { team: addr },
          fromBlock: fromRscBlock,
          toBlock: currentRscBlock,
        })

        for (const log of signalLogs) {
          const signalId = Number(log.args.signalId ?? 255)
          if (signalId >= 0 && signalId <= 4) {
            const key = `S${signalId + 1}`
            nextOccurred.add(key)
            if (log.transactionHash) nextTx[key] = log.transactionHash
            nextMeta[key] = {
              source: 'rsc',
              txHash: log.transactionHash ?? undefined,
              blockNumber: log.blockNumber,
              points: Number(log.args.points ?? 0),
              label: 'RSC SignalTriggered',
            }
          }
        }
      } catch {
        // Continue with fallback sources.
      }

      // Fallback source: callback relay events on Unichain for S1/S2.
      try {
        const currentBlock = await unichainClient.getBlockNumber()
        const fromBlock = currentBlock > 300_000n ? currentBlock - 300_000n : 0n

        const [lockRelays, pauseRelays] = await Promise.all([
          unichainClient.getLogs({
            address: CALLBACK_RECEIVER_ADDRESS,
            event: lockExtendRelayedEvent,
            args: { team: addr },
            fromBlock,
            toBlock: currentBlock,
          }),
          unichainClient.getLogs({
            address: CALLBACK_RECEIVER_ADDRESS,
            event: pauseWithdrawalsRelayedEvent,
            args: { team: addr },
            fromBlock,
            toBlock: currentBlock,
          }),
        ])

        if (pauseRelays.length > 0 && !nextOccurred.has('S1')) {
          nextOccurred.add('S1')
          const latest = pauseRelays[pauseRelays.length - 1]
          const tx = latest.transactionHash
          if (tx) nextTx.S1 = tx
          nextMeta.S1 = {
            source: 'callback',
            txHash: tx ?? undefined,
            blockNumber: latest.blockNumber,
            label: 'Callback PauseWithdrawalsRelayed',
          }
        }

        if (lockRelays.length > 0 && !nextOccurred.has('S2')) {
          nextOccurred.add('S2')
          const latest = lockRelays[lockRelays.length - 1]
          const tx = latest.transactionHash
          if (tx) nextTx.S2 = tx
          nextMeta.S2 = {
            source: 'callback',
            txHash: tx ?? undefined,
            blockNumber: latest.blockNumber,
            label: 'Callback LockExtendRelayed',
          }
        }
      } catch {
        // Best-effort; keep evaluating fallback source below.
      }

      if (!nextOccurred.has('S2')) {
        try {
          const position = await unichainClient.readContract({
            address: VESTING_HOOK_ADDRESS,
            abi: vestingHookAbi,
            functionName: 'positions',
            args: [addr],
          })

          const lockExtendedUntil = (position as readonly unknown[])[4] as bigint
          const now = BigInt(Math.floor(Date.now() / 1000))
          if (lockExtendedUntil > now) {
            nextOccurred.add('S2')
            nextMeta.S2 = {
              source: 'hook-fallback',
              label: 'Hook lockExtendedUntil > now',
            }
          }
        } catch {
          // Keep current derived set.
        }
      }

      if (!cancelled) {
        setOccurredSignals(
          Array.from(nextOccurred).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
        )
        setLastTxBySignal(nextTx)
        setTriggerMetaBySignal(nextMeta)
      }
    }

    fetch()
    const interval = setInterval(fetch, 15_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [teamAddress])

  return { occurredSignals, lastTxBySignal, triggerMetaBySignal }
}

export const useMilestoneLockState = (teamAddress?: string) => {
  const [lockedMilestones, setLockedMilestones] = useState<number[]>([1, 2, 3])
  const [unlockedMilestones, setUnlockedMilestones] = useState<number[]>([])
  const [unlockTxByMilestone, setUnlockTxByMilestone] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!teamAddress) return
    let cancelled = false
    const addr = teamAddress as `0x${string}`

    const fetch = async () => {
      const unlocked = new Set<number>()
      const unlockTx: Record<string, string> = {}

      try {
        const currentBlock = await unichainClient.getBlockNumber()
        const fromBlock = currentBlock > 300_000n ? currentBlock - 300_000n : 0n

        const logs = await unichainClient.getLogs({
          address: VESTING_HOOK_ADDRESS,
          event: milestoneUnlockedEvent,
          args: { team: addr },
          fromBlock,
          toBlock: currentBlock,
        })

        for (const log of logs) {
          const milestoneId = Number(log.args.milestoneId ?? 255)
          if (milestoneId >= 0 && milestoneId <= 2) {
            const m = milestoneId + 1
            unlocked.add(m)
            if (log.transactionHash) unlockTx[`M${m}`] = log.transactionHash
          }
        }
      } catch {
        // Keep defaults when logs are unavailable.
      }

      const unlockedSorted = Array.from(unlocked).sort((a, b) => a - b)
      const locked = [1, 2, 3].filter((m) => !unlocked.has(m))

      if (!cancelled) {
        setUnlockedMilestones(unlockedSorted)
        setLockedMilestones(locked)
        setUnlockTxByMilestone(unlockTx)
      }
    }

    fetch()
    const interval = setInterval(fetch, 15_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [teamAddress])

  return { lockedMilestones, unlockedMilestones, unlockTxByMilestone }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  6. VestingHook event polling (Unichain Sepolia)
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const useHookEventPolling = (teamAddress?: string, pollInterval = 15_000) => {
  const [isPolling, setIsPolling] = useState(false)
  const { setEvents } = useVerifyStore()

  useEffect(() => {
    if (!teamAddress) return
    setIsPolling(true)
    let fromBlock = 0n

    const poll = async () => {
      try {
        const currentBlock = await unichainClient.getBlockNumber()
        if (fromBlock === 0n) fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n

        const logs = await unichainClient.getLogs({
          address: VESTING_HOOK_ADDRESS,
          fromBlock,
          toBlock: currentBlock,
        })

        fromBlock = currentBlock + 1n

        const mapped: OnChainEvent[] = logs.map((log: Log, i: number) => {
          // Decode event name from first topic
          const topicMap: Record<string, string> = {}
          for (const evt of vestingHookAbi) {
            if (evt.type === 'event') {
              topicMap[evt.name] = evt.name
            }
          }

          return {
            id: `${log.transactionHash}-${i}`,
            timestamp: Date.now(),
            eventType: 'PositionLocked' as OnChainEvent['eventType'],
            description: `Event in tx ${log.transactionHash?.slice(0, 10)}...`,
            txHash: log.transactionHash ?? '0x',
            blockNumber: Number(log.blockNumber),
          }
        })

        if (mapped.length > 0) setEvents(mapped)
      } catch (err) {
        console.error('Error polling hook events:', err)
      }
    }

    poll()
    const interval = setInterval(poll, pollInterval)
    return () => { setIsPolling(false); clearInterval(interval) }
  }, [teamAddress, pollInterval, setEvents])

  return { isPolling }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  7. RSC event polling (Lasna Testnet)
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const useRSCEventPolling = (projectAddress?: string, pollInterval = 15_000) => {
  const [isPolling, setIsPolling] = useState(false)
  const { addIncomingEvent, addRSCResponse, setStats } = useRSCMonitorStore()

  useEffect(() => {
    if (!projectAddress) return
    setIsPolling(true)
    let fromBlock = 0n

    const poll = async () => {
      try {
        const currentBlock = await lasnaClient.getBlockNumber()
        if (fromBlock === 0n) fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n

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

          addIncomingEvent({
            id: `${log.transactionHash}-${log.logIndex}`,
            timestamp: Date.now(),
            chain: 'UNICHAIN_SEPOLIA',
            blockNumber: Number(log.blockNumber),
            eventName: 'RSC Event',
            fromAddress: log.address,
            value: '',
            txHash: log.transactionHash ?? '0x',
          })

          // Check if it's a Callback event (means dispatch happened)
          if (log.topics[0]) {
            callbacks++
          }
        }

        setStats({
          totalReactCalls: reactCalls,
          totalCallbacksDispatched: callbacks,
          totalMilestonesUnlocked: unlocks,
          totalLockExtensionsApplied: extensions,
        })
      } catch (err) {
        console.error('Error polling RSC events:', err)
      }
    }

    poll()
    const interval = setInterval(poll, pollInterval)
    return () => { setIsPolling(false); clearInterval(interval) }
  }, [projectAddress, pollInterval, addIncomingEvent, addRSCResponse, setStats])

  return { isPolling }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  8. Contract write helpers (used by LaunchPool)
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const useContractWrites = () => {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { switchNetworkAsync } = useSwitchNetwork()

  /** Register vesting position on VestingHook (Unichain Sepolia) */
  const registerVestingPosition = useCallback(
    async (
      milestones: Array<{ type: string; threshold: number; unlockPercentage: number }>,
      tokenAddress: `0x${string}`,
      poolId: `0x${string}`,
    ) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const formattedMilestones = milestones.map((m) => ({
        conditionType: CONDITION_TYPE_MAP[m.type as keyof typeof CONDITION_TYPE_MAP] ?? 0,
        threshold: BigInt(m.threshold),
        unlockPct: m.unlockPercentage,
        complete: false,
      }))

      // Pad to exactly 3 milestones
      while (formattedMilestones.length < 3) {
        formattedMilestones.push({ conditionType: 0, threshold: 0n, unlockPct: 0, complete: false })
      }

      const hash = await walletClient.writeContract({
        address: VESTING_HOOK_ADDRESS,
        abi: vestingHookAbi,
        functionName: 'registerVestingPosition',
        args: [
          formattedMilestones.slice(0, 3) as any,
          tokenAddress,
          poolId,
        ],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      await nonceSafeWait()
      return receipt
    },
    [walletClient, publicClient],
  )

  /** Register milestones on RiskGuardRSC (Lasna Testnet)
   *  IMPORTANT: Caller must switch to Lasna chain first via switchToLasna().
   *  This function fetches a fresh wallet client for the Lasna chain.
   */
  const registerMilestonesOnRSC = useCallback(
    async (
      poolId: `0x${string}`,
      teamAddress: `0x${string}`,
      tokenAddress: `0x${string}`,
      deployerAddress: `0x${string}`,
      milestones: Array<{ type: string; threshold: number; unlockPercentage: number }>,
    ) => {
      // Get a fresh wallet client for the currently connected chain (should be Lasna after switch)
      const wc = await getCoreWalletClient({ chainId: lasnaTestnet.id })
      if (!wc) throw new Error('Wallet not connected to Lasna')
      const pc = getCorePublicClient({ chainId: lasnaTestnet.id })

      const conditionTypes: [bigint, bigint, bigint] = [0n, 0n, 0n]
      const thresholds: [bigint, bigint, bigint] = [0n, 0n, 0n]
      const unlockPcts: [number, number, number] = [0, 0, 0]

      milestones.slice(0, 3).forEach((m, i) => {
        conditionTypes[i] = BigInt(CONDITION_TYPE_MAP[m.type as keyof typeof CONDITION_TYPE_MAP] ?? 0)
        thresholds[i] = BigInt(m.threshold)
        unlockPcts[i] = m.unlockPercentage
      })

      const hash = await wc.writeContract({
        address: RISK_GUARD_RSC_ADDRESS,
        abi: riskGuardRSCAbi,
        functionName: 'registerMilestones',
        args: [poolId, teamAddress, tokenAddress, deployerAddress, conditionTypes, thresholds, unlockPcts],
        chain: lasnaTestnet,
      })

      const receipt = await pc.waitForTransactionReceipt({ hash })
      await nonceSafeWait()
      return receipt
    },
    [],
  )

  /** Add genesis wallet on RiskGuardRSC (Lasna)
   *  IMPORTANT: Caller must switch to Lasna chain first via switchToLasna().
   */
  const addGenesisWallet = useCallback(
    async (teamAddress: `0x${string}`, walletAddress: `0x${string}`) => {
      const wc = await getCoreWalletClient({ chainId: lasnaTestnet.id })
      if (!wc) throw new Error('Wallet not connected to Lasna')
      const pc = getCorePublicClient({ chainId: lasnaTestnet.id })

      const hash = await wc.writeContract({
        address: RISK_GUARD_RSC_ADDRESS,
        abi: riskGuardRSCAbi,
        functionName: 'addGenesisWallet',
        args: [teamAddress, walletAddress],
        chain: lasnaTestnet,
      })

      const receipt = await pc.waitForTransactionReceipt({ hash })
      await nonceSafeWait()
      return receipt
    },
    [],
  )

  /** Set or clear treasury contract address on RiskGuardRSC (Lasna)
   *  Pass zero address to clear (nullable behavior).
   */
  const setTreasuryAddressOnRSC = useCallback(
    async (teamAddress: `0x${string}`, treasuryAddress: `0x${string}`) => {
      const wc = await getCoreWalletClient({ chainId: lasnaTestnet.id })
      if (!wc) throw new Error('Wallet not connected to Lasna')
      const pc = getCorePublicClient({ chainId: lasnaTestnet.id })

      const hash = await wc.writeContract({
        address: RISK_GUARD_RSC_ADDRESS,
        abi: riskGuardRSCAbi,
        functionName: 'setTreasuryAddress',
        args: [teamAddress, treasuryAddress],
        chain: lasnaTestnet,
      })

      const receipt = await pc.waitForTransactionReceipt({ hash })
      await nonceSafeWait()
      return receipt
    },
    [],
  )

  /** Approve a token for spending by the PoolModifyLiquidityTest router */
  const approveToken = useCallback(
    async (tokenAddress: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      await nonceSafeWait()
      return receipt
    },
    [walletClient, publicClient],
  )

  /** Initialize a Uniswap v4 pool on the PoolManager */
  const initializePool = useCallback(
    async (poolKey: PoolKeyTuple, sqrtPriceX96: bigint) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const hash = await walletClient.writeContract({
        address: POOL_MANAGER_ADDRESS as `0x${string}`,
        abi: poolManagerAbi,
        functionName: 'initialize',
        args: [poolKey, sqrtPriceX96],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      await nonceSafeWait()
      return receipt
    },
    [walletClient, publicClient],
  )

  /** Add liquidity via PoolModifyLiquidityTest (triggers afterAddLiquidity hook) */
  const addLiquidity = useCallback(
    async (
      poolKey: PoolKeyTuple,
      tickLower: number,
      tickUpper: number,
      liquidityDelta: bigint,
    ) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const hash = await walletClient.writeContract({
        address: POOL_MODIFY_LIQUIDITY_TEST_ADDRESS as `0x${string}`,
        abi: poolModifyLiquidityTestAbi,
        functionName: 'modifyLiquidity',
        args: [
          poolKey,
          {
            tickLower,
            tickUpper,
            liquidityDelta,
            salt: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          },
          '0x' as `0x${string}`, // empty hookData
        ],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      await nonceSafeWait()
      return receipt
    },
    [walletClient, publicClient],
  )

  /** Switch wallet to Lasna testnet (5318007) for RSC interactions */
  const switchToLasna = useCallback(async () => {
    if (!switchNetworkAsync) throw new Error('switchNetwork not available')
    await switchNetworkAsync(lasnaTestnet.id)
  }, [switchNetworkAsync])

  /** Switch wallet back to Unichain Sepolia (1301) */
  const switchToUnichain = useCallback(async () => {
    if (!switchNetworkAsync) throw new Error('switchNetwork not available')
    await switchNetworkAsync(unichainSepolia.id)
  }, [switchNetworkAsync])

  return {
    registerVestingPosition,
    registerMilestonesOnRSC,
    addGenesisWallet,
    setTreasuryAddressOnRSC,
    approveToken,
    initializePool,
    addLiquidity,
    switchToLasna,
    switchToUnichain,
  }
}
