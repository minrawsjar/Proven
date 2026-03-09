// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice Vault that holds locked LP positions for vesting teams
/// @dev setHook() is callable ONCE then permanently locked — no admin key
interface IVaultManager {
    /// @notice Record a team's LP position as deposited (locked)
    /// @param team   Team wallet that added liquidity
    /// @param poolId Pool identifier
    /// @param amount LP amount to lock
    function depositPosition(address team, PoolId poolId, uint256 amount) external;

    /// @notice Release a team's LP position (partial or full)
    /// @param team   Team wallet
    /// @param poolId Pool identifier
    /// @param amount LP amount to release
    /// @param to     Recipient of the released LP tokens
    function releasePosition(address team, PoolId poolId, uint256 amount, address to) external;

    /// @notice Get locked LP amount for a team in a pool — investors can verify custody
    /// @param team   Team wallet
    /// @param poolId Pool identifier
    /// @return Locked LP amount
    function getLockedAmount(address team, PoolId poolId) external view returns (uint256);

    /// @notice Set the authorized hook address. Callable ONCE, then permanently locked.
    /// @param hook Address of the TimeLockHook / VestingHook
    function setHook(address hook) external;
}
