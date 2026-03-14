// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IPoolModifyLiquidityTest {
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int128 liquidityDelta;
        bytes32 salt;
    }

    function modifyLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external;
}

/// @notice Demo script to add liquidity from any wallet (run with PRIVATE_KEY)
contract DemoAddLiquidity is Script {
    // Unichain Sepolia constants used in this repo
    address constant USDC = 0x11aFfEac94B440C3c332813450db66fb3285BFB2;
    address constant PRVN = 0x3c2d1A5c84B7F513ed07Fe2e71dF9538aC217F7c;
    address constant HOOK = 0xC7bFe6835bC6a4d9A32f0F34A75C21A0982D8640;
    address constant ROUTER = 0x5fa728c0a5cfd51bee4b060773f50554c0c8a7ab; // PoolModifyLiquidityTest

    uint24 constant FEE = 3000;
    int24 constant TICK_SPACING = 60;

    function _floorTick(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 compressed = tick / spacing;
        if (tick < 0 && (tick % spacing) != 0) compressed -= 1;
        return compressed * spacing;
    }

    function run() external {
        uint256 liqDelta = vm.envUint("LIQ_DELTA"); // e.g. 1e18
        uint256 approveAmt = vm.envUint("APPROVE_AMT"); // e.g. 1e24

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(PRVN),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });

        int24 tickLower = _floorTick(TickMath.MIN_TICK, TICK_SPACING);
        int24 tickUpper = _floorTick(TickMath.MAX_TICK, TICK_SPACING);

        vm.startBroadcast();

        IERC20(USDC).approve(ROUTER, approveAmt);
        IERC20(PRVN).approve(ROUTER, approveAmt);

        IPoolModifyLiquidityTest(ROUTER).modifyLiquidity(
            key,
            IPoolModifyLiquidityTest.ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int128(int256(liqDelta)),
                salt: bytes32(0)
            }),
            ""
        );

        vm.stopBroadcast();
        console.log("Liquidity added");
    }
}
