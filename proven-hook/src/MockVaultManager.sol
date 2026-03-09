// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolId} from "v4-core/types/PoolId.sol";
import {IVaultManager} from "./IVaultManager.sol";

/// @notice Mock VaultManager for tests: records depositPosition / releasePosition calls
contract MockVaultManager is IVaultManager {
    error OnlyHook();
    error HookAlreadySet();
    error InsufficientLockedAmount();

    event DepositPosition(address indexed team, PoolId indexed poolId, uint256 amount);
    event ReleasePosition(address indexed team, PoolId indexed poolId, uint256 amount, address to);
    event HookSet(address hook);

    address public hook;
    mapping(address => mapping(PoolId => uint256)) public locked;

    modifier onlyHook() {
        if (hook != address(0) && msg.sender != hook) revert OnlyHook();
        _;
    }

    function setHook(address _hook) external override {
        if (hook != address(0)) revert HookAlreadySet();
        hook = _hook;
        emit HookSet(_hook);
    }

    function depositPosition(address team, PoolId poolId, uint256 amount) external override onlyHook {
        locked[team][poolId] += amount;
        emit DepositPosition(team, poolId, amount);
    }

    function releasePosition(address team, PoolId poolId, uint256 amount, address to) external override onlyHook {
        if (locked[team][poolId] < amount) revert InsufficientLockedAmount();
        locked[team][poolId] -= amount;
        emit ReleasePosition(team, poolId, amount, to);
    }

    function getLockedAmount(address team, PoolId poolId) external view override returns (uint256) {
        return locked[team][poolId];
    }
}
