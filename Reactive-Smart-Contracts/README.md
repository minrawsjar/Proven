# Reactive-Smart-Contracts

Reactive policy layer for Proven.

This package contains **RiskGuardRSC** and **ProvenCallback**.

- `RiskGuardRSC` ingests hook events, evaluates milestones/risk, and emits callback intents.
- `ProvenCallback` receives authorized callbacks on origin chain and relays hook actions.

---

## Core contracts

- `src/RiskGuardRSC.sol`
- `src/ProvenCallback.sol`

---

## What it does

1. Subscribes to origin chain hook events.
2. Automatically indexes newly launched teams and pools.
3. Evaluates milestone completion and risk signals.
4. Dispatches callback actions:
   - `authorizeUnlock`
   - `pauseWithdrawals`
   - `extendLock`

---

## How RSC protects LP (from protocol flow)

`RiskGuardRSC` is the autonomous policy brain on Lasna. It helps by continuously enforcing two outcomes:

1. **Progress based unlocks**
   - Consumes `PoolMetricsUpdated` and related pool activity events.
   - Tracks TVL, volume, and user metrics in reactive state.
   - When a milestone is reached, emits callback intent so `ProvenCallback` executes unlock on Unichain.

2. **Rug risk based lock extension (Rage Lock)**
   - Evaluates rug signals on each relevant event.
   - If composite risk breaches threshold, emits callback intent to extend lock windows.
   - This adds time friction automatically, without bots or multisigs.

### 5 Rug signals evaluated by `RiskGuardRSC`

- **S1 Large holder outflow**: abnormal token movement from monitored wallets.
- **S2 Treasury drain**: sudden treasury balance reduction.
- **S3 LP withdrawal attempt**: direct remove liquidity intent (max severity).
- **S4 Liquidity concentration**: top holders controlling too much supply.
- **S5 Holder dispersion drop**: shrinking unique holder count.

Each signal contributes to a composite risk score (`0-100`) used to decide whether to continue normal milestone flow or trigger protective lock extensions.

---

## Deployed contracts

| Contract | Chain | Address |
|---|---|---|
| ProvenCallback | Unichain Sepolia (1301) | [0xeaD222788a469141e3dee4e777F882ddA0b67c9F](https://sepolia.uniscan.xyz/address/0xeaD222788a469141e3dee4e777F882ddA0b67c9F) |
| RiskGuardRSC | Lasna Testnet (5318007) | [0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193](https://lasna.reactscan.net/address/0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193) |

---

## Folder structure

```
Reactive-Smart-Contracts/
├── src/
│   ├── RiskGuardRSC.sol
│   └── ProvenCallback.sol
├── script/
│   ├── DeployReactive.s.sol
│   └── DeployCallback.s.sol
├── test/
│   ├── RiskGuardRSC.t.sol
│   ├── RiskGuardRSCExtra.t.sol
│   ├── ProvenCallbackExtra.t.sol
│   └── fuzz/
│       └── RiskGuardRSCFuzz.t.sol
└── foundry.toml
```

---

## Commands

```bash
forge build
forge test
forge coverage --report summary
```

Deploy examples:

```bash
forge script script/DeployCallback.s.sol:DeployCallbackScript --rpc-url unichain_sepolia --broadcast
forge create src/RiskGuardRSC.sol:RiskGuardRSC --rpc-url lasna --broadcast --private-key $PRIVATE_KEY --value 2ether --constructor-args 1301 1301 <HOOK_ADDR> <CALLBACK_ADDR>
```

---

## Note on naming

The old name `TimeLockRSC` was legacy. `RiskGuardRSC` better reflects behavior through risk driven guarding with milestone logic and penalty lock windows.
