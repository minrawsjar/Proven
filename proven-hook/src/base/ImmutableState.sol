// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

/// @title Immutable State
/// @notice Holds immutable pool manager reference and onlyPoolManager modifier for hooks.
abstract contract ImmutableState {
    IPoolManager public immutable poolManager;

    error NotPoolManager();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }
}
