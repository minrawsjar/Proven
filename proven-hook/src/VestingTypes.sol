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
/// @param complete      Whether this milestone has been completed by RSC callback
struct Milestone {
    ConditionType conditionType;
    uint256 threshold;
    uint8 unlockPct;
    bool complete;
}

/// @notice Registered vesting position for a team
/// @param team              Team wallet (address(0) means not registered)
/// @param tokenAddr         Project token address (for RSC / Lasna)
/// @param milestones        Three milestones
/// @param lpAmount          Total LP amount locked in vault
/// @param registeredAt      Block timestamp when position was registered
/// @param lockExtendedUntil Per-team rage lock / alert end timestamp (0 = not active)
struct VestingPosition {
    address team;
    address tokenAddr;
    Milestone[3] milestones;
    uint256 lpAmount;
    uint256 registeredAt;
    uint256 lockExtendedUntil;
}
