<p align="center">
  <h1 align="center">Proven Protocol</h1>
  <p align="center"><strong>Performance-Vested Liquidity for Token Launches</strong></p>
  <p align="center">
    Lock LP tokens in a smart vault. They unlock only when real on chain milestones are hit for TVL, volume, and users. Verification is autonomous through Reactive Smart Contracts.
  </p>
</p>

<p align="center">
  <a href="#architecture">Architecture</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#contracts">Contracts</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#demo">Demo</a> •
  <a href="#license">License</a>
</p>

---

## The Problem

In 2021, the $SQUID token executed a rug pull of $2.1M from 40,000 investors. The LP was "locked" with a 7 day time lock. On day 7, the team removed 100% of liquidity in a single transaction. Investors held worthless tokens.

**Time locks do not work.** They only delay the rug. They do not prevent it.

## The Solution

Proven replaces time locks with **milestone based vesting liquidity**:

- LP tokens are locked in a vault with **on chain milestones** (TVL targets, volume thresholds, and user counts)
- A **Reactive Smart Contract** on the Reactive Network autonomously monitors 5 rug signals every block
- When milestones are met → LP unlocks progressively
- Rug signals detected → lock **extends automatically** (Rage Lock)
- No bots, no multisigs, and no human intervention. The system is fully trustless.

> **Proven doesn't promise investors will make money. It promises the founder can't steal theirs.**

---

## Architecture

```
 UNICHAIN SEPOLIA (1301)                       LASNA TESTNET (5318007)
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│                                 │           │                                 │
│  ERC-20 Token (founder deploys) │           │                                 │
│                                 │           │  events                         │
│  Uniswap v4 Pool + ProvenHook   │──────────▶│   RiskGuardRSC.sol              │
│                                 │           │   • Subscribes to pool events.  │
│  ProvenVault (holds locked LP)  │◀──────────│   • Tracks TVL,volume, users    │
│         │                       │ callbacks │   • Scores 5 rug signals        │
│  ProvenCallback (receives CBs)  │           │   • Emits milestone/rage-lock   │
│  → unlockMilestone()            │           │     callbacks                   │
│  → extendLock()                 │           │                                 │
│  → updateRiskScore()            │           │   State (in ReactVM):           │
│                                 │           │   • poolMetrics[pool]           │
│                                 │           │   • riskScores[pool]            │
│                                 │           │   • milestoneStatus[pool]       │
│                                 │           │                                 │
└─────────────────────────────────┘           └─────────────────────────────────┘
              │
              ▼
      Frontend (React + Vite)
      reads on chain state
```

### Chain Details

| Chain | Role | Chain ID | RPC | Explorer |
|---|---|---|---|---|
| Unichain Sepolia | Origin + Destination | `1301` | `https://sepolia.unichain.org` | [Uniscan](https://sepolia.uniscan.xyz) |
| Lasna Testnet | Reactive Network | `5318007` | `https://lasna-rpc.rnk.dev/` | [ReactScan](https://lasna.reactscan.net) |

### Key Addresses

| Contract | Chain | Address |
|---|---|---|
| Reactive Network System Contract | Lasna | `0x0000000000000000000000000000000000fffFfF` |
| Callback Proxy | Unichain Sepolia | `0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4` |

### Deployed Contracts (Mar 16 2026)

| Contract | Chain | Address |
|---|---|---|
| VestingHook | Unichain Sepolia | [`0x6127Fe036B9cd6435404E56365f904167298C640`](https://sepolia.uniscan.xyz/address/0x6127Fe036B9cd6435404E56365f904167298C640) |
| MockVaultManager | Unichain Sepolia | [`0x8b1800805b478fb66bb58331662899157cec4dd4`](https://sepolia.uniscan.xyz/address/0x8b1800805b478fb66bb58331662899157cec4dd4) |
| ProvenCallback | Unichain Sepolia | [`0xF61B21a60FeE27d36099BA7A7bc81E96cC4B2a0A`](https://sepolia.uniscan.xyz/address/0xF61B21a60FeE27d36099BA7A7bc81E96cC4B2a0A) |
| RiskGuardRSC | Lasna Testnet | [`0x9796f833700b32aF4A3ebC837C2DCd35BEf56118`](https://lasna.reactscan.net/address/0x9796f833700b32aF4A3ebC837C2DCd35BEf56118) |

### Live Demo Pools

| Pool | Team | Unlock State | Dashboard |
|---|---|---|---|
| Nova Protocol | `0xdae6...1a3c` | 0% — Fully locked | [View](https://provenprotocol.dev/verify/0xdae6cf499756455de55eaad590d59609870e1a3c) |
| Stellar DeFi | `0xca09...5d67` | 34% — M1 unlocked | [View](https://provenprotocol.dev/verify/0xca093b5e50df91117440f9dfd1542b8f42075d67) |
| Orbit Finance | `0x6da9...0f2a` | 67% — M1+M2 unlocked | [View](https://provenprotocol.dev/verify/0x6da90fd521d6cff9d373204038459addca260f2a) |
| Zenith Labs | `0x6995...ec6f` | 100% — Fully unlocked | [View](https://provenprotocol.dev/verify/0x699507c6aeb4268ff4dc05721c803dbe466cec6f) |
| Shadow Token | `0x079b...2e14` | 34% + RAGE LOCKED 30d | [View](https://provenprotocol.dev/verify/0x079bb29d652294b01f4bdf86bb318277e0892e14) |

---

## How It Works

### Phase 1: Founder Launches a Pool

1. Founder deploys an ERC-20 token on Unichain Sepolia
2. Through the Proven frontend, they create a Uniswap v4 pool with the **ProvenHook** attached
3. LP tokens are deposited into the **ProvenVault**. They are now **locked**.
4. Founder defines milestones (e.g., TVL $1M → 25%, Volume $5M → 50%, 5K users → 25%)
5. The hook emits a `PoolRegistered` event

### Phase 2: Reactive Contract Starts Watching

The **RiskGuardRSC** contract on Lasna has subscriptions that tell the Reactive Network:

> *"Notify me whenever these events happen on Unichain Sepolia chain 1301."*

It subscribes to: `PoolMetricsUpdated`, `Transfer`, `Swap`, `AddLiquidity`, `RemoveLiquidity`

### Phase 3: Continuous Monitoring

Every time a relevant event occurs on Unichain Sepolia:

1. The Reactive Network delivers the event to `RiskGuardRSC.react()`
2. The reactive contract decodes the event data
3. It updates internal state (TVL, volume, user count)
4. It checks milestone thresholds
5. It evaluates 5 rug signals and computes a composite risk score (0–100)

### Phase 4a: Milestone Hit (Happy Path)

When a milestone threshold is met:

```
react() detects TVL >= $1M
  → emits Callback(1301, provenCallback, gasLimit, unlockMilestone(pool, 0))
  → Reactive Network delivers callback to Unichain Sepolia
  → ProvenCallback.unlockMilestone() executes
  → ProvenVault releases 25% of founder's LP
```

### Phase 4b: Rug Signals Detected (Protection Path)

When suspicious activity is detected:

```
react() detects composite risk score > 50
  → emits Callback(1301, provenCallback, gasLimit, extendLock(pool, 30 days))
  → Reactive Network delivers callback to Unichain Sepolia
  → ProvenCallback.extendLock() executes
  → ProvenVault extends lock by 30 days (Rage Lock)
```

---

## The 5 Rug Signals: Deep Dive

The reactive contract evaluates 5 on chain signals every time a relevant event is delivered. Each signal independently scores between 0 and 20 based on severity. The scores are summed into a **composite risk score** (0 to 100) that determines what action the RSC takes.

### Signal S1: Large Holder Outflow

**What it detects:** A large percentage of the token supply moving out of known wallets (founder, team, advisors) within a short window.

**Why it matters:** Before a rug pull, the team typically moves tokens to fresh wallets that are not being watched. This is the preparation phase. They are staging tokens for a coordinated dump.

**How it's calculated:**

```
Inputs:
  totalSupply       = total token supply (from ERC-20)
  amountMoved       = tokens transferred out of monitored wallets in the last 24h
  outflowPercentage = (amountMoved / totalSupply) × 100

Scoring:
  if outflowPercentage <= 5%   → score = 0   (normal activity)
  if outflowPercentage <= 10%  → score = 5   (minor movement)
  if outflowPercentage <= 15%  → score = 10  (notable movement)
  if outflowPercentage <= 25%  → score = 15  (significant. Elevated risk)
  if outflowPercentage > 25%   → score = 20  (critical. Likely staging before a rug)
```

**Events consumed:** `Transfer(address indexed from, address indexed to, uint256 value)`

**How the RSC tracks it:** The reactive contract maintains a rolling 24-hour window of transfers from monitored wallets. Each `Transfer` event where `from` is a monitored address adds to the cumulative outflow. Old entries (>24h) are aged out.

---

### Signal S2: Treasury Drain

**What it detects:** The project's treasury wallet balance dropping significantly.

**Why it matters:** Many projects have a treasury or marketing wallet. Before rugging, teams drain this wallet. They convert to ETH or stables and bridge out. A sudden drop in treasury balance is a strong leading indicator.

**How it's calculated:**

```
Inputs:
  previousBalance = treasury balance at last checkpoint
  currentBalance  = treasury balance now
  dropPercentage  = ((previousBalance - currentBalance) / previousBalance) × 100

Scoring:
  if dropPercentage <= 5%   → score = 0   (normal operations, paying expenses)
  if dropPercentage <= 10%  → score = 4   (minor draw)
  if dropPercentage <= 20%  → score = 8   (noticeable)
  if dropPercentage <= 40%  → score = 14  (alarming)
  if dropPercentage > 40%   → score = 20  (critical. Treasury is being emptied)
```

**Events consumed:** `Transfer` events where `from` matches the registered treasury address.

**Note:** The treasury address is optionally set by the founder during pool creation. If no treasury address is provided, S2 scores 0 by default (no data to evaluate).

---

### Signal S3: LP Withdrawal Attempt

**What it detects:** Any attempt to remove liquidity from the Uniswap pool, even if the transaction reverts.

**Why it matters:** This is the most direct rug signal. If someone is even *trying* to call `removeLiquidity()` on the pool, it shows intent. The ProvenHook blocks the actual removal, but the **attempt itself** is a signal.

**How it's calculated:**

```
Inputs:
  attemptDetected = boolean (did a removeLiquidity event fire?)

Scoring:
  if no attempt         → score = 0
  if attempt detected   → score = 20  (maximum. This is a direct rug signal)
```

**Events consumed:** `RemoveLiquidity` or the Uniswap v4 equivalent `ModifyLiquidity` with negative delta.

**Why it's binary (0 or 20):** There's no "mild" version of trying to pull liquidity. Either you're trying to remove it or you're not. Any attempt is treated as maximum severity for this signal.

---

### Signal S4: Liquidity Concentration

**What it detects:** Token supply becoming concentrated in very few wallets.

**Why it matters:** If 3 wallets hold 70% of supply, those 3 wallets can coordinate a dump. High concentration means a small number of actors control the price. This often happens when team members or insiders accumulate tokens under different addresses before dumping.

**How it's calculated:**

```
Inputs:
  top3HolderPercentage = percentage of total supply held by the 3 largest wallets

Scoring:
  if top3HolderPercentage <= 30%  → score = 0   (well distributed)
  if top3HolderPercentage <= 40%  → score = 4   (slightly concentrated)
  if top3HolderPercentage <= 50%  → score = 8   (moderately concentrated)
  if top3HolderPercentage <= 60%  → score = 14  (highly concentrated)
  if top3HolderPercentage > 60%   → score = 20  (critical. Whale dominated)
```

**Events consumed:** `Transfer` events. The RSC tracks the top holder balances by processing every transfer and maintaining a sorted balance map in its ReactVM state.

**Implementation note:** On chain, we cannot query "top 3 holders" directly. Instead, the reactive contract maintains a mapping of `address → balance` for significant holders (>1% of supply) and updates it on every `Transfer` event. This is possible because RSCs are stateful. They have persistent storage in the ReactVM.

---

### Signal S5: Holder Dispersion

**What it detects:** The number of unique token holders decreasing.

**Why it matters:** A healthy project gains users over time. If the unique holder count is *dropping*, people are selling and leaving. A rapid decrease (>10%) in a short period signals panic selling or a coordinated exit. This is often triggered by insider knowledge of an upcoming rug.

**How it's calculated:**

```
Inputs:
  previousHolderCount = unique holders at last checkpoint
  currentHolderCount  = unique holders now
  dropPercentage      = ((previousHolderCount - currentHolderCount) / previousHolderCount) × 100

Scoring:
  if holders are increasing  → score = 0   (healthy growth)
  if dropPercentage <= 3%    → score = 0   (normal churn)
  if dropPercentage <= 5%    → score = 4   (mild concern)
  if dropPercentage <= 10%   → score = 10  (significant exodus)
  if dropPercentage <= 20%   → score = 16  (mass exit)
  if dropPercentage > 20%    → score = 20  (critical. Project collapsing)
```

**Events consumed:** `Transfer` events. The RSC increments the holder count when a new address receives tokens (balance goes from 0 to >0) and decrements when an address balance drops to 0.

---

### Composite Score Calculation

All 5 signals are evaluated independently and summed:

```
compositeScore = S1 + S2 + S3 + S4 + S5

Minimum possible: 0   (all signals clean)
Maximum possible: 100 (all signals at maximum severity)
```

### Score Thresholds and Actions

| Score Range | Risk Level | Color | RSC Action |
|---|---|---|---|
| **0–25** | 🟢 Healthy | Green | No action. State updated silently. |
| **26–49** | 🟡 Watch | Yellow | `updateRiskScore()` callback dispatched. Score is written on-chain for the frontend to display. Investors are warned. |
| **50–74** | 🟠 Danger | Orange | **Rage Lock triggered.** `extendLock(pool, 30 days)` callback dispatched. Lock duration extended by 30 days. |
| **75–100** | 🔴 Critical | Red | **Rage Lock + Emergency.** `extendLock(pool, 90 days)` callback dispatched. Lock extended by 90 days. All pending milestone unlocks frozen. |

### Score Persistence and Decay

- Scores are **cumulative within a rolling window**. They do not reset to zero after each event.
- If no suspicious activity occurs for 7 days, signal scores **decay by 25%** per week
- This prevents a single past event from permanently branding a project
- If activity resumes (new signals fire), the score climbs again immediately
- Decay only applies to S1, S2, S4, and S5. **S3 (LP withdrawal attempt) does not decay** because attempting to remove liquidity is always a deliberate action.

### Real World Example: How Signals Combine

**Scenario: A founder prepares to rug over 3 days**

```
Day 1:
  Founder moves 20% of tokens to a fresh wallet
  → S1 fires: outflow 20% → score 15
  → Composite: 15 (Healthy. No action yet, but RSC is tracking)

Day 2:
  Treasury drops 35% (founder converting to ETH)
  → S2 fires: treasury drain 35% → score 14
  → Composite: 15 + 14 = 29 (Watch zone)
  → RSC dispatches updateRiskScore(29) callback
  → Frontend shows yellow warning to investors

Day 3:
  Top 3 wallets now hold 55% of supply (concentration increasing)
  → S4 fires: concentration 55% → score 14
  → Composite: 15 + 14 + 14 = 43 (Watch zone. Getting close)
  → RSC dispatches updateRiskScore(43) callback

  Then: Founder attempts removeLiquidity()
  → ProvenHook reverts the tx (instant protection)
  → But the event is still emitted and caught by RSC
  → S3 fires: LP withdrawal attempt → score 20
  → Composite: 15 + 14 + 14 + 20 = 63 (DANGER)
  → RSC dispatches extendLock(pool, 30 days)
  → Lock extended. Founder is completely blocked.

Day 3 result:
  ┌─────────────────────────────────────┐
  │ S1: Holder Outflow    ███████░░░ 15 │
  │ S2: Treasury Drain    ███████░░░ 14 │
  │ S3: LP Withdrawal     ██████████ 20 │
  │ S4: Concentration     ███████░░░ 14 │
  │ S5: Holder Dispersion ░░░░░░░░░░  0 │
  │                                     │
  │ COMPOSITE SCORE       ████████░░ 63 │
  │ STATUS: 🟠 RAGE LOCKED (+30 DAYS)  │
  └─────────────────────────────────────┘
```

---

## Milestone System: Deep Dive

### How Milestones Work

When a founder creates a pool via Proven, they define up to 3 milestones. Each milestone has:

| Field | Description | Example |
|---|---|---|
| **Condition** | What on chain metric to track | TVL, Trading Volume, Unique Users |
| **Threshold** | The target value | $1,000,000 |
| **Unlock %** | How much LP to release when met | 25% |

The total unlock percentages across all milestones must equal exactly **100%**.

### How Milestones Are Verified

Milestones are **not** reported by the founder. They are verified by the RSC reading real on chain data:

| Milestone Type | On Chain Source | How RSC Reads It |
|---|---|---|
| **TVL** | Token + pair token balance in the Uniswap pool | `PoolMetricsUpdated` event from ProvenHook, which reads pool reserves |
| **Trading Volume** | Cumulative swap amounts over time | `Swap` events from the pool, accumulated in ReactVM state |
| **Unique Users** | Count of distinct addresses that have interacted with the pool | `Swap` / `AddLiquidity` events, deduplicated by address in ReactVM state |

### Milestone Lifecycle

```
PENDING → VERIFIED → UNLOCKED

PENDING:    Threshold not yet met. LP remains locked.
VERIFIED:   RSC detects threshold met. Callback dispatched.
UNLOCKED:   Callback executed on chain. LP released to founder.
```

### Can Milestones Be Reversed?

**No.** Once a milestone is verified and LP is unlocked, it's done. The founder has already withdrawn that portion. However:

- If rug signals fire **after** a partial unlock, the **remaining locked LP** gets rage locked.
- The already unlocked portion is gone, but the majority is still protected.
- This is why progressive unlock matters: only 25% might be out, and 75% is still locked and protected

### Milestone + Rug Signal Interaction

```
State: M1 complete (25% unlocked), M2 and M3 pending (75% locked)

Rug signals fire → composite score 63 → RAGE LOCK

Result:
  ✅ 25% already withdrawn by founder (can't be clawed back)
  🔒 75% locked for 30 additional days
  ❄️  M2 and M3 frozen. Even if thresholds are met during rage lock,
     no more LP is released until the rage lock expires AND score drops below 50
```

---

## Callback System: How Cross Chain Actions Work

### The Flow

```
1. Event happens on Unichain Sepolia (chain 1301)
2. Reactive Network picks it up and delivers to react() on Lasna
3. react() evaluates logic and emits a Callback event
4. Reactive Network reads the Callback event
5. Reactive Network submits a transaction to Unichain Sepolia
6. The transaction calls the ProvenCallback contract
7. ProvenCallback executes the action on the vault
```

### Callback Authorization

For security, the Reactive Network **replaces the first argument** of every callback with the **RVM ID** (the deployer's address). This means:

- The callback contract can verify that only **our** reactive contract is sending commands
- A random attacker cannot call `unlockMilestone()` directly. It would have the wrong RVM ID.
- This is enforced by the `rvmIdOnly` modifier from `AbstractCallback`

### The Three Callbacks

**1. `unlockMilestone(address rvmId, address pool, uint8 milestoneIndex)`**

- Triggered when: A milestone threshold is met
- Effect: Marks the milestone as complete in ProvenVault, allowing the founder to withdraw that % of LP
- Frequency: At most 3 times per pool (one per milestone)

**2. `extendLock(address rvmId, address pool, uint256 duration)`**

- Triggered when: Composite risk score exceeds 50
- Effect: Extends the lock duration on all remaining LP. Freezes pending milestones.
- Duration: 30 days for score 50–74, 90 days for score 75+
- Frequency: Can fire multiple times if signals keep firing

**3. `updateRiskScore(address rvmId, address pool, uint256 newScore)`**

- Triggered when: Composite risk score is 26–49 (Watch zone)
- Effect: Writes the current risk score on chain so the frontend can display it
- Frequency: Fires on every score change in the Watch zone

---

## Multi Layer Protection

Proven has **three independent defense layers** that protect against different attack vectors:

### Layer 1: ProvenHook (Instant, Same Block)

The Uniswap v4 hook has `beforeRemoveLiquidity` logic that checks if the LP is locked in the vault. If yes, the transaction **reverts immediately**. This is the fastest defense. No cross chain communication is needed.

```
Attacker calls removeLiquidity() → Hook checks vault → REVERT
```

### Layer 2: ProvenVault (Instant, Same Block)

The vault contract enforces unlock percentages. Even if someone bypasses the hook, the vault itself won't release more LP than what's been unlocked by verified milestones.

```
Attacker calls vault.withdraw(100%) → Vault checks: only 25% unlocked → REVERT
```

### Layer 3: RiskGuardRSC (Cross Chain, 1 to 2 Blocks)

The reactive contract catches everything else. It detects subtle and indirect signals that precede a rug. Token transfers, treasury drains, and concentration changes do not directly interact with the pool or vault, so layers 1 and 2 cannot catch them. The RSC monitors these patterns across chains and extends the lock preemptively.

```
Founder drains treasury + moves tokens → RSC detects pattern → extendLock()
```

### Defense Matrix

| Attack Vector | Layer 1 (Hook) | Layer 2 (Vault) | Layer 3 (RSC) |
|---|---|---|---|
| Direct LP removal from pool | ✅ Blocks | Not applicable | ✅ Detects attempt (S3) |
| Withdraw more than unlocked from vault | Not applicable | ✅ Blocks | Not applicable |
| Move tokens to fresh wallets | Not applicable | Not applicable | ✅ Detects (S1) |
| Drain treasury | Not applicable | Not applicable | ✅ Detects (S2) |
| Concentrate supply in few wallets | Not applicable | Not applicable | ✅ Detects (S4) |
| Cause mass holder exodus | Not applicable | Not applicable | ✅ Detects (S5) |
| Wait for time lock to expire | N/A | N/A | **Impossible** (milestone based) |

---

## What Proven Does NOT Protect Against

Proven is powerful but not omniscient. It's important to be honest about limitations:

| Scenario | Proven's Response |
|---|---|
| Token price drops due to market conditions | ❌ Not a rug. LP is locked and investors can still sell |
| Founder builds a bad product | ❌ Not a scam. Milestones just will not be met, and LP stays locked |
| Founder sells their personal token holdings (not LP) | ⚠️ S1 may partially detect this, but founders are allowed to sell some tokens |
| Off chain fraud (fake marketing, lying about team) | ❌ Out of scope. Proven monitors on chain data only |
| Smart contract exploits in the token itself | ❌ Out of scope. Proven protects LP, not the token contract |

> **Proven eliminates scam risk. It does not eliminate market risks.**

---

## Contracts

### On Unichain Sepolia (1301)

| Contract | Purpose |
|---|---|
| **ProvenHook.sol** | Uniswap v4 hook. It emits pool metric events and blocks unauthorized LP removal |
| **ProvenVault.sol** | Holds locked LP tokens and enforces milestone based unlock logic |
| **ProvenCallback.sol** | Receives callbacks from Reactive Network and executes `unlockMilestone()`, `extendLock()`, and `updateRiskScore()` |

### On Lasna Testnet (5318007)

| Contract | Purpose |
|---|---|
| **RiskGuardRSC.sol** | The autonomous brain. It subscribes to events, runs signal logic, and emits callbacks |

---

## Project Structure

```
Proven/
├── Frontend/                          # React + Vite + TypeScript app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── LaunchPool.tsx
│   │   │   ├── InvestorDashboard.tsx
│   │   │   └── RSCActivityMonitor.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── config/
│   │   └── utils/
│   └── README.md
│
├── proven-hook/                       # Foundry project (Unichain-side hook)
│   ├── src/
│   │   ├── VestingHook.sol
│   │   ├── VestingTypes.sol
│   │   ├── MockVaultManager.sol
│   │   └── IVaultManager.sol
│   ├── script/
│   ├── test/
│   │   └── fuzz/
│   └── README.md
│
├── Reactive-Smart-Contracts/          # Foundry project (Reactive layer)
│   ├── src/
│   │   ├── RiskGuardRSC.sol
│   │   └── ProvenCallback.sol
│   ├── script/
│   ├── test/
│   │   └── fuzz/
│   └── README.md
├── LICENSE
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast, anvil)
- [MetaMask](https://metamask.io/) or any injected wallet
- Testnet ETH on Unichain Sepolia (faucet: [Unichain Faucet](https://faucet.unichain.org))
- Testnet REACT on Lasna (faucet: [Reactive Faucet](https://faucet.rnk.dev))

### 1. Clone the Repo

```bash
git clone https://github.com/minrawsjar/Proven.git
cd Proven
```

### 2. Frontend

```bash
cd Frontend
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000)

### 3. Smart Contracts

```bash
cd Reactive-Smart-Contracts
forge install
forge build
forge test
```

### 4. Environment Setup

Create `.env` in `Reactive-Smart-Contracts/`:

```env
PRIVATE_KEY=your_deployer_private_key
UNICHAIN_SEPOLIA_RPC=https://sepolia.unichain.org
LASNA_RPC=https://lasna-rpc.rnk.dev/
```

### 5. Deploy

```bash
# Deploy callback receiver to Unichain Sepolia
forge script script/DeployCallback.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC --broadcast

# Deploy reactive contract to Lasna
forge script script/DeployReactive.s.sol --rpc-url $LASNA_RPC --broadcast
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, wagmi, zustand |
| Smart Contracts | Solidity, Foundry, Uniswap v4 Hooks |
| Reactive Layer | Reactive Network, reactive lib, Lasna Testnet |
| Origin/Destination | Unichain Sepolia |
| Wallet | MetaMask (injected connector) |

---

## Key Concepts

### What If Milestones Are Never Met?

LP stays locked forever. The founder loses their capital. But crucially:

- The **pool still has liquidity**. Investors can always sell their tokens.
- Unlike a rug pull where the pool is drained and tokens become **untradeable**, with Proven the token may lose value but investors can **always exit**
- Proven eliminates **scam risk** while leaving **market risk** with the investor's own judgment

**The key difference:**
```
Rug Pull (no Proven):          Dead Project (with Proven):

LP removed by founder          LP locked forever
Pool = empty                   Pool = still has liquidity
Investor tries to sell         Investor tries to sell
→ CANNOT. No liquidity.        → CAN. Pool still works.
→ Token worth literally $0     → Token worth $0.5
→ Complete LOSS                → Loss will be there but not massive
```

### Reactive Smart Contracts: How They Enable Proven

Traditional smart contracts are passive. They only execute when someone sends a transaction. This means you need bots, multisigs, or centralized servers to trigger protective actions. All of these are trust assumptions.

Reactive Smart Contracts (RSCs) on the Reactive Network **invert this model**:

1. **Subscribe**: The RSC tells the network to watch events on a chain.
2. **React**: When an event matches, the network calls `react()` automatically.
3. **Callback**: The RSC emits a `Callback` event that the network delivers as a transaction to the destination chain.

This gives Proven its core property: **nobody needs to press a button**. Rug detection and lock extension happen autonomously and trustlessly on chain. The RSC runs in an isolated ReactVM. It cannot be tampered with, paused, or bribed.

Without the Reactive Network, Proven would need a centralized monitoring server with private keys. That server would be a single point of failure, a trust assumption, and a target for attackers. The RSC eliminates all of that.

Learn more: [Reactive Network Docs](https://dev.reactive.network)

---

## Contributing

This project is built for Atrium academy's UHI8 Hookathon. Contributions welcome after the event.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with</strong><br/>
  <a href="https://dev.reactive.network">Reactive Network</a> •
  <a href="https://unichain.org">Unichain</a> •
  <a href="https://v4.uniswap.org">Uniswap v4</a>
</p>
