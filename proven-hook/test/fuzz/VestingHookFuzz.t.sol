// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VestingHookTestHelper} from "../../src/VestingHookTestHelper.sol";
import {MockVaultManager} from "../../src/MockVaultManager.sol";
import {Milestone, ConditionType} from "../../src/VestingTypes.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract VestingHookFuzzTest is Test {
    using PoolIdLibrary for PoolKey;

    VestingHookTestHelper internal hook;
    MockVaultManager internal vault;

    address constant POOL_MANAGER = address(0xCAFE);
    address constant TEAM = address(0xBEEF);

    PoolKey internal key;
    PoolId internal poolId;

    function setUp() public {
        vault = new MockVaultManager();
        hook = new VestingHookTestHelper(IPoolManager(POOL_MANAGER), vault, address(0xABCD), address(this));
        vault.setHook(address(hook));

        key = PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        poolId = key.toId();
    }

    function testFuzz_registerVestingPosition_validUnlockSplit(uint8 p1Raw, uint8 p2Raw) public {
        uint8 p1 = uint8(bound(uint256(p1Raw), 1, 98));
        uint8 p2 = uint8(bound(uint256(p2Raw), 1, 99 - p1));
        uint8 p3 = uint8(100 - p1 - p2);

        vm.prank(TEAM);
        hook.registerVestingPosition(
            [
                Milestone({conditionType: ConditionType.TVL, threshold: 1, unlockPct: p1, complete: false}),
                Milestone({conditionType: ConditionType.Vol, threshold: 1, unlockPct: p2, complete: false}),
                Milestone({conditionType: ConditionType.Users, threshold: 1, unlockPct: p3, complete: false})
            ],
            address(0xDEAD),
            poolId
        );

        assertEq(hook.poolToTeam(poolId), TEAM);
    }

    function testFuzz_afterAddLiquidity_positiveDeltaLocks(uint128 amount) public {
        vm.assume(amount > 0);
        _register();

        vm.prank(POOL_MANAGER);
        hook.afterAddLiquidity(
            address(this),
            key,
            ModifyLiquidityParams({tickLower: -60, tickUpper: 60, liquidityDelta: int256(uint256(amount)), salt: bytes32(0)}),
            BalanceDeltaLibrary.ZERO_DELTA,
            BalanceDeltaLibrary.ZERO_DELTA,
            ""
        );

        assertEq(vault.locked(TEAM, poolId), uint256(amount));
        (, , uint256 lpAmount,,) = hook.positions(TEAM);
        assertEq(lpAmount, uint256(amount));
    }

    function testFuzz_afterAddLiquidity_nonPositiveDoesNotLock(int128 delta) public {
        vm.assume(delta <= 0);
        _register();

        vm.prank(POOL_MANAGER);
        hook.afterAddLiquidity(
            address(this),
            key,
            ModifyLiquidityParams({tickLower: -60, tickUpper: 60, liquidityDelta: int256(delta), salt: bytes32(0)}),
            BalanceDeltaLibrary.ZERO_DELTA,
            BalanceDeltaLibrary.ZERO_DELTA,
            ""
        );

        assertEq(vault.locked(TEAM, poolId), 0);
    }

    function _register() internal {
        vm.prank(TEAM);
        hook.registerVestingPosition(
            [
                Milestone({conditionType: ConditionType.TVL, threshold: 1, unlockPct: 34, complete: false}),
                Milestone({conditionType: ConditionType.Vol, threshold: 1, unlockPct: 33, complete: false}),
                Milestone({conditionType: ConditionType.Users, threshold: 1, unlockPct: 33, complete: false})
            ],
            address(0xDEAD),
            poolId
        );
    }
}
