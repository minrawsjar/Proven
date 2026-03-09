/* ═══════════════════════════════════════════════════════════════════════════════
 *  Proven – contract addresses & chain constants
 *
 *  Unichain Sepolia (1301)  = origin chain (pool + hook + callback)
 *  Lasna Testnet  (5318007) = Reactive Network (RSC)
 * ═══════════════════════════════════════════════════════════════════════════════ */

/* ─── Chain IDs ─── */
export const UNICHAIN_SEPOLIA_CHAIN_ID = 1301
export const LASNA_CHAIN_ID = 5318007

/* ─── Uniswap v4 (Unichain Sepolia) ─── */
export const POOL_MANAGER_ADDRESS = '0x00b036b58a818b1bc34d502d3fe730db729e62ac' as const
export const POSITION_MANAGER_ADDRESS = '0xf969aee60879c54baaed9f3ed26147db216fd664' as const
export const UNIVERSAL_ROUTER_ADDRESS = '0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d' as const
export const STATE_VIEW_ADDRESS = '0xc199f1072a74d4e905aba1a037ec6c77f7f5b8e2' as const
export const QUOTER_ADDRESS = '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as const
export const POOL_SWAP_TEST_ADDRESS = '0x9140a78c1a137c7ff1c151ec8231272af78a99a4' as const
export const POOL_MODIFY_LIQUIDITY_TEST_ADDRESS = '0x5fa728c0a5cfd51bee4b060773f50554c0c8a7ab' as const
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const

/* ─── Reactive Callback Proxy (Unichain Sepolia) ─── */
export const CALLBACK_PROXY_ADDRESS = '0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4' as const

/* ─── Proven Contracts (Unichain Sepolia – fill after deployment) ─── */
export const VESTING_HOOK_ADDRESS = (import.meta.env.VITE_HOOK_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`
export const VAULT_MANAGER_ADDRESS = (import.meta.env.VITE_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`
export const CALLBACK_RECEIVER_ADDRESS = (import.meta.env.VITE_CALLBACK_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

/* ─── Proven Contracts (Lasna Testnet – fill after deployment) ─── */
export const TIMELOCK_RSC_ADDRESS = (import.meta.env.VITE_RSC_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

/* ─── RPC Endpoints (for viem publicClient) ─── */
export const UNICHAIN_RPC = 'https://sepolia.unichain.org'
export const LASNA_RPC = 'https://lasna-rpc.rnk.dev'

/* ─── Block Explorer URLs ─── */
export const UNICHAIN_EXPLORER = 'https://sepolia.uniscan.xyz'
export const LASNA_EXPLORER = 'https://lasna.reactscan.net'

/* ─── Condition type mapping (matches ConditionType enum in VestingTypes.sol) ─── */
export const CONDITION_TYPE_MAP = {
  TVL: 0,
  VOLUME: 1,
  USERS: 2,
} as const

/* ─── Signal labels (S1-S5 from TimeLockRSC) ─── */
export const SIGNAL_LABELS: Record<number, string> = {
  0: 'Large Holder Outflow',
  1: 'Treasury Drain',
  2: 'LP Withdrawal Attempt',
  3: 'Liquidity Concentration',
  4: 'Holder Dispersion',
}

/* ─── Risk tier thresholds ─── */
export const RISK_TIERS = {
  SAFE: { max: 24, label: 'Safe', color: 'brand' },
  WATCH: { max: 49, label: 'Watch', color: 'neon-yellow' },
  ALERT: { max: 74, label: 'Alert', color: 'neon-orange' },
  RAGE: { max: 100, label: 'Rage', color: 'neon-red' },
} as const
