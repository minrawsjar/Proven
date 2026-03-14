#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Proven Protocol — Full Deployment Pipeline
# ═══════════════════════════════════════════════════════════════════════════
#
#  Deploys all contracts across two chains:
#    • Unichain Sepolia (chain 1301):  MockVaultManager, VestingHook, ProvenCallback
#    • Lasna Testnet (chain 5318007):  RiskGuardRSC
#
#  Prerequisites:
#    1. Foundry installed (forge, cast)
#    2. .env files in both proven-hook/ and Reactive-Smart-Contracts/
#    3. SAME deployer private key in both .env files (required for address prediction)
#    4. Deployer wallet funded on BOTH chains
#       - Unichain Sepolia: ≥ 0.1 ETH (typical gas budget)
#       - Lasna Testnet: ≥ 2.1 ETH (2 ETH constructor funding + gas)
#
#  Usage:
#    chmod +x deploy.sh
#    ./deploy.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_DIR="$ROOT_DIR/proven-hook"
RSC_DIR="$ROOT_DIR/Reactive-Smart-Contracts"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()   { echo -e "${CYAN}[DEPLOY]${NC} $*"; }
ok()    { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
fail()  { echo -e "${RED}[FAILED]${NC} $*"; exit 1; }

command -v forge >/dev/null 2>&1 || fail "forge not found. Install Foundry first."
command -v cast >/dev/null 2>&1 || fail "cast not found. Install Foundry first."

# ─── Validate env files ────────────────────────────────────────────────────
log "Checking environment files..."

if [[ ! -f "$HOOK_DIR/.env" ]]; then
    fail "Missing $HOOK_DIR/.env — copy from .env.example and fill in PRIVATE_KEY"
fi

if [[ ! -f "$RSC_DIR/.env" ]]; then
    fail "Missing $RSC_DIR/.env — copy from .env.example and fill in PRIVATE_KEY"
fi

# Source the hook .env for PRIVATE_KEY
set -a
source "$HOOK_DIR/.env"
set +a

if [[ -z "${PRIVATE_KEY:-}" ]]; then
    fail "PRIVATE_KEY not set in $HOOK_DIR/.env"
fi

if [[ -z "${POOL_MANAGER:-}" ]]; then
    fail "POOL_MANAGER not set in $HOOK_DIR/.env (required by DeployProvenScript)"
fi

HOOK_PRIVATE_KEY="$PRIVATE_KEY"

# Validate RSC .env key and enforce same key for deterministic callback prediction
set -a
source "$RSC_DIR/.env"
set +a

if [[ -z "${PRIVATE_KEY:-}" ]]; then
    fail "PRIVATE_KEY not set in $RSC_DIR/.env"
fi

RSC_PRIVATE_KEY="$PRIVATE_KEY"

if [[ "${HOOK_PRIVATE_KEY,,}" != "${RSC_PRIVATE_KEY,,}" ]]; then
    fail "PRIVATE_KEY mismatch between proven-hook/.env and Reactive-Smart-Contracts/.env. Use the SAME key in both files."
fi

PRIVATE_KEY="$HOOK_PRIVATE_KEY"

DEPLOYER=$(cast wallet address "$PRIVATE_KEY" 2>/dev/null) || fail "Invalid PRIVATE_KEY"
log "Deployer: $DEPLOYER"

# ─── Check balances ────────────────────────────────────────────────────────
log "Checking balances..."

UNICHAIN_BAL=$(cast balance "$DEPLOYER" --rpc-url https://sepolia.unichain.org 2>/dev/null) || warn "Could not check Unichain Sepolia balance"
LASNA_BAL=$(cast balance "$DEPLOYER" --rpc-url https://lasna-rpc.rnk.dev 2>/dev/null) || warn "Could not check Lasna balance"

log "Unichain Sepolia balance: $UNICHAIN_BAL"
log "Lasna Testnet balance:    $LASNA_BAL"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "         PHASE 1: Unichain Sepolia (VaultManager + Hook)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

cd "$HOOK_DIR"
log "Building proven-hook contracts..."
forge build --quiet || fail "proven-hook build failed"
ok "Build successful"

log "Running DeployProven.s.sol (CREATE2 address mining + deploy)..."
echo ""

DEPLOY_OUTPUT=$(forge script script/DeployProven.s.sol:DeployProvenScript \
    --rpc-url https://sepolia.unichain.org \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    -vvvv 2>&1) || {
    echo "$DEPLOY_OUTPUT"
    fail "Phase 1 deployment failed"
}

echo "$DEPLOY_OUTPUT"

# Extract deployed addresses from output (macOS-compatible)
VAULT_ADDR=$(echo "$DEPLOY_OUTPUT" | grep '\[tx0\] MockVaultManager:' | grep -o '0x[0-9a-fA-F]*' | head -1) || true
HOOK_ADDR=$(echo "$DEPLOY_OUTPUT" | grep '\[tx1\] VestingHook:' | grep -o '0x[0-9a-fA-F]*' | head -1) || true
CALLBACK_PREDICTED=$(echo "$DEPLOY_OUTPUT" | grep 'ProvenCallback:' | grep -o '0x[0-9a-fA-F]*' | head -1) || true

if [[ -z "$HOOK_ADDR" ]]; then
    warn "Could not auto-extract VestingHook address from output."
    warn "Please find it in the logs above and set VESTING_HOOK_ADDR manually."
    read -rp "Enter VestingHook address: " HOOK_ADDR
fi

ok "Phase 1 complete!"
ok "MockVaultManager: $VAULT_ADDR"
ok "VestingHook:      $HOOK_ADDR"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "         PHASE 2: Unichain Sepolia (ProvenCallback)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

cd "$RSC_DIR"

# Source RSC .env and override VESTING_HOOK_ADDR
set -a
source "$RSC_DIR/.env"
set +a

# Always use the same deployer key captured from proven-hook/.env
PRIVATE_KEY="$HOOK_PRIVATE_KEY"
export VESTING_HOOK_ADDR="$HOOK_ADDR"
export CALLBACK_SENDER_ADDR="${CALLBACK_SENDER_ADDR:-0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4}"

log "Building Reactive-Smart-Contracts..."
forge build --quiet || fail "RSC build failed"
ok "Build successful"

log "Deploying ProvenCallback on Unichain Sepolia..."
echo ""

CALLBACK_OUTPUT=$(forge script script/DeployCallback.s.sol:DeployCallbackScript \
    --rpc-url https://sepolia.unichain.org \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    -vvvv 2>&1) || {
    echo "$CALLBACK_OUTPUT"
    fail "Phase 2 deployment failed"
}

echo "$CALLBACK_OUTPUT"

CALLBACK_ADDR=$(echo "$CALLBACK_OUTPUT" | grep 'ProvenCallback deployed at:' | grep -o '0x[0-9a-fA-F]*' | head -1) || true

if [[ -n "$CALLBACK_PREDICTED" && -n "$CALLBACK_ADDR" ]]; then
    if [[ "${CALLBACK_ADDR,,}" == "${CALLBACK_PREDICTED,,}" ]]; then
        ok "ProvenCallback address matches prediction! ✓"
    else
        warn "ProvenCallback address DOES NOT match prediction!"
        warn "Predicted: $CALLBACK_PREDICTED"
        warn "Actual:    $CALLBACK_ADDR"
        warn "VestingHook's RSC_AUTHORIZER will be incorrect. Redeployment needed."
        fail "Address mismatch — abort"
    fi
fi

if [[ -z "$CALLBACK_ADDR" ]]; then
    warn "Could not auto-extract ProvenCallback address."
    read -rp "Enter ProvenCallback address: " CALLBACK_ADDR
fi

ok "Phase 2 complete!"
ok "ProvenCallback: $CALLBACK_ADDR"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "         PHASE 3: Lasna Testnet (RiskGuardRSC)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

log "Deploying RiskGuardRSC on Lasna testnet via forge create..."
log "(Using forge create to avoid Reactive Network precompile simulation issues)"
echo ""

RSC_DEPLOY_VALUE="${RSC_DEPLOY_VALUE:-2ether}"

RSC_OUTPUT=$(forge create src/RiskGuardRSC.sol:RiskGuardRSC \
    --rpc-url https://lasna-rpc.rnk.dev \
    --private-key "$PRIVATE_KEY" \
    --value "$RSC_DEPLOY_VALUE" \
    --broadcast \
    --constructor-args 1301 1301 "$HOOK_ADDR" "$CALLBACK_ADDR" 2>&1) || {
    echo "$RSC_OUTPUT"
    fail "Phase 3 deployment failed"
}

echo "$RSC_OUTPUT"

RSC_ADDR=$(echo "$RSC_OUTPUT" | grep 'Deployed to:' | grep -o '0x[0-9a-fA-F]*' | head -1) || true

if [[ -z "$RSC_ADDR" ]]; then
    warn "Could not auto-extract RiskGuardRSC address."
    read -rp "Enter RiskGuardRSC address: " RSC_ADDR
fi

ok "Phase 3 complete!"
ok "RiskGuardRSC: $RSC_ADDR"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "             DEPLOYMENT COMPLETE — ALL CONTRACTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Chain: Unichain Sepolia (1301)"
echo "  ├─ MockVaultManager:  ${VAULT_ADDR:-<check logs>}"
echo "  ├─ VestingHook:       $HOOK_ADDR"
echo "  └─ ProvenCallback:    $CALLBACK_ADDR"
echo ""
echo "  Chain: Lasna Testnet (5318007)"
echo "  └─ RiskGuardRSC:      $RSC_ADDR"
echo ""

# ─── Write frontend .env ────────────────────────────────────────────────────
FRONTEND_ENV="$ROOT_DIR/Frontend/.env"
log "Writing Frontend/.env ..."

cat > "$FRONTEND_ENV" <<EOF
# Auto-generated by deploy.sh — $(date -u +"%Y-%m-%d %H:%M:%S UTC")
VITE_HOOK_ADDRESS=$HOOK_ADDR
VITE_VAULT_ADDRESS=${VAULT_ADDR:-}
VITE_CALLBACK_ADDRESS=$CALLBACK_ADDR
VITE_RSC_ADDRESS=$RSC_ADDR
EOF

ok "Frontend/.env written"

# ─── Write proven-hook deployed addresses ────────────────────────────────────
log "Updating proven-hook/.env with deployed addresses..."
{
    grep -v '^VAULT_MANAGER=' "$HOOK_DIR/.env" | grep -v '^VESTING_HOOK_ADDR=' | grep -v '^RSC_AUTHORIZER='
    echo "VAULT_MANAGER=${VAULT_ADDR:-}"
    echo "VESTING_HOOK_ADDR=$HOOK_ADDR"
    echo "RSC_AUTHORIZER=$CALLBACK_ADDR"
} > "$HOOK_DIR/.env.tmp" && mv "$HOOK_DIR/.env.tmp" "$HOOK_DIR/.env"

# ─── Write RSC deployed addresses ────────────────────────────────────────
log "Updating Reactive-Smart-Contracts/.env with deployed addresses..."
{
    grep -v '^VESTING_HOOK_ADDR=' "$RSC_DIR/.env" | grep -v '^PROVEN_CALLBACK_ADDR=' | grep -v '^PROVEN_REACTIVE_ADDR='
    echo "VESTING_HOOK_ADDR=$HOOK_ADDR"
    echo "PROVEN_CALLBACK_ADDR=$CALLBACK_ADDR"
    echo "PROVEN_REACTIVE_ADDR=$RSC_ADDR"
} > "$RSC_DIR/.env.tmp" && mv "$RSC_DIR/.env.tmp" "$RSC_DIR/.env"

ok "All .env files updated"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Next steps:"
echo "    1. cd Frontend && npm run dev"
echo "    2. Connect wallet on Unichain Sepolia"
echo "    3. Test the full flow: LaunchPool → InvestorDashboard → RSCMonitor"
echo "    4. (Optional) set PROVEN_REACTIVE_ADDR in Reactive-Smart-Contracts/.env"
echo "═══════════════════════════════════════════════════════════════"
