// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Condition type for vesting milestones (0=TVL, 1=Vol, 2=Users)
enum ConditionType {
    TVL,
    Vol,
    Users
}

/// @notice A single vesting milestone
/// @param conditionType 0=TVL, 1=Vol, 2=Users
/// @param threshold     Target value (uint256)
/// @param unlockPct     Unlock percentage 1-100
struct Milestone {
    ConditionType conditionType;
    uint256 threshold;
    uint8 unlockPct;
}

/// @notice Registered vesting position for a team
/// @param team       Team wallet (address(0) means not registered)
/// @param tokenAddr  Project token address (for RSC / Lasna)
/// @param milestones Three milestones
/// @param lpAmount   Total LP amount locked in vault
struct VestingPosition {
    address team;
    address tokenAddr;
    Milestone[3] milestones;
    uint256 lpAmount;
}
