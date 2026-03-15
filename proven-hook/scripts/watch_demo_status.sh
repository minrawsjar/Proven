#!/usr/bin/env bash
set -euo pipefail

# Polls latest demo team wallets and prints hook/risk status until targets are reached.
#
# Targets (judge demo readiness):
# - at least one team with unlockedPct > 0
# - at least one team with tier >= 1 (WATCH/ALERT/RAGE)
# - at least one team with tier >= 3 (RAGE)
#
# Optional stimulation:
#   AUTO_TRIGGER_SWAPS=1 -> runs TriggerSwap each loop to emit PoolMetricsUpdated
#
# Usage:
#   /Users/swarnimraj/Proven/proven-hook/scripts/watch_demo_status.sh
#   AUTO_TRIGGER_SWAPS=1 MAX_LOOPS=20 INTERVAL_SEC=20 /Users/swarnimraj/Proven/proven-hook/scripts/watch_demo_status.sh

ROOT_DIR="/Users/swarnimraj/Proven"
HOOK_DIR="$ROOT_DIR/proven-hook"
ENV_FILE="$HOOK_DIR/.env"

MAX_LOOPS="${MAX_LOOPS:-20}"
INTERVAL_SEC="${INTERVAL_SEC:-20}"
AUTO_TRIGGER_SWAPS="${AUTO_TRIGGER_SWAPS:-0}"

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

RSC_ADDR="${DEMO_RSC_ADDR:-}"
if [[ -z "$RSC_ADDR" && -f "$ROOT_DIR/Frontend/.env" ]]; then
  RSC_ADDR="$(grep -E '^VITE_RSC_ADDRESS=' "$ROOT_DIR/Frontend/.env" | head -n1 | cut -d= -f2- || true)"
fi

if [[ -z "$RSC_ADDR" ]]; then
  echo "Missing RSC address. Set DEMO_RSC_ADDR or Frontend VITE_RSC_ADDRESS."
  exit 1
fi

LATEST_DIR="$(ls -dt "$HOOK_DIR"/demo-output/* 2>/dev/null | head -n1 || true)"
if [[ -z "$LATEST_DIR" || ! -f "$LATEST_DIR/demo_wallets.csv" ]]; then
  echo "No demo_wallets.csv found. Run create_demo_wallet_teams.sh first."
  exit 1
fi

CSV="$LATEST_DIR/demo_wallets.csv"

cast_call_retry() {
  local max_tries="${1:-5}"
  shift
  local try=1
  local out
  while true; do
    set +e
    out=$(cast call "$@" 2>&1)
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
    sleep $((try * 2))
    try=$((try + 1))
  done
}

echo "Watching demo status"
echo "CSV: $CSV"
echo "Hook: $VESTING_HOOK_ADDR"
echo "RSC : $RSC_ADDR"

loop=1
while [[ "$loop" -le "$MAX_LOOPS" ]]; do
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "[$ts] Loop $loop/$MAX_LOOPS"
  echo "team,scenario,unlockedPct,riskScore,tier"

  any_unlocked=0
  any_watch=0
  any_rage=0

  # Handle malformed historical CSV lines by taking first 7 comma-separated fields only.
  while IFS=',' read -r idx scenario team team_pk gen gen_pk reg_tx extra; do
    if [[ ! "$team" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
      continue
    fi

    unlocked=$(cast_call_retry 5 "$VESTING_HOOK_ADDR" "unlockedPctByTeam(address)(uint8)" "$team" --rpc-url "$UNICHAIN_RPC_URL" | tr -d '\n\r')
    score=$(cast_call_retry 5 "$RSC_ADDR" "getRiskScore(address)(uint16)" "$team" --rpc-url "https://lasna-rpc.rnk.dev" | tr -d '\n\r')
    tier=$(cast_call_retry 5 "$RSC_ADDR" "getLastDispatchedTier(address)(uint8)" "$team" --rpc-url "https://lasna-rpc.rnk.dev" | tr -d '\n\r')

    echo "$team,$scenario,$unlocked,$score,$tier"

    if [[ "$unlocked" =~ ^[0-9]+$ ]] && (( unlocked > 0 )); then any_unlocked=1; fi
    if [[ "$tier" =~ ^[0-9]+$ ]] && (( tier >= 1 )); then any_watch=1; fi
    if [[ "$tier" =~ ^[0-9]+$ ]] && (( tier >= 3 )); then any_rage=1; fi
  done < <(tail -n +2 "$CSV")

  echo "summary: unlocked=$any_unlocked watch+=$any_watch rage=$any_rage"

  if (( any_unlocked == 1 && any_watch == 1 && any_rage == 1 )); then
    echo "Target reached: demo states present."
    exit 0
  fi

  if [[ "$AUTO_TRIGGER_SWAPS" == "1" ]]; then
    echo "stimulus: running TriggerSwap"
    (
      cd "$HOOK_DIR"
      PRIVATE_KEY="$PRIVATE_KEY" forge script script/TriggerSwap.s.sol:TriggerSwap --rpc-url "$UNICHAIN_RPC_URL" --broadcast >/dev/null 2>&1 || true
    )
  fi

  loop=$((loop + 1))
  sleep "$INTERVAL_SEC"
done

echo "Target not reached within MAX_LOOPS=$MAX_LOOPS"
exit 1
