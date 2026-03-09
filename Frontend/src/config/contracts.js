/* ═══════════════════════════════════════════════════════════════════════════════
 *  Proven – contract ABIs for viem / wagmi
 *
 *  Only the functions & events the frontend actually needs are included.
 *  Full ABIs live in the compiled Foundry output directories.
 * ═══════════════════════════════════════════════════════════════════════════════ */
/* ─── VestingHook (Unichain Sepolia) ─── */
export const vestingHookAbi = [
    // ── reads ──
    {
        type: 'function',
        name: 'positions',
        inputs: [{ name: '', type: 'address' }],
        outputs: [
            { name: 'team', type: 'address' },
            { name: 'tokenAddr', type: 'address' },
            { name: 'lpAmount', type: 'uint256' },
            { name: 'registeredAt', type: 'uint256' },
            { name: 'lockExtendedUntil', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'unlockedPctByTeam',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'RSC_AUTHORIZER',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'VAULT_MANAGER',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'poolManager',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    // ── writes ──
    {
        type: 'function',
        name: 'registerVestingPosition',
        inputs: [
            {
                name: 'milestones',
                type: 'tuple[3]',
                components: [
                    { name: 'conditionType', type: 'uint8' },
                    { name: 'threshold', type: 'uint256' },
                    { name: 'unlockPct', type: 'uint8' },
                    { name: 'complete', type: 'bool' },
                ],
            },
            { name: 'tokenAddr', type: 'address' },
            { name: 'poolId', type: 'bytes32' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'authorizeUnlock',
        inputs: [
            { name: 'team', type: 'address' },
            { name: 'milestoneId', type: 'uint8' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'extendLock',
        inputs: [
            { name: 'team', type: 'address' },
            { name: 'penaltyDays', type: 'uint32' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'pauseWithdrawals',
        inputs: [
            { name: 'team', type: 'address' },
            { name: 'pauseHours', type: 'uint32' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    // ── events ──
    {
        type: 'event',
        name: 'PositionRegistered',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'tokenAddr', type: 'address', indexed: true },
            { name: 'poolId', type: 'bytes32', indexed: true },
        ],
    },
    {
        type: 'event',
        name: 'PositionLocked',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'poolId', type: 'bytes32', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'PoolMetricsUpdated',
        inputs: [
            { name: 'poolId', type: 'bytes32', indexed: true },
            { name: 'tvl', type: 'uint256', indexed: false },
            { name: 'cumulativeVol', type: 'uint256', indexed: false },
            { name: 'uniqueUsers', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'CrashDetected',
        inputs: [
            { name: 'poolId', type: 'bytes32', indexed: true },
            { name: 'dropPct', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'MilestoneUnlocked',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'milestoneId', type: 'uint8', indexed: true },
            { name: 'newUnlockedPct', type: 'uint8', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'LockExtended',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'lockUntil', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'WithdrawalsPaused',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'pausedUntil', type: 'uint256', indexed: false },
        ],
    },
];
/* ─── TimeLockRSC (Lasna Testnet) ─── */
export const timeLockRSCAbi = [
    // ── writes (called by team during launch) ──
    {
        type: 'function',
        name: 'registerMilestones',
        inputs: [
            { name: 'poolId', type: 'bytes32' },
            { name: 'team', type: 'address' },
            { name: 'conditionTypes', type: 'uint256[3]' },
            { name: 'thresholds', type: 'uint256[3]' },
            { name: 'unlockPcts', type: 'uint8[3]' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'addGenesisWallet',
        inputs: [
            { name: 'team', type: 'address' },
            { name: 'wallet', type: 'address' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    // ── reads ──
    {
        type: 'function',
        name: 'compositeScore',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'uint16' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'lastDispatchedTier',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'walletToTeam',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    // ── events ──
    {
        type: 'event',
        name: 'TeamIndexed',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'poolId', type: 'bytes32', indexed: true },
            { name: 'tokenAddr', type: 'address', indexed: true },
        ],
    },
    {
        type: 'event',
        name: 'UnlockAuthorized',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'milestoneId', type: 'uint8', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'SignalTriggered',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'signalId', type: 'uint8', indexed: false },
            { name: 'points', type: 'uint16', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'RiskScoreUpdated',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'score', type: 'uint16', indexed: false },
            { name: 'tier', type: 'uint8', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'RiskElevated',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'score', type: 'uint16', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'ComboBonus',
        inputs: [
            { name: 'team', type: 'address', indexed: true },
            { name: 'activeCount', type: 'uint8', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'LPLocked',
        inputs: [
            { name: 'poolId', type: 'bytes32', indexed: true },
            { name: 'team', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'Callback',
        inputs: [
            { name: 'chain_id', type: 'uint256', indexed: true },
            { name: '_contract', type: 'address', indexed: true },
            { name: 'gas_limit', type: 'uint64', indexed: true },
            { name: 'payload', type: 'bytes', indexed: false },
        ],
    },
];
/* ─── ERC-20 (minimal for token reads) ─── */
export const erc20Abi = [
    {
        type: 'function',
        name: 'name',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'symbol',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'totalSupply',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'approve',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'allowance',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
];
