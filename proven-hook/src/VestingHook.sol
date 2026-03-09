// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./utils/BaseHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {VestingPosition, Milestone} from "./VestingTypes.sol";
import {IVaultManager} from "./IVaultManager.sol";

/// @title VestingHook
/// @notice Uniswap v4 hook: register vesting positions (before addLiquidity), then lock LP in vault (afterAddLiquidity).
/// Extends BaseHook and uses getHookPermissions() for setup (see docs/HOOKS_DESIGN.md).
///
/// Design (see "Building your first hook" / Mechanism Design):
/// - We use afterAddLiquidity (not beforeAddLiquidity) so we get BalanceDelta delta and ModifyLiquidityParams.
/// - We return (selector, ZERO_DELTA) so we do not take or give tokens; we only record and forward to VaultManager.
contract VestingHook is BaseHook {
    error UnlockPctSumNot100();
    error AlreadyRegistered();
    error LockExtensionActive(uint256 until);
    error ExceedsUnlockedAmount(uint256 requested, uint256 maxWithdrawable);
    error InvalidUnlockPct();
    error OnlyRSC();
    error InvalidMilestoneId();

    event PositionRegistered(address indexed team, address indexed tokenAddr, PoolId indexed poolId);
    event PositionLocked(address indexed team, PoolId indexed poolId, uint256 amount);
    event PoolMetricsUpdated(PoolId indexed poolId, uint256 tvl, uint256 cumulativeVol, uint256 uniqueUsers);
    event CrashDetected(PoolId indexed poolId, uint256 dropPct);
    event MilestoneUnlocked(address indexed team, uint8 indexed milestoneId, uint8 newUnlockedPct);
    event LockExtended(address indexed team, uint256 lockUntil);
    event WithdrawalsPaused(address indexed team, uint256 pausedUntil);

    IVaultManager public immutable VAULT_MANAGER;

    /// @notice Immutable RSC authorizer address — set at deploy, never changeable.
    ///         Only this address (ProvenCallback / RSC proxy) can call authorizeUnlock/extendLock/pauseWithdrawals.
    address public immutable RSC_AUTHORIZER;

    /// @dev positions[team] = vesting position (team == 0 means not registered)
    mapping(address => VestingPosition) public positions;
    /// @dev poolToTeam[poolId] = team that registered for this pool
    mapping(PoolId => address) public poolToTeam;

    /// @dev Unlocked percentage (0–100) per team for withdrawal gate.
    mapping(address => uint8) public unlockedPctByTeam;

    // ---------- Hook Point 3: afterSwap metrics & crash detection ----------
    /// @dev Cumulative swap volume per pool (sum of |amount0| + |amount1|).
    mapping(PoolId => uint256) public cumulativeVolume;
    /// @dev Unique swapper count per pool.
    mapping(PoolId => uint256) public uniqueSwapperCount;
    /// @dev Whether sender has swapped in this pool (for first-swap bump).
    mapping(PoolId => mapping(address => bool)) public hasSwapped;
    /// @dev Last price (sqrtPriceX96^2 >> 192) for crash detection.
    mapping(PoolId => uint256) public lastPrice;

    /// @notice Only the immutable RSC authorizer can call this function.
    modifier onlyRSC() {
        if (msg.sender != RSC_AUTHORIZER) revert OnlyRSC();
        _;
    }

    constructor(
        IPoolManager _manager,
        IVaultManager _vaultManager,
        address _rscAuthorizer
    ) BaseHook(_manager) {
        VAULT_MANAGER = _vaultManager;
        RSC_AUTHORIZER = _rscAuthorizer;
    }

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Register a vesting position. Must be called BEFORE addLiquidity.
    /// @param milestones Three milestones (conditionType, threshold, unlockPct 1–100)
    /// @param tokenAddr   Project token address (for RSC / Lasna)
    /// @param poolId      Pool ID the team will add liquidity to (key.toId())
    function registerVestingPosition(
        Milestone[3] calldata milestones,
        address tokenAddr,
        PoolId poolId
    ) external {
        if (positions[msg.sender].team != address(0)) revert AlreadyRegistered();

        uint256 sum;
        for (uint256 i; i < 3; i++) {
            if (milestones[i].unlockPct == 0 || milestones[i].unlockPct > 100) revert UnlockPctSumNot100();
            sum += milestones[i].unlockPct;
        }
        if (sum != 100) revert UnlockPctSumNot100();

        VestingPosition storage pos = positions[msg.sender];
        pos.team = msg.sender;
        pos.tokenAddr = tokenAddr;
        pos.lpAmount = 0;
        pos.registeredAt = block.timestamp;
        pos.lockExtendedUntil = 0;
        for (uint256 j; j < 3; j++) {
            pos.milestones[j].conditionType = milestones[j].conditionType;
            pos.milestones[j].threshold = milestones[j].threshold;
            pos.milestones[j].unlockPct = milestones[j].unlockPct;
            pos.milestones[j].complete = false;
        }
        poolToTeam[poolId] = msg.sender;

        emit PositionRegistered(msg.sender, tokenAddr, poolId);
    }

    /// @notice Hook: runs immediately after addLiquidity (Hook Point 1). Locks LP in VaultManager when sender is registered.
    function _afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, BalanceDelta) {
        if (positions[sender].team == address(0)) {
            return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
        }

        PoolId poolId = key.toId();
        uint256 lpAmount = _calcLpFromDelta(params, delta);
        if (lpAmount == 0) {
            return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
        }

        VAULT_MANAGER.depositPosition(sender, poolId, lpAmount);
        positions[sender].lpAmount += lpAmount;
        poolToTeam[poolId] = sender;

        emit PositionLocked(sender, poolId, lpAmount);
        return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    /// @dev Derive LP amount from add-liquidity params/delta. Uses liquidity delta when adding.
    function _calcLpFromDelta(ModifyLiquidityParams calldata params, BalanceDelta) internal pure returns (uint256) {
        if (params.liquidityDelta <= 0) return 0;
        return uint256(params.liquidityDelta);
    }

    /// @notice Returns locked LP amount for a team (for a pool). Investors can verify via this.
    function getLockedAmount(address team, PoolId poolId) external view returns (uint256) {
        if (poolToTeam[poolId] != team) return 0;
        return positions[team].lpAmount;
    }

    // ---------- Hook Point 2: Withdrawal gate (beforeRemoveLiquidity) ----------

    /// @notice Hook: runs before removeLiquidity. Gates vesting-team withdrawals by lock extension and unlocked %.
    function _beforeRemoveLiquidity(
        address sender,
        PoolKey calldata,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) internal view override returns (bytes4) {
        // Check 1 — Not a vesting position: allow freely (normal LP).
        if (positions[sender].team == address(0)) {
            return this.beforeRemoveLiquidity.selector;
        }

        // Check 2 — Rage lock / alert active: no withdrawals until per-team lockExtendedUntil.
        uint256 teamLockUntil = positions[sender].lockExtendedUntil;
        if (teamLockUntil != 0 && block.timestamp < teamLockUntil) {
            revert LockExtensionActive(teamLockUntil);
        }

        // Check 3 — Within authorized unlock %?
        uint256 lpAmount = positions[sender].lpAmount;
        uint256 maxWithdrawable = (lpAmount * unlockedPctByTeam[sender]) / 100;
        uint256 requested = params.liquidityDelta < 0 ? uint256(-params.liquidityDelta) : uint256(params.liquidityDelta);
        if (requested > maxWithdrawable) {
            revert ExceedsUnlockedAmount(requested, maxWithdrawable);
        }

        return this.beforeRemoveLiquidity.selector;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                RSC CALLBACK TARGETS (onlyRSC — immutable authorizer)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Called by RSC when a milestone is reached.
    ///         Sets milestone.complete = true, increases unlockedPctByTeam.
    /// @param team        The vesting team address
    /// @param milestoneId Which milestone (0, 1, or 2)
    function authorizeUnlock(address team, uint8 milestoneId) external onlyRSC {
        if (milestoneId >= 3) revert InvalidMilestoneId();
        VestingPosition storage pos = positions[team];
        if (pos.milestones[milestoneId].complete) return; // idempotent

        pos.milestones[milestoneId].complete = true;
        unlockedPctByTeam[team] += pos.milestones[milestoneId].unlockPct;
        if (unlockedPctByTeam[team] > 100) unlockedPctByTeam[team] = 100;

        emit MilestoneUnlocked(team, milestoneId, unlockedPctByTeam[team]);
    }

    /// @notice RAGE LOCK — Called by RSC when risk score ≥ 75.
    ///         Extends the team's lock by penaltyDays (typically 30 days).
    /// @param team        The vesting team address
    /// @param penaltyDays Number of days to extend the lock
    function extendLock(address team, uint32 penaltyDays) external onlyRSC {
        uint256 lockUntil = block.timestamp + (uint256(penaltyDays) * 1 days);
        positions[team].lockExtendedUntil = lockUntil;
        emit LockExtended(team, lockUntil);
    }

    /// @notice ALERT — Called by RSC when risk score 50–74.
    ///         Pauses withdrawals for the specified number of hours (typically 48h).
    /// @param team       The vesting team address
    /// @param pauseHours Number of hours to pause withdrawals
    function pauseWithdrawals(address team, uint32 pauseHours) external onlyRSC {
        uint256 pausedUntil = block.timestamp + (uint256(pauseHours) * 1 hours);
        positions[team].lockExtendedUntil = pausedUntil;
        emit WithdrawalsPaused(team, pausedUntil);
    }

    // ---------- Hook Point 3: afterSwap — metrics tracking & price crash detection ----------

    /// @notice Hook: runs after every swap. Updates cumulative volume, unique swappers, TVL; detects ≥30% price crash.
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Metrics: cumulative volume (sum of absolute deltas)
        uint256 amt0 = _abs128(BalanceDeltaLibrary.amount0(delta));
        uint256 amt1 = _abs128(BalanceDeltaLibrary.amount1(delta));
        uint256 swapAmt = amt0 + amt1;
        cumulativeVolume[poolId] += swapAmt;

        if (!hasSwapped[poolId][sender]) {
            uniqueSwapperCount[poolId]++;
            hasSwapped[poolId][sender] = true;
        }

        (uint160 sqrtPriceX96,,,) = StateLibrary.getSlot0(poolManager, poolId);
        uint128 liquidity = StateLibrary.getLiquidity(poolManager, poolId);
        uint256 tvl = _calcTVL(sqrtPriceX96, liquidity);

        // Price crash detection (Signal 3)
        uint256 currentPrice = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
        if (lastPrice[poolId] > 0) {
            uint256 drop = (lastPrice[poolId] - currentPrice) * 100 / lastPrice[poolId];
            if (drop >= 30) {
                emit CrashDetected(poolId, drop);
            }
        }
        lastPrice[poolId] = currentPrice;

        emit PoolMetricsUpdated(poolId, tvl, cumulativeVolume[poolId], uniqueSwapperCount[poolId]);

        return (this.afterSwap.selector, 0);
    }

    function _abs128(int128 x) internal pure returns (uint256) {
        return x < 0 ? uint256(uint128(-x)) : uint256(uint128(x));
    }

    /// @dev TVL proxy from current sqrtPrice and liquidity (e.g. for RSC milestone / S4).
    function _calcTVL(uint160 sqrtPriceX96, uint128 liquidity) internal pure returns (uint256) {
        return (uint256(liquidity) * uint256(sqrtPriceX96)) >> 96;
    }
}
