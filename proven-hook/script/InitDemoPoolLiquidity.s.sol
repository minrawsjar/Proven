// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

interface IPoolManagerLike {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
}

interface IPoolModifyLiquidityTestLike {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }

    function modifyLiquidity(
        PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes memory hookData
    ) external payable returns (int256 delta);
}

contract InitDemoPoolLiquidity is Script {
    address constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    address constant POOL_MODIFY_LIQUIDITY_TEST = 0x5fa728C0A5cfd51BEe4B060773f50554c0C8A7AB;
    address constant VESTING_HOOK = 0xC7bFe6835bC6a4d9A32f0F34A75C21A0982D8640;

    // USDC / demo token
    address constant TOKEN0 = 0x11aFfEac94B440C3c332813450db66fb3285BFB2; // lower address
    address constant TOKEN1 = 0x9af9C6fe2a845354EcC3bDCe1af9c427Fb42Ed70;

    uint24 constant FEE = 3000;
    int24 constant TICK_SPACING = 60;

    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 2^96
    int24 constant TICK_LOWER = -887220;
    int24 constant TICK_UPPER = 887220;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(pk);

        uint256 token0Amt = 1000e18;
        uint256 token1Amt = 1000e18;
        int256 liquidityDelta = int256(token0Amt);

        IPoolManagerLike.PoolKey memory pmKey = IPoolManagerLike.PoolKey({
            currency0: TOKEN0,
            currency1: TOKEN1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: VESTING_HOOK
        });

        IPoolModifyLiquidityTestLike.PoolKey memory mlKey = IPoolModifyLiquidityTestLike.PoolKey({
            currency0: TOKEN0,
            currency1: TOKEN1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: VESTING_HOOK
        });

        console.log("=== Init Demo Pool + Add Liquidity ===");
        console.log("owner", owner);
        console.log("token0", TOKEN0);
        console.log("token1", TOKEN1);

        vm.startBroadcast(pk);

        IERC20(TOKEN0).approve(POOL_MODIFY_LIQUIDITY_TEST, token0Amt);
        IERC20(TOKEN1).approve(POOL_MODIFY_LIQUIDITY_TEST, token1Amt);

        try IPoolManagerLike(POOL_MANAGER).initialize(pmKey, SQRT_PRICE_1_1) returns (int24 tick) {
            console.log("initialized tick", int256(tick));
        } catch {
            console.log("initialize skipped (already initialized or failed)");
        }

        IPoolModifyLiquidityTestLike.ModifyLiquidityParams memory params = IPoolModifyLiquidityTestLike
            .ModifyLiquidityParams({
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                liquidityDelta: liquidityDelta,
                salt: bytes32(0)
            });

        IPoolModifyLiquidityTestLike(POOL_MODIFY_LIQUIDITY_TEST).modifyLiquidity(mlKey, params, bytes(""));

        vm.stopBroadcast();

        console.log("done");
    }
}
