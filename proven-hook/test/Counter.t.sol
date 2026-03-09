// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VestingHook} from "../src/VestingHook.sol";
import {VestingHookTestHelper} from "../src/VestingHookTestHelper.sol";
import {MockVaultManager} from "../src/MockVaultManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract CounterTest is Test {
    VestingHook public hook;
    MockVaultManager public vault;

    function setUp() public {
        vault = new MockVaultManager();
        hook = new VestingHookTestHelper(IPoolManager(address(1)), vault, address(0));
    }

    function test_HookDeployed() public view {
        assertEq(address(hook.VAULT_MANAGER()), address(vault));
        assertEq(address(hook.poolManager()), address(1));
    }
}
