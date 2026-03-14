#!/usr/bin/env bash
set -euo pipefail

# Creates multiple demo TEAM wallets, funds each with 0.02 ETH from main wallet,
# registers VestingHook positions, and triggers rug-like outflow attempts.
#
# Usage:
#   NUM_TEAMS=6 /Users/swarnimraj/Proven/proven-hook/scripts/create_demo_wallet_teams.sh
#
# Required env (loaded from proven-hook/.env):
#   PRIVATE_KEY
#   UNICHAIN_RPC_URL
#   VESTING_HOOK_ADDR
#
# Optional env:
#   DEMO_TOKEN_ADDR      (auto-detected from broadcast file if unset)
#   DEMO_POOL_ID         (auto-detected from broadcast file if unset)
#   DEMO_RSC_ADDR        (auto-detected from Frontend/.env if unset)
#   LASNA_RPC_URL        (default: https://lasna-rpc.rnk.dev)
#   TEAM_FUND_ETH        (default: 0.02ether)
#   TEAM_TOKEN_FUND_WEI  (default: 300e18)

ROOT_DIR="/Users/swarnimraj/Proven"
HOOK_DIR="$ROOT_DIR/proven-hook"
ENV_FILE="$HOOK_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${PRIVATE_KEY:?PRIVATE_KEY missing in .env}"
: "${UNICHAIN_RPC_URL:?UNICHAIN_RPC_URL missing in .env}"
: "${VESTING_HOOK_ADDR:?VESTING_HOOK_ADDR missing in .env}"

NUM_TEAMS="${NUM_TEAMS:-6}"
TEAM_FUND_ETH="${TEAM_FUND_ETH:-0.02ether}"
TEAM_TOKEN_FUND_WEI="${TEAM_TOKEN_FUND_WEI:-300000000000000000000}"
LASNA_RPC_URL="${LASNA_RPC_URL:-https://lasna-rpc.rnk.dev}"

# Optional auto-discovery for RSC from Frontend/.env
if [[ -z "${DEMO_RSC_ADDR:-}" && -f "$ROOT_DIR/Frontend/.env" ]]; then
  DEMO_RSC_ADDR="$(grep -E '^VITE_RSC_ADDRESS=' "$ROOT_DIR/Frontend/.env" | head -n1 | cut -d= -f2- || true)"
fi

MAIN_ADDR="$(cast wallet address --private-key "$PRIVATE_KEY")"

# Auto-detect token + pool id from the latest successful register script broadcast
DEMO_BROADCAST_JSON="$HOOK_DIR/broadcast/TriggerRSC.s.sol/1301/phase1_register-latest.json"
if [[ -z "${DEMO_TOKEN_ADDR:-}" || -z "${DEMO_POOL_ID:-}" ]]; then
  if [[ ! -f "$DEMO_BROADCAST_JSON" ]]; then
    echo "Set DEMO_TOKEN_ADDR and DEMO_POOL_ID, or provide broadcast file at:"
    echo "  $DEMO_BROADCAST_JSON"
    exit 1
  fi
fi

DEMO_TOKEN_ADDR="${DEMO_TOKEN_ADDR:-$(python3 -c 'import json; j=json.load(open("/Users/swarnimraj/Proven/proven-hook/broadcast/TriggerRSC.s.sol/1301/phase1_register-latest.json")); print([t for t in j["transactions"] if (t.get("function") or "").startswith("registerVestingPosition")][0]["arguments"][1])')}"
DEMO_POOL_ID="${DEMO_POOL_ID:-$(python3 -c 'import json; j=json.load(open("/Users/swarnimraj/Proven/proven-hook/broadcast/TriggerRSC.s.sol/1301/phase1_register-latest.json")); print([t for t in j["transactions"] if (t.get("function") or "").startswith("registerVestingPosition")][0]["arguments"][2])')}"

OUT_DIR="$HOOK_DIR/demo-output/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"
CSV="$OUT_DIR/demo_wallets.csv"

echo "index,scenario,team_address,team_private_key,genesis_address,genesis_private_key,register_tx" > "$CSV"

echo "=== Demo bootstrap start ==="
echo "Main wallet:   $MAIN_ADDR"
echo "Hook:          $VESTING_HOOK_ADDR"
echo "Token:         $DEMO_TOKEN_ADDR"
echo "PoolId:        $DEMO_POOL_ID"
echo "RSC:           ${DEMO_RSC_ADDR:-<skip-rsc-config>}"
echo "Teams:         $NUM_TEAMS"
echo "Output:        $OUT_DIR"

cast_send_retry() {
  local max_tries="${1:-6}"
  shift
  local try=1
  local out
  while true; do
    set +e
    out=$(cast send "$@" 2>&1)
    local rc=$?
    set -e
    if [[ $rc -eq 0 ]]; then
      echo "$out"
      return 0
    fi

    if [[ $try -ge $max_tries ]]; then
      echo "$out" >&2
      return $rc
    fi

    if echo "$out" | grep -qiE 'nonce too low|replacement transaction underpriced|already known|timeout'; then
      sleep $((try * 2))
      try=$((try + 1))
      continue
    fi

    echo "$out" >&2
    return $rc
  done
}

scenario_config() {
  local idx="$1"
  case "$idx" in
    1)
      # Unlocked candidate (all easy)
      echo "unlocked_candidate|[(0,1,30,false),(1,1,40,false),(2,1,30,false)]|[0,1,2]|[1,1,1]|[30,40,30]"
      ;;
    2)
      # Baseline
      echo "baseline|[(0,500000000000000000000,25,false),(1,1000000000000000000000,50,false),(2,3,25,false)]|[0,1,2]|[500000000000000000000,1000000000000000000000,3]|[25,50,25]"
      ;;
    3)
      # Hard lock candidate
      echo "hard_lock|[(0,5000000000000000000000,30,false),(1,10000000000000000000000,40,false),(2,50,30,false)]|[0,1,2]|[5000000000000000000000,10000000000000000000000,50]|[30,40,30]"
      ;;
    4)
      # Score increase candidate
      echo "score_up|[(0,1000000000000000000000,20,false),(1,1,60,false),(2,5,20,false)]|[0,1,2]|[1000000000000000000000,1,5]|[20,60,20]"
      ;;
    5)
      # Rug attempt candidate
      echo "rug_attempt|[(0,1000000000000000000000,20,false),(1,2000000000000000000000,30,false),(2,1,50,false)]|[0,1,2]|[1000000000000000000000,2000000000000000000000,1]|[20,30,50]"
      ;;
    *)
      # Rage-lock candidate (easy milestones + heavy outflow)
      echo "rage_candidate|[(0,1,34,false),(1,1,33,false),(2,1,33,false)]|[0,1,2]|[1,1,1]|[34,33,33]"
      ;;
  esac
}

for i in $(seq 1 "$NUM_TEAMS"); do
  echo "--- Team $i/$NUM_TEAMS ---"

  TEAM_OUT="$(cast wallet new)"
  TEAM_ADDR="$(echo "$TEAM_OUT" | awk '/Address:/{print $2}')"
  TEAM_PK="$(echo "$TEAM_OUT" | awk '/Private key:/{print $3}')"

  GEN_OUT="$(cast wallet new)"
  GEN_ADDR="$(echo "$GEN_OUT" | awk '/Address:/{print $2}')"
  GEN_PK="$(echo "$GEN_OUT" | awk '/Private key:/{print $3}')"

  # 1) fund team + genesis gas
  cast_send_retry 6 "$TEAM_ADDR" --value "$TEAM_FUND_ETH" --rpc-url "$UNICHAIN_RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
  cast_send_retry 6 "$GEN_ADDR" --value 0.003ether --rpc-url "$UNICHAIN_RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

  # 2) fund team with demo token for outflow/rug signal attempts
  cast_send_retry 6 "$DEMO_TOKEN_ADDR" "transfer(address,uint256)" "$TEAM_ADDR" "$TEAM_TOKEN_FUND_WEI" --rpc-url "$UNICHAIN_RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

  # 3) register vesting position from team wallet
  SCEN="$(scenario_config "$i")"
  SCENARIO="$(echo "$SCEN" | cut -d'|' -f1)"
  MILESTONES="$(echo "$SCEN" | cut -d'|' -f2)"
  CONDITION_TYPES="$(echo "$SCEN" | cut -d'|' -f3)"
  THRESHOLDS="$(echo "$SCEN" | cut -d'|' -f4)"
  UNLOCK_PCTS="$(echo "$SCEN" | cut -d'|' -f5)"

  REG_JSON="$(cast_send_retry 6 "$VESTING_HOOK_ADDR" "registerVestingPosition((uint8,uint256,uint8,bool)[3],address,bytes32)" "$MILESTONES" "$DEMO_TOKEN_ADDR" "$DEMO_POOL_ID" --rpc-url "$UNICHAIN_RPC_URL" --private-key "$TEAM_PK" --json)"
  REG_TX="$(python3 - <<'PY'
import json,sys,re
raw=sys.stdin.read().strip()
tx=''
if raw:
    try:
        obj=json.loads(raw)
        tx=(obj.get('transactionHash') or obj.get('hash') or '').strip()
    except Exception:
        m=re.search(r'0x[a-fA-F0-9]{64}', raw)
        if m: tx=m.group(0)
print(tx)
PY
<<< "$REG_JSON")"

  # 3b) mirror milestone config on RSC (Lasna), if available
  if [[ -n "${DEMO_RSC_ADDR:-}" ]]; then
    cast_send_retry 6 "$DEMO_RSC_ADDR" "registerMilestones(bytes32,address,address,address,uint256[3],uint256[3],uint8[3])" "$DEMO_POOL_ID" "$TEAM_ADDR" "$DEMO_TOKEN_ADDR" "$TEAM_ADDR" "$CONDITION_TYPES" "$THRESHOLDS" "$UNLOCK_PCTS" --rpc-url "$LASNA_RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
    cast_send_retry 6 "$DEMO_RSC_ADDR" "addGenesisWallet(address,address)" "$TEAM_ADDR" "$GEN_ADDR" --rpc-url "$LASNA_RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
  fi

  # 4) trigger rug-like outflow attempts (S1/S2 candidates)
  if [[ "$i" -ge 4 ]]; then
    # S1 candidate: deployer/team outflow
    cast_send_retry 6 "$DEMO_TOKEN_ADDR" "transfer(address,uint256)" "$MAIN_ADDR" 120000000000000000000 --rpc-url "$UNICHAIN_RPC_URL" --private-key "$TEAM_PK" >/dev/null
  fi

  if [[ "$i" -ge 5 ]]; then
    # S2 candidate path: team -> genesis, then genesis -> main
    cast_send_retry 6 "$DEMO_TOKEN_ADDR" "transfer(address,uint256)" "$GEN_ADDR" 120000000000000000000 --rpc-url "$UNICHAIN_RPC_URL" --private-key "$TEAM_PK" >/dev/null
    cast_send_retry 6 "$DEMO_TOKEN_ADDR" "transfer(address,uint256)" "$MAIN_ADDR" 90000000000000000000 --rpc-url "$UNICHAIN_RPC_URL" --private-key "$GEN_PK" >/dev/null
  fi

  printf '%s,%s,%s,%s,%s,%s,%s\n' "$i" "$SCENARIO" "$TEAM_ADDR" "$TEAM_PK" "$GEN_ADDR" "$GEN_PK" "$REG_TX" >> "$CSV"
  echo "registered: $TEAM_ADDR"
done

echo "=== Demo bootstrap complete ==="
echo "CSV: $CSV"
echo "Use team addresses in /verify/<team_address>"
