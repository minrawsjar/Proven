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
| ProvenCallback | Unichain Sepolia (1301) | [0xF61B21a60FeE27d36099BA7A7bc81E96cC4B2a0A](https://sepolia.uniscan.xyz/address/0xF61B21a60FeE27d36099BA7A7bc81E96cC4B2a0A) |
| RiskGuardRSC | Lasna Testnet (5318007) | [0x9796f833700b32aF4A3ebC837C2DCd35BEf56118](https://lasna.reactscan.net/address/0x9796f833700b32aF4A3ebC837C2DCd35BEf56118) |

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
