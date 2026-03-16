// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestToken} from "../src/TestToken.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

interface IERC20Minimal {
    function approve(address spender, uint256 amount) external returns (bool);
}

struct MilestoneInput {
    uint8 conditionType;  // 0=TVL, 1=Vol, 2=Users
    uint256 threshold;
    uint8 unlockPct;
    bool complete;
}

interface IVestingHookDemo {
    function registerVestingPosition(
        MilestoneInput[3] calldata milestones,
        address tokenAddr,
        PoolId poolId
    ) external;
}

interface IPoolManagerInit {
    struct PKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }
    function initialize(PKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
}

interface IPoolModifyLiq {
    struct PKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }
    struct MLParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }
    function modifyLiquidity(PKey memory key, MLParams memory params, bytes memory hookData)
        external payable returns (int256 delta);
}

/**
 * @title DeployFiveDemoPools
 * @notice Deploys 5 demo pools on Unichain Sepolia, each with a unique team,
 *         token pair, vesting position, and initial liquidity.
 *
 *   Pool 0 — "Nova Protocol"   → 0% unlocked   (high thresholds, no milestones hit)
 *   Pool 1 — "Stellar DeFi"    → 34% unlocked   (milestone 0 hit on Lasna)
 *   Pool 2 — "Orbit Finance"   → 67% unlocked   (milestones 0+1 hit)
 *   Pool 3 — "Zenith Labs"     → 100% unlocked  (all milestones hit)
 *   Pool 4 — "Shadow Token"    → 34% unlocked + RAGE LOCKED 30 days
 *
 * Phase 2 (Lasna unlock/lock) is done via cast commands in the companion shell script.
 *
 * Usage:
 *   source .env
 *   forge script script/DeployFiveDemoPools.s.sol:DeployFiveDemoPools \
 *     --rpc-url https://sepolia.unichain.org --broadcast -vvvv
 */
contract DeployFiveDemoPools is Script {
    using PoolIdLibrary for PoolKey;

    address constant POOL_MODIFY_LIQ_TEST = 0x5fa728C0A5cfd51BEe4B060773f50554c0C8A7AB;

    uint24  constant FEE            = 3000;
    int24   constant TICK_SPACING   = 60;
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 2^96
    int24   constant TICK_LOWER     = -887220;
    int24   constant TICK_UPPER     =  887220;
    uint256 constant LP_AMOUNT      = 10000e18;

    // ─── Storage used to pass data between helper functions ─────
    uint256   s_deployerPk;
    address   s_hookAddr;
    address   s_poolManager;
    address   s_baseToken;
    uint256[5] s_teamPks;
    address[5] s_teams;
    address[5] s_projTokens;
    address[5] s_c0;
    address[5] s_c1;
    bytes32[5] s_poolIds;

    function run() external {
        s_deployerPk  = vm.envUint("PRIVATE_KEY");
        s_hookAddr    = vm.envAddress("VESTING_HOOK_ADDR");
        s_poolManager = vm.envAddress("POOL_MANAGER");

        console.log("==============================================");
        console.log("  Deploy 5 Demo Pools - Phase 1 (Unichain)");
        console.log("==============================================");
        console.log("Deployer:    ", vm.addr(s_deployerPk));
        console.log("VestingHook: ", s_hookAddr);
        console.log("PoolManager: ", s_poolManager);

        _deriveTeamKeys();
        _deployTokensAndFundTeams();
        _computePoolIds();
        _registerPositions();
        _initPoolsAndAddLiquidity();
        _printSummary();
    }

    // ════════════════════════════════════════════════════════════
    //  Derive 5 deterministic team private keys
    // ════════════════════════════════════════════════════════════
    function _deriveTeamKeys() internal {
        uint256 N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140;
        for (uint256 i = 0; i < 5; i++) {
            s_teamPks[i] = (uint256(keccak256(abi.encodePacked(s_deployerPk, "demo_v3_", i))) % (N - 1)) + 1;
            s_teams[i] = vm.addr(s_teamPks[i]);
        }
        console.log("");
        console.log("--- Team Wallets ---");
        for (uint256 i = 0; i < 5; i++) {
            console.log("  Team", i);
            console.log("    addr:", s_teams[i]);
            console.log("    pk:  ", vm.toString(bytes32(s_teamPks[i])));
        }
    }

    // ════════════════════════════════════════════════════════════
    //  Deploy 6 tokens + fund teams with ETH
    // ════════════════════════════════════════════════════════════
    function _deployTokensAndFundTeams() internal {
        vm.startBroadcast(s_deployerPk);

        s_baseToken = address(new TestToken("Demo USDC", "dUSDC"));
        console.log("");
        console.log("Base token dUSDC:", s_baseToken);

        s_projTokens[0] = address(new TestToken("Nova Protocol",  "NOVA"));
        s_projTokens[1] = address(new TestToken("Stellar DeFi",   "STLR"));
        s_projTokens[2] = address(new TestToken("Orbit Finance",  "ORBIT"));
        s_projTokens[3] = address(new TestToken("Zenith Labs",    "ZEN"));
        s_projTokens[4] = address(new TestToken("Shadow Token",   "SHDW"));

        for (uint256 i = 0; i < 5; i++) {
            console.log("  Token", i, ":", s_projTokens[i]);
        }

        for (uint256 i = 0; i < 5; i++) {
            (bool ok,) = payable(s_teams[i]).call{value: 0.002 ether}("");
            require(ok, "ETH fund failed");
        }
        console.log("Funded 5 teams with 0.002 ETH each");

        vm.stopBroadcast();
    }

    // ════════════════════════════════════════════════════════════
    //  Compute sorted token pairs + pool IDs
    // ════════════════════════════════════════════════════════════
    function _computePoolIds() internal {
        for (uint256 i = 0; i < 5; i++) {
            if (s_baseToken < s_projTokens[i]) {
                s_c0[i] = s_baseToken;
                s_c1[i] = s_projTokens[i];
            } else {
                s_c0[i] = s_projTokens[i];
                s_c1[i] = s_baseToken;
            }
            PoolKey memory key = PoolKey({
                currency0: Currency.wrap(s_c0[i]),
                currency1: Currency.wrap(s_c1[i]),
                fee: FEE,
                tickSpacing: TICK_SPACING,
                hooks: IHooks(s_hookAddr)
            });
            s_poolIds[i] = PoolId.unwrap(key.toId());
        }
        console.log("");
        console.log("--- Pool IDs ---");
        for (uint256 i = 0; i < 5; i++) {
            console.log("  Pool", i, ":");
            console.logBytes32(s_poolIds[i]);
        }
    }

    // ════════════════════════════════════════════════════════════
    //  Register vesting positions from each team wallet
    // ════════════════════════════════════════════════════════════
    function _registerPositions() internal {
        console.log("");
        console.log("--- Registering Vesting Positions ---");
        for (uint256 i = 0; i < 5; i++) {
            MilestoneInput[3] memory ms = _getMilestones(i);
            vm.broadcast(s_teamPks[i]);
            IVestingHookDemo(s_hookAddr).registerVestingPosition(
                ms, s_projTokens[i], PoolId.wrap(s_poolIds[i])
            );
            console.log("  Pool", i, "registered from", s_teams[i]);
        }
    }

    // ════════════════════════════════════════════════════════════
    //  Initialize pools + add liquidity from deployer
    // ════════════════════════════════════════════════════════════
    function _initPoolsAndAddLiquidity() internal {
        console.log("");
        console.log("--- Init Pools + Add Liquidity ---");
        vm.startBroadcast(s_deployerPk);

        for (uint256 i = 0; i < 5; i++) {
            _initOnePool(i);
        }

        vm.stopBroadcast();
    }

    function _initOnePool(uint256 i) internal {
        IPoolManagerInit.PKey memory pmKey = IPoolManagerInit.PKey({
            currency0: s_c0[i], currency1: s_c1[i],
            fee: FEE, tickSpacing: TICK_SPACING, hooks: s_hookAddr
        });
        try IPoolManagerInit(s_poolManager).initialize(pmKey, SQRT_PRICE_1_1) returns (int24) {
            console.log("  Pool", i, "initialized");
        } catch {
            console.log("  Pool", i, "already initialized");
        }

        IERC20Minimal(s_c0[i]).approve(POOL_MODIFY_LIQ_TEST, LP_AMOUNT);
        IERC20Minimal(s_c1[i]).approve(POOL_MODIFY_LIQ_TEST, LP_AMOUNT);

        IPoolModifyLiq.PKey memory mlKey = IPoolModifyLiq.PKey({
            currency0: s_c0[i], currency1: s_c1[i],
            fee: FEE, tickSpacing: TICK_SPACING, hooks: s_hookAddr
        });
        IPoolModifyLiq.MLParams memory params = IPoolModifyLiq.MLParams({
            tickLower: TICK_LOWER, tickUpper: TICK_UPPER,
            liquidityDelta: int256(LP_AMOUNT), salt: bytes32(0)
        });
        IPoolModifyLiq(POOL_MODIFY_LIQ_TEST).modifyLiquidity(mlKey, params, "");
        console.log("  Pool", i, "LP added");
    }

    // ════════════════════════════════════════════════════════════
    //  Summary
    // ════════════════════════════════════════════════════════════
    function _printSummary() internal view {
        console.log("");
        console.log("==============================================");
        console.log("  PHASE 1 COMPLETE - 5 Demo Pools Deployed");
        console.log("==============================================");
        string[5] memory names;
        names[0] = "Nova Protocol (0% unlocked)";
        names[1] = "Stellar DeFi (34% unlocked)";
        names[2] = "Orbit Finance (67% unlocked)";
        names[3] = "Zenith Labs (100% unlocked)";
        names[4] = "Shadow Token (34% + RAGE LOCKED)";
        for (uint256 i = 0; i < 5; i++) {
            console.log("");
            console.log("Pool", i, "-", names[i]);
            console.log("  Team:    ", s_teams[i]);
            console.log("  Token:   ", s_projTokens[i]);
            console.log("  PoolId:");
            console.logBytes32(s_poolIds[i]);
        }
        console.log("");
        console.log("Base token (dUSDC):", s_baseToken);
        console.log("");
        console.log("NEXT: Run phase2 cast commands on Lasna");
    }

    /// @dev Returns the milestone config for each pool index.
    function _getMilestones(uint256 idx) internal pure returns (MilestoneInput[3] memory ms) {
        if (idx == 0) {
            // Nova Protocol: very high thresholds → 0% unlocked
            ms[0] = MilestoneInput(0, 1_000_000e18, 34, false);
            ms[1] = MilestoneInput(1, 5_000_000e18, 33, false);
            ms[2] = MilestoneInput(2, 10_000,       33, false);
        } else if (idx == 1) {
            // Stellar DeFi: → 34% (milestone 0 only)
            ms[0] = MilestoneInput(0, 500e18,  34, false);
            ms[1] = MilestoneInput(1, 2000e18, 33, false);
            ms[2] = MilestoneInput(2, 50,      33, false);
        } else if (idx == 2) {
            // Orbit Finance: → 67% (milestones 0+1)
            ms[0] = MilestoneInput(0, 500e18,  34, false);
            ms[1] = MilestoneInput(1, 2000e18, 33, false);
            ms[2] = MilestoneInput(2, 50,      33, false);
        } else if (idx == 3) {
            // Zenith Labs: → 100% (all milestones)
            ms[0] = MilestoneInput(0, 100e18, 34, false);
            ms[1] = MilestoneInput(1, 100e18, 33, false);
            ms[2] = MilestoneInput(2, 2,      33, false);
        } else {
            // Shadow Token: → 34% + RAGE LOCKED
            ms[0] = MilestoneInput(0, 500e18,  34, false);
            ms[1] = MilestoneInput(1, 2000e18, 33, false);
            ms[2] = MilestoneInput(2, 50,      33, false);
        }
    }
}
