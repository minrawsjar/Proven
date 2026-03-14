# Proven Protocol — Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Unichain Sepolia (1301)                │
│                                                         │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐   │ 
│  │MockVaultMgr  │←─│ VestingHook │←─│ProvenCallback │   │
│  │(LP custody)  │  │ (Uni v4 hook│  │(RSC relay)    │   │
│  └──────────────┘  │  CREATE2)   │  └───────┬───────┘   │
│                    └──────┬──────┘          ↑           │
│                           │          Callback Proxy     │
│                    PoolManager        0x9299472A...     │
│                    0x00b036b5...                        │
└─────────────────────────────────────────────────────────┘
                            │  events ↓    ↑ callbacks
┌─────────────────────────────────────────────────────────┐
│                  Lasna Testnet (5318007)                │
│                                                         │
│              ┌──────────────────────┐                   │
│              │    RiskGuardRSC      │                   │
│              │  (5-signal rug det.) │                   │
│              └──────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Foundry** installed (`forge`, `cast`)
2. **Deployer wallet** funded on both chains:
  - Unichain Sepolia: enough ETH for gas (typically `>= 0.1 ETH`)
  - Lasna Testnet: enough ETH for gas + constructor value (typically `>= 2.1 ETH`)
3. **Same private key** for all deployments (required for address prediction)

### Get Testnet Funds

- **Unichain Sepolia ETH**: Bridge from Sepolia via [Superbridge](https://superbridge.app/unichain-sepolia)
- **Lasna Testnet ETH**: Use the [Reactive Faucet](https://faucet.rnk.dev/)

---

## Quick Deploy (Automated)

```bash
# 1. Ensure these files exist and are configured:
#    proven-hook/.env
#    Reactive-Smart-Contracts/.env
#
#    Required:
#    - SAME PRIVATE_KEY in both
#    - POOL_MANAGER in proven-hook/.env
#
# 2. Run the master deploy script
./deploy.sh
```

The script handles everything: CREATE2 salt mining, sequential deployment across both chains, address verification, and auto-populates `Frontend/.env`.

---

## Manual Deploy (Step-by-step)

### Phase 1: Unichain Sepolia — VaultManager + VestingHook

```bash
cd proven-hook
source .env

forge script script/DeployProven.s.sol:DeployProvenScript \
  --rpc-url https://sepolia.unichain.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

This script:
1. Predicts MockVaultManager address (nonce n)
2. Predicts ProvenCallback address (nonce n+3) — **DO NOT send other txs!**
3. Mines a CREATE2 salt so VestingHook's address has flags `0x0640` (afterAddLiquidity + beforeRemoveLiquidity + afterSwap)
4. Deploys MockVaultManager → VestingHook → vault.setHook()

**Save the output addresses!**

### Phase 2: Unichain Sepolia — ProvenCallback

```bash
cd ../Reactive-Smart-Contracts
source .env

# Set the VestingHook address from Phase 1
export VESTING_HOOK_ADDR=<hook_address_from_phase_1>
export CALLBACK_SENDER_ADDR=0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4

forge script script/DeployCallback.s.sol:DeployCallbackScript \
  --rpc-url https://sepolia.unichain.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

⚠️ **CRITICAL**: The ProvenCallback address MUST match the prediction from Phase 1. If it doesn't, VestingHook's `RSC_AUTHORIZER` is wrong and you must redeploy everything.

### Phase 3: Lasna Testnet — RiskGuardRSC

```bash
# Still in Reactive-Smart-Contracts/
export ORIGIN_CHAIN_ID=1301
export CALLBACK_CHAIN_ID=1301
export PROVEN_CALLBACK_ADDR=<callback_address_from_phase_2>

forge create src/RiskGuardRSC.sol:RiskGuardRSC \
  --rpc-url https://lasna-rpc.rnk.dev \
  --private-key $PRIVATE_KEY \
  --value 2ether \
  --broadcast \
  --constructor-args 1301 1301 <hook_address_from_phase_1> <callback_address_from_phase_2>
```

### Phase 4: Update Frontend

Create `Frontend/.env`:

```
VITE_HOOK_ADDRESS=<vesting_hook_address>
VITE_VAULT_ADDRESS=<vault_manager_address>
VITE_CALLBACK_ADDRESS=<proven_callback_address>
VITE_RSC_ADDRESS=<riskguardrsc_address>
```

Then:

```bash
cd ../Frontend
npm run dev
```

---

## Deployed Contract Addresses

> Fill these in after deployment

| Contract | Chain | Address |
|---|---|---|
| MockVaultManager | Unichain Sepolia (1301) | |
| VestingHook | Unichain Sepolia (1301) | |
| ProvenCallback | Unichain Sepolia (1301) | |
| RiskGuardRSC | Lasna Testnet (5318007) | |

---

## How CREATE2 Address Mining Works

Uniswap v4 hooks encode their permissions in the **lowest 14 bits** of their contract address. The PoolManager checks `uint160(hookAddr) & 0x3FFF` against the hook's declared permissions.

VestingHook declares three callbacks:
- `afterAddLiquidity` → bit 10 → `0x0400`
- `beforeRemoveLiquidity` → bit 9 → `0x0200`
- `afterSwap` → bit 6 → `0x0040`
- **Combined: `0x0640`**

The deploy script uses the `HookMiner` library to brute-force a CREATE2 salt that produces an address ending in the correct bit pattern. On average, this takes ~16,384 iterations (2^14 possible patterns).

### The Circular Dependency

VestingHook's constructor takes `RSC_AUTHORIZER` (= ProvenCallback address), but ProvenCallback's constructor takes the VestingHook address. We break this cycle by **predicting ProvenCallback's address** using `vm.computeCreateAddress(deployer, nonce + 3)` before deploying anything.

This works because:
1. VestingHook is deployed via CREATE2 (address independent of nonce)
2. ProvenCallback is deployed via regular CREATE (address = f(deployer, nonce))
3. We control the exact nonce by deploying in sequence with no gaps

---

## Troubleshooting

### "VaultManager address mismatch"
The deployer's nonce changed between the prediction and actual deployment. Someone sent a transaction from the same wallet. Restart from Phase 1.

### "VestingHook address mismatch"
The CREATE2 salt mining produced an unexpected result. This shouldn't happen — file a bug.

### "ProvenCallback address mismatch"
A transaction was sent between Phase 1 and Phase 2, shifting the nonce. The VestingHook's `RSC_AUTHORIZER` is now pointing to a wrong address. **Redeploy everything from Phase 1.**

### "HookMiner: no valid salt found"
Increase the iteration limit in `HookMiner.sol` (currently 500k). The theoretical maximum needed is ~2^14 ≈ 16k, but hash distribution may require more.

### RiskGuardRSC deployment fails on Lasna
Ensure you have sufficient Lasna balance. Deployment sends constructor value (`2 ether` by default in current flow) plus gas.
