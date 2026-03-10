// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TimeLockRSC} from "../src/TimeLockRSC.sol";

/**
 * @title DeployReactiveScript
 * @notice Deploys TimeLockRSC on the Reactive Network (Lasna testnet, chain 5318007).
 *         Run this AFTER deploying ProvenCallback on the origin chain.
 *
 * Usage:
 *   source .env
 *   forge script script/DeployReactive.s.sol:DeployReactiveScript \
 *     --rpc-url $LASNA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 */
contract DeployReactiveScript is Script {
    function run() public {
        uint256 originChainId   = vm.envUint("ORIGIN_CHAIN_ID");
        uint256 callbackChainId = vm.envUint("CALLBACK_CHAIN_ID");
        address hookAddr        = vm.envAddress("VESTING_HOOK_ADDR");
        address callbackProxy   = vm.envAddress("PROVEN_CALLBACK_ADDR");

        console.log("--- Deploying TimeLockRSC on Lasna ---");
        console.log("Origin Chain ID:  ", originChainId);
        console.log("Callback Chain ID:", callbackChainId);
        console.log("VestingHook:      ", hookAddr);
        console.log("Callback Proxy:   ", callbackProxy);

        vm.startBroadcast();

        TimeLockRSC rsc = new TimeLockRSC{value: 0.5 ether}(
            originChainId,
            callbackChainId,
            hookAddr,
            callbackProxy
        );

        vm.stopBroadcast();

        console.log("TimeLockRSC deployed at:", address(rsc));
        console.log("-------------------------------");
    }
}
