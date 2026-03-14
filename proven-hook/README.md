# proven-hook

Uniswap v4 hook contracts deployed on Unichain Sepolia for Proven Protocol.

This module contains the hook logic that:

- registers vesting positions per team/pool
- tracks LP locked amounts
- gates LP removal by unlocked percentage
- emits pool metrics and crash signals for RSC monitoring
- exposes callback targets (`authorizeUnlock`, `pauseWithdrawals`, `extendLock`)

---

## Core contracts

- `src/VestingHook.sol` is the main hook contract.
- `src/VestingTypes.sol` contains milestone and position structs.
- `src/MockVaultManager.sol` is a test vault mock.
- `src/VestingHookTestHelper.sol` provides helper logic for hook testing.

---

## Detailed hook architecture (Uniswap v4)

`VestingHook` is a stateful Uniswap v4 hook that combines launch time registration, runtime withdrawal gating, and live metric emission for Reactive policy.

### Enabled hook points

`getHookPermissions()` enables exactly three callback surfaces:

- `afterAddLiquidity = true`
- `beforeRemoveLiquidity = true`
- `afterSwap = true`

This is intentional:

- **`afterAddLiquidity`**: needed to read final `liquidityDelta` and lock LP after position add.
- **`beforeRemoveLiquidity`**: needed to block/limit exits before LP is removed.
- **`afterSwap`**: needed to update market metrics and emit risk signals continuously.

### Architecture layers

1. **Registration layer**
	 - Entry: `registerVestingPosition(Milestone[3], tokenAddr, poolId)`
	 - Stores team vesting config in `positions[team]` and links `poolToTeam[poolId]`.
	 - Validates unlock percentages: each milestone in `1..100`, total must equal `100`.

2. **Custody + accounting layer**
	 - Hook point: `_afterAddLiquidity(...)`
	 - Resolves team from `poolId` (router is caller in v4 flows).
	 - Derives LP amount from `params.liquidityDelta`.
	 - For registered pools, forwards LP accounting to `VAULT_MANAGER.depositPosition(team, poolId, lpAmount)` and increments `positions[team].lpAmount`.

3. **Withdrawal policy layer**
	 - Hook point: `_beforeRemoveLiquidity(...)`
	 - Enforces two independent constraints before any LP removal:
		 - **Time lock constraint**: if `lockExtendedUntil > block.timestamp`, revert (`LockExtensionActive`).
		 - **Amount constraint**: requested withdrawal must be `<= (lpAmount * unlockedPctByTeam / 100)`, else revert (`ExceedsUnlockedAmount`).
	 - Pools that are not registered are unaffected and follow pass through behavior.

4. **Telemetry + signal layer**
	 - Hook point: `_afterSwap(...)`
	 - Maintains per pool runtime metrics:
		 - `cumulativeVolume[poolId]`
		 - `uniqueSwapperCount[poolId]`
		 - `hasSwapped[poolId][actor]`
		 - `lastPrice[poolId]`
	 - Computes TVL proxy from pool liquidity + `sqrtPriceX96`.
	 - Emits:
		 - `PoolMetricsUpdated(poolId, tvl, cumulativeVol, uniqueUsers)`
		 - `CrashDetected(poolId, dropPct)` when price drop is `>= 30%` from last observed price.

### RSC callback control plane

The hook exposes callback targets callable only by immutable `RSC_AUTHORIZER` (`onlyRSC`):

- `authorizeUnlock(team, milestoneId)`
	- Marks milestone complete.
	- Increments `unlockedPctByTeam` (capped at 100).
	- Emits `MilestoneUnlocked`.

- `pauseWithdrawals(team, pauseHours)`
	- Sets temporary block window via `lockExtendedUntil`.
	- Emits `WithdrawalsPaused`.

- `extendLock(team, penaltyDays)`
	- Applies longer Rage Lock window via `lockExtendedUntil`.
	- Emits `LockExtended`.

### Why this design helps

- **No blanket freeze**: only registered vesting pools are constrained; standard pools continue normally.
- **Deterministic enforcement**: withdrawal limits are computed on chain from stored LP and unlocked percentage.
- **Cross chain autonomy ready**: the hook emits the exact metrics and signals needed by `RiskGuardRSC`, and then accepts only authorized callback actions.
- **Router safe accounting**: team identity is keyed by `poolId`, which avoids dependence on router `sender` identity.

### Data flow (end to end)

1. Team registers milestones for `poolId`.
2. Liquidity is added; hook locks/accounts LP through vault manager.
3. Swaps continuously update metrics and crash signals.
4. Reactive layer evaluates milestones/risk off these events.
5. Reactive callback authorizes unlocks or extends/pauses lock windows.
6. Future remove liquidity attempts are allowed or rejected by the current policy state.

---

## Folder structure

```
proven-hook/
├── src/
│   ├── VestingHook.sol
│   ├── VestingTypes.sol
│   ├── IVaultManager.sol
│   ├── MockVaultManager.sol
│   ├── VestingHookTestHelper.sol
│   ├── base/
│   └── utils/
├── script/
│   ├── DeployProven.s.sol
│   ├── TriggerRSC.s.sol
│   ├── TriggerSwap.s.sol
│   └── ...
├── test/
│   ├── VestingHook.t.sol
│   ├── VestingHookExtra.t.sol
│   └── fuzz/
│       └── VestingHookFuzz.t.sol
└── foundry.toml
```

---

## Hook lifecycle summary

1. Team calls `registerVestingPosition(...)` with 3 milestones (unlock % sum must be 100).
2. On liquidity add, hook tracks LP amount for that team/pool.
3. On remove liquidity, hook enforces:
	- active penalty lock window checks
	- max withdrawable based on unlocked %
4. On swap, hook updates:
	- cumulative volume
	- unique swapper count
	- crash detection events

These emitted events are consumed by `RiskGuardRSC` in the reactive package.

---

## How the hook helps (from protocol flow)

`VestingHook` is the enforcement layer on Unichain. It ensures liquidity behavior matches milestone progress.

1. **Launch time vesting registration**
	- Founder registers a pool position with milestone thresholds and unlock percentages.
	- LP enters custody through the vault manager flow and is treated as locked by default.

2. **Real time guardrails on liquidity actions**
	- On add liquidity: records the locked LP baseline and updates pool state.
	- On remove liquidity: blocks unauthorized or over limit withdrawals based on the currently unlocked share.
	- Enforces active penalty lock windows set by reactive callbacks.

3. **Metric and signal emission for autonomous policy**
	- Emits pool metrics used by `RiskGuardRSC` (TVL/volume/users progression).
	- Emits suspicious activity and crash relevant signals used in risk scoring.

Net effect: teams can unlock LP only as performance milestones are met; attempted abuse is constrained at the hook level and escalated to reactive protection.

---

## Deployed contracts

| Contract | Chain | Address |
|---|---|---|
| VestingHook | Unichain Sepolia (1301) | [0xC7bFe6835bC6a4d9A32f0F34A75C21A0982D8640](https://sepolia.uniscan.xyz/address/0xC7bFe6835bC6a4d9A32f0F34A75C21A0982D8640) |
| MockVaultManager | Unichain Sepolia (1301) | [0xDb00c77688d05d2122673a0dE9Ee06eBa15A42E5](https://sepolia.uniscan.xyz/address/0xDb00c77688d05d2122673a0dE9Ee06eBa15A42E5) |

---

## Commands

Build:

```bash
forge build
```

Test:

```bash
forge test
```

Coverage:

```bash
forge coverage --report summary
```

Deploy script example:

```bash
forge script script/DeployProven.s.sol:DeployProven --rpc-url unichain_sepolia --broadcast
```

---

## Notes

- One hook deployment can support many pools. Pool specific state is keyed by `poolId`.
- Callback actions are restricted by immutable `RSC_AUTHORIZER`.
