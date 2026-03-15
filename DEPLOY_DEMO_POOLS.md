Demo pools: deploy and run
==========================

This project includes a simple `DemoPool` contract and a Foundry script that deploys multiple demo pools configured with different states (rugged, unlocked, rage-locked, score-updated).

Files added
- `proven-hook/src/DemoPool.sol` - minimal demo pool used only for demos
- `proven-hook/script/DeployDemoPools.s.sol` - Foundry script to deploy 6 demo pools and apply state changes
- `proven-hook/scripts/demo_run.sh` - helper shell snippet showing `cast` and `forge` commands

Quick steps
1. Create or pick a funded account (via `cast wallet new` or use existing private key).
2. Set env vars: `RPC_URL` and `PRIVATE_KEY`.
3. Fund the account with enough ETH for deployment.
4. Run the Foundry script:

```
export RPC_URL="https://your-rpc"
export PRIVATE_KEY="0x..."
forge script proven-hook/script/DeployDemoPools.s.sol:DeployDemoPools --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
```

Notes
- The demo contract is intentionally simple and only for demonstration/testing; do not use in production.
- `proven-hook/scripts/demo_run.sh` contains helpful example `cast` commands (replace placeholders).
- The script logs deployed addresses to console.
