// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VestingHookTestHelper} from "../src/VestingHookTestHelper.sol";
import {MockVaultManager} from "../src/MockVaultManager.sol";
import {VestingHook} from "../src/VestingHook.sol";
import {Milestone, ConditionType} from "../src/VestingTypes.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta, BalanceDeltaLibrary, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract MockPoolManagerState {
    mapping(bytes32 => bytes32) internal store;

    function setSlot(bytes32 slot, bytes32 value) external {
        store[slot] = value;
    }

    function extsload(bytes32 slot) external view returns (bytes32) {
        return store[slot];
    }
}

contract VestingHookExtraTest is Test {
    using PoolIdLibrary for PoolKey;

    VestingHookTestHelper internal hook;
    MockVaultManager internal vault;
    MockPoolManagerState internal mockManager;

    address constant TEAM = address(0xBEEF);
    address constant RSC_AUTHORIZER = address(0xABCD);

    PoolKey internal key;
    PoolId internal poolId;
    bytes4 internal constant HOOK_NOT_IMPLEMENTED_SELECTOR = bytes4(keccak256("HookNotImplemented()"));
    bytes4 internal constant NOT_POOL_MANAGER_SELECTOR = bytes4(keccak256("NotPoolManager()"));

    function setUp() public {
        mockManager = new MockPoolManagerState();
        vault = new MockVaultManager();
        hook = new VestingHookTestHelper(IPoolManager(address(mockManager)), vault, RSC_AUTHORIZER, address(this));
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

    function test_afterAddLiquidity_nonVesting_noLock() public {
        vm.prank(address(mockManager));
        (bytes4 sel,) = hook.afterAddLiquidity(
            address(0x1111),
            key,
            _liqParams(int256(100e18)),
            BalanceDeltaLibrary.ZERO_DELTA,
            BalanceDeltaLibrary.ZERO_DELTA,
            ""
        );

        assertEq(sel, hook.afterAddLiquidity.selector);
        assertEq(vault.locked(address(0x1111), poolId), 0);
    }

    function test_afterAddLiquidity_registered_locks() public {
        _register(TEAM);

        vm.prank(address(mockManager));
        hook.afterAddLiquidity(
            address(0x1111),
            key,
            _liqParams(int256(123e18)),
            BalanceDeltaLibrary.ZERO_DELTA,
            BalanceDeltaLibrary.ZERO_DELTA,
            ""
        );

        assertEq(vault.locked(TEAM, poolId), 123e18);
        (, , uint256 lpAmount,,) = hook.positions(TEAM);
        assertEq(lpAmount, 123e18);
    }

    function test_afterAddLiquidity_zeroOrNegativeLiquidity_noLock() public {
        _register(TEAM);

        vm.startPrank(address(mockManager));
        hook.afterAddLiquidity(address(0), key, _liqParams(0), BalanceDeltaLibrary.ZERO_DELTA, BalanceDeltaLibrary.ZERO_DELTA, "");
        hook.afterAddLiquidity(address(0), key, _liqParams(-1), BalanceDeltaLibrary.ZERO_DELTA, BalanceDeltaLibrary.ZERO_DELTA, "");
        vm.stopPrank();

        assertEq(vault.locked(TEAM, poolId), 0);
    }

    function test_afterSwap_countsUniqueUsers_fromHookDataAndFallbacks() public {
        _setPoolState(2 ** 96, 1_000_000);

        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 1});
        BalanceDelta delta = toBalanceDelta(-10, 8);

        // hookData actor
        vm.prank(address(mockManager));
        hook.afterSwap(address(0xAAAA), key, params, delta, abi.encode(address(0xB0B)));
        assertEq(hook.uniqueSwapperCount(poolId), 1);

        // same actor again -> no increment
        vm.prank(address(mockManager));
        hook.afterSwap(address(0xAAAA), key, params, delta, abi.encode(address(0xB0B)));
        assertEq(hook.uniqueSwapperCount(poolId), 1);

        // hookData zero address -> fallback to tx.origin
        vm.prank(address(mockManager));
        hook.afterSwap(address(0xAAAA), key, params, delta, abi.encode(address(0)));
        assertEq(hook.uniqueSwapperCount(poolId), 2);

        // empty hookData and sender != tx.origin -> fallback to tx.origin, no new increment
        vm.prank(address(mockManager));
        hook.afterSwap(address(0xAAAA), key, params, delta, "");
        assertEq(hook.uniqueSwapperCount(poolId), 2);

        assertEq(hook.cumulativeVolume(poolId), 72); // 4 swaps * (10 + 8)
    }

    function test_afterSwap_emitsCrashDetected_onLargeDrop() public {
        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 1});
        BalanceDelta delta = toBalanceDelta(-1, 1);

        // Initial price = 1.0
        _setPoolState(2 ** 96, 500_000);
        vm.prank(address(mockManager));
        hook.afterSwap(address(this), key, params, delta, "");

        // Drop to 0.25 (sqrt / 2), should emit crash >= 30%
        _setPoolState(2 ** 95, 500_000);
        vm.expectEmit(true, false, false, true);
        emit VestingHook.CrashDetected(poolId, 100);
        vm.prank(address(mockManager));
        hook.afterSwap(address(this), key, params, delta, "");
    }

    function test_disabledHookPoints_revertHookNotImplemented() public {
        vm.startPrank(address(mockManager));
        vm.expectRevert(abi.encodeWithSelector(HOOK_NOT_IMPLEMENTED_SELECTOR));
        hook.beforeInitialize(address(this), key, 1);

        vm.expectRevert(abi.encodeWithSelector(HOOK_NOT_IMPLEMENTED_SELECTOR));
        hook.afterInitialize(address(this), key, 1, 0);

        vm.expectRevert(abi.encodeWithSelector(HOOK_NOT_IMPLEMENTED_SELECTOR));
        hook.beforeAddLiquidity(address(this), key, _liqParams(1), "");

        vm.expectRevert(abi.encodeWithSelector(HOOK_NOT_IMPLEMENTED_SELECTOR));
        hook.afterRemoveLiquidity(address(this), key, _liqParams(-1), BalanceDeltaLibrary.ZERO_DELTA, BalanceDeltaLibrary.ZERO_DELTA, "");

        vm.expectRevert(abi.encodeWithSelector(HOOK_NOT_IMPLEMENTED_SELECTOR));
        hook.beforeSwap(address(this), key, SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 1}), "");

        vm.expectRevert(abi.encodeWithSelector(HOOK_NOT_IMPLEMENTED_SELECTOR));
        hook.beforeDonate(address(this), key, 1, 1, "");

        vm.expectRevert(abi.encodeWithSelector(HOOK_NOT_IMPLEMENTED_SELECTOR));
        hook.afterDonate(address(this), key, 1, 1, "");
        vm.stopPrank();
    }

    function test_onlyPoolManager_guard() public {
        vm.expectRevert(abi.encodeWithSelector(NOT_POOL_MANAGER_SELECTOR));
        hook.beforeRemoveLiquidity(address(this), key, _liqParams(-1), "");
    }

    function _register(address team) internal {
        vm.prank(team);
        hook.registerVestingPosition(
            [
                Milestone({conditionType: ConditionType.TVL, threshold: 1e6, unlockPct: 34, complete: false}),
                Milestone({conditionType: ConditionType.Vol, threshold: 2e6, unlockPct: 33, complete: false}),
                Milestone({conditionType: ConditionType.Users, threshold: 3e6, unlockPct: 33, complete: false})
            ],
            address(0xDEAD),
            poolId
        );
    }

    function _liqParams(int256 delta) internal pure returns (ModifyLiquidityParams memory) {
        return ModifyLiquidityParams({tickLower: -60, tickUpper: 60, liquidityDelta: delta, salt: bytes32(0)});
    }

    function _setPoolState(uint160 sqrtPriceX96, uint128 liquidity) internal {
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), bytes32(uint256(6))));
        bytes32 liqSlot = bytes32(uint256(stateSlot) + 3);

        mockManager.setSlot(stateSlot, bytes32(uint256(sqrtPriceX96)));
        mockManager.setSlot(liqSlot, bytes32(uint256(liquidity)));
    }
}
