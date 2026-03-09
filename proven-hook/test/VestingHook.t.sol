// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VestingHook} from "../src/VestingHook.sol";
import {VestingHookTestHelper} from "../src/VestingHookTestHelper.sol";
import {MockVaultManager} from "../src/MockVaultManager.sol";
import {Milestone, ConditionType} from "../src/VestingTypes.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract VestingHookTest is Test {
    VestingHookTestHelper public hook;
    MockVaultManager public vault;
    PoolId constant POOL_ID = PoolId.wrap(keccak256("test-pool"));
    address constant POOL_MANAGER = address(1);
    address constant RSC_AUTHORIZER = address(0xABCD);

    function setUp() public {
        vault = new MockVaultManager();
        // 3-arg constructor: (IPoolManager, IVaultManager, address _rscAuthorizer)
        hook = new VestingHookTestHelper(IPoolManager(POOL_MANAGER), vault, RSC_AUTHORIZER);
        vault.setHook(address(hook));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                       REGISTRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_registerVestingPosition() public {
        Milestone[3] memory milestones = _milestones(33, 33, 34);
        address tokenAddr = address(0xDeaD);
        vm.expectEmit(true, true, true, true);
        emit VestingHook.PositionRegistered(address(this), tokenAddr, POOL_ID);
        hook.registerVestingPosition(milestones, tokenAddr, POOL_ID);

        (address team, address tok, uint256 lpAmount, uint256 registeredAt, uint256 lockExtendedUntil) =
            hook.positions(address(this));
        assertEq(team, address(this));
        assertEq(tok, tokenAddr);
        assertEq(lpAmount, 0);
        assertGt(registeredAt, 0);
        assertEq(lockExtendedUntil, 0);
        assertEq(hook.poolToTeam(POOL_ID), address(this));
    }

    function test_registerVestingPosition_revertSumNot100() public {
        Milestone[3] memory milestones = _milestones(30, 30, 30);
        vm.expectRevert(VestingHook.UnlockPctSumNot100.selector);
        hook.registerVestingPosition(milestones, address(1), POOL_ID);
    }

    function test_registerVestingPosition_revertAlreadyRegistered() public {
        Milestone[3] memory milestones = _milestones(50, 25, 25);
        hook.registerVestingPosition(milestones, address(1), POOL_ID);
        vm.expectRevert(VestingHook.AlreadyRegistered.selector);
        hook.registerVestingPosition(milestones, address(1), POOL_ID);
    }

    function test_getLockedAmount() public {
        assertEq(hook.getLockedAmount(address(this), POOL_ID), 0);
        _registerVestingTeam(address(this));
        assertEq(hook.getLockedAmount(address(this), POOL_ID), 0);
        assertEq(hook.getLockedAmount(address(0xBEEF), POOL_ID), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                  WITHDRAWAL GATE (beforeRemoveLiquidity)
    // ═══════════════════════════════════════════════════════════════════════

    function test_beforeRemoveLiquidity_nonVestingPasses() public {
        PoolKey memory key = _buildPoolKey();
        ModifyLiquidityParams memory params = _removeParams(-1000);
        vm.prank(POOL_MANAGER);
        bytes4 selector = hook.beforeRemoveLiquidity(address(0xBEEF), key, params, "");
        assertEq(selector, hook.beforeRemoveLiquidity.selector);
    }

    function test_beforeRemoveLiquidity_lockExtensionActiveReverts() public {
        _registerVestingTeam(address(this));
        hook.setLpAmountForTest(address(this), 1000e18);
        // Authorize milestone 0 → 34% unlocked
        vm.prank(RSC_AUTHORIZER);
        hook.authorizeUnlock(address(this), 0);
        // Extend lock 1 day via RSC
        vm.prank(RSC_AUTHORIZER);
        hook.extendLock(address(this), 1);

        PoolKey memory key = _buildPoolKey();
        ModifyLiquidityParams memory params = _removeParams(-100e18);
        vm.prank(POOL_MANAGER);
        vm.expectRevert(abi.encodeWithSelector(VestingHook.LockExtensionActive.selector, block.timestamp + 1 days));
        hook.beforeRemoveLiquidity(address(this), key, params, "");
    }

    function test_beforeRemoveLiquidity_exceedsUnlockedAmountReverts() public {
        _registerVestingTeam(address(this));
        hook.setLpAmountForTest(address(this), 1000e18);
        // Authorize milestone 0 → 34% unlocked
        vm.prank(RSC_AUTHORIZER);
        hook.authorizeUnlock(address(this), 0);

        PoolKey memory key = _buildPoolKey();
        // Try to withdraw 500e18 but only 340e18 is allowed (34%)
        ModifyLiquidityParams memory params = _removeParams(-500e18);
        vm.prank(POOL_MANAGER);
        vm.expectRevert(
            abi.encodeWithSelector(VestingHook.ExceedsUnlockedAmount.selector, 500e18, 340e18)
        );
        hook.beforeRemoveLiquidity(address(this), key, params, "");
    }

    function test_beforeRemoveLiquidity_vestingWithinLimitPasses() public {
        _registerVestingTeam(address(this));
        hook.setLpAmountForTest(address(this), 1000e18);
        // Authorize milestone 0 (34%) + milestone 1 (33%) = 67%
        vm.startPrank(RSC_AUTHORIZER);
        hook.authorizeUnlock(address(this), 0);
        hook.authorizeUnlock(address(this), 1);
        vm.stopPrank();

        PoolKey memory key = _buildPoolKey();
        ModifyLiquidityParams memory params = _removeParams(-600e18); // 600 < 670 limit
        vm.prank(POOL_MANAGER);
        bytes4 selector = hook.beforeRemoveLiquidity(address(this), key, params, "");
        assertEq(selector, hook.beforeRemoveLiquidity.selector);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //               RSC CALLBACK TARGETS (onlyRSC modifier)
    // ═══════════════════════════════════════════════════════════════════════

    function test_authorizeUnlock_success() public {
        _registerVestingTeam(address(this));

        vm.prank(RSC_AUTHORIZER);
        hook.authorizeUnlock(address(this), 0);

        assertEq(hook.unlockedPctByTeam(address(this)), 34);
    }

    function test_authorizeUnlock_allMilestones() public {
        _registerVestingTeam(address(this));

        vm.startPrank(RSC_AUTHORIZER);
        hook.authorizeUnlock(address(this), 0); // 34%
        hook.authorizeUnlock(address(this), 1); // +33% = 67%
        hook.authorizeUnlock(address(this), 2); // +33% = 100%
        vm.stopPrank();

        assertEq(hook.unlockedPctByTeam(address(this)), 100);
    }

    function test_authorizeUnlock_idempotent() public {
        _registerVestingTeam(address(this));

        vm.startPrank(RSC_AUTHORIZER);
        hook.authorizeUnlock(address(this), 0);
        hook.authorizeUnlock(address(this), 0); // double call — idempotent
        vm.stopPrank();

        assertEq(hook.unlockedPctByTeam(address(this)), 34);
    }

    function test_authorizeUnlock_revertOnlyRSC() public {
        _registerVestingTeam(address(this));

        vm.prank(address(0xDEAD));
        vm.expectRevert(VestingHook.OnlyRSC.selector);
        hook.authorizeUnlock(address(this), 0);
    }

    function test_authorizeUnlock_revertInvalidMilestoneId() public {
        _registerVestingTeam(address(this));

        vm.prank(RSC_AUTHORIZER);
        vm.expectRevert(VestingHook.InvalidMilestoneId.selector);
        hook.authorizeUnlock(address(this), 3);
    }

    function test_extendLock_success() public {
        _registerVestingTeam(address(this));

        vm.prank(RSC_AUTHORIZER);
        hook.extendLock(address(this), 30);

        (, , , , uint256 lockUntil) = hook.positions(address(this));
        assertEq(lockUntil, block.timestamp + 30 days);
    }

    function test_extendLock_revertOnlyRSC() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(VestingHook.OnlyRSC.selector);
        hook.extendLock(address(this), 30);
    }

    function test_pauseWithdrawals_success() public {
        _registerVestingTeam(address(this));

        vm.prank(RSC_AUTHORIZER);
        hook.pauseWithdrawals(address(this), 48);

        (, , , , uint256 lockUntil) = hook.positions(address(this));
        assertEq(lockUntil, block.timestamp + 48 hours);
    }

    function test_pauseWithdrawals_revertOnlyRSC() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(VestingHook.OnlyRSC.selector);
        hook.pauseWithdrawals(address(this), 48);
    }

    function test_lockExpiresAfterTime() public {
        _registerVestingTeam(address(this));
        hook.setLpAmountForTest(address(this), 1000e18);

        // Authorize milestone 0 → 34%
        vm.prank(RSC_AUTHORIZER);
        hook.authorizeUnlock(address(this), 0);

        // Extend lock 1 day
        vm.prank(RSC_AUTHORIZER);
        hook.extendLock(address(this), 1);

        // Can't withdraw during lock
        PoolKey memory key = _buildPoolKey();
        ModifyLiquidityParams memory params = _removeParams(-100e18);
        vm.prank(POOL_MANAGER);
        vm.expectRevert(abi.encodeWithSelector(VestingHook.LockExtensionActive.selector, block.timestamp + 1 days));
        hook.beforeRemoveLiquidity(address(this), key, params, "");

        // Warp past lock → can withdraw
        vm.warp(block.timestamp + 2 days);
        vm.prank(POOL_MANAGER);
        bytes4 sel = hook.beforeRemoveLiquidity(address(this), key, params, "");
        assertEq(sel, hook.beforeRemoveLiquidity.selector);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                            HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    function _milestones(uint8 p1, uint8 p2, uint8 p3) internal pure returns (Milestone[3] memory) {
        return [
            Milestone({conditionType: ConditionType.TVL, threshold: 1e6, unlockPct: p1, complete: false}),
            Milestone({conditionType: ConditionType.Vol, threshold: 2e6, unlockPct: p2, complete: false}),
            Milestone({conditionType: ConditionType.Users, threshold: 3e6, unlockPct: p3, complete: false})
        ];
    }

    function _buildPoolKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _removeParams(int256 delta) internal pure returns (ModifyLiquidityParams memory) {
        return ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: delta,
            salt: bytes32(0)
        });
    }

    function _registerVestingTeam(address team) internal {
        vm.prank(team);
        hook.registerVestingPosition(_milestones(34, 33, 33), address(0xDeaD), POOL_ID);
    }
}
