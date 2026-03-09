// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {VestingHook} from "../src/VestingHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IVaultManager} from "../src/IVaultManager.sol";

contract DeployScript is Script {
    function run() public {
        IPoolManager manager = IPoolManager(vm.envAddress("POOL_MANAGER"));
        IVaultManager vault = IVaultManager(vm.envAddress("VAULT_MANAGER"));
        vm.startBroadcast();
        new VestingHook(manager, vault);
        vm.stopBroadcast();
    }
}
