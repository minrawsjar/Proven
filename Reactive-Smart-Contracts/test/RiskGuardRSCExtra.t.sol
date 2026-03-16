// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {RiskGuardRSC} from "../src/RiskGuardRSC.sol";
import {IReactive} from "reactive-lib/interfaces/IReactive.sol";

contract MockSystemService {
    uint256 public subscribeCalls;

    receive() external payable {}

    function debt(address) external pure returns (uint256) {
        return 0;
    }

    function subscribe(uint256, address, uint256, uint256, uint256, uint256) external {
        subscribeCalls++;
    }

    function unsubscribe(uint256, address, uint256, uint256, uint256, uint256) external {}
}

contract RiskGuardRSCExtraTest is Test {
    RiskGuardRSC internal rsc;

    uint256 constant ORIGIN_CHAIN = 1301;
    uint256 constant CALLBACK_CHAIN = 1301;

    address constant TEAM = address(0xBEEF);
    address constant TOKEN = address(0xDEAD);
    address constant GENESIS = address(0xCAFE);
    bytes32 constant POOL_ID = bytes32(uint256(0x1234));

    function setUp() public {
        rsc = new RiskGuardRSC(ORIGIN_CHAIN, CALLBACK_CHAIN, address(0x1111), address(0x2222));
        rsc.registerMilestones(
            POOL_ID,
            TEAM,
            [uint256(0), uint256(1), uint256(2)],
            [uint256(1_000_000), uint256(5_000_000), uint256(500)],
            [uint8(34), uint8(33), uint8(33)]
        );
    }

    function test_watchTier_emitsWithoutCallback() public {
        _lockLP(TEAM, POOL_ID, 1000e18);

        rsc.react(_buildCrashLog(35)); // S3 => WATCH tier

        assertEq(rsc.getLastDispatchedTier(TEAM), 1);
        assertEq(rsc.totalCallbacks(), 0);
    }

    function test_alertTier_dispatchesPauseCallback() public {
        _lockLP(TEAM, POOL_ID, 1000e18);

        rsc.react(_buildCrashLog(35));
        vm.warp(block.timestamp + 2 days); // avoid combo bonus escalating to RAGE tier
        rsc.react(_buildMetricsLog(100, 90, 1)); // S4 -> total 60 => ALERT

        assertEq(rsc.getLastDispatchedTier(TEAM), 2);
        assertEq(rsc.totalCallbacks(), 1);
    }

    function test_s2_genesisOutflow_triggersSignal() public {
        _lockLP(TEAM, POOL_ID, 1000e18);
        rsc.addGenesisWallet(TEAM, GENESIS);

        IReactive.LogRecord memory transferLog = IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: TOKEN,
            topic_0: uint256(keccak256("Transfer(address,address,uint256)")),
            topic_1: uint256(uint160(GENESIS)),
            topic_2: uint256(uint160(address(0x9999))),
            topic_3: 0,
            data: abi.encode(uint256(200e18)),
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });

        rsc.react(transferLog);

        (uint256 triggeredAt, uint16 basePoints, ) = rsc.getSignalState(TEAM, 1);
        assertGt(triggeredAt, 0);
        assertEq(basePoints, 40);
    }

    function test_transferFallback_usesSenderAsTeamWhenUnknown() public {
        address unknownSender = address(0xA11CE);

        IReactive.LogRecord memory transferLog = IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: TOKEN,
            topic_0: uint256(keccak256("Transfer(address,address,uint256)")),
            topic_1: uint256(uint160(unknownSender)),
            topic_2: uint256(uint160(address(0x9999))),
            topic_3: 0,
            data: abi.encode(uint256(101 ether)),
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });

        rsc.react(transferLog);

        (uint256 triggeredAt, uint16 basePoints, ) = rsc.getSignalState(unknownSender, 0);
        assertGt(triggeredAt, 0);
        assertEq(basePoints, 45);
    }

    function test_pendingGenesis_autoLinkWithinWindow() public {
        _indexTeam(TEAM, TOKEN, POOL_ID);
        _lockLP(TEAM, POOL_ID, 1000e18);

        // Deployer sends to new wallet -> candidate linked
        rsc.react(_buildTransferLog(TEAM, GENESIS, 1e18));

        // Candidate sends out quickly -> should auto-link and trigger S2
        rsc.react(_buildTransferLog(GENESIS, address(0x7777), 200e18));

        assertEq(rsc.walletToTeam(GENESIS), TEAM);
        (uint256 triggeredAt, uint16 basePoints, ) = rsc.getSignalState(TEAM, 1);
        assertGt(triggeredAt, 0);
        assertEq(basePoints, 40);
    }

    function test_pendingGenesis_expiredDoesNotAutoLink() public {
        _indexTeam(TEAM, TOKEN, POOL_ID);
        _lockLP(TEAM, POOL_ID, 1000e18);

        rsc.react(_buildTransferLog(TEAM, GENESIS, 1e18));
        vm.warp(block.timestamp + 2 days);

        // Expired candidate; fallback should evaluate sender as its own team (S1 fallback)
        rsc.react(_buildTransferLog(GENESIS, address(0x7777), 101 ether));

        assertEq(rsc.walletToTeam(GENESIS), address(0));
        (uint256 triggeredAt, uint16 basePoints, ) = rsc.getSignalState(GENESIS, 0);
        assertGt(triggeredAt, 0);
        assertEq(basePoints, 45);
    }

    function test_unknownTopic_onlyIncrementsReactCounter() public {
        uint256 before = rsc.totalReactCalls();

        IReactive.LogRecord memory log = IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: address(0x1234),
            topic_0: 0xDEADBEEF,
            topic_1: 0,
            topic_2: 0,
            topic_3: 0,
            data: "",
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });

        rsc.react(log);

        assertEq(rsc.totalReactCalls(), before + 1);
        assertEq(rsc.totalCallbacks(), 0);
    }

    function test_callbackDebugProbe_authorizedPathCovered() public {
        // Equivalent path lives in ProvenCallback; here we ensure RiskGuardRSC debug callback emission path runs.
        rsc.react(_buildMetricsLog(0, 0, 0));
        assertEq(rsc.totalReactCalls(), 1);
    }

    function _lockLP(address team, bytes32 poolId, uint256 amount) internal {
        IReactive.LogRecord memory log = IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: address(0x1111),
            topic_0: uint256(keccak256("PositionLocked(address,bytes32,uint256)")),
            topic_1: uint256(uint160(team)),
            topic_2: uint256(poolId),
            topic_3: 0,
            data: abi.encode(amount),
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
        rsc.react(log);
    }

    function _indexTeam(address team, address token, bytes32 poolId) internal {
        IReactive.LogRecord memory log = IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: address(0x1111),
            topic_0: uint256(keccak256("PositionRegistered(address,address,bytes32)")),
            topic_1: uint256(uint160(team)),
            topic_2: uint256(uint160(token)),
            topic_3: uint256(poolId),
            data: "",
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
        rsc.react(log);
    }

    function _buildMetricsLog(uint256 tvl, uint256 vol, uint256 users) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: address(0x1111),
            topic_0: uint256(keccak256("PoolMetricsUpdated(bytes32,uint256,uint256,uint256)")),
            topic_1: uint256(POOL_ID),
            topic_2: 0,
            topic_3: 0,
            data: abi.encode(tvl, vol, users),
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }

    function _buildCrashLog(uint256 dropPct) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: address(0x1111),
            topic_0: uint256(keccak256("CrashDetected(bytes32,uint256)")),
            topic_1: uint256(POOL_ID),
            topic_2: 0,
            topic_3: 0,
            data: abi.encode(dropPct),
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }

    function _buildTransferLog(address from, address to, uint256 amount) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: TOKEN,
            topic_0: uint256(keccak256("Transfer(address,address,uint256)")),
            topic_1: uint256(uint160(from)),
            topic_2: uint256(uint160(to)),
            topic_3: 0,
            data: abi.encode(amount),
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }
}

contract RiskGuardRSCRnOnlyTest is Test {
    RiskGuardRSC internal rsc;
    MockSystemService internal service;

    uint256 constant ORIGIN_CHAIN = 1301;
    uint256 constant CALLBACK_CHAIN = 1301;
    address constant SYSTEM_ADDR = 0x0000000000000000000000000000000000fffFfF;

    function setUp() public {
        service = new MockSystemService();
        vm.etch(SYSTEM_ADDR, address(service).code);

        rsc = new RiskGuardRSC(ORIGIN_CHAIN, CALLBACK_CHAIN, address(0x1111), address(0x2222));
    }

    function test_bootstrapPositionRegSubscription_rnOnlyOwner() public {
        uint256 before = _subscribeCallsAtSystemAddress();
        rsc.bootstrapPositionRegSubscription();
        assertEq(_subscribeCallsAtSystemAddress(), before + 1);
    }

    function test_bootstrapPositionRegSubscription_revertOnlyOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(abi.encodeWithSelector(RiskGuardRSC.OnlyOwner.selector));
        rsc.bootstrapPositionRegSubscription();
    }

    function test_subscribeToTeam_and_addGenesisWallet_registerSubscriptions() public {
        uint256 before = _subscribeCallsAtSystemAddress();

        rsc.subscribeToTeam(address(0), address(0xBEEF), address(0xCAFE), bytes32(uint256(0x1234)));
        // 4 subscriptions in subscribeToTeam
        assertEq(_subscribeCallsAtSystemAddress(), before + 4);

        rsc.addGenesisWallet(address(0xBEEF), address(0xBABE));
        assertEq(rsc.walletToTeam(address(0xBABE)), address(0xBEEF));
        assertEq(_subscribeCallsAtSystemAddress(), before + 5);
    }

    function _subscribeCallsAtSystemAddress() internal view returns (uint256 calls_) {
        (bool ok, bytes memory data) = SYSTEM_ADDR.staticcall(abi.encodeWithSignature("subscribeCalls()"));
        require(ok, "read subscribeCalls failed");
        calls_ = abi.decode(data, (uint256));
    }
}
