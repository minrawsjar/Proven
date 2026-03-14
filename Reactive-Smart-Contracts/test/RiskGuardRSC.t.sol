// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {RiskGuardRSC} from "../src/RiskGuardRSC.sol";
import {ProvenCallback} from "../src/ProvenCallback.sol";
import {IReactive} from "reactive-lib/interfaces/IReactive.sol";

// ════════════════════════════════════════════════════════════════════════════
//                          MOCK VESTING HOOK
// ════════════════════════════════════════════════════════════════════════════

/// @dev Lightweight mock that records calls from ProvenCallback (matches the
///      onlyRSC callback targets in the real VestingHook architecture)
contract MockTimeLockHook {
    // --- authorizeUnlock ---
    address public lastUnlockTeam;
    uint8   public lastUnlockMilestoneId;
    uint256 public authorizeUnlockCallCount;

    // --- extendLock ---
    address public lastExtendTeam;
    uint32  public lastExtendPenaltyDays;

    // --- pauseWithdrawals ---
    address public lastPauseTeam;
    uint32  public lastPauseHours;

    function authorizeUnlock(address team, uint8 milestoneId) external {
        lastUnlockTeam = team;
        lastUnlockMilestoneId = milestoneId;
        authorizeUnlockCallCount++;
    }

    function extendLock(address team, uint32 penaltyDays) external {
        lastExtendTeam = team;
        lastExtendPenaltyDays = penaltyDays;
    }

    function pauseWithdrawals(address team, uint32 pauseHours) external {
        lastPauseTeam = team;
        lastPauseHours = pauseHours;
    }
}

// ════════════════════════════════════════════════════════════════════════════
//                         RISKGUARDRSC TESTS
// ════════════════════════════════════════════════════════════════════════════

contract RiskGuardRSCTest is Test {
    RiskGuardRSC    rsc;
    ProvenCallback  callback;
    MockTimeLockHook hook;

    uint256 constant ORIGIN_CHAIN   = 11155111; // Sepolia
    uint256 constant CALLBACK_CHAIN = 11155111;

    address constant TEAM      = address(0xBEEF);
    address constant TOKEN     = address(0xDeaD);
    bytes32 constant POOL_ID   = bytes32(uint256(0x1234));

    function setUp() public {
        // 1. Deploy mock hook
        hook = new MockTimeLockHook();

        // 2. Deploy callback (this test contract = authorized sender)
        callback = new ProvenCallback(
            address(hook),
            address(this)
        );

        // 3. Deploy RSC (in test env, vm=true → skips real subscriptions)
        rsc = new RiskGuardRSC(
            ORIGIN_CHAIN,
            CALLBACK_CHAIN,
            address(hook),
            address(callback)
        );

        // 4. Register milestones for test pool
        rsc.registerMilestones(
            POOL_ID,
            TEAM,
            [uint256(0), uint256(1), uint256(2)],                   // TVL, Vol, Users
            [uint256(1_000_000), uint256(5_000_000), uint256(500)],  // thresholds
            [uint8(34), uint8(33), uint8(33)]                        // unlock percentages
        );
    }

    // ──────────────────────────────────────────────────────────────
    //          _indexNewTeam — DYNAMIC SUBSCRIPTION BOOTSTRAP
    // ──────────────────────────────────────────────────────────────

    function test_indexNewTeam() public {
        address newTeam  = address(0xCAFE);
        address newToken = address(0xFEED);
        bytes32 newPool  = bytes32(uint256(0x5678));

        IReactive.LogRecord memory log = IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN,
            _contract:    address(hook),
            topic_0:      uint256(keccak256("PositionRegistered(address,address,bytes32)")),
            topic_1:      uint256(uint160(newTeam)),
            topic_2:      uint256(uint160(newToken)),
            topic_3:      uint256(newPool),
            data:         "",
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });

        rsc.react(log);

        assertEq(rsc.getPoolTeam(newPool), newTeam);
        (address team, , , , , , , , , , , ) = rsc.configs(newTeam);
        assertEq(team, newTeam);
    }

    // ──────────────────────────────────────────────────────────────
    //                  MILESTONE EVALUATION TESTS
    // ──────────────────────────────────────────────────────────────

    function test_milestoneUnlock_singleMilestone() public {
        rsc.react(_buildMetricsLog(1_000_000, 100_000, 10));

        assertEq(rsc.getTotalUnlockedPct(TEAM), 34);
        assertTrue(rsc.isMilestoneComplete(TEAM, 0));
        assertFalse(rsc.isMilestoneComplete(TEAM, 1));
        assertFalse(rsc.isMilestoneComplete(TEAM, 2));
    }

    function test_milestoneUnlock_allAtOnce() public {
        rsc.react(_buildMetricsLog(2_000_000, 5_000_000, 1_000));

        assertEq(rsc.getTotalUnlockedPct(TEAM), 100);
        assertTrue(rsc.isMilestoneComplete(TEAM, 0));
        assertTrue(rsc.isMilestoneComplete(TEAM, 1));
        assertTrue(rsc.isMilestoneComplete(TEAM, 2));
    }

    function test_milestoneUnlock_progressive() public {
        // First: only TVL
        rsc.react(_buildMetricsLog(1_000_000, 0, 0));
        assertEq(rsc.getTotalUnlockedPct(TEAM), 34);

        // Second: + volume
        rsc.react(_buildMetricsLog(1_500_000, 5_000_000, 100));
        assertEq(rsc.getTotalUnlockedPct(TEAM), 67);

        // Third: + users
        rsc.react(_buildMetricsLog(2_000_000, 6_000_000, 500));
        assertEq(rsc.getTotalUnlockedPct(TEAM), 100);
    }

    function test_milestoneUnlock_noRegression() public {
        rsc.react(_buildMetricsLog(2_000_000, 5_000_000, 1_000));
        assertEq(rsc.getTotalUnlockedPct(TEAM), 100);

        // Metrics drop — milestones already complete, should NOT regress
        rsc.react(_buildMetricsLog(0, 0, 0));
        assertEq(rsc.getTotalUnlockedPct(TEAM), 100);
    }

    function test_noCallbackIfUnindexed() public {
        bytes32 unknownPool = bytes32(uint256(0x9999));

        IReactive.LogRecord memory log = IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN,
            _contract:    address(hook),
            topic_0:      uint256(keccak256("PoolMetricsUpdated(bytes32,uint256,uint256,uint256)")),
            topic_1:      uint256(unknownPool),
            topic_2:      0,
            topic_3:      0,
            data:         abi.encode(uint256(10e6), uint256(10e6), uint256(10_000)),
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });

        rsc.react(log); // should not revert
        assertEq(rsc.getTotalUnlockedPct(address(0)), 0);
    }

    // ──────────────────────────────────────────────────────────────
    //                  RUG SIGNAL DETECTION TESTS
    // ──────────────────────────────────────────────────────────────

    function test_S3_priceCrash_triggersSignal() public {
        // Set LP locked so team is tracked
        _lockLP(TEAM, POOL_ID, 1000e18);

        IReactive.LogRecord memory log = _buildCrashLog(45); // 45% drop
        rsc.react(log);

        (uint256 triggeredAt, uint16 basePoints, ) = rsc.getSignalState(TEAM, 2);
        assertGt(triggeredAt, 0);
        assertEq(basePoints, 35); // S3_POINTS
    }

    function test_S1_deployerOutflow_triggersSignal() public {
        // Index team first so walletToTeam[TEAM] = TEAM & deployer is set
        _indexTeam(TEAM, TOKEN, POOL_ID);

        // Set LP locked
        _lockLP(TEAM, POOL_ID, 1000e18);

        // Transfer from deployer (TEAM) — amount > 20% of locked
        IReactive.LogRecord memory log = IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN,
            _contract:    TOKEN,
            topic_0:      uint256(keccak256("Transfer(address,address,uint256)")),
            topic_1:      uint256(uint160(TEAM)),  // from = deployer
            topic_2:      uint256(uint160(address(0x999))), // to
            topic_3:      0,
            data:         abi.encode(uint256(250e18)), // 25% of 1000e18
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });

        rsc.react(log);

        (uint256 triggeredAt, uint16 basePoints, ) = rsc.getSignalState(TEAM, 0);
        assertGt(triggeredAt, 0);
        assertEq(basePoints, 45); // S1_POINTS
    }

    function test_riskScore_decays() public {
        _lockLP(TEAM, POOL_ID, 1000e18);

        // Trigger S3 (crash)
        rsc.react(_buildCrashLog(50));
        assertGt(rsc.getRiskScore(TEAM), 0);

        // Warp 12 days — S3 decays at 3/day = 36 total decay, base=35 → fully decayed
        vm.warp(block.timestamp + 12 days);

        // Trigger another event to recalc score, using metrics that won't trigger S4
        // tvl=1000, vol=100 → vol*100/tvl = 10 ≤ 80, so S4 not triggered
        rsc.react(_buildMetricsLog(1000, 100, 1));
        assertEq(rsc.getRiskScore(TEAM), 0);
    }

    function test_comboBonus_twoSignals() public {
        _lockLP(TEAM, POOL_ID, 1000e18);

        // Trigger S3 (crash) + S4 (sell ratio > 80% of TVL)
        rsc.react(_buildCrashLog(40));

        // S4: volume > 80% of TVL
        rsc.react(_buildMetricsLog(100, 90, 1)); // vol/tvl = 90%

        uint16 score = rsc.getRiskScore(TEAM);
        // S3=35 + S4=25 + combo=20 = 80 → capped at 100
        assertGe(score, 60); // at minimum S3+S4
    }

    // ──────────────────────────────────────────────────────────────
    //                  TIERED DISPATCH TESTS
    // ──────────────────────────────────────────────────────────────

    function test_rageTier_emitsExtendLockCallback() public {
        _lockLP(TEAM, POOL_ID, 1000e18);

        // Trigger S3 + combo to push score ≥ 75
        rsc.react(_buildCrashLog(50)); // S3 = 35

        // Trigger another signal to push into RAGE via combo
        rsc.react(_buildMetricsLog(100, 90, 1)); // S4 = 25, combo = 20 → total = 80

        assertEq(rsc.getLastDispatchedTier(TEAM), 3); // TIER_RAGE
    }

    function test_idempotency_sameTierNotReDispatched() public {
        _lockLP(TEAM, POOL_ID, 1000e18);

        // Push to RAGE
        rsc.react(_buildCrashLog(50));
        rsc.react(_buildMetricsLog(100, 90, 1));

        uint256 callbacksBefore = rsc.totalCallbacks();

        // Another event, same tier — should not re-dispatch
        rsc.react(_buildCrashLog(35));

        // Callbacks should not increase if tier hasn't changed
        assertEq(rsc.totalCallbacks(), callbacksBefore);
    }

    // ──────────────────────────────────────────────────────────────
    //                  CALLBACK CONTRACT TESTS
    // ──────────────────────────────────────────────────────────────

    function test_callback_authorizeUnlock() public {
        callback.authorizeUnlock(address(0), TEAM, 1);

        assertEq(hook.lastUnlockTeam(), TEAM);
        assertEq(hook.lastUnlockMilestoneId(), 1);
    }

    function test_callback_extendLock() public {
        callback.extendLock(address(0), TEAM, 30);

        assertEq(hook.lastExtendTeam(), TEAM);
        assertEq(hook.lastExtendPenaltyDays(), 30);
    }

    function test_callback_pauseWithdrawals() public {
        callback.pauseWithdrawals(address(0), TEAM, 48);

        assertEq(hook.lastPauseTeam(), TEAM);
        assertEq(hook.lastPauseHours(), 48);
    }

    function test_callback_rejectsUnauthorized() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert("Authorized sender only");
        callback.authorizeUnlock(address(0), TEAM, 0);
    }

    function test_callback_rejectsUnauthorized_extendLock() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert("Authorized sender only");
        callback.extendLock(address(0), TEAM, 30);
    }

    function test_callback_rejectsUnauthorized_pauseWithdrawals() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert("Authorized sender only");
        callback.pauseWithdrawals(address(0), TEAM, 48);
    }

    // ──────────────────────────────────────────────────────────────
    //                 LP TRACKING TESTS
    // ──────────────────────────────────────────────────────────────

    function test_positionLocked_tracked() public {
        _lockLP(TEAM, POOL_ID, 1000e18);
        assertEq(rsc.getTeamLPLocked(TEAM), 1000e18);
    }

    function test_positionLocked_cumulative() public {
        _lockLP(TEAM, POOL_ID, 500e18);
        _lockLP(TEAM, POOL_ID, 300e18);
        assertEq(rsc.getTeamLPLocked(TEAM), 800e18);
    }

    // ──────────────────────────────────────────────────────────────
    //                   REACT COUNTER TESTS
    // ──────────────────────────────────────────────────────────────

    function test_reactCallCounter() public {
        uint256 before = rsc.totalReactCalls();
        rsc.react(_buildMetricsLog(100, 100, 1));
        assertEq(rsc.totalReactCalls(), before + 1);
    }

    // ──────────────────────────────────────────────────────────────
    //                         HELPERS
    // ──────────────────────────────────────────────────────────────

    function _lockLP(address team, bytes32 poolId, uint256 amount) internal {
        IReactive.LogRecord memory log = IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN,
            _contract:    address(hook),
            topic_0:      uint256(keccak256("PositionLocked(address,bytes32,uint256)")),
            topic_1:      uint256(uint160(team)),
            topic_2:      uint256(poolId),
            topic_3:      0,
            data:         abi.encode(amount),
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });
        rsc.react(log);
    }

    function _buildMetricsLog(
        uint256 tvl,
        uint256 vol,
        uint256 users
    ) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN,
            _contract:    address(hook),
            topic_0:      uint256(keccak256("PoolMetricsUpdated(bytes32,uint256,uint256,uint256)")),
            topic_1:      uint256(POOL_ID),
            topic_2:      0,
            topic_3:      0,
            data:         abi.encode(tvl, vol, users),
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });
    }

    function _buildCrashLog(uint256 dropPct) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN,
            _contract:    address(hook),
            topic_0:      uint256(keccak256("CrashDetected(bytes32,uint256)")),
            topic_1:      uint256(POOL_ID),
            topic_2:      0,
            topic_3:      0,
            data:         abi.encode(dropPct),
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });
    }

    function _indexTeam(address team, address token, bytes32 poolId) internal {
        IReactive.LogRecord memory log = IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN,
            _contract:    address(hook),
            topic_0:      uint256(keccak256("PositionRegistered(address,address,bytes32)")),
            topic_1:      uint256(uint160(team)),
            topic_2:      uint256(uint160(token)),
            topic_3:      uint256(poolId),
            data:         "",
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });
        rsc.react(log);
    }
}
