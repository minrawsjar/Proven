import { useEffect, useState, useCallback } from 'react'
import { useAccount, useNetwork, useSwitchNetwork, usePublicClient, useWalletClient } from 'wagmi'
import { createPublicClient, http, parseAbiItem, type Log } from 'viem'
import { useVerifyStore, type OnChainEvent } from '../store/verifyStore'
import { useRSCMonitorStore } from '../store/rscMonitorStore'
import { unichainSepolia, lasnaTestnet } from '../config/wagmi'
import { vestingHookAbi, timeLockRSCAbi, erc20Abi } from '../config/contracts'
import {
  VESTING_HOOK_ADDRESS,
  TIMELOCK_RSC_ADDRESS,
  LASNA_RPC,
  UNICHAIN_RPC,
  CONDITION_TYPE_MAP,
} from '../config/constants'

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

export const usePositionData = (teamAddress?: string) => {
  const [data, setData] = useState<PositionData | null>(null)
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
        const [position, unlockedPct] = await Promise.all([
          unichainClient.readContract({
            address: VESTING_HOOK_ADDRESS,
            abi: vestingHookAbi,
            functionName: 'positions',
            args: [addr],
          }),
          unichainClient.readContract({
            address: VESTING_HOOK_ADDRESS,
            abi: vestingHookAbi,
            functionName: 'unlockedPctByTeam',
            args: [addr],
          }),
        ])

        if (!cancelled) {
          const [team, tokenAddr, lpAmount, registeredAt, lockExtendedUntil] = position as [
            `0x${string}`, `0x${string}`, bigint, bigint, bigint,
          ]
          setData({
            team,
            tokenAddr,
            lpAmount,
            registeredAt,
            lockExtendedUntil,
            unlockedPct: Number(unlockedPct),
          })
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

  return { data, loading, error }
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
      try {
        const [compositeScore, dispatchedTier] = await Promise.all([
          lasnaClient.readContract({
            address: TIMELOCK_RSC_ADDRESS,
            abi: timeLockRSCAbi,
            functionName: 'compositeScore',
            args: [addr],
          }),
          lasnaClient.readContract({
            address: TIMELOCK_RSC_ADDRESS,
            abi: timeLockRSCAbi,
            functionName: 'lastDispatchedTier',
            args: [addr],
          }),
        ])
        if (!cancelled) {
          setScore(Number(compositeScore))
          setTier(Number(dispatchedTier))
        }
      } catch {
        // RSC might not be deployed yet
      }
    }
    fetch()
    const interval = setInterval(fetch, 15_000) // poll every 15s
    return () => { cancelled = true; clearInterval(interval) }
  }, [teamAddress])

  return { score, tier }
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
          address: TIMELOCK_RSC_ADDRESS,
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
      return receipt
    },
    [walletClient, publicClient],
  )

  /** Register milestones on TimeLockRSC (Lasna Testnet)
   *  Note: This requires the user to switch to Lasna or use a relayer.
   *  For now we prepare the TX data; the frontend should prompt a chain switch.
   */
  const registerMilestonesOnRSC = useCallback(
    async (
      poolId: `0x${string}`,
      teamAddress: `0x${string}`,
      milestones: Array<{ type: string; threshold: number; unlockPercentage: number }>,
    ) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const conditionTypes: [bigint, bigint, bigint] = [0n, 0n, 0n]
      const thresholds: [bigint, bigint, bigint] = [0n, 0n, 0n]
      const unlockPcts: [number, number, number] = [0, 0, 0]

      milestones.slice(0, 3).forEach((m, i) => {
        conditionTypes[i] = BigInt(CONDITION_TYPE_MAP[m.type as keyof typeof CONDITION_TYPE_MAP] ?? 0)
        thresholds[i] = BigInt(m.threshold)
        unlockPcts[i] = m.unlockPercentage
      })

      const hash = await walletClient.writeContract({
        address: TIMELOCK_RSC_ADDRESS,
        abi: timeLockRSCAbi,
        functionName: 'registerMilestones',
        args: [poolId, teamAddress, conditionTypes, thresholds, unlockPcts],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      return receipt
    },
    [walletClient, publicClient],
  )

  /** Add genesis wallet on TimeLockRSC (Lasna) */
  const addGenesisWallet = useCallback(
    async (teamAddress: `0x${string}`, walletAddress: `0x${string}`) => {
      if (!walletClient) throw new Error('Wallet not connected')

      const hash = await walletClient.writeContract({
        address: TIMELOCK_RSC_ADDRESS,
        abi: timeLockRSCAbi,
        functionName: 'addGenesisWallet',
        args: [teamAddress, walletAddress],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      return receipt
    },
    [walletClient, publicClient],
  )

  return {
    registerVestingPosition,
    registerMilestonesOnRSC,
    addGenesisWallet,
  }
}
