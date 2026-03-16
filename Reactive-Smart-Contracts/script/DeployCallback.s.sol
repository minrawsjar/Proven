// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ProvenCallback} from "../src/ProvenCallback.sol";

/**
 * @title DeployCallbackScript
 * @notice Deploys ProvenCallback on the ORIGIN chain (e.g. Sepolia).
 *         Run this FIRST, then use the deployed address when deploying ProvenReactive.
 *
 * Usage:
 *   source .env
 *   forge script script/DeployCallback.s.sol:DeployCallbackScript \
 *     --rpc-url $ORIGIN_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 */
contract DeployCallbackScript is Script {
    function run() public {
        address vestingHook    = vm.envAddress("VESTING_HOOK_ADDR");
        address callbackSender = vm.envAddress("CALLBACK_SENDER_ADDR");

        console.log("--- Deploying ProvenCallback (Unichain Sepolia) ---");
        console.log("VestingHook:    ", vestingHook);
        console.log("Callback Sender:", callbackSender);

        vm.startBroadcast();

        ProvenCallback callback = new ProvenCallback{value: 1 ether}(
            vestingHook,
            callbackSender
        );

        vm.stopBroadcast();

        console.log("ProvenCallback deployed at:", address(callback));
        console.log("-------------------------------");
    }
}
