// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AbstractCallback} from "reactive-lib/abstract-base/AbstractCallback.sol";

/**
 * @title ITimeLockHook
 * @notice Interface for the VestingHook RSC callback targets.
 *         All functions are onlyRSC on the hook side (immutable rscAuthorizer).
 */
interface ITimeLockHook {
    /// @notice Authorize a milestone unlock for a team
    function authorizeUnlock(address team, uint8 milestoneId) external;

    /// @notice RAGE LOCK — extend lock by penaltyDays (typically 30 days)
    function extendLock(address team, uint32 penaltyDays) external;

    /// @notice ALERT — pause withdrawals for pauseHours (typically 48h)
    function pauseWithdrawals(address team, uint32 pauseHours) external;
}

/**
 * @title ProvenCallback
 * @author Proven Protocol
 * @notice Callback receiver deployed on the origin chain (Ethereum Sepolia, same chain as VestingHook).
 *         Receives cross-chain callbacks from RiskGuardRSC running on Reactive Lasna,
 *         and translates them into state changes on the VestingHook:
 *
 *         • authorizeUnlock  → VestingHook.authorizeUnlock(team, milestoneId)
 *         • extendLock       → VestingHook.extendLock(team, penaltyDays)      [RAGE]
 *         • pauseWithdrawals → VestingHook.pauseWithdrawals(team, hours)      [ALERT]
 *
 * @dev Only the Reactive Network's callback proxy (passed as _callbackSender) is
 *      authorized to invoke these functions, enforced by AbstractCallback.authorizedSenderOnly.
 */
contract ProvenCallback is AbstractCallback {
    // ═══════════════════════════════════════════════════════════════════════════
    //                            IMMUTABLES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice VestingHook (TimeLockHook) contract on this chain
    ITimeLockHook public immutable HOOK;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event MilestoneUnlockRelayed(address indexed team, uint8 milestoneId);
    event LockExtendRelayed(address indexed team, uint32 penaltyDays);
    event PauseWithdrawalsRelayed(address indexed team, uint32 pauseHours);
    event DebugReactProbe(
        address indexed rsc,
        uint256 reactCalls,
        uint256 topic0,
        uint256 sourceChainId
    );

    // ═══════════════════════════════════════════════════════════════════════════
    //                            CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @param _hook            Address of VestingHook on this chain
     * @param _callbackSender  Address of the Reactive Network callback proxy on this chain
     */
    constructor(
        address _hook,
        address _callbackSender
    ) AbstractCallback(_callbackSender) payable {
        HOOK = ITimeLockHook(_hook);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                         CALLBACK HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Called by RSC when a milestone is reached.
     *         Relays to VestingHook.authorizeUnlock() → sets milestone.complete = true,
     *         increases unlockedPctByTeam.
     * @param team        The vesting team's address
     * @param milestoneId Which milestone (0, 1, or 2)
     */
    function authorizeUnlock(
        address,         // rvm_id — injected by Reactive Network, not used
        address team,
        uint8   milestoneId
    ) external authorizedSenderOnly {
        HOOK.authorizeUnlock(team, milestoneId);
        emit MilestoneUnlockRelayed(team, milestoneId);
    }

    /**
     * @notice RAGE LOCK — Called by RSC when risk score ≥ 75.
     *         Relays to VestingHook.extendLock() → sets lockExtendedUntil = now + 30 days.
     * @param team        The vesting team's address
     * @param penaltyDays Number of days to extend the lock (typically 30)
     */
    function extendLock(
        address,         // rvm_id — injected by Reactive Network, not used
        address team,
        uint32  penaltyDays
    ) external authorizedSenderOnly {
        HOOK.extendLock(team, penaltyDays);
        emit LockExtendRelayed(team, penaltyDays);
    }

    /**
     * @notice ALERT — Called by RSC when risk score 50–74.
     *         Relays to VestingHook.pauseWithdrawals() → sets lockExtendedUntil = now + 48h.
     * @param team  The vesting team's address
     * @param pauseHours Number of hours to pause withdrawals (typically 48)
     */
    function pauseWithdrawals(
        address,         // rvm_id — injected by Reactive Network, not used
        address team,
        uint32  pauseHours
    ) external authorizedSenderOnly {
        HOOK.pauseWithdrawals(team, pauseHours);
        emit PauseWithdrawalsRelayed(team, pauseHours);
    }

    /**
    * @notice Debug-only probe emitted from RiskGuardRSC.react() callback path.
     * @dev Helps verify ReactVM-side values on destination-chain events.
     */
    function debugReactProbe(
        address,        // rvm_id — injected by Reactive Network, not used
        address rsc,
        uint256 reactCalls,
        uint256 topic0,
        uint256 sourceChainId
    ) external authorizedSenderOnly {
        emit DebugReactProbe(rsc, reactCalls, topic0, sourceChainId);
    }
}
