// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AbstractReactive} from "reactive-lib/abstract-base/AbstractReactive.sol";
import {IReactive} from "reactive-lib/interfaces/IReactive.sol";

/**
 * @title RiskGuardRSC
 * @author Proven Protocol
 * @notice Reactive Smart Contract deployed on the Reactive Network Lasna testnet.
 *         RSC deployed once. Never redeployed. Handles unlimited teams autonomously.
 *
 *         Monitors VestingHook events on Unichain Sepolia and:
 *         1. Auto-indexes new teams via PositionRegistered (dynamic subscriptions)
 *         2. Evaluates milestone conditions (TVL / Volume / Users)
 *         3. Runs 5-signal rug detection with scoring & decay
 *         4. Dispatches tiered responses (SAFE / WATCH / ALERT / RAGE)
 *
 * @dev Subscriptions:
 *   PERMANENT (constructor): PositionRegistered → bootstraps all dynamic subscriptions
 *   DYNAMIC (per team): PoolMetricsUpdated, CrashDetected, Transfer (deployer + genesis wallets)
 */
contract RiskGuardRSC is AbstractReactive {
    // ═══════════════════════════════════════════════════════════════════════════
    //                        EVENT TOPIC SIGNATURES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev keccak256("PoolMetricsUpdated(bytes32,uint256,uint256,uint256)")
    uint256 private constant POOL_METRICS_TOPIC =
        uint256(keccak256("PoolMetricsUpdated(bytes32,uint256,uint256,uint256)"));

    /// @dev keccak256("CrashDetected(bytes32,uint256)")
    uint256 private constant CRASH_TOPIC =
        uint256(keccak256("CrashDetected(bytes32,uint256)"));

    /// @dev keccak256("PositionRegistered(address,address,bytes32)")
    uint256 private constant POSITION_REG_TOPIC =
        uint256(keccak256("PositionRegistered(address,address,bytes32)"));

    /// @dev keccak256("PositionLocked(address,bytes32,uint256)")
    uint256 private constant POSITION_LOCKED_TOPIC =
        uint256(keccak256("PositionLocked(address,bytes32,uint256)"));

    /// @dev keccak256("Transfer(address,address,uint256)")
    uint256 private constant TRANSFER_TOPIC =
        uint256(keccak256("Transfer(address,address,uint256)"));

    // ═══════════════════════════════════════════════════════════════════════════
    //                        MILESTONE CONDITION TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 private constant CONDITION_TVL   = 0;
    uint256 private constant CONDITION_VOL   = 1;
    uint256 private constant CONDITION_USERS = 2;

    // ═══════════════════════════════════════════════════════════════════════════
    //                         RUG SIGNAL CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice S1: Deployer outflow > 20%     → +45 pts, decay -5/day
    uint16 private constant S1_POINTS = 45;
    uint16 private constant S1_DECAY  = 5;

    /// @notice Absolute fallback threshold for S1 when lpLocked is unavailable in current execution context
    uint256 private constant S1_FALLBACK_ABS_OUTFLOW = 100 ether;

    /// @notice S2: Genesis wallet outflow > 15% → +40 pts, decay -5/day
    uint16 private constant S2_POINTS = 40;
    uint16 private constant S2_DECAY  = 5;

    /// @notice Absolute fallback threshold for S2 when lpLocked is unavailable in current execution context
    uint256 private constant S2_FALLBACK_ABS_OUTFLOW = 75 ether;

    /// @notice S3: Price crash ≥ 30% / block   → +35 pts, decay -3/day
    uint16 private constant S3_POINTS = 35;
    uint16 private constant S3_DECAY  = 3;

    /// @notice S4: Sell ratio > 80% / 50 blocks → +25 pts, decay -8/day
    uint16 private constant S4_POINTS = 25;
    uint16 private constant S4_DECAY  = 8;

    /// @notice S5: Treasury drain > 25%         → +30 pts, decay -4/day (post-MVP)
    uint16 private constant S5_POINTS = 30;
    uint16 private constant S5_DECAY  = 4;

    /// @notice Combo bonus: 2+ signals active within 24h → +20 pts
    uint16 private constant COMBO_BONUS = 20;
    uint256 private constant COMBO_WINDOW = 24 hours;

    /// @notice Score cap
    uint16 private constant SCORE_CAP = 100;

    // ═══════════════════════════════════════════════════════════════════════════
    //                          RISK TIERS
    // ═══════════════════════════════════════════════════════════════════════════

    uint8 private constant TIER_SAFE  = 0;  // 0-24:  no action
    uint8 private constant TIER_WATCH = 1;  // 25-49: emit RiskElevated (no callback)
    uint8 private constant TIER_ALERT = 2;  // 50-74: callback → pauseWithdrawals(48h)
    uint8 private constant TIER_RAGE  = 3;  // 75+:   callback → extendLock(30 days)

    // ═══════════════════════════════════════════════════════════════════════════
    //                            CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice EIP-155 chain ID where VestingHook is deployed (Ethereum Sepolia: 11155111)
    uint256 public immutable ORIGIN_CHAIN_ID;

    /// @notice EIP-155 chain ID where ProvenCallback receives callbacks (same as origin)
    uint256 public immutable CALLBACK_CHAIN_ID;

    /// @notice Address of VestingHook (TimeLockHook) on the origin chain
    address public immutable HOOK_ADDR;

    /// @notice Address of ProvenCallback on the callback chain
    address public immutable CALLBACK_ADDR;

    /// @notice Gas limit for cross-chain callback transactions
    uint64  public constant  CALLBACK_GAS_LIMIT = 1_000_000;

    /// @notice Deployer — used for admin functions
    address public immutable OWNER;

    // ═══════════════════════════════════════════════════════════════════════════
    //                     PER-TEAM STATE (all keyed by team address)
    // ═══════════════════════════════════════════════════════════════════════════

    struct MilestoneData {
        uint256 conditionType; // 0=TVL, 1=Vol, 2=Users
        uint256 threshold;
        uint8   unlockPct;
        bool    complete;
    }

    struct SignalState {
        uint256 triggeredAt;  // block.timestamp when signal last fired (0 = never)
        uint16  basePoints;   // points added when triggered
        uint16  decayPerDay;  // points decayed per day since trigger
    }

    struct TeamConfig {
        address        team;
        address        tokenAddr;
        bytes32        poolId;
        address        deployer;      // auto-detected from PositionRegistered event sender
        MilestoneData[3] milestones;
        uint8          totalUnlockedPct;
        uint256        lpLocked;
        bool           isIndexed;     // true once _indexNewTeam has run

        // Rug signal state (S1–S5)
        SignalState[5] signals;
        uint8          activeSignalCount24h; // signals triggered in last 24h window
        uint256        lastComboCheck;       // timestamp of last combo evaluation

        // Score & tier
        uint16         riskScore;
        uint8          lastDispatchedTier;   // idempotency guard
    }

    /// @notice team address → config
    mapping(address => TeamConfig) public configs;

    /// @notice poolId → team address
    mapping(bytes32 => address) public poolToTeam;

    /// @notice wallet address → team address (deployer wallets, genesis wallets)
    mapping(address => address) public walletToTeam;

    /// @notice Track total react() calls and callbacks for frontend monitoring
    uint256 public totalReactCalls;
    uint256 public totalCallbacks;

    /// @notice Temporary candidate link: wallet that likely belongs to a team's genesis flow.
    ///         Finalized into walletToTeam when that wallet emits an outbound transfer.
    mapping(address => address) public pendingGenesisTeam;

    /// @notice Timestamp when pendingGenesisTeam was set.
    mapping(address => uint256) public pendingGenesisAt;

    /// @notice Time window to confirm a pending genesis candidate.
    uint256 private constant GENESIS_LINK_WINDOW = 1 days;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event TeamIndexed(address indexed team, bytes32 indexed poolId, address indexed tokenAddr);
    event LPLocked(bytes32 indexed poolId, address indexed team, uint256 amount);
    event UnlockAuthorized(address indexed team, uint8 milestoneId);
    event RiskScoreUpdated(address indexed team, uint16 score, uint8 tier);
    event RiskElevated(address indexed team, uint16 score);   // WATCH tier — no callback
    event SignalTriggered(address indexed team, uint8 signalId, uint16 points);
    event ComboBonus(address indexed team, uint8 activeCount);

    // Debug events (temporary instrumentation)
    event DebugReactMeta(
        uint256 indexed topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3,
        uint256 chainId,
        address originContract,
        uint256 blockNumber,
        uint256 logIndex,
        uint256 dataLength,
        bytes32 dataHash
    );
    event DebugPositionRegDecoded(address indexed team, address indexed tokenAddr, bytes32 indexed poolId);
    event DebugPoolMetricsTeamLookup(bytes32 indexed poolId, address indexed team);
    event DebugCrashTeamLookup(bytes32 indexed poolId, address indexed team);
    event DebugTransferTeamLookup(address indexed from, address indexed team);
    event DebugPositionLockedDecoded(address indexed team, bytes32 indexed poolId, uint256 amount);
    event DebugMilestoneMetrics(address indexed team, uint256 tvl, uint256 cumulativeVol, uint256 uniqueUsers);
    event DebugDynamicSubscribeCallbackEmitted(address indexed team, address indexed tokenAddr, bytes32 indexed poolId);
    event DebugSubscribeToTeamCalled(address indexed rvmId, address indexed team, address indexed tokenAddr, bytes32 poolId);
    event DebugUnlockCallbackQueued(address indexed team, uint8 milestoneId);
    event DebugPauseCallbackQueued(address indexed team, uint32 pauseHours);
    event DebugExtendCallbackQueued(address indexed team, uint32 penaltyDays);
    event DebugBootstrapPositionRegSubscription(bool success);
    event DebugReactProbeCallbackQueued(uint256 reactCalls, uint256 topic0, uint256 chainId);
    event DebugGenesisCandidateLinked(address indexed wallet, address indexed team, uint256 amount);
    event DebugGenesisWalletAutoLinked(address indexed wallet, address indexed team);

    // ═══════════════════════════════════════════════════════════════════════════
    //                              ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error OnlyOwner();

    // ═══════════════════════════════════════════════════════════════════════════
    //                            CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @param _originChainId   Chain ID where VestingHook lives (11155111 for Sepolia)
     * @param _callbackChainId Chain ID where ProvenCallback lives (same as origin)
     * @param _hookAddr        VestingHook contract address on the origin chain
     * @param _callbackAddr    ProvenCallback contract address on the callback chain
     */
    constructor(
        uint256 _originChainId,
        uint256 _callbackChainId,
        address _hookAddr,
        address _callbackAddr
    ) payable {
        OWNER            = msg.sender;
        ORIGIN_CHAIN_ID  = _originChainId;
        CALLBACK_CHAIN_ID = _callbackChainId;
        HOOK_ADDR        = _hookAddr;
        CALLBACK_ADDR    = _callbackAddr;

        // PERMANENT subscription: PositionRegistered — fires for EVERY new team launch
        // Bootstraps all dynamic subscriptions per team
        if (!vm) {
            try service.subscribe(
                _originChainId,
                _hookAddr,
                POSITION_REG_TOPIC,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            ) {
                emit DebugBootstrapPositionRegSubscription(true);
            } catch {
                // Do not block deployment if subscription payment/registration fails in constructor.
                // Use bootstrapPositionRegSubscription() after deployment.
                emit DebugBootstrapPositionRegSubscription(false);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                          REACT ENTRY POINT
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IReactive
    function react(LogRecord calldata log) external vmOnly {
        totalReactCalls++;

        // Debug callback: surface VM-side values on destination chain for verification.
        bytes memory debugPayload = abi.encodeWithSignature(
            "debugReactProbe(address,address,uint256,uint256,uint256)",
            address(0),
            address(this),
            totalReactCalls,
            log.topic_0,
            log.chain_id
        );
        emit Callback(CALLBACK_CHAIN_ID, CALLBACK_ADDR, CALLBACK_GAS_LIMIT, debugPayload);
        emit DebugReactProbeCallbackQueued(totalReactCalls, log.topic_0, log.chain_id);

        emit DebugReactMeta(
            log.topic_0,
            log.topic_1,
            log.topic_2,
            log.topic_3,
            log.chain_id,
            log._contract,
            log.block_number,
            log.log_index,
            log.data.length,
            keccak256(log.data)
        );

        uint256 topic = log.topic_0;

        if (topic == POSITION_REG_TOPIC) {
            _indexNewTeam(log);
        } else if (topic == POOL_METRICS_TOPIC) {
            bytes32 poolId = bytes32(log.topic_1);
            address team = poolToTeam[poolId];
            emit DebugPoolMetricsTeamLookup(poolId, team);
            if (team != address(0)) {
                _evalMilestone(team, log);
                _evalSellRatio(team, log);  // S4
            }
        } else if (topic == CRASH_TOPIC) {
            bytes32 poolId = bytes32(log.topic_1);
            address team = poolToTeam[poolId];
            emit DebugCrashTeamLookup(poolId, team);
            if (team != address(0)) {
                _evalPriceCrash(team, log); // S3
            }
        } else if (topic == TRANSFER_TOPIC) {
            address from = address(uint160(log.topic_1));
            address to = address(uint160(log.topic_2));
            address team = walletToTeam[from];

            // If sender has no direct mapping, try to resolve via recent candidate link.
            if (team == address(0)) {
                address candidateTeam = pendingGenesisTeam[from];
                uint256 linkedAt = pendingGenesisAt[from];
                if (
                    candidateTeam != address(0) &&
                    linkedAt != 0 &&
                    block.timestamp >= linkedAt &&
                    block.timestamp - linkedAt <= GENESIS_LINK_WINDOW
                ) {
                    team = candidateTeam;
                    walletToTeam[from] = candidateTeam;
                    TeamConfig storage candidateCfg = configs[candidateTeam];
                    if (candidateCfg.team == address(0)) candidateCfg.team = candidateTeam;
                    if (candidateCfg.deployer == address(0)) candidateCfg.deployer = candidateTeam;
                    emit DebugGenesisWalletAutoLinked(from, candidateTeam);
                }
            }

            // Fallback: if team mapping is missing in current execution context,
            // treat sender as team to keep S1/S2 monitoring functional.
            if (team == address(0)) {
                team = from;
                TeamConfig storage cfg = configs[team];
                if (cfg.team == address(0)) cfg.team = team;
                if (cfg.deployer == address(0)) cfg.deployer = team;
            }

            emit DebugTransferTeamLookup(from, team);
            if (team != address(0)) {
                // Learn potential genesis wallets directly in ReactVM context:
                // when deployer sends tokens to a new wallet, mark recipient as candidate.
                if (from == configs[team].deployer && to != address(0) && to != team && walletToTeam[to] == address(0)) {
                    uint256 amount = abi.decode(log.data, (uint256));
                    pendingGenesisTeam[to] = team;
                    pendingGenesisAt[to] = block.timestamp;
                    emit DebugGenesisCandidateLinked(to, team, amount);
                }

                // Determine if deployer (S1) or genesis wallet (S2)
                if (from == configs[team].deployer) {
                    _evalDeployerOutflow(team, log); // S1
                } else {
                    _evalGenesisOutflow(team, log);  // S2
                }
            }
        } else if (topic == POSITION_LOCKED_TOPIC) {
            address team = address(uint160(log.topic_1));
            bytes32 poolId = bytes32(log.topic_2);
            uint256 amount = abi.decode(log.data, (uint256));
            emit DebugPositionLockedDecoded(team, poolId, amount);
            configs[team].lpLocked += amount;
            emit LPLocked(poolId, team, amount);
        }

        // Always update score & dispatch for any team affected
        // (handled inside each eval function)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //               _indexNewTeam — DYNAMIC SUBSCRIPTION BOOTSTRAP
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @dev Handles PositionRegistered(address indexed team, address indexed tokenAddr, PoolId indexed poolId)
     *      Auto-subscribes to all events needed for this team's pool and token.
     */
    function _indexNewTeam(LogRecord calldata log) internal {
        address team     = address(uint160(log.topic_1));
        address tokenAddr = address(uint160(log.topic_2));
        bytes32 poolId   = bytes32(log.topic_3);

        emit DebugPositionRegDecoded(team, tokenAddr, poolId);

        TeamConfig storage cfg = configs[team];
        cfg.team      = team;
        cfg.tokenAddr = tokenAddr;
        cfg.poolId    = poolId;
        cfg.deployer  = team; // deployer = team address (auto-detected from event sender)
        cfg.isIndexed = true;

        poolToTeam[poolId]   = team;
        walletToTeam[team]   = team; // deployer wallet → team

        // ReactVM cannot call service.subscribe() directly.
        // Emit a Callback to the RNK instance of this contract, which will
        // call subscribeToTeam() (rnOnly) to register the dynamic subscriptions.
        // address(0) = RVM ID placeholder — Reactive Network overwrites it.
        bytes memory subPayload = abi.encodeWithSignature(
            "subscribeToTeam(address,address,address,bytes32)",
            address(0),
            team,
            tokenAddr,
            poolId
        );
        emit Callback(block.chainid, address(this), CALLBACK_GAS_LIMIT, subPayload);
        emit DebugDynamicSubscribeCallbackEmitted(team, tokenAddr, poolId);

        emit TeamIndexed(team, poolId, tokenAddr);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                       MILESTONE EVALUATOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @dev Decodes (poolId, tvl, vol, users) from PoolMetricsUpdated log.
     *      Loops milestones[0..2] — if metric ≥ threshold and !complete:
     *        → mark complete
     *        → _callback authorizeUnlock(team, milestoneId)
     */
    function _evalMilestone(address team, LogRecord calldata log) internal {
        TeamConfig storage cfg = configs[team];
        if (!cfg.isIndexed) return;

        (uint256 tvl, uint256 cumulativeVol, uint256 uniqueUsers) =
            abi.decode(log.data, (uint256, uint256, uint256));

        emit DebugMilestoneMetrics(team, tvl, cumulativeVol, uniqueUsers);

        for (uint256 i = 0; i < 3; i++) {
            MilestoneData storage m = cfg.milestones[i];
            if (m.complete) continue;

            bool met = false;
            if (m.conditionType == CONDITION_TVL) {
                met = tvl >= m.threshold;
            } else if (m.conditionType == CONDITION_VOL) {
                met = cumulativeVol >= m.threshold;
            } else if (m.conditionType == CONDITION_USERS) {
                met = uniqueUsers >= m.threshold;
            }

            if (met) {
                m.complete = true;
                cfg.totalUnlockedPct += m.unlockPct;

                // Cross-chain callback: address(0) = RVM ID slot (overwritten by Reactive Network)
                bytes memory payload = abi.encodeWithSignature(
                    "authorizeUnlock(address,address,uint8)",
                    address(0),
                    team,
                    uint8(i)
                );
                emit Callback(CALLBACK_CHAIN_ID, CALLBACK_ADDR, CALLBACK_GAS_LIMIT, payload);
                totalCallbacks++;
                emit DebugUnlockCallbackQueued(team, uint8(i));

                emit UnlockAuthorized(team, uint8(i));
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                     RUG SIGNAL DETECTOR — 5 SIGNALS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice S1: Deployer outflow > 20% → +45 pts
     * @dev Triggered from Transfer event where from = deployer
     */
    function _evalDeployerOutflow(address team, LogRecord calldata log) internal {
        uint256 amount = abi.decode(log.data, (uint256));
        TeamConfig storage cfg = configs[team];

        // Primary threshold: transfer amount > 20% of team's locked LP value.
        // Fallback: if lpLocked is unavailable in this execution context, use an absolute threshold.
        if ((cfg.lpLocked > 0 && amount * 100 / cfg.lpLocked > 20) ||
            (cfg.lpLocked == 0 && amount >= S1_FALLBACK_ABS_OUTFLOW)) {
            _triggerSignal(team, 0, S1_POINTS, S1_DECAY);
        }

        _updateScore(team);
        _dispatch(team);
    }

    /**
     * @notice S2: Genesis wallet outflow > 15% → +40 pts
     * @dev Triggered from Transfer event where from = genesis wallet
     */
    function _evalGenesisOutflow(address team, LogRecord calldata log) internal {
        uint256 amount = abi.decode(log.data, (uint256));
        TeamConfig storage cfg = configs[team];

        // Primary threshold: transfer amount > 15% of team's locked LP value.
        // Fallback: if lpLocked is unavailable in this execution context, use an absolute threshold.
        if ((cfg.lpLocked > 0 && amount * 100 / cfg.lpLocked > 15) ||
            (cfg.lpLocked == 0 && amount >= S2_FALLBACK_ABS_OUTFLOW)) {
            _triggerSignal(team, 1, S2_POINTS, S2_DECAY);
        }

        _updateScore(team);
        _dispatch(team);
    }

    /**
     * @notice S3: Price crash ≥ 30% / block → +35 pts
     * @dev Triggered from CrashDetected event
     */
    function _evalPriceCrash(address team, LogRecord calldata log) internal {
        uint256 dropPct = abi.decode(log.data, (uint256));

        if (dropPct >= 30) {
            _triggerSignal(team, 2, S3_POINTS, S3_DECAY);
        }

        _updateScore(team);
        _dispatch(team);
    }

    /**
     * @notice S4: Sell ratio > 80% in recent blocks → +25 pts
     * @dev Approximated from PoolMetricsUpdated volume data
     */
    function _evalSellRatio(address team, LogRecord calldata log) internal {
        // Simplified: if volume spikes dramatically relative to TVL, flag sell pressure
        (uint256 tvl, uint256 cumulativeVol, ) =
            abi.decode(log.data, (uint256, uint256, uint256));

        // If cumulative volume > 80% of TVL in recent activity, that's suspicious
        if (tvl > 0 && cumulativeVol * 100 / tvl > 80) {
            _triggerSignal(team, 3, S4_POINTS, S4_DECAY);
        }

        _updateScore(team);
        _dispatch(team);
    }

    /**
     * @notice Trigger a rug signal for a team
     * @param team     Team address
     * @param signalId Signal index (0=S1, 1=S2, 2=S3, 3=S4, 4=S5)
     * @param points   Base points for this signal
     * @param decay    Decay rate per day
     */
    function _triggerSignal(address team, uint8 signalId, uint16 points, uint16 decay) internal {
        TeamConfig storage cfg = configs[team];
        SignalState storage sig = cfg.signals[signalId];

        sig.triggeredAt = block.timestamp;
        sig.basePoints  = points;
        sig.decayPerDay = decay;

        emit SignalTriggered(team, signalId, points);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                      SCORE CALCULATION + DISPATCH
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Recalculate the risk score for a team, applying decay to all signals.
     */
    function _updateScore(address team) internal {
        TeamConfig storage cfg = configs[team];
        uint256 totalPoints = 0;
        uint8 activeCount = 0;

        for (uint256 i = 0; i < 5; i++) {
            SignalState storage sig = cfg.signals[i];
            if (sig.triggeredAt == 0) continue;

            uint256 elapsed = block.timestamp - sig.triggeredAt;
            uint256 daysPassed = elapsed / 1 days;
            uint256 decayed = uint256(sig.decayPerDay) * daysPassed;

            if (decayed >= sig.basePoints) {
                // Signal fully decayed
                sig.triggeredAt = 0;
                continue;
            }

            uint256 currentPoints = uint256(sig.basePoints) - decayed;
            totalPoints += currentPoints;

            // Count signals active within the combo window
            if (elapsed <= COMBO_WINDOW) {
                activeCount++;
            }
        }

        // Combo bonus: 2+ signals active in 24h
        if (activeCount >= 2) {
            totalPoints += COMBO_BONUS;
            emit ComboBonus(team, activeCount);
        }

        // Cap at SCORE_CAP
        if (totalPoints > SCORE_CAP) {
            totalPoints = SCORE_CAP;
        }

        cfg.riskScore = uint16(totalPoints);
        cfg.activeSignalCount24h = activeCount;
    }

    /**
     * @notice Dispatch appropriate response based on risk tier.
     *         Idempotency: lastDispatchedTier prevents re-firing same tier.
     */
    function _dispatch(address team) internal {
        TeamConfig storage cfg = configs[team];
        uint8 tier = _getTier(cfg.riskScore);

        emit RiskScoreUpdated(team, cfg.riskScore, tier);

        // Idempotency: don't re-fire the same tier
        if (tier <= cfg.lastDispatchedTier && tier != TIER_SAFE) return;
        cfg.lastDispatchedTier = tier;

        if (tier == TIER_SAFE) {
            // 0-24: no action
            return;
        } else if (tier == TIER_WATCH) {
            // 25-49: emit RiskElevated (no callback, frontend-only)
            emit RiskElevated(team, cfg.riskScore);
        } else if (tier == TIER_ALERT) {
            // 50-74: callback → pauseWithdrawals (address(0) = RVM ID slot)
            bytes memory payload = abi.encodeWithSignature(
                "pauseWithdrawals(address,address,uint32)",
                address(0),
                team,
                uint32(48)
            );
            emit Callback(CALLBACK_CHAIN_ID, CALLBACK_ADDR, CALLBACK_GAS_LIMIT, payload);
            totalCallbacks++;
            emit DebugPauseCallbackQueued(team, uint32(48));
        } else if (tier == TIER_RAGE) {
            // 75+: callback → extendLock (address(0) = RVM ID slot)
            bytes memory payload = abi.encodeWithSignature(
                "extendLock(address,address,uint32)",
                address(0),
                team,
                uint32(30)
            );
            emit Callback(CALLBACK_CHAIN_ID, CALLBACK_ADDR, CALLBACK_GAS_LIMIT, payload);
            totalCallbacks++;
            emit DebugExtendCallbackQueued(team, uint32(30));
        }
    }

    function _getTier(uint16 score) internal pure returns (uint8) {
        if (score >= 75) return TIER_RAGE;
        if (score >= 50) return TIER_ALERT;
        if (score >= 25) return TIER_WATCH;
        return TIER_SAFE;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                 ADMIN — MILESTONE CONFIG (manual bootstrap)
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert OnlyOwner();
        _;
    }

    /**
     * @notice Manually bootstrap the permanent PositionRegistered subscription.
     * @dev Use this after deployment if constructor-time subscribe failed.
     */
    function bootstrapPositionRegSubscription() external rnOnly onlyOwner {
        service.subscribe(
            ORIGIN_CHAIN_ID,
            HOOK_ADDR,
            POSITION_REG_TOPIC,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE
        );
        emit DebugBootstrapPositionRegSubscription(true);
    }

    /**
     * @notice Mirror the team's vesting milestones into the RSC.
     *         Call after team registers on VestingHook. Because the RSC cannot
     *         read origin-chain storage, milestones are replicated here.
     */
    function registerMilestones(
        bytes32    poolId,
        address    team,
        uint256[3] calldata conditionTypes,
        uint256[3] calldata thresholds,
        uint8[3]   calldata unlockPcts
    ) external onlyOwner {
        TeamConfig storage cfg = configs[team];
        cfg.team       = team;
        cfg.poolId     = poolId;
        cfg.isIndexed  = true;
        cfg.totalUnlockedPct = 0;

        poolToTeam[poolId] = team;

        for (uint256 i = 0; i < 3; i++) {
            cfg.milestones[i] = MilestoneData({
                conditionType: conditionTypes[i],
                threshold:     thresholds[i],
                unlockPct:     unlockPcts[i],
                complete:      false
            });
        }
    }

    /**
     * @notice Register a genesis wallet address for S2 signal detection.
     * @param team   Team address
     * @param wallet Genesis wallet address
     */
    function addGenesisWallet(address team, address wallet) external onlyOwner {
        walletToTeam[wallet] = team;

        // Subscribe to Transfer events from this genesis wallet
        if (!vm) {
            service.subscribe(
                ORIGIN_CHAIN_ID,
                configs[team].tokenAddr,
                TRANSFER_TOPIC,
                uint256(uint160(wallet)),
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function isMilestoneComplete(address team, uint256 index) external view returns (bool) {
        return configs[team].milestones[index].complete;
    }

    function getTotalUnlockedPct(address team) external view returns (uint8) {
        return configs[team].totalUnlockedPct;
    }

    function getRiskScore(address team) external view returns (uint16) {
        return configs[team].riskScore;
    }

    function getLastDispatchedTier(address team) external view returns (uint8) {
        return configs[team].lastDispatchedTier;
    }

    function getPoolTeam(bytes32 poolId) external view returns (address) {
        return poolToTeam[poolId];
    }

    function getTeamLPLocked(address team) external view returns (uint256) {
        return configs[team].lpLocked;
    }

    function getSignalState(address team, uint8 signalId) external view returns (
        uint256 triggeredAt, uint16 basePoints, uint16 decayPerDay
    ) {
        SignalState storage sig = configs[team].signals[signalId];
        return (sig.triggeredAt, sig.basePoints, sig.decayPerDay);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    //       DYNAMIC SUBSCRIPTION REGISTRATION — RNK INSTANCE ONLY
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Called via Callback from the ReactVM after a PositionRegistered event.
     *         Registers per-team event subscriptions via the system contract.
     * @dev rnOnly: only runs on the RNK (Lasna) instance, never in the ReactVM.
     *      The first argument is the RVM ID injected by Reactive Network (ignored).
     * @param rvm_id     RVM ID — injected by Reactive Network, not used
     * @param team       Team address from the PositionRegistered event
     * @param tokenAddr  Token address for Transfer event monitoring
     * @param poolId     Pool ID for PoolMetricsUpdated / CrashDetected filtering
     */
    function subscribeToTeam(
        address rvm_id,    /* injected & overwritten by Reactive Network — not used */
        address team,
        address tokenAddr,
        bytes32 poolId
    ) external rnOnly {
        // Persist minimal team index state on RNK copy.
        // If ReactVM execution context is recreated between events, this makes
        // pool/team lookup available for subsequent react() invocations.
        TeamConfig storage cfg = configs[team];
        cfg.team = team;
        cfg.tokenAddr = tokenAddr;
        cfg.poolId = poolId;
        if (cfg.deployer == address(0)) {
            cfg.deployer = team;
        }
        cfg.isIndexed = true;

        poolToTeam[poolId] = team;
        walletToTeam[team] = team;

        emit DebugSubscribeToTeamCalled(rvm_id, team, tokenAddr, poolId);

        // PoolMetricsUpdated filtered by poolId (topic1)
        service.subscribe(
            ORIGIN_CHAIN_ID, HOOK_ADDR,
            POOL_METRICS_TOPIC,
            uint256(poolId),
            REACTIVE_IGNORE, REACTIVE_IGNORE
        );

        // CrashDetected filtered by poolId (topic1)
        service.subscribe(
            ORIGIN_CHAIN_ID, HOOK_ADDR,
            CRASH_TOPIC,
            uint256(poolId),
            REACTIVE_IGNORE, REACTIVE_IGNORE
        );

        // PositionLocked filtered by team address (topic1)
        service.subscribe(
            ORIGIN_CHAIN_ID, HOOK_ADDR,
            POSITION_LOCKED_TOPIC,
            uint256(uint160(team)),
            REACTIVE_IGNORE, REACTIVE_IGNORE
        );

        // ERC20 Transfer from team/deployer address (topic1 = from)
        service.subscribe(
            ORIGIN_CHAIN_ID, tokenAddr,
            TRANSFER_TOPIC,
            uint256(uint160(team)),
            REACTIVE_IGNORE, REACTIVE_IGNORE
        );
    }

}
