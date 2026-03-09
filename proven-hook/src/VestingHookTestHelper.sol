// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VestingHook} from "./VestingHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IVaultManager} from "./IVaultManager.sol";

/// @notice Test-only VestingHook that skips hook address validation so it can be deployed to any address.
contract VestingHookTestHelper is VestingHook {
    constructor(IPoolManager _manager, IVaultManager _vaultManager) VestingHook(_manager, _vaultManager) {}

    /// @dev Override to skip validation when testing (deploy to any address).
    function validateHookAddress() internal view override {}

    /// @dev Set lpAmount for a team so withdrawal-gate tests can run without going through afterAddLiquidity.
    function setLpAmountForTest(address team, uint256 amount) external {
        positions[team].lpAmount = amount;
    }
}
