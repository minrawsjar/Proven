// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

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

contract TriggerDemoSwap is Script {
    address constant POOL_SWAP_TEST = 0x9140a78c1A137c7fF1c151EC8231272aF78a99A4;
    address constant VESTING_HOOK   = 0xC7bFe6835bC6a4d9A32f0F34A75C21A0982D8640;

    // Demo pool tokens
    address constant TOKEN0 = 0x11aFfEac94B440C3c332813450db66fb3285BFB2; // USDC (lower address)
    address constant TOKEN1 = 0x9af9C6fe2a845354EcC3bDCe1af9c427Fb42Ed70; // ProvenToken demo

    uint24 constant FEE = 3000;
    int24 constant TICK_SPACING = 60;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address trader = vm.addr(pk);

        IPoolSwapTest.PoolKey memory poolKey = IPoolSwapTest.PoolKey({
            currency0: TOKEN0,
            currency1: TOKEN1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: VESTING_HOOK
        });

        // exact input: 1 token0
        int256 amountIn = 1e18;

        IPoolSwapTest.SwapParams memory params = IPoolSwapTest.SwapParams({
            zeroForOne: true,
            amountSpecified: -amountIn,
            sqrtPriceLimitX96: 4295128739 + 1
        });

        IPoolSwapTest.TestSettings memory settings = IPoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

        vm.startBroadcast(pk);
        IERC20(TOKEN0).approve(POOL_SWAP_TEST, type(uint256).max);
        IERC20(TOKEN1).approve(POOL_SWAP_TEST, type(uint256).max);
        bytes memory hookData = abi.encode(trader);
        IPoolSwapTest(POOL_SWAP_TEST).swap(poolKey, params, settings, hookData);
        vm.stopBroadcast();

        console.log("demo swap sent");
    }
}
