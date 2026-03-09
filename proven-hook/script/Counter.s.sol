// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {VestingHookTestHelper} from "../src/VestingHookTestHelper.sol";
import {MockVaultManager} from "../src/MockVaultManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IVaultManager} from "../src/IVaultManager.sol";

contract CounterScript is Script {
    function run() public {
        vm.startBroadcast();
        MockVaultManager vault = new MockVaultManager();
        new VestingHookTestHelper(IPoolManager(address(1)), IVaultManager(address(vault)));
        vm.stopBroadcast();
    }
}
