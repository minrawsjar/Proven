// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolId} from "v4-core/types/PoolId.sol";
import {IVaultManager} from "./IVaultManager.sol";

/// @notice Mock VaultManager for tests: records depositPosition calls
contract MockVaultManager is IVaultManager {
    event DepositPosition(address indexed team, PoolId indexed poolId, uint256 amount);

    mapping(address => mapping(PoolId => uint256)) public locked;

    function depositPosition(address team, PoolId poolId, uint256 amount) external override {
        locked[team][poolId] += amount;
        emit DepositPosition(team, poolId, amount);
    }
}
