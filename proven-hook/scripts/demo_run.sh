#!/usr/bin/env bash
set -euo pipefail

# Example helper to create a new wallet, fund it, and run the Foundry deploy script
# Adjust RPC_URL and FAUCET_SENDER to your environment (local node / testnet faucet)

RPC_URL=${RPC_URL:-"https://rpc.example"}
FAUCET_SENDER=${FAUCET_SENDER:-"0x..."}

echo "Creating a new demo wallet (private key will be saved to ./demo_deployer.key)"
# Create new wallet and extract the private key (cast prints private key on create)
cast wallet new > /tmp/cast_wallet_out || true
PRIVATE_KEY=$(grep -Eo "0x[0-9a-fA-F]{64}" /tmp/cast_wallet_out | head -n1)
if [ -z "$PRIVATE_KEY" ]; then
  echo "Failed to create wallet with cast; inspect /tmp/cast_wallet_out"
  cat /tmp/cast_wallet_out || true
  exit 1
fi
echo "$PRIVATE_KEY" > demo_deployer.key
echo "Private key saved to demo_deployer.key"

echo "Fund the new wallet from your faucet/local node (example using cast send):"
echo "cast send $FAUCET_SENDER $(cast wallet address --private-key $PRIVATE_KEY) 5ether --rpc-url $RPC_URL"

echo "When funded, set environment and run the Foundry script (example):"
echo "export RPC_URL=$RPC_URL"
echo "export PRIVATE_KEY=$PRIVATE_KEY"
echo "forge script proven-hook/script/DeployDemoPools.s.sol:DeployDemoPools --rpc-url \$RPC_URL --broadcast --private-key \$PRIVATE_KEY"

echo "Done. The Foundry script will log deployed demo pool addresses to console."
