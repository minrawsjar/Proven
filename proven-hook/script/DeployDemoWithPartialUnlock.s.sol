// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IVestingHookDemo {
    function registerVestingPosition(
        MilestoneInput[3] calldata milestones,
        address tokenAddr,
        PoolId poolId
    ) external;

    function unlockedPctByTeam(address team) external view returns (uint8);
    function authorizeUnlock(address team, uint8 milestoneId) external;
}

struct MilestoneInput {
    uint8 conditionType;  // 0=TVL, 1=Vol, 2=Users
    uint256 threshold;
    uint8 unlockPct;
    bool complete;
}

interface IPoolManagerInit {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
}

interface IPoolModifyLiquidity {
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

interface IRiskGuardRSC {
    function forceAuthorizeUnlock(address team, uint8 milestoneId) external;
    function registerMilestones(
        bytes32 poolId,
        address team,
        address tokenAddr,
        address deployer,
        uint256[3] calldata conditionTypes,
        uint256[3] calldata thresholds,
        uint8[3] calldata unlockPcts
    ) external;
}

/**
 * @title DeployDemoWithPartialUnlock
 * @notice Creates a demo pool with a vesting position and triggers a partial
 *         milestone unlock (milestone 0 → 34% unlocked).
 *
 * This script demonstrates the end-to-end flow:
 *   1. Deploy two demo ERC20 tokens (or use existing)
 *   2. Register a vesting position on VestingHook (3 milestones: 34/33/33)
 *   3. Initialize pool on PoolManager & add liquidity
 *   4. Call forceAuthorizeUnlock on RSC (Lasna) → dispatches callback
 *      → ProvenCallback → VestingHook.authorizeUnlock()
 *
 * Required env:
 *   PRIVATE_KEY         — deployer wallet
 *   VESTING_HOOK_ADDR   — deployed VestingHook address
 *   RSC_AUTHORIZER      — deployed ProvenCallback address (= RSC_AUTHORIZER on hook)
 *   POOL_MANAGER        — Uniswap v4 PoolManager
 *
 * Usage:
 *   source .env
 *   # Phase 1: Register + add liquidity (Unichain Sepolia)
 *   forge script script/DeployDemoWithPartialUnlock.s.sol:DeployDemoWithPartialUnlock \
 *     --sig "phase1_setupPool()" \
 *     --rpc-url https://sepolia.unichain.org \
 *     --broadcast -vvvv
 *
 *   # Phase 2: Force partial unlock via RSC (Lasna)
 *   forge script script/DeployDemoWithPartialUnlock.s.sol:DeployDemoWithPartialUnlock \
 *     --sig "phase2_forcePartialUnlock()" \
 *     --rpc-url https://lasna-rpc.rnk.dev \
 *     --broadcast -vvvv
 *
 *   # Phase 3: Verify unlock on Unichain
 *   cast call $VESTING_HOOK_ADDR "unlockedPctByTeam(address)(uint8)" $DEPLOYER --rpc-url https://sepolia.unichain.org
 */
contract DeployDemoWithPartialUnlock is Script {
    using PoolIdLibrary for PoolKey;

    // ── Pool parameters ──
    uint24  constant FEE          = 3000;
    int24   constant TICK_SPACING = 60;
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 2^96 (1:1 price)
    int24   constant TICK_LOWER = -887220;
    int24   constant TICK_UPPER =  887220;

    /**
     * @notice Phase 1: Register vesting position + init pool + add liquidity (run on Unichain Sepolia)
     */
    function phase1_setupPool() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address hookAddr = vm.envAddress("VESTING_HOOK_ADDR");
        address poolManager = vm.envAddress("POOL_MANAGER");

        // Use existing demo tokens if set, otherwise prompt
        address token0 = vm.envOr("DEMO_TOKEN0", address(0));
        address token1 = vm.envOr("DEMO_TOKEN1", address(0));

        require(token0 != address(0) && token1 != address(0),
            "Set DEMO_TOKEN0 and DEMO_TOKEN1 in env (sorted: token0 < token1)");
        require(token0 < token1, "DEMO_TOKEN0 must be < DEMO_TOKEN1 (address sort)");

        console.log("============================================");
        console.log("  Demo Pool with Partial Unlock -- Phase 1");
        console.log("============================================");
        console.log("Deployer:     ", deployer);
        console.log("VestingHook:  ", hookAddr);
        console.log("PoolManager:  ", poolManager);
        console.log("Token0:       ", token0);
        console.log("Token1:       ", token1);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hookAddr)
        });
        PoolId poolId = key.toId();

        console.log("");
        console.log("PoolId:");
        console.logBytes32(PoolId.unwrap(poolId));

        vm.startBroadcast(pk);

        // Step 1: Register vesting position (3 milestones: 34/33/33)
        MilestoneInput[3] memory milestones;
        milestones[0] = MilestoneInput({conditionType: 0, threshold: 500e18,  unlockPct: 34, complete: false}); // TVL > 500
        milestones[1] = MilestoneInput({conditionType: 1, threshold: 2000e18, unlockPct: 33, complete: false}); // Vol > 2000
        milestones[2] = MilestoneInput({conditionType: 2, threshold: 5,       unlockPct: 33, complete: false}); // Users > 5

        IVestingHookDemo(hookAddr).registerVestingPosition(milestones, token1, poolId);
        console.log("[1/3] VestingPosition registered (34/33/33 split)");

        // Step 2: Initialize pool
        IPoolManagerInit.PoolKey memory pmKey = IPoolManagerInit.PoolKey({
            currency0: token0,
            currency1: token1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: hookAddr
        });

        try IPoolManagerInit(poolManager).initialize(pmKey, SQRT_PRICE_1_1) returns (int24 tick) {
            console.log("[2/3] Pool initialized at tick:", int256(tick));
        } catch {
            console.log("[2/3] Pool already initialized (skipped)");
        }

        // Step 3: Add liquidity
        uint256 liquidityAmount = 1000e18;

        IERC20(token0).approve(vm.envAddress("POOL_MODIFY_LIQUIDITY_TEST"), liquidityAmount);
        IERC20(token1).approve(vm.envAddress("POOL_MODIFY_LIQUIDITY_TEST"), liquidityAmount);

        IPoolModifyLiquidity.PoolKey memory mlKey = IPoolModifyLiquidity.PoolKey({
            currency0: token0,
            currency1: token1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: hookAddr
        });

        IPoolModifyLiquidity.ModifyLiquidityParams memory params = IPoolModifyLiquidity.ModifyLiquidityParams({
            tickLower: TICK_LOWER,
            tickUpper: TICK_UPPER,
            liquidityDelta: int256(liquidityAmount),
            salt: bytes32(0)
        });

        IPoolModifyLiquidity(vm.envAddress("POOL_MODIFY_LIQUIDITY_TEST")).modifyLiquidity(mlKey, params, "");
        console.log("[3/3] Liquidity added:", liquidityAmount);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Phase 1 complete ===");
        console.log("Next: Run phase2_forcePartialUnlock on Lasna to trigger milestone 0 unlock");
        console.log("  Team (deployer):", deployer);
    }

    /**
     * @notice Phase 2: Force partial unlock via RSC (run on Lasna testnet)
     *         Calls forceAuthorizeUnlock(team, 0) → emits Callback → ProvenCallback → VestingHook
     */
    function phase2_forcePartialUnlock() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address rscAddr = vm.envAddress("PROVEN_REACTIVE_ADDR");

        console.log("============================================");
        console.log("  Demo Pool with Partial Unlock -- Phase 2");
        console.log("============================================");
        console.log("RSC:    ", rscAddr);
        console.log("Team:   ", deployer);

        vm.startBroadcast(pk);

        // Unlock milestone 0 only → 34% unlocked (partial)
        IRiskGuardRSC(rscAddr).forceAuthorizeUnlock(deployer, 0);
        console.log("[OK] forceAuthorizeUnlock(team, 0) dispatched");
        console.log("     Callback will be delivered to ProvenCallback on Unichain Sepolia");
        console.log("     Expected result: unlockedPctByTeam = 34%");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Phase 2 complete ===");
        console.log("Verify on Unichain:");
        console.log("  cast call $VESTING_HOOK_ADDR 'unlockedPctByTeam(address)(uint8)' ", deployer);
    }

    /**
     * @notice Phase 3 (optional): Register milestones on RSC for full monitoring
     *         Run on Lasna so RSC knows about this pool's milestones
     */
    function phase3_registerOnRSC() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address rscAddr = vm.envAddress("PROVEN_REACTIVE_ADDR");
        address hookAddr = vm.envAddress("VESTING_HOOK_ADDR");
        address token1 = vm.envAddress("DEMO_TOKEN1");

        // Compute poolId the same way as phase1
        address token0 = vm.envAddress("DEMO_TOKEN0");
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hookAddr)
        });
        bytes32 poolId = PoolId.unwrap(key.toId());

        console.log("============================================");
        console.log("  Demo Pool -- Phase 3: Register on RSC");
        console.log("============================================");

        vm.startBroadcast(pk);

        IRiskGuardRSC(rscAddr).registerMilestones(
            poolId,
            deployer,
            token1,
            deployer,
            [uint256(0), uint256(1), uint256(2)],
            [uint256(500e18), uint256(2000e18), uint256(5)],
            [uint8(34), uint8(33), uint8(33)]
        );

        console.log("[OK] Milestones registered on RSC");

        vm.stopBroadcast();
    }

    function run() public {
        phase1_setupPool();
    }
}
