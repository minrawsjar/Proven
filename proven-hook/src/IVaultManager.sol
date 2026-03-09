// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice Vault that holds locked LP positions for vesting teams
interface IVaultManager {
    /// @notice Record a team's LP position as deposited (locked)
    /// @param team   Team wallet that added liquidity
    /// @param poolId Pool identifier
    /// @param amount LP amount to lock
    function depositPosition(address team, PoolId poolId, uint256 amount) external;
}
