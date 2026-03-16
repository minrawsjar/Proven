// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VestingHook} from "../src/VestingHook.sol";
import {MockVaultManager} from "../src/MockVaultManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IVaultManager} from "../src/IVaultManager.sol";
import {HookMiner} from "./HookMiner.sol";

/**
 * @title DeployProvenScript
 * @notice Deploys MockVaultManager + VestingHook (via CREATE2 address-mining) on Unichain Sepolia.
 *
 *         Uniswap v4 hooks encode permissions in the lowest 14 bits of their address.
 *         VestingHook requires:
 *           - afterAddLiquidity      (bit 10) = 0x0400
 *           - beforeRemoveLiquidity  (bit 9)  = 0x0200
 *           - afterSwap              (bit 6)  = 0x0040
 *           → Combined:              0x0640
 *
 *         This script:
 *           1. Predicts VaultManager address (regular CREATE at nonce n)
 *           2. Predicts ProvenCallback address (regular CREATE at nonce n+3, deployed in next step)
 *           3. Mines a CREATE2 salt for VestingHook using those addresses as constructor args
 *           4. Deploys MockVaultManager, VestingHook, and wires them together
 *
 *         After this script, run DeployCallback.s.sol from Reactive-Smart-Contracts
 *         to deploy ProvenCallback at the predicted address.
 *
 * Required env:
 *   PRIVATE_KEY          — deployer private key (hex, with 0x prefix)
 *   POOL_MANAGER         — Uniswap v4 PoolManager on Unichain Sepolia
 *
 * Usage:
 *   source .env
 *   forge script script/DeployProven.s.sol:DeployProvenScript \
 *     --rpc-url unichain_sepolia \
 *     --broadcast \
 *     -vvvv
 */
contract DeployProvenScript is Script {
    /// @dev VestingHook permission flags (afterAddLiquidity | beforeRemoveLiquidity | afterSwap)
    uint160 constant HOOK_FLAGS = uint160(0x0640);

    function run() public {
        // ─── Read env ──────────────────────────────────────────────────────
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));

        uint64 nonce = vm.getNonce(deployer);

        console.log("=========================================================");
        console.log("  Proven Protocol - Unichain Sepolia Deployment (Phase 1)");
        console.log("=========================================================");
        console.log("Deployer:         ", deployer);
        console.log("Current nonce:    ", nonce);
        console.log("PoolManager:      ", address(poolManager));

        // ─── Step 1: Predict addresses ─────────────────────────────────────
        //
        // Transaction sequence on Unichain Sepolia:
        //   tx0 (nonce n  ): new MockVaultManager()          → vaultAddr
        //   tx1 (nonce n+1): new VestingHook{salt}()         → hookAddr  (CREATE2)
        //   tx2 (nonce n+2): vault.setHook(hookAddr)         → (call)
        //   tx3 (nonce n+3): new ProvenCallback{0.1 ether}() → callbackAddr  [next script]
        //
        // ProvenCallback is deployed from the SAME deployer wallet in the
        // Reactive-Smart-Contracts project. Its address depends only on
        // the deployer + nonce, so we can predict it here.

        address predictedVault    = vm.computeCreateAddress(deployer, nonce);
        address predictedCallback = vm.computeCreateAddress(deployer, nonce + 3);

        console.log("");
        console.log("--- Predicted Addresses ---");
        console.log("MockVaultManager:  ", predictedVault);
        console.log("ProvenCallback:    ", predictedCallback);

        // ─── Step 2: Mine CREATE2 salt ─────────────────────────────────────
        bytes memory initCode = abi.encodePacked(
            type(VestingHook).creationCode,
            abi.encode(
                poolManager,
                IVaultManager(predictedVault),
                predictedCallback, // RSC_AUTHORIZER
                deployer            // OWNER
            )
        );

        console.log("");
        console.log("Mining CREATE2 salt (target flags: 0x0640)...");
        console.log("CREATE2 factory:   ", CREATE2_FACTORY);

        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_FACTORY,
            HOOK_FLAGS,
            initCode
        );

        console.log("Mined VestingHook: ", hookAddr);
        console.logBytes32(salt);

        // Sanity check
        require(
            uint160(hookAddr) & uint160(0x3FFF) == HOOK_FLAGS,
            "FATAL: mined address flag mismatch"
        );

        // ─── Step 3: Deploy ────────────────────────────────────────────────
        console.log("");
        console.log("--- Deploying ---");

        vm.startBroadcast(pk);

        // tx0 (nonce n): MockVaultManager
        MockVaultManager vault = new MockVaultManager();
        require(address(vault) == predictedVault, "VaultManager address mismatch");
        console.log("[tx0] MockVaultManager:", address(vault));

        // tx1 (nonce n+1): VestingHook via CREATE2
        VestingHook hook = new VestingHook{salt: salt}(
            poolManager,
            IVaultManager(address(vault)),
            predictedCallback,
            deployer
        );
        require(address(hook) == hookAddr, "VestingHook address mismatch");
        console.log("[tx1] VestingHook:     ", address(hook));

        // tx2 (nonce n+2): Wire vault → hook (one-time, permanently locked)
        vault.setHook(address(hook));
        console.log("[tx2] vault.setHook() done");

        vm.stopBroadcast();

        // ─── Step 4: Summary & next steps ──────────────────────────────────
        console.log("");
        console.log("=========================================================");
        console.log("  Phase 1 Complete! Save these addresses:");
        console.log("=========================================================");
        console.log("VAULT_MANAGER_ADDR = ", address(vault));
        console.log("VESTING_HOOK_ADDR  = ", address(hook));
        console.log("RSC_AUTHORIZER     = ", predictedCallback);
        console.log("");
        console.log("--- NEXT: Phase 2 - Deploy ProvenCallback ---");
        console.log("cd ../Reactive-Smart-Contracts");
        console.log("Set VESTING_HOOK_ADDR in .env to:", address(hook));
        console.log("");
        console.log("IMPORTANT: The predicted ProvenCallback address is:");
        console.log("  ", predictedCallback);
        console.log("This REQUIRES deployer nonce to be exactly:", nonce + 3);
        console.log("Do NOT send any other transactions before Phase 2!");
    }
}
