// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @dev Minimal interface for PoolSwapTest (Unichain Sepolia)
interface IPoolSwapTest {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24  fee;
        int24   tickSpacing;
        address hooks;
    }

    struct SwapParams {
        bool    zeroForOne;
        int256  amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    struct TestSettings {
        bool takeClaims;
        bool settleUsingBurn;
    }

    function swap(
        PoolKey memory key,
        SwapParams memory params,
        TestSettings memory testSettings,
        bytes memory hookData
    ) external payable returns (int256 delta);
}

/**
 * @title TriggerSwap — Execute a swap to generate PoolMetricsUpdated events
 * @notice This swap triggers the VestingHook's afterSwap → emits PoolMetricsUpdated
 *         → Reactive Network picks it up → TimeLockRSC evaluates milestones & signals
 */
contract TriggerSwap is Script {
    // ── Deployed addresses on Unichain Sepolia ──
    address constant POOL_SWAP_TEST = 0x9140a78c1A137c7fF1c151EC8231272aF78a99A4;
    address constant VESTING_HOOK   = 0x854BcA4456489aCa8Ccf6bA37D6EF3E9869E8640;

    // ── Pool tokens (sorted) ──
    address constant TOKEN0 = 0x11aFfEac94B440C3c332813450db66fb3285BFB2; // USDC (lower address)
    address constant TOKEN1 = 0x3c2d1A5c84B7F513ed07Fe2e71dF9538aC217F7c; // PTT

    // ── Pool parameters (must match what was initialized) ──
    uint24  constant FEE          = 3000;      // 0.3%
    int24   constant TICK_SPACING = 60;        // standard for 0.3% fee

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console.log("=== Trigger Swap Script ===");
        console.log("Deployer:", deployer);
        console.log("Pool: TOKEN0(USDC) / TOKEN1(PTT)");

        IPoolSwapTest.PoolKey memory poolKey = IPoolSwapTest.PoolKey({
            currency0:  TOKEN0,
            currency1:  TOKEN1,
            fee:        FEE,
            tickSpacing: TICK_SPACING,
            hooks:      VESTING_HOOK
        });

        // Swap 10 USDC (token0) for PTT (token1) — zeroForOne = true
        int256 swapAmount = 10e18; // 10 tokens (18 decimals)

        IPoolSwapTest.SwapParams memory params = IPoolSwapTest.SwapParams({
            zeroForOne:        true,
            amountSpecified:   -swapAmount, // exact input (negative = exact in)
            sqrtPriceLimitX96: 4295128739 + 1 // min price limit for zeroForOne
        });

        IPoolSwapTest.TestSettings memory settings = IPoolSwapTest.TestSettings({
            takeClaims:      false,
            settleUsingBurn: false
        });

        vm.startBroadcast(pk);

        // Approve PoolSwapTest to spend tokens
        IERC20(TOKEN0).approve(POOL_SWAP_TEST, type(uint256).max);
        IERC20(TOKEN1).approve(POOL_SWAP_TEST, type(uint256).max);
        console.log("Approved tokens for PoolSwapTest");

        // Execute swap — this triggers afterSwap → PoolMetricsUpdated event
        console.log("Executing swap: 10 USDC -> PTT");
        IPoolSwapTest(POOL_SWAP_TEST).swap(
            poolKey,
            params,
            settings,
            bytes("")
        );
        console.log("Swap executed! PoolMetricsUpdated event emitted.");
        console.log("RSC should pick this up on Lasna within ~30 seconds.");

        vm.stopBroadcast();
    }
}
