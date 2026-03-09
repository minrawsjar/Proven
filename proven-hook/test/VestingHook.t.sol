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

    function setUp() public {
        vault = new MockVaultManager();
        // Use test helper to skip hook-address validation (so we can deploy to any address).
        hook = new VestingHookTestHelper(IPoolManager(POOL_MANAGER), vault);
    }

    function test_registerVestingPosition() public {
        Milestone[3] memory milestones = [
            Milestone({conditionType: ConditionType.TVL, threshold: 1e6, unlockPct: 33}),
            Milestone({conditionType: ConditionType.Vol, threshold: 2e6, unlockPct: 33}),
            Milestone({conditionType: ConditionType.Users, threshold: 3e6, unlockPct: 34})
        ];
        address tokenAddr = address(0xDeaD);
        vm.expectEmit(true, true, true, true);
        emit VestingHook.PositionRegistered(address(this), tokenAddr, POOL_ID);
        hook.registerVestingPosition(milestones, tokenAddr, POOL_ID);

        (address team, address tok, uint256 lpAmount) = hook.positions(address(this));
        assertEq(team, address(this));
        assertEq(tok, tokenAddr);
        assertEq(lpAmount, 0);
        assertEq(hook.poolToTeam(POOL_ID), address(this));
    }

    function test_registerVestingPosition_revertSumNot100() public {
        Milestone[3] memory milestones = [
            Milestone({conditionType: ConditionType.TVL, threshold: 1e6, unlockPct: 30}),
            Milestone({conditionType: ConditionType.Vol, threshold: 2e6, unlockPct: 30}),
            Milestone({conditionType: ConditionType.Users, threshold: 3e6, unlockPct: 30})
        ];
        vm.expectRevert(VestingHook.UnlockPctSumNot100.selector);
        hook.registerVestingPosition(milestones, address(1), POOL_ID);
    }

    function test_registerVestingPosition_revertAlreadyRegistered() public {
        Milestone[3] memory milestones = [
            Milestone({conditionType: ConditionType.TVL, threshold: 1e6, unlockPct: 50}),
            Milestone({conditionType: ConditionType.Vol, threshold: 2e6, unlockPct: 25}),
            Milestone({conditionType: ConditionType.Users, threshold: 3e6, unlockPct: 25})
        ];
        hook.registerVestingPosition(milestones, address(1), POOL_ID);
        vm.expectRevert(VestingHook.AlreadyRegistered.selector);
        hook.registerVestingPosition(milestones, address(1), POOL_ID);
    }

    function test_getLockedAmount() public {
        assertEq(hook.getLockedAmount(address(this), POOL_ID), 0);
        Milestone[3] memory milestones = [
            Milestone({conditionType: ConditionType.TVL, threshold: 1e6, unlockPct: 34}),
            Milestone({conditionType: ConditionType.Vol, threshold: 2e6, unlockPct: 33}),
            Milestone({conditionType: ConditionType.Users, threshold: 3e6, unlockPct: 33})
        ];
        hook.registerVestingPosition(milestones, address(0xDeaD), POOL_ID);
        assertEq(hook.getLockedAmount(address(this), POOL_ID), 0);
        assertEq(hook.getLockedAmount(address(0xBEEF), POOL_ID), 0);
    }

    // ---------- beforeRemoveLiquidity (Hook Point 2: withdrawal gate) ----------

    function _buildPoolKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function test_beforeRemoveLiquidity_nonVestingPasses() public {
        // Check 1: sender not a vesting position → allow.
        PoolKey memory key = _buildPoolKey();
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: -1000,
            salt: bytes32(0)
        });
        vm.prank(POOL_MANAGER);
        bytes4 selector = hook.beforeRemoveLiquidity(address(0xBEEF), key, params, "");
        assertEq(selector, hook.beforeRemoveLiquidity.selector);
    }

    function test_beforeRemoveLiquidity_lockExtensionActiveReverts() public {
        _registerVestingTeam(address(this));
        hook.setLpAmountForTest(address(this), 1000e18);
        hook.setUnlockedPctForTeam(address(this), 50);
        hook.setLockExtendedUntil(block.timestamp + 1 days);

        PoolKey memory key = _buildPoolKey();
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: -100e18,
            salt: bytes32(0)
        });
        vm.prank(POOL_MANAGER);
        vm.expectRevert(abi.encodeWithSelector(VestingHook.LockExtensionActive.selector, block.timestamp + 1 days));
        hook.beforeRemoveLiquidity(address(this), key, params, "");
    }

    function test_beforeRemoveLiquidity_exceedsUnlockedAmountReverts() public {
        _registerVestingTeam(address(this));
        hook.setLpAmountForTest(address(this), 1000e18);
        hook.setUnlockedPctForTeam(address(this), 10); // maxWithdrawable = 100e18

        PoolKey memory key = _buildPoolKey();
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: -200e18, // requested > 100e18
            salt: bytes32(0)
        });
        vm.prank(POOL_MANAGER);
        vm.expectRevert(
            abi.encodeWithSelector(VestingHook.ExceedsUnlockedAmount.selector, 200e18, 100e18)
        );
        hook.beforeRemoveLiquidity(address(this), key, params, "");
    }

    function test_beforeRemoveLiquidity_vestingWithinLimitPasses() public {
        _registerVestingTeam(address(this));
        hook.setLpAmountForTest(address(this), 1000e18);
        hook.setUnlockedPctForTeam(address(this), 50); // maxWithdrawable = 500e18

        PoolKey memory key = _buildPoolKey();
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: -300e18,
            salt: bytes32(0)
        });
        vm.prank(POOL_MANAGER);
        bytes4 selector = hook.beforeRemoveLiquidity(address(this), key, params, "");
        assertEq(selector, hook.beforeRemoveLiquidity.selector);
    }

    function _registerVestingTeam(address team) internal {
        vm.prank(team);
        Milestone[3] memory milestones = [
            Milestone({conditionType: ConditionType.TVL, threshold: 1e6, unlockPct: 34}),
            Milestone({conditionType: ConditionType.Vol, threshold: 2e6, unlockPct: 33}),
            Milestone({conditionType: ConditionType.Users, threshold: 3e6, unlockPct: 33})
        ];
        hook.registerVestingPosition(milestones, address(0xDeaD), POOL_ID);
    }
}
